const Village = require('../models/Village');
const VideoVod = require('../models/VideoVod');

const estLienValide = (lien) => /^https?:\/\/\S+$/i.test(lien);

const liveVodDuVillage = async (villageId) => {
  const village = await Village.findById(villageId).select('nom direct');
  if (!village) return null;

  const videos = await VideoVod.find({ village: villageId }).sort({ createdAt: -1 });

  return {
    village: { _id: village._id, nom: village.nom },
    direct: {
      lien: village.direct?.lien || '',
      enCours: Boolean(village.direct?.enCours && village.direct?.lien),
    },
    videos,
  };
};

// @route GET /api/live-vod/village/:villageId
// Public (app mobile) : direct et vidéos à la demande d'une église.
const obtenirLiveVod = async (req, res) => {
  try {
    const donnees = await liveVodDuVillage(req.params.villageId);
    if (!donnees) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }
    res.json(donnees);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/live-vod/mon-village
// Réservé au Village Admin : direct et vidéos de son église.
const monLiveVod = async (req, res) => {
  try {
    const donnees = await liveVodDuVillage(req.user.village);
    if (!donnees) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }
    res.json(donnees);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/live-vod/direct
// Réservé au Village Admin : enregistre le lien du direct et indique s'il
// est en cours (sinon l'app affiche "Direct terminé").
const modifierDirect = async (req, res) => {
  try {
    const lien = (req.body.lien || '').trim();
    const enCours = Boolean(req.body.enCours);

    if (lien && !estLienValide(lien)) {
      return res.status(400).json({ message: 'Le lien du direct doit commencer par http:// ou https://' });
    }
    if (enCours && !lien) {
      return res.status(400).json({ message: 'Indiquez le lien du direct avant de le lancer.' });
    }

    await Village.updateOne({ _id: req.user.village }, { direct: { lien, enCours } });

    res.json(await liveVodDuVillage(req.user.village));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/live-vod/videos
// Réservé au Village Admin : ajoute une vidéo à la demande à son église.
const ajouterVideo = async (req, res) => {
  try {
    const titre = (req.body.titre || '').trim();
    const lien = (req.body.lien || '').trim();

    if (!titre) {
      return res.status(400).json({ message: 'Veuillez indiquer le titre de la vidéo.' });
    }
    if (!estLienValide(lien)) {
      return res.status(400).json({ message: 'Le lien de la vidéo doit commencer par http:// ou https://' });
    }

    const video = await VideoVod.create({ village: req.user.village, titre, lien });
    res.status(201).json(video);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/live-vod/videos/:id
// Réservé au Village Admin : supprime une vidéo de son église.
const supprimerVideo = async (req, res) => {
  try {
    const video = await VideoVod.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Vidéo introuvable.' });
    }
    if (video.village.toString() !== req.user.village.toString()) {
      return res.status(403).json({ message: 'Cette vidéo ne concerne pas votre église.' });
    }

    await video.deleteOne();
    res.json({ message: 'Vidéo supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  obtenirLiveVod,
  monLiveVod,
  modifierDirect,
  ajouterVideo,
  supprimerVideo,
};
