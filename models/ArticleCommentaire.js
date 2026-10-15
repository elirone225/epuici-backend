const mongoose = require('mongoose');

// Commentaire d'un fidèle sous une publication de son église
const articleCommentaireSchema = new mongoose.Schema(
  {
    article: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Article',
      required: true,
    },
    village: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Village',
      required: true,
    },
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Utilisateur',
      required: true,
    },
    texte: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

articleCommentaireSchema.index({ article: 1, createdAt: 1 });

module.exports = mongoose.model('ArticleCommentaire', articleCommentaireSchema);
