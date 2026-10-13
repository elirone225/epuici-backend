const mongoose = require('mongoose');

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
      enum: [
        'actualites',
        'communique_officiel',
        'alerte_urgente',
        'avis_deces',
        'naissance',
        'mariage',
        'reussite',
        'commerce',
      ],
      default: 'actualites',
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
  },
  { timestamps: true }
);

articleSchema.index({ village: 1, statut: 1, createdAt: -1 });

module.exports = mongoose.model('Article', articleSchema);
