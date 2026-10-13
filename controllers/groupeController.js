const mongoose = require('mongoose');
const Groupe = require('../models/Groupe');
const DemandeGroupe = require('../models/DemandeGroupe');
const MessageGroupe = require('../models/MessageGroupe');
const Utilisateur = require('../models/Utilisateur');
const { envoyerNotificationsMulticast } = require('../services/notificationService');
const { cloudinary } = require('../config/cloudinary');

const contientId = (liste, id) => liste.some((element) => element.equals(id));

// Envoie une notification push à une liste d'utilisateurs (sans bloquer la réponse)
const notifierUtilisateurs = async (idsUtilisateurs, contenu) => {
  try {
    const destinataires = await Utilisateur.find({
      _id: { $in: idsUtilisateurs },
      tokenNotification: { $exists: true, $ne: null },
    }).select('tokenNotification');
    const tokens = destinataires.map((u) => u.tokenNotification).filter(Boolean);
    await envoyerNotificationsMulticast(tokens, contenu);
  } catch (error) {
    console.error('Erreur notification groupe:', error.message);
  }
};

// Ne garde que les fidèles qui suivent bien l'église (abonnés)
const filtrerResponsablesValides = async (ids, villageId) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const idsValides = ids.filter((id) => mongoose.isValidObjectId(id));
  const abonnes = await Utilisateur.find({
    _id: { $in: idsValides },
    villagesSuivis: villageId,
  }).select('_id');
  return abonnes.map((u) => u._id);
};

// Charge le groupe et vérifie que l'utilisateur connecté en est membre
const chargerGroupePourMembre = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ message: 'Groupe introuvable.' });
    return null;
  }
  const groupe = await Groupe.findById(req.params.id);
  if (!groupe) {
    res.status(404).json({ message: 'Groupe introuvable.' });
    return null;
  }
  if (!contientId(groupe.membres, req.user._id)) {
    res.status(403).json({ message: "Vous n'êtes pas membre de ce groupe." });
    return null;
  }
  return groupe;
};

