const crypto = require('crypto');
const mongoose = require('mongoose');
const Evenement = require('../models/Evenement');
const {
  genererIcs,
  lienGoogleAgenda,
  envoyerRappelsDus,
  dateLocale,
  heureLocale,
} = require('../services/agendaService');
const { notifierFidelesDuVillage } = require('../services/notificationService');

const idValide = (id) => mongoose.Types.ObjectId.isValid(id);

// Un événement vu par l'app : sans la liste des participants, mais avec
// leur nombre et la situation du fidèle connecté
const versClient = (evenement, utilisateur) => {
  const participation = utilisateur
    ? evenement.participants.find((p) => p.utilisateur.toString() === utilisateur._id.toString())
    : null;
  const nomEglise = evenement.village?.nom || '';
  return {
    _id: evenement._id,
    village: evenement.village?.nom ? { _id: evenement.village._id, nom: nomEglise } : evenement.village,
    titre: evenement.titre,
    description: evenement.description,
    lieu: evenement.lieu,
    dateDebut: evenement.dateDebut,
    dateFin: evenement.dateFin || null,
    photo: evenement.photo || null,
    nombreParticipants: evenement.participants.length,
    jeParticipe: Boolean(participation),
    rappelActif: Boolean(participation?.rappel),
    lienGoogleAgenda: lienGoogleAgenda(evenement, nomEglise),
  };
};

