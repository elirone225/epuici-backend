const mongoose = require('mongoose');

const alerteSchema = new mongoose.Schema(
  {
    village: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Village',
      required: true,
    },
    utilisateur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Utilisateur',
      required: true,
    },
    // Nature de l'alerte, choisie par le fidèle
    type: {
      type: String,
      enum: ['deces', 'maladie', 'urgence', 'autre'],
      default: 'autre',
    },
    description: { type: String, required: true, trim: true },
    photos: {
      type: [String], // URLs Cloudinary, jusqu'à 3 photos, facultatif
      validate: {
        validator: (arr) => arr.length <= 3,
        message: 'Maximum 3 photos par alerte.',
      },
      default: [],
    },
    // Suivi visible par le fidèle : reçue -> prise en charge -> traitée
    statut: {
      type: String,
      enum: ['nouvelle', 'en_cours', 'traitee'],
      default: 'nouvelle',
    },
    // Message de l'église au fidèle (facultatif)
    reponse: { type: String, trim: true, maxlength: 1000 },
    statutModifieLe: { type: Date },
  },
  { timestamps: true }
);

alerteSchema.index({ village: 1, statut: 1, createdAt: -1 });
alerteSchema.index({ utilisateur: 1, createdAt: -1 });

module.exports = mongoose.model('Alerte', alerteSchema);
