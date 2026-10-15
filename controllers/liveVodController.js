const mongoose = require('mongoose');
const Village = require('../models/Village');
const VideoVod = require('../models/VideoVod');
const MessageDirect = require('../models/MessageDirect');
const { notifierFidelesDuVillage } = require('../services/notificationService');

const estLienValide = (lien) => /^https?:\/\/\S+$/i.test(lien);

const directDuVillage = (village) => ({
  lien: village.direct?.lien || '',
  enCours: Boolean(village.direct?.lien),
});

// @route GET /api/live-vod/village/:villageId
// Public (app mobile) : direct de l'église du fidèle + vidéos du Super Admin
// (communes à toutes les églises).
const obtenirLiveVod = async (req, res) => {
  try {
    const village = await Village.findById(req.params.villageId).select('nom direct');
    if (!village) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }
    const videos = await VideoVod.find().sort({ createdAt: -1 });

    res.json({
      village: { _id: village._id, nom: village.nom },
      direct: directDuVillage(village),
      videos,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/live-vod/videos
// Public : vidéos ajoutées par le Super Admin, visibles par tous les fidèles.
const listerVideos = async (req, res) => {
  try {
    const videos = await VideoVod.find().sort({ createdAt: -1 });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/live-vod/mon-direct
// Réservé au Village Admin : lien du direct de son église.
const monDirect = async (req, res) => {
  try {
    const village = await Village.findById(req.user.village).select('direct');
    if (!village) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }
    res.json(directDuVillage(village));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/live-vod/direct
// Réservé au Village Admin : enregistre le lien du direct de son église pour
// que les fidèles absents puissent le suivre. Un lien vide termine le direct
// (l'app affiche alors "Direct terminé").
const modifierDirect = async (req, res) => {
  try {
    const lien = (req.body.lien || '').trim();

    if (lien && !estLienValide(lien)) {
      return res
        .status(400)
        .json({ message: 'Le lien du direct doit commencer par http:// ou https://' });
    }

    const avant = await Village.findById(req.user.village).select('nom direct');
    if (!avant) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }
    const dejaEnDirect = Boolean(avant.direct?.lien);

    // Nouveau direct (lien donné alors qu'aucun direct n'était en cours) :
    // nouveau chat. Une simple mise à jour du lien garde le chat en cours.
    const direct = { lien, enCours: Boolean(lien) };
    if (lien) {
      direct.demarreLe = dejaEnDirect && avant.direct.demarreLe ? avant.direct.demarreLe : new Date();
    }

    const village = await Village.findByIdAndUpdate(req.user.village, { direct }, { new: true }).select('direct');

    if (lien && !dejaEnDirect) {
      notifierFidelesDuVillage(req.user.village, {
        title: `${avant.nom} est en direct`,
        body: 'Rejoignez le direct et le chat dans EPUICI.',
        data: { type: 'direct', villageId: String(req.user.village) },
      }, 'directs');
    }

    res.json(directDuVillage(village));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/live-vod/videos
// Réservé au Super Admin : ajoute une vidéo visible par tous les fidèles,
// soit par lien (YouTube, Facebook...), soit en envoyant le fichier vidéo
// (champ "video", stocké sur Cloudinary).
const ajouterVideo = async (req, res) => {
  try {
    const titre = (req.body.titre || '').trim();
    const lien = req.file ? req.file.path : (req.body.lien || '').trim();

    if (!titre) {
      return res.status(400).json({ message: 'Veuillez indiquer le titre de la vidéo.' });
    }
    if (!estLienValide(lien)) {
      return res
        .status(400)
        .json({ message: 'Ajoutez un fichier vidéo ou un lien commençant par http:// ou https://' });
    }

    const video = await VideoVod.create({ titre, lien });
    res.status(201).json(video);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/live-vod/videos/:id
// Réservé au Super Admin.
const supprimerVideo = async (req, res) => {
  try {
    const video = await VideoVod.findByIdAndDelete(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Vidéo introuvable.' });
    }
    res.json({ message: 'Vidéo supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// --- Chat en direct ---

const TAILLE_MAX_MESSAGE = 300;
const DELAI_ENTRE_MESSAGES_MS = 2000;
const PRESENCE_MS = 30 * 1000;

// Spectateurs du chat : fidèles ayant consulté le chat dans les 30 dernières
// secondes (mémoire du serveur, remise à zéro au redémarrage, sans gravité)
const presences = new Map(); // villageId -> Map(utilisateurId -> horodatage)

const compterPresences = (villageId, utilisateurId) => {
  const maintenant = Date.now();
  let liste = presences.get(villageId);
  if (!liste) presences.set(villageId, (liste = new Map()));
  if (utilisateurId) liste.set(utilisateurId, maintenant);
  let nombre = 0;
  for (const [id, vu] of liste) {
    if (maintenant - vu > PRESENCE_MS) liste.delete(id);
    else nombre += 1;
  }
  return nombre;
};

// Le chat d'une église est réservé à ses fidèles et à ses comptes admin
const accesChat = (req, villageId) =>
  req.role === 'villageadmin'
    ? String(req.user.village) === String(villageId)
    : (req.user.villagesSuivis || []).some((v) => String(v) === String(villageId));

const versClientMessage = (m) => ({
  _id: m._id,
  texte: m.texte,
  auteurId: m.auteur,
  auteurNom: m.auteurNom,
  auteurPhoto: m.auteurPhoto || null,
  estEglise: m.estEglise,
  createdAt: m.createdAt,
});

// @route GET /api/live-vod/village/:villageId/chat?apres=<id du dernier message reçu>
// Fidèle de l'église ou admin : messages du direct en cours (100 derniers,
// ou seulement les nouveaux avec ?apres=) et nombre de spectateurs
const chatDirect = async (req, res) => {
  try {
    const { villageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(villageId)) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }
    if (!accesChat(req, villageId)) {
      return res.status(403).json({ message: 'Le chat est réservé aux membres de cette église.' });
    }
    const village = await Village.findById(villageId).select('direct');
    if (!village) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }
    if (!village.direct?.lien) {
      return res.json({ enDirect: false, messages: [], spectateurs: 0 });
    }

    const spectateurs = compterPresences(
      villageId,
      req.role === 'utilisateur' ? String(req.user._id) : null
    );

    const filtre = { village: villageId, createdAt: { $gte: village.direct.demarreLe || new Date(0) } };
    const { apres } = req.query;
    let messages;
    if (apres && mongoose.Types.ObjectId.isValid(apres)) {
      messages = await MessageDirect.find({ ...filtre, _id: { $gt: apres } }).sort({ _id: 1 }).limit(200);
    } else {
      messages = (await MessageDirect.find(filtre).sort({ _id: -1 }).limit(100)).reverse();
    }

    res.json({ enDirect: true, messages: messages.map(versClientMessage), spectateurs });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/live-vod/village/:villageId/chat   { texte }
const envoyerMessageDirect = async (req, res) => {
  try {
    const { villageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(villageId)) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }
    if (!accesChat(req, villageId)) {
      return res.status(403).json({ message: 'Le chat est réservé aux membres de cette église.' });
    }
    const texte = String(req.body.texte || '').trim();
    if (!texte) {
      return res.status(400).json({ message: 'Votre message est vide.' });
    }
    if (texte.length > TAILLE_MAX_MESSAGE) {
      return res.status(400).json({ message: `Message trop long (${TAILLE_MAX_MESSAGE} caractères maximum).` });
    }

    const village = await Village.findById(villageId).select('nom direct');
    if (!village?.direct?.lien) {
      return res.status(400).json({ message: 'Le direct est terminé : le chat est fermé.' });
    }

    // Anti-inondation : un message toutes les 2 secondes au plus
    const recent = await MessageDirect.exists({
      auteur: req.user._id,
      createdAt: { $gte: new Date(Date.now() - DELAI_ENTRE_MESSAGES_MS) },
    });
    if (recent) {
      return res.status(429).json({ message: 'Doucement ! Attendez un instant avant le prochain message.' });
    }

    const estEglise = req.role === 'villageadmin';
    const message = await MessageDirect.create({
      village: villageId,
      auteur: req.user._id,
      estEglise,
      auteurNom: estEglise ? village.nom : req.user.nom || 'Fidèle',
      auteurPhoto: estEglise ? undefined : req.user.photoProfil,
      texte,
    });

    res.status(201).json(versClientMessage(message));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/live-vod/chat/:messageId
// L'auteur du message, ou l'admin / le trésorier de l'église (modération)
const supprimerMessageDirect = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.messageId)) {
      return res.status(404).json({ message: 'Message introuvable.' });
    }
    const message = await MessageDirect.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message introuvable.' });
    }
    const autorise =
      req.role === 'villageadmin'
        ? String(message.village) === String(req.user.village)
        : String(message.auteur) === String(req.user._id);
    if (!autorise) {
      return res.status(403).json({ message: 'Vous ne pouvez pas supprimer ce message.' });
    }
    await message.deleteOne();
    res.json({ message: 'Message supprimé.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  chatDirect,
  envoyerMessageDirect,
  supprimerMessageDirect,
  obtenirLiveVod,
  listerVideos,
  monDirect,
  modifierDirect,
  ajouterVideo,
  supprimerVideo,
};