// @route GET /api/evenements/village/:villageId?periode=a_venir|passes&limite=
// Public (personnalisé si connecté) : agenda d'une église
const listerEvenements = async (req, res) => {
  try {
    if (!idValide(req.params.villageId)) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }
    const passes = req.query.periode === 'passes';
    const limite = Math.min(100, Math.max(1, parseInt(req.query.limite, 10) || 50));
    const maintenant = new Date();

    // "À venir" garde les événements en cours (commencés il y a moins de 6 h)
    const seuil = passes ? maintenant : new Date(maintenant.getTime() - 6 * 60 * 60 * 1000);
    const evenements = await Evenement.find({
      village: req.params.villageId,
      dateDebut: passes ? { $lt: seuil } : { $gte: seuil },
    })
      .sort({ dateDebut: passes ? -1 : 1 })
      .limit(limite)
      .populate('village', 'nom');

    res.json(evenements.map((e) => versClient(e, req.user)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/evenements/:id
const obtenirEvenement = async (req, res) => {
  try {
    if (!idValide(req.params.id)) {
      return res.status(404).json({ message: 'Événement introuvable.' });
    }
    const evenement = await Evenement.findById(req.params.id).populate('village', 'nom');
    if (!evenement) {
      return res.status(404).json({ message: 'Événement introuvable.' });
    }
    res.json(versClient(evenement, req.user));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// Événement de l'église du fidèle connecté (403 sinon)
const evenementDuFidele = async (req, res) => {
  if (!idValide(req.params.id)) {
    res.status(404).json({ message: 'Événement introuvable.' });
    return null;
  }
  const evenement = await Evenement.findById(req.params.id);
  if (!evenement) {
    res.status(404).json({ message: 'Événement introuvable.' });
    return null;
  }
  const membre = (req.user.villagesSuivis || []).some(
    (v) => v.toString() === evenement.village.toString()
  );
  if (!membre) {
    res.status(403).json({ message: 'Cet événement concerne une autre église.' });
    return null;
  }
  return evenement;
};

// @route POST /api/evenements/:id/participer
// Fidèle : "Je participe" (une seconde fois : annule sa participation)
const basculerParticipation = async (req, res) => {
  try {
    const evenement = await evenementDuFidele(req, res);
    if (!evenement) return;

    const dejaInscrit = evenement.participants.some(
      (p) => p.utilisateur.toString() === req.user._id.toString()
    );
    if (!dejaInscrit && evenement.finEffective() < new Date()) {
      return res.status(400).json({ message: 'Cet événement est déjà terminé.' });
    }

    // Mise à jour atomique : pas de doublon même en cas de double appui
    const misAJour = await Evenement.findByIdAndUpdate(
      evenement._id,
      dejaInscrit
        ? { $pull: { participants: { utilisateur: req.user._id } } }
        : { $push: { participants: { utilisateur: req.user._id, rappel: true } } },
      { new: true }
    ).populate('village', 'nom');

    res.json(versClient(misAJour, req.user));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/evenements/:id/rappel   { actif: true|false }
// Fidèle participant : active ou coupe les notifications de rappel
const changerRappel = async (req, res) => {
  try {
    const evenement = await evenementDuFidele(req, res);
    if (!evenement) return;

    const misAJour = await Evenement.findOneAndUpdate(
      { _id: evenement._id, 'participants.utilisateur': req.user._id },
      { $set: { 'participants.$.rappel': req.body.actif !== false } },
      { new: true }
    ).populate('village', 'nom');
    if (!misAJour) {
      return res.status(400).json({ message: "Indiquez d'abord que vous participez." });
    }
    res.json(versClient(misAJour, req.user));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/evenements/:id/calendrier.ics
// Public : fichier à ouvrir avec l'agenda du téléphone
const calendrierEvenement = async (req, res) => {
  try {
    if (!idValide(req.params.id)) return res.status(404).send('Événement introuvable.');
    const evenement = await Evenement.findById(req.params.id).populate('village', 'nom');
    if (!evenement) return res.status(404).send('Événement introuvable.');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="evenement-epuici.ics"');
    res.send(genererIcs(evenement, evenement.village?.nom));
  } catch (error) {
    res.status(500).send('Erreur serveur.');
  }
};

// --- Espace admin de l'église (admin et trésorier) ---

// Champs saisis dans l'admin, validés. Renvoie { donnees } ou { erreur }.
const lireFormulaire = (corps, existant = {}) => {
  const titre = corps.titre !== undefined ? String(corps.titre).trim() : existant.titre;
  if (!titre) return { erreur: "Le titre de l'événement est obligatoire." };

  const dateDebut = corps.dateDebut ? new Date(corps.dateDebut) : existant.dateDebut;
  if (!dateDebut || Number.isNaN(dateDebut.getTime())) {
    return { erreur: 'La date et l\'heure de début sont obligatoires.' };
  }
  let dateFin = existant.dateFin;
  if (corps.dateFin !== undefined) dateFin = corps.dateFin ? new Date(corps.dateFin) : undefined;
  if (dateFin && (Number.isNaN(dateFin.getTime()) || dateFin <= dateDebut)) {
    return { erreur: 'La fin doit être après le début.' };
  }

  return {
    donnees: {
      titre: titre.slice(0, 150),
      description: corps.description !== undefined ? String(corps.description).trim() : existant.description,
      lieu: corps.lieu !== undefined ? String(corps.lieu).trim() : existant.lieu,
      dateDebut,
      dateFin: dateFin || null,
    },
  };
};

// @route GET /api/evenements/mon-eglise
const evenementsDeMonEglise = async (req, res) => {
  try {
    const evenements = await Evenement.find({ village: req.user.village }).sort({ dateDebut: -1 });
    res.json(
      evenements.map((e) => ({
        ...versClient(e),
        participants: undefined,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/evenements  (multipart : champs + photo facultative)
const creerEvenement = async (req, res) => {
  try {
    const { donnees, erreur } = lireFormulaire(req.body);
    if (erreur) return res.status(400).json({ message: erreur });
    if (donnees.dateDebut < new Date(Date.now() - 60 * 60 * 1000)) {
      return res.status(400).json({ message: 'La date de début est déjà passée.' });
    }

    const evenement = await Evenement.create({
      ...donnees,
      village: req.user.village,
      auteur: req.user._id,
      photo: req.file?.path,
    });

    if (req.body.notifier !== 'false') {
      notifierFidelesDuVillage(req.user.village, {
        title: 'Nouvel événement',
        body: `${evenement.titre} — ${dateLocale(evenement.dateDebut)} à ${heureLocale(evenement.dateDebut)}`,
        data: { type: 'evenement', evenementId: evenement._id.toString() },
      });
    }

    res.status(201).json(versClient(evenement));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

const evenementDeMonEglise = async (req, res) => {
  if (!idValide(req.params.id)) {
    res.status(404).json({ message: 'Événement introuvable.' });
    return null;
  }
  const evenement = await Evenement.findOne({ _id: req.params.id, village: req.user.village });
  if (!evenement) {
    res.status(404).json({ message: 'Événement introuvable.' });
    return null;
  }
  return evenement;
};

// @route PUT /api/evenements/:id  (multipart)
const modifierEvenement = async (req, res) => {
  try {
    const evenement = await evenementDeMonEglise(req, res);
    if (!evenement) return;

    const { donnees, erreur } = lireFormulaire(req.body, evenement);
    if (erreur) return res.status(400).json({ message: erreur });

    // Date changée : les rappels seront renvoyés pour la nouvelle date
    if (donnees.dateDebut.getTime() !== evenement.dateDebut.getTime()) {
      evenement.rappelVeilleEnvoyeLe = null;
      evenement.rappelHeureEnvoyeLe = null;
    }
    Object.assign(evenement, donnees);
    if (req.file) evenement.photo = req.file.path;
    if (req.body.retirerPhoto === 'true' && !req.file) evenement.photo = undefined;
    await evenement.save();

    res.json(versClient(evenement));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/evenements/:id
const supprimerEvenement = async (req, res) => {
  try {
    const evenement = await evenementDeMonEglise(req, res);
    if (!evenement) return;
    await evenement.deleteOne();
    res.json({ message: 'Événement supprimé.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/evenements/:id/participants
const participantsEvenement = async (req, res) => {
  try {
    const evenement = await evenementDeMonEglise(req, res);
    if (!evenement) return;
    await evenement.populate('participants.utilisateur', 'nom telephone');
    res.json(
      evenement.participants
        .filter((p) => p.utilisateur)
        .map((p) => ({
          _id: p.utilisateur._id,
          nom: p.utilisateur.nom || 'Fidèle',
          telephone: p.utilisateur.telephone,
          inscritLe: p.inscritLe,
        }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/evenements/rappels/executer
// Tâche planifiée externe (en-tête X-Cron-Secret = CRON_SECRET)
const executerRappels = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const recu = Buffer.from(String(req.headers['x-cron-secret'] || ''));
  const attendu = Buffer.from(secret || '');
  const valide =
    Boolean(secret) && recu.length === attendu.length && crypto.timingSafeEqual(recu, attendu);
  if (!valide) {
    return res.status(401).json({ message: 'Non autorisé.' });
  }
  try {
    const envoyes = await envoyerRappelsDus();
    res.json({ message: 'Rappels vérifiés.', notificationsEnvoyees: envoyes });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  listerEvenements,
  obtenirEvenement,
  basculerParticipation,
  changerRappel,
  calendrierEvenement,
  evenementsDeMonEglise,
  creerEvenement,
  modifierEvenement,
  supprimerEvenement,
  participantsEvenement,
  executerRappels,
};
