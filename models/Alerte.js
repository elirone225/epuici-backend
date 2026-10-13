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
    description: { type: String, required: true, trim: true },
    photos: {
      type: [String], // URLs Cloudinary, jusqu'à 3 photos, facultatif
      validate: {
        validator: (arr) => arr.length <= 3,
        message: 'Maximum 3 photos par alerte.',
      },
      default: [],
    },
    statut: {
      type: String,
      enum: ['nouvelle', 'traitee'],
      default: 'nouvelle',
    },
  },
  { timestamps: true }
);

alerteSchema.index({ village: 1, statut: 1, createdAt: -1 });

module.exports = mongoose.model('Alerte', alerteSchema);
