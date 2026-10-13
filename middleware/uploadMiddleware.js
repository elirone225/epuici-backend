const multer = require('multer');
const {
  articleStorage,
  alerteStorage,
  pubReportageStorage,
  profilStorage,
  bannierePubStorage,
} = require('../config/cloudinary');

const multerArticle = multer({
  storage: articleStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max par photo
}).array('photos', 3);

const multerAlerte = multer({
  storage: alerteStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
}).array('photos', 3);

const multerPubReportage = multer({
  storage: pubReportageStorage,
  limits: { fileSize: 80 * 1024 * 1024 }, // 80 Mo max par vidéo
}).single('video');

const multerProfil = multer({
  storage: profilStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('photoProfil');

const multerBannierePub = multer({
  storage: bannierePubStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('image');

// On enveloppe multer pour transformer ses erreurs (fichier trop gros, Cloudinary
// mal configuré, etc.) en réponse JSON claire, au lieu de faire planter la requête.
const uploadPhotosArticle = (req, res, next) => {
  multerArticle(req, res, (err) => {
    if (err) {
      console.error('Erreur upload photos article :', err.message);
      return res.status(400).json({
        message:
          "Erreur lors de l'envoi des photos. Vérifiez la configuration Cloudinary dans le .env, ou la taille/format des images.",
        erreur: err.message,
      });
    }
    next();
  });
};

const uploadPhotosAlerte = (req, res, next) => {
  multerAlerte(req, res, (err) => {
    if (err) {
      console.error('Erreur upload photos alerte :', err.message);
      return res.status(400).json({
        message:
          "Erreur lors de l'envoi des photos. Vérifiez la configuration Cloudinary dans le .env, ou la taille/format des images.",
        erreur: err.message,
      });
    }
    next();
  });
};

const uploadVideoPubReportage = (req, res, next) => {
  multerPubReportage(req, res, (err) => {
    if (err) {
      console.error('Erreur upload vidéo Pub et Reportage :', err.message);
      return res.status(400).json({
        message:
          "Erreur lors de l'envoi de la vidéo. Vérifiez la configuration Cloudinary dans le .env, ou la taille/format du fichier (80 Mo max, mp4/mov/webm).",
        erreur: err.message,
      });
    }
    next();
  });
};

// Photo de profil facultative : à l'inscription, l'utilisateur peut ne pas
// en envoyer du tout (pas d'erreur si le champ est absent).
const uploadPhotoProfil = (req, res, next) => {
  multerProfil(req, res, (err) => {
    if (err) {
      console.error('Erreur upload photo de profil :', err.message);
      return res.status(400).json({
        message:
          "Erreur lors de l'envoi de la photo de profil. Vérifiez la taille (5 Mo max) et le format (jpg, png, webp).",
        erreur: err.message,
      });
    }
    next();
  });
};

const uploadImageBannierePub = (req, res, next) => {
  multerBannierePub(req, res, (err) => {
    if (err) {
      console.error('Erreur upload bande pub :', err.message);
      return res.status(400).json({
        message:
          "Erreur lors de l'envoi de l'image. Vérifiez la taille (5 Mo max) et le format (jpg, png, webp).",
        erreur: err.message,
      });
    }
    next();
  });
};

module.exports = {
  uploadPhotosArticle,
  uploadPhotosAlerte,
  uploadVideoPubReportage,
  uploadPhotoProfil,
  uploadImageBannierePub,
};
