const mongoose = require('mongoose');
const DemandePriere = require('../models/DemandePriere');

const PAR_PAGE = 20;

// Une demande vue par un fidèle (mur de prière ou "mes demandes")
const versFidele = (demande, utilisateurId) => {
  const auteur = demande.utilisateur && demande.utilisateur._id ? demande.utilisateur : null;
  const moi = auteur ? auteur._id.equals(utilisateurId) : String(demande.utilisateur) === String(utilisateurId);
  const masquer = demande.anonyme && !moi;
  return {
    _id: demande._id,
    texte: demande.texte,
    visibilite: demande.visibilite || 'privee',
    anonyme: Boolean(demande.anonyme),
    auteurNom: masquer ? 'Anonyme' : auteur?.nom || 'Fidèle',
    auteurPhoto: masquer ? null : auteur?.photoProfil || null,
    moi,
    nbPriants: demande.priants?.length || 0,
    jaiPrie: (demande.priants || []).some((id) => String(id) === String(utilisateurId)),
    exaucee: Boolean(demande.exaucee),
    temoignage: demande.temoignage || null,
    exauceeLe: demande.exauceeLe || null,
    createdAt: demande.createdAt,
  };
};

const idValide = (id) => mongoose.Types.ObjectId.isValid(id);

// @route POST /api/demandes-priere   { texte, visibilite?, anonyme? }
// Réservé aux fidèles connectés : envoie une demande de prière à l'admin
// de l'église suivie, et la publie sur le mur de prière si elle est publique.
const creerDemandePriere = async (req, res) => {
  try {
    const { texte } = req.body;

    if (!texte || !texte.trim()) {
      return res.status(400).json({ message: 'Veuillez écrire votre demande de prière.' });
    }

    const village = req.user.villagesSuivis?.[0];
    if (!village) {
      return res.status(400).json({
        message: "Vous devez d'abord choisir votre église dans le menu.",
      });
    }

    const demande = await DemandePriere.create({
      village,
      utilisateur: req.user._id,
      texte: texte.trim(),
      visibilite: req.body.visibilite === 'publique' ? 'publique' : 'privee',
      anonyme: req.body.anonyme === true,
    });

    res.status(201).json(demande);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/demandes-priere/mur?page=
// Fidèle : demandes publiques de son église, les plus récentes d'abord
const murDePriere = async (req, res) => {
  try {
    const village = req.user.villagesSuivis?.[0];
    if (!village) {
      return res.json({ demandes: [], page: 1, pages: 1 });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const filtre = { village, visibilite: 'publique' };
    const [demandes, total] = await Promise.all([
      DemandePriere.find(filtre)
        .populate('utilisateur', 'nom photoProfil')
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAR_PAGE)
        .limit(PAR_PAGE),
      DemandePriere.countDocuments(filtre),
    ]);
    res.json({
      demandes: demandes.map((d) => versFidele(d, req.user._id)),
      page,
      pages: Math.max(1, Math.ceil(total / PAR_PAGE)),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/demandes-priere/mes-demandes
const mesDemandes = async (req, res) => {
  try {
    const demandes = await DemandePriere.find({ utilisateur: req.user._id })
      .populate('utilisateur', 'nom photoProfil')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(demandes.map((d) => versFidele(d, req.user._id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/demandes-priere/:id/prie
// "J'ai prié" (un second appui retire le compteur) : demandes publiques de
// son église, ou ses propres demandes
const basculerPriere = async (req, res) => {
  try {
    if (!idValide(req.params.id)) {
      return res.status(404).json({ message: 'Demande introuvable.' });
    }
    const demande = await DemandePriere.findById(req.params.id);
    if (!demande) {
      return res.status(404).json({ message: 'Demande introuvable.' });
    }
    const estAuteur = demande.utilisateur.equals(req.user._id);
    const membre = (req.user.villagesSuivis || []).some((v) => v.equals(demande.village));
    if (!estAuteur && !(membre && demande.visibilite === 'publique')) {
      return res.status(403).json({ message: 'Cette demande de prière ne vous est pas accessible.' });
    }

    const dejaPrie = demande.priants.some((id) => id.equals(req.user._id));
    // Mise à jour atomique : pas de double comptage
    const aJour = await DemandePriere.findByIdAndUpdate(
      demande._id,
      dejaPrie ? { $pull: { priants: req.user._id } } : { $addToSet: { priants: req.user._id } },
      { new: true }
    ).populate('utilisateur', 'nom photoProfil');

    res.json(versFidele(aJour, req.user._id));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// Demande de l'auteur connecté, ou null (réponse déjà envoyée)
const demandeDeLAuteur = async (req, res) => {
  if (!idValide(req.params.id)) {
    res.status(404).json({ message: 'Demande introuvable.' });
    return null;
  }
  const demande = await DemandePriere.findById(req.params.id);
  if (!demande) {
    res.status(404).json({ message: 'Demande introuvable.' });
    return null;
  }
  if (!demande.utilisateur.equals(req.user._id)) {
    res.status(403).json({ message: "Seul l'auteur de la demande peut faire cela." });
    return null;
  }
  return demande;
};

// @route PUT /api/demandes-priere/:id/exaucee   { exaucee: true|false, temoignage? }
// L'auteur annonce que sa prière est exaucée, avec son témoignage
const marquerExaucee = async (req, res) => {
  try {
    const demande = await demandeDeLAuteur(req, res);
    if (!demande) return;

    if (req.body.exaucee === false) {
      demande.exaucee = false;
      demande.temoignage = undefined;
      demande.exauceeLe = undefined;
    } else {
      const temoignage = String(req.body.temoignage || '').trim();
      if (temoignage.length > 2000) {
        return res.status(400).json({ message: 'Témoignage trop long (2000 caractères maximum).' });
      }
      demande.exaucee = true;
      demande.temoignage = temoignage || undefined;
      demande.exauceeLe = demande.exauceeLe || new Date();
    }
    await demande.save();
    await demande.populate('utilisateur', 'nom photoProfil');
    res.json(versFidele(demande, req.user._id));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/demandes-priere/:id/mienne
const supprimerMaDemande = async (req, res) => {
  try {
    const demande = await demandeDeLAuteur(req, res);
    if (!demande) return;
    await demande.deleteOne();
    res.json({ message: 'Demande supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/demandes-priere/mon-village
// Réservé au Village Admin : demandes de prière reçues par son église.
const demandesDeMonVillage = async (req, res) => {
  try {
    const demandes = await DemandePriere.find({ village: req.user.village })
      .populate('utilisateur', 'nom telephone')
      .sort({ createdAt: -1 });

    res.json(
      demandes.map((d) => ({
        ...d.toObject(),
        priants: undefined,
        nbPriants: d.priants?.length || 0,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/demandes-priere/:id/statut
// Réservé au Village Admin : marque une demande comme priée (ou la rouvre).
const changerStatutDemande = async (req, res) => {
  try {
    const demande = await DemandePriere.findById(req.params.id);
    if (!demande) {
      return res.status(404).json({ message: 'Demande introuvable.' });
    }
    if (demande.village.toString() !== req.user.village.toString()) {
      return res.status(403).json({ message: 'Cette demande ne concerne pas votre église.' });
    }

    demande.statut = demande.statut === 'traitee' ? 'nouvelle' : 'traitee';
    await demande.save();
    await demande.populate('utilisateur', 'nom telephone');

    res.json({ ...demande.toObject(), priants: undefined, nbPriants: demande.priants?.length || 0 });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/demandes-priere/:id/retirer-du-mur
// Réservé au Village Admin (modération) : la demande redevient privée
const retirerDuMur = async (req, res) => {
  try {
    if (!idValide(req.params.id)) {
      return res.status(404).json({ message: 'Demande introuvable.' });
    }
    const demande = await DemandePriere.findOne({ _id: req.params.id, village: req.user.village });
    if (!demande) {
      return res.status(404).json({ message: 'Demande introuvable.' });
    }
    demande.visibilite = 'privee';
    await demande.save();
    await demande.populate('utilisateur', 'nom telephone');
    res.json({ ...demande.toObject(), priants: undefined, nbPriants: demande.priants?.length || 0 });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/demandes-priere/:id
// Réservé au Village Admin : supprime une demande de son église.
const supprimerDemande = async (req, res) => {
  try {
    const demande = await DemandePriere.findById(req.params.id);
    if (!demande) {
      return res.status(404).json({ message: 'Demande introuvable.' });
    }
    if (demande.village.toString() !== req.user.village.toString()) {
      return res.status(403).json({ message: 'Cette demande ne concerne pas votre église.' });
    }

    await demande.deleteOne();
    res.json({ message: 'Demande supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  creerDemandePriere,
  murDePriere,
  mesDemandes,
  basculerPriere,
  marquerExaucee,
  supprimerMaDemande,
  demandesDeMonVillage,
  changerStatutDemande,
  retirerDuMur,
  supprimerDemande,
};
