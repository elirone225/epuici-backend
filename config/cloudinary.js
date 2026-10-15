const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Stockage pour les photos d'articles (actualités)
const articleStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'epuici/articles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
  },
});

// Stockage pour les photos jointes aux alertes des habitants
const alerteStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'epuici/alertes',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
  },
});

// Stockage pour les affiches des événements de l'agenda
const evenementStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'epuici/evenements',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
  },
});

// Stockage pour les photos de profil des utilisateurs (habitants)
const profilStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'epuici/profils',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit', quality: 'auto' }],
  },
});

// Stockage pour les bandes publicitaires (format banderole, Super Admin uniquement)
const bannierePubStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'epuici/bannieres-pub',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1600, crop: 'limit', quality: 'auto' }],
  },
});

// Stockage pour les vidéos "Pub et Reportage" (Super Admin uniquement)
const pubReportageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'epuici/pub-reportage',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'webm'],
  },
});

// Stockage des photos et messages vocaux envoyés dans les groupes.
// Les audios (resource_type "video" chez Cloudinary) sont convertis en MP3 à
// l'envoi : le navigateur enregistre en WebM/Opus ou MP4/AAC selon le
// téléphone, et le MP3 se lit partout (y compris sur iPhone).
const groupeMediaStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.mimetype.startsWith('image/')) {
      return {
        folder: 'epuici/groupes/photos',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
        transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }],
      };
    }
    return {
      folder: 'epuici/groupes/audios',
      resource_type: 'video',
      format: 'mp3',
    };
  },
});

module.exports = {
  evenementStorage,
  cloudinary,
  groupeMediaStorage,
  articleStorage,
  alerteStorage,
  pubReportageStorage,
  profilStorage,
  bannierePubStorage,
};
