const mongoose = require('mongoose');

const demandePriereSchema = new mongoose.Schema(
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
    texte: { type: String, required: true, trim: true, maxlength: 2000 },
    statut: {
      type: String,
      enum: ['nouvelle', 'traitee'],
      default: 'nouvelle',
    },
  },
  { timestamps: true }
);

demandePriereSchema.index({ village: 1, statut: 1, createdAt: -1 });

module.exports = mongoose.model('DemandePriere', demandePriereSchema);
