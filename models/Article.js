const mongoose = require('mongoose');

// Catégories proposées aux églises. Les anciennes valeurs (héritées
// d'Akye News) restent acceptées et sont classées dans "Annonces".
const CATEGORIES_PUBLICATION = {
  annonce: 'Annonce',
  enseignement: 'Enseignement',
  temoignage: 'Témoignage',
};
const ANCIENNES_CATEGORIES = [
  'actualites',
  'communique_officiel',
  'alerte_urgente',
  'avis_deces',
  'naissance',
  'mariage',
  'reussite',
  'commerce',
];

const articleSchema = new mongoose.Schema(
  {
    village: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Village',
      required: true,
    },
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VillageAdmin',
      required: true,
    },
    titre: { type: String, required: true, trim: true },
    contenu: { type: String, required: true },
    categorie: {
      type: String,
      enum: [...Object.keys(CATEGORIES_PUBLICATION), ...ANCIENNES_CATEGORIES],
      default: 'annonce',
    },
    photos: {
      type: [String], // URLs Cloudinary, 2 à 3 photos
      validate: {
        validator: (arr) => arr.length >= 1 && arr.length <= 3,
        message: 'Un article doit contenir entre 1 et 3 photos.',
      },
    },
    statut: {
      type: String,
      enum: ['brouillon', 'publie'],
      default: 'brouillon',
    },
    vues: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    nombreCommentaires: { type: Number, default: 0 },
  },
  { timestamps: true }
);

articleSchema.index({ village: 1, statut: 1, createdAt: -1 });

// Filtre MongoDB d'une catégorie du fil ("annonce" inclut les anciennes)
const filtreCategorie = (categorie) => {
  if (categorie === 'annonce') return { categorie: { $nin: ['enseignement', 'temoignage'] } };
  if (CATEGORIES_PUBLICATION[categorie]) return { categorie };
  return {};
};

module.exports = mongoose.model('Article', articleSchema);
module.exports.CATEGORIES_PUBLICATION = CATEGORIES_PUBLICATION;
module.exports.filtreCategorie = filtreCategorie;
