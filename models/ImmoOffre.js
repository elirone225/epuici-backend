const mongoose = require('mongoose');

const immoOffreSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: [
        'terrain_vente',
        'terrain_achat',
        'maison_vente',
        'maison_location',
        'emploi',
      ],
      required: true,
    },
    titre: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    prix: { type: Number }, // non requis pour les offres d'emploi
    localisation: { type: String },
    contact: { type: String, required: true },
    photos: {
      type: [String], // optionnel pour emploi, 1-3 photos pour immo
      default: [],
    },
    statut: {
      type: String,
      enum: ['disponible', 'clos'],
      default: 'disponible',
    },
  },
  { timestamps: true }
);

immoOffreSchema.index({ village: 1, type: 1, statut: 1, createdAt: -1 });

module.exports = mongoose.model('ImmoOffre', immoOffreSchema);
