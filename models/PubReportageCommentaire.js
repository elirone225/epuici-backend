const mongoose = require('mongoose');

const pubReportageCommentaireSchema = new mongoose.Schema(
  {
    pubReportage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PubReportage',
      required: true,
    },
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Utilisateur',
      required: true,
    },
    texte: { type: String, required: true, trim: true },
    repondreA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PubReportageCommentaire',
      default: null,
    },
  },
  { timestamps: true }
);

pubReportageCommentaireSchema.index({ pubReportage: 1, createdAt: -1 });

module.exports = mongoose.model('PubReportageCommentaire', pubReportageCommentaireSchema);