// Middleware des routes de messages : vérifie l'adhésion AVANT l'envoi d'un
// éventuel fichier vers Cloudinary, puis transmet le groupe via req.groupe.
const exigerMembreGroupe = async (req, res, next) => {
  try {
    const groupe = await chargerGroupePourMembre(req, res);
    if (!groupe) return;
    req.groupe = groupe;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// Les audios sont stockés en resource_type "video" chez Cloudinary
const typeRessourceCloudinary = (typeMessage) => (typeMessage === 'audio' ? 'video' : 'image');

// Supprime de Cloudinary les fichiers des messages donnés (sans bloquer en cas d'échec)
const supprimerMedias = async (messages) => {
  for (const typeMessage of ['photo', 'audio']) {
    const ids = messages
      .filter((m) => m.type === typeMessage && m.mediaPublicId)
      .map((m) => m.mediaPublicId);
    for (let i = 0; i < ids.length; i += 100) {
      try {
        await cloudinary.api.delete_resources(ids.slice(i, i + 100), {
          resource_type: typeRessourceCloudinary(typeMessage),
          invalidate: true, // vide aussi le cache du CDN
        });
      } catch (error) {
        console.error('Erreur suppression médias Cloudinary :', error.message);
      }
    }
  }
};

const apercuMessage = (message) => {
  if (message.type === 'photo') return message.texte ? `📷 ${message.texte}` : '📷 Photo';
  if (message.type === 'audio') return '🎤 Message vocal';
  return message.texte;
};

const formaterMessage = (message, groupe, utilisateurId) => {
  const auteur = message.auteur && message.auteur._id ? message.auteur : null;
  return {
    _id: message._id,
    type: message.type || 'texte',
    texte: message.texte || '',
    mediaUrl: message.mediaUrl,
    dureeAudio: message.dureeAudio,
    createdAt: message.createdAt,
    auteur: auteur ? { _id: auteur._id, nom: auteur.nom, photoProfil: auteur.photoProfil } : null,
    estResponsable: auteur ? contientId(groupe.responsables, auteur._id) : false,
    moi: auteur ? auteur._id.equals(utilisateurId) : false,
  };
};

// ---------------------------------------------------------------------------
// Admin de l'église
// ---------------------------------------------------------------------------

// @route GET /api/groupes/mon-eglise
const groupesDeMonEglise = async (req, res) => {
  try {
    const groupes = await Groupe.find({ village: req.user.village })
      .populate('responsables', 'nom telephone')
      .sort({ nom: 1 });

    const demandesParGroupe = await DemandeGroupe.aggregate([
      { $match: { groupe: { $in: groupes.map((g) => g._id) }, statut: 'en_attente' } },
      { $group: { _id: '$groupe', total: { $sum: 1 } } },
    ]);
    const demandes = Object.fromEntries(demandesParGroupe.map((d) => [d._id.toString(), d.total]));

    res.json(
      groupes.map((g) => ({
        _id: g._id,
        nom: g.nom,
        description: g.description,
        responsables: g.responsables,
        nbMembres: g.membres.length,
        nbDemandesEnAttente: demandes[g._id.toString()] || 0,
        dernierMessageLe: g.dernierMessageLe,
        createdAt: g.createdAt,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/groupes
// Réservé à l'admin de l'église, abonnement actif obligatoire
const creerGroupe = async (req, res) => {
  try {
    const { nom, description, responsables } = req.body;
    if (!nom || !nom.trim()) {
      return res.status(400).json({ message: 'Le nom du groupe est obligatoire.' });
    }

    const existant = await Groupe.findOne({ village: req.user.village, nom: nom.trim() });
    if (existant) {
      return res.status(400).json({ message: 'Un groupe porte déjà ce nom dans votre église.' });
    }

    const idsResponsables = await filtrerResponsablesValides(responsables, req.user.village);

    const groupe = await Groupe.create({
      village: req.user.village,
      nom: nom.trim(),
      description: description || '',
      responsables: idsResponsables,
      membres: idsResponsables,
      creePar: req.user._id,
    });

    res.status(201).json(groupe);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/groupes/:id
// Modifie le nom, la description et/ou les responsables du groupe
const modifierGroupe = async (req, res) => {
  try {
    const groupe = await Groupe.findOne({ _id: req.params.id, village: req.user.village });
    if (!groupe) {
      return res.status(404).json({ message: 'Groupe introuvable.' });
    }

    const { nom, description, responsables } = req.body;

    if (nom !== undefined) {
      if (!nom.trim()) {
        return res.status(400).json({ message: 'Le nom du groupe est obligatoire.' });
      }
      const doublon = await Groupe.findOne({
        village: req.user.village,
        nom: nom.trim(),
        _id: { $ne: groupe._id },
      });
      if (doublon) {
        return res.status(400).json({ message: 'Un groupe porte déjà ce nom dans votre église.' });
      }
      groupe.nom = nom.trim();
    }
    if (description !== undefined) groupe.description = description;

    if (responsables !== undefined) {
      const idsResponsables = await filtrerResponsablesValides(responsables, req.user.village);
      groupe.responsables = idsResponsables;
      // Un nouveau responsable devient automatiquement membre ; un ancien
      // responsable reste simple membre.
      for (const id of idsResponsables) {
        if (!contientId(groupe.membres, id)) groupe.membres.push(id);
      }
      // Ses éventuelles demandes en attente n'ont plus lieu d'être
      await DemandeGroupe.deleteMany({
        groupe: groupe._id,
        utilisateur: { $in: idsResponsables },
        statut: 'en_attente',
      });
    }

    await groupe.save();
    await groupe.populate('responsables', 'nom telephone');
    res.json(groupe);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/groupes/:id
// Supprime le groupe, ses demandes et tous ses messages
const supprimerGroupe = async (req, res) => {
  try {
    const groupe = await Groupe.findOne({ _id: req.params.id, village: req.user.village });
    if (!groupe) {
      return res.status(404).json({ message: 'Groupe introuvable.' });
    }

    const messagesAvecMedia = await MessageGroupe.find({
      groupe: groupe._id,
      mediaPublicId: { $exists: true },
    }).select('type mediaPublicId');
    await supprimerMedias(messagesAvecMedia);

    await DemandeGroupe.deleteMany({ groupe: groupe._id });
    await MessageGroupe.deleteMany({ groupe: groupe._id });
    await groupe.deleteOne();

    res.json({ message: 'Groupe supprimé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// ---------------------------------------------------------------------------
// Fidèles (app mobile)
// ---------------------------------------------------------------------------

// @route GET /api/groupes/eglise/:villageId
// Liste les groupes d'une église avec la situation du fidèle connecté
const groupesDeLEglise = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.villageId)) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }

    const groupes = await Groupe.find({ village: req.params.villageId }).sort({ nom: 1 });
    const demandesEnAttente = await DemandeGroupe.find({
      groupe: { $in: groupes.map((g) => g._id) },
      utilisateur: req.user._id,
      statut: 'en_attente',
    }).select('groupe');
    const idsEnAttente = demandesEnAttente.map((d) => d.groupe);

    res.json(
      groupes.map((g) => {
        let monStatut = 'aucun';
        if (contientId(g.responsables, req.user._id)) monStatut = 'responsable';
        else if (contientId(g.membres, req.user._id)) monStatut = 'membre';
        else if (contientId(idsEnAttente, g._id)) monStatut = 'en_attente';

        return {
          _id: g._id,
          nom: g.nom,
          description: g.description,
          nbMembres: g.membres.length,
          monStatut,
        };
      })
    );
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/groupes/mes-groupes
// Groupes dont le fidèle est membre, avec un aperçu du dernier message
const mesGroupes = async (req, res) => {
  try {
    const groupes = await Groupe.find({ membres: req.user._id })
      .populate('village', 'nom')
      .sort({ dernierMessageLe: -1, nom: 1 });

    const resultats = await Promise.all(
      groupes.map(async (g) => {
        const dernierMessage = await MessageGroupe.findOne({ groupe: g._id })
          .sort({ createdAt: -1 })
          .populate('auteur', 'nom');

        const estResponsable = contientId(g.responsables, req.user._id);
        const nbDemandesEnAttente = estResponsable
          ? await DemandeGroupe.countDocuments({ groupe: g._id, statut: 'en_attente' })
          : 0;

        return {
          _id: g._id,
          nom: g.nom,
          description: g.description,
          village: g.village,
          nbMembres: g.membres.length,
          monStatut: estResponsable ? 'responsable' : 'membre',
          nbDemandesEnAttente,
          dernierMessage: dernierMessage
            ? {
                texte: apercuMessage(dernierMessage),
                auteurNom: dernierMessage.auteur?.nom || 'Membre',
                createdAt: dernierMessage.createdAt,
              }
            : null,
        };
      })
    );

    res.json(resultats);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/groupes/:id/demande
// Le fidèle demande à rejoindre le groupe
const demanderAdhesion = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Groupe introuvable.' });
    }
    const groupe = await Groupe.findById(req.params.id);
    if (!groupe) {
      return res.status(404).json({ message: 'Groupe introuvable.' });
    }
    if (contientId(groupe.membres, req.user._id)) {
      return res.status(400).json({ message: 'Vous êtes déjà membre de ce groupe.' });
    }

    const dejaDemande = await DemandeGroupe.findOne({
      groupe: groupe._id,
      utilisateur: req.user._id,
      statut: 'en_attente',
    });
    if (dejaDemande) {
      return res.status(400).json({ message: 'Votre demande est déjà en attente.' });
    }

    const demande = await DemandeGroupe.create({ groupe: groupe._id, utilisateur: req.user._id });

    notifierUtilisateurs(groupe.responsables, {
      title: groupe.nom,
      body: `${req.user.nom || 'Un fidèle'} demande à rejoindre le groupe.`,
      data: { type: 'demande_groupe', groupeId: groupe._id.toString() },
    });

    res.status(201).json(demande);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/groupes/:id/demande
// Le fidèle annule sa demande en attente
const annulerDemande = async (req, res) => {
  try {
    await DemandeGroupe.deleteOne({
      groupe: req.params.id,
      utilisateur: req.user._id,
      statut: 'en_attente',
    });
    res.json({ message: 'Demande annulée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/groupes/:id/quitter
const quitterGroupe = async (req, res) => {
  try {
    const groupe = await chargerGroupePourMembre(req, res);
    if (!groupe) return;

    if (contientId(groupe.responsables, req.user._id)) {
      return res.status(400).json({
        message: "Vous êtes responsable de ce groupe. Demandez à l'admin de l'église de vous retirer ce rôle avant de quitter.",
      });
    }

    groupe.membres = groupe.membres.filter((id) => !id.equals(req.user._id));
    await groupe.save();
    res.json({ message: 'Vous avez quitté le groupe.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/groupes/:id
// Détails du groupe pour un membre : description, responsables, membres
const detailGroupe = async (req, res) => {
  try {
    const groupe = await chargerGroupePourMembre(req, res);
    if (!groupe) return;

    await groupe.populate([
      { path: 'village', select: 'nom' },
      { path: 'membres', select: 'nom photoProfil' },
    ]);

    const estResponsable = contientId(groupe.responsables, req.user._id);
    const nbDemandesEnAttente = estResponsable
      ? await DemandeGroupe.countDocuments({ groupe: groupe._id, statut: 'en_attente' })
      : 0;

    res.json({
      _id: groupe._id,
      nom: groupe.nom,
      description: groupe.description,
      village: groupe.village,
      monStatut: estResponsable ? 'responsable' : 'membre',
      nbDemandesEnAttente,
      membres: groupe.membres.map((m) => ({
        _id: m._id,
        nom: m.nom,
        photoProfil: m.photoProfil,
        estResponsable: contientId(groupe.responsables, m._id),
        moi: m._id.equals(req.user._id),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/groupes/:id/demandes
// Réservé aux responsables du groupe : demandes en attente
const demandesDuGroupe = async (req, res) => {
  try {
    const groupe = await chargerGroupePourMembre(req, res);
    if (!groupe) return;

    if (!contientId(groupe.responsables, req.user._id)) {
      return res.status(403).json({ message: 'Réservé aux responsables du groupe.' });
    }

    const demandes = await DemandeGroupe.find({ groupe: groupe._id, statut: 'en_attente' })
      .populate('utilisateur', 'nom telephone photoProfil')
      .sort({ createdAt: 1 });

    res.json(demandes);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/groupes/demandes/:demandeId
// Un responsable accepte ou refuse une demande. Body : { decision: 'acceptee' | 'refusee' }
const traiterDemande = async (req, res) => {
  try {
    const { decision } = req.body;
    if (!['acceptee', 'refusee'].includes(decision)) {
      return res.status(400).json({ message: 'Décision invalide.' });
    }
    if (!mongoose.isValidObjectId(req.params.demandeId)) {
      return res.status(404).json({ message: 'Demande introuvable.' });
    }

    const demande = await DemandeGroupe.findById(req.params.demandeId);
    if (!demande || demande.statut !== 'en_attente') {
      return res.status(404).json({ message: 'Demande introuvable ou déjà traitée.' });
    }

    const groupe = await Groupe.findById(demande.groupe);
    if (!groupe || !contientId(groupe.responsables, req.user._id)) {
      return res.status(403).json({ message: 'Réservé aux responsables du groupe.' });
    }

    demande.statut = decision;
    demande.traitePar = req.user._id;
    await demande.save();

    if (decision === 'acceptee' && !contientId(groupe.membres, demande.utilisateur)) {
      groupe.membres.push(demande.utilisateur);
      await groupe.save();
    }

    notifierUtilisateurs([demande.utilisateur], {
      title: groupe.nom,
      body:
        decision === 'acceptee'
          ? 'Votre demande a été acceptée. Bienvenue dans le groupe !'
          : "Votre demande pour rejoindre le groupe n'a pas été acceptée.",
      data: { type: 'reponse_demande_groupe', groupeId: groupe._id.toString() },
    });

    res.json({ message: decision === 'acceptee' ? 'Demande acceptée.' : 'Demande refusée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/groupes/:id/membres/:utilisateurId
// Un responsable retire un membre (qui n'est pas responsable) du groupe
const retirerMembre = async (req, res) => {
  try {
    const groupe = await chargerGroupePourMembre(req, res);
    if (!groupe) return;

    if (!contientId(groupe.responsables, req.user._id)) {
      return res.status(403).json({ message: 'Réservé aux responsables du groupe.' });
    }
    if (!mongoose.isValidObjectId(req.params.utilisateurId)) {
      return res.status(404).json({ message: 'Membre introuvable.' });
    }
    const idMembre = new mongoose.Types.ObjectId(req.params.utilisateurId);
    if (contientId(groupe.responsables, idMembre)) {
      return res.status(400).json({ message: 'Un responsable ne peut être retiré que par l\'admin de l\'église.' });
    }

    groupe.membres = groupe.membres.filter((id) => !id.equals(idMembre));
    await groupe.save();
    res.json({ message: 'Membre retiré du groupe.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/groupes/:id/messages?apres=<date>&avant=<date>&limite=50
// "apres" sert au rafraîchissement régulier de la discussion ouverte,
// "avant" au chargement des messages plus anciens. Résultat trié du plus
// ancien au plus récent.
const listerMessages = async (req, res) => {
  try {
    const groupe = await chargerGroupePourMembre(req, res);
    if (!groupe) return;

    const { apres, avant } = req.query;
    const limite = Math.min(Number(req.query.limite) || 50, 100);

    const filtre = { groupe: groupe._id };
    if (apres) filtre.createdAt = { $gt: new Date(apres) };
    else if (avant) filtre.createdAt = { $lt: new Date(avant) };

    let messages;
    if (apres) {
      messages = await MessageGroupe.find(filtre)
        .sort({ createdAt: 1 })
        .limit(limite)
        .populate('auteur', 'nom photoProfil');
    } else {
      messages = await MessageGroupe.find(filtre)
        .sort({ createdAt: -1 })
        .limit(limite)
        .populate('auteur', 'nom photoProfil');
      messages.reverse();
    }

    res.json(messages.map((m) => formaterMessage(m, groupe, req.user._id)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/groupes/:id/messages
// Body (JSON ou multipart) : texte, et pour un média le fichier "media"
// (photo ou vocal) avec dureeAudio en secondes pour un vocal.
// L'adhésion est vérifiée en amont par exigerMembreGroupe (req.groupe).
const envoyerMessage = async (req, res) => {
  const fichier = req.file;
  try {
    const groupe = req.groupe;
    const texte = (req.body.texte || '').trim();

    let type = 'texte';
    if (fichier) type = fichier.mimetype.startsWith('image/') ? 'photo' : 'audio';

    if (type === 'texte' && !texte) {
      return res.status(400).json({ message: 'Le message est vide.' });
    }
    if (texte.length > 2000) {
      if (fichier) await supprimerMedias([{ type, mediaPublicId: fichier.filename }]);
      return res.status(400).json({ message: 'Message trop long (2000 caractères maximum).' });
    }

    const duree = Number(req.body.dureeAudio);
    const message = await MessageGroupe.create({
      groupe: groupe._id,
      auteur: req.user._id,
      type,
      // Pas de légende sur un vocal
      texte: type === 'audio' ? undefined : texte || undefined,
      // Les photos HEIC (iPhone) ne s'affichent pas partout : Cloudinary les
      // convertit en JPG si on demande l'extension .jpg
      mediaUrl: fichier?.path?.replace(/\.(heic|heif)$/i, '.jpg'),
      mediaPublicId: fichier?.filename,
      dureeAudio: type === 'audio' && duree > 0 ? Math.round(duree) : undefined,
    });

    groupe.dernierMessageLe = message.createdAt;
    await groupe.save();

    const apercu = apercuMessage(message);
    const autresMembres = groupe.membres.filter((id) => !id.equals(req.user._id));
    notifierUtilisateurs(autresMembres, {
      title: groupe.nom,
      body: `${req.user.nom || 'Membre'} : ${apercu.length > 120 ? `${apercu.slice(0, 117)}...` : apercu}`,
      data: { type: 'message_groupe', groupeId: groupe._id.toString() },
    });

    res.status(201).json(formaterMessage({ ...message.toObject(), auteur: req.user }, groupe, req.user._id));
  } catch (error) {
    if (fichier) {
      supprimerMedias([
        { type: fichier.mimetype.startsWith('image/') ? 'photo' : 'audio', mediaPublicId: fichier.filename },
      ]);
    }
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  exigerMembreGroupe,
  groupesDeMonEglise,
  creerGroupe,
  modifierGroupe,
  supprimerGroupe,
  groupesDeLEglise,
  mesGroupes,
  demanderAdhesion,
  annulerDemande,
  quitterGroupe,
  detailGroupe,
  demandesDuGroupe,
  traiterDemande,
  retirerMembre,
  listerMessages,
  envoyerMessage,
};
