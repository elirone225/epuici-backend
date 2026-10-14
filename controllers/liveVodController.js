const Village = require('../models/Village');
const VideoVod = require('../models/VideoVod');

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

    const village = await Village.findByIdAndUpdate(
      req.user.village,
      { direct: { lien, enCours: Boolean(lien) } },
      { new: true }
    ).select('direct');

    res.json(directDuVillage(village));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/live-vod/videos
// Réservé au Super Admin : ajoute une vidéo visible par tous les fidèles.
const ajouterVideo = async (req, res) => {
  try {
    const titre = (req.body.titre || '').trim();
    const lien = (req.body.lien || '').trim();

    if (!titre) {
      return res.status(400).json({ message: 'Veuillez indiquer le titre de la vidéo.' });
    }
    if (!estLienValide(lien)) {
      return res
        .status(400)
        .json({ message: 'Le lien de la vidéo doit commencer par http:// ou https://' });
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

module.exports = {
  obtenirLiveVod,
  listerVideos,
  monDirect,
  modifierDirect,
  ajouterVideo,
  supprimerVideo,
};
