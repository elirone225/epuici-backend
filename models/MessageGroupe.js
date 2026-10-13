const mongoose = require('mongoose');

const messageGroupeSchema = new mongoose.Schema(
  {
    groupe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Groupe',
      required: true,
    },
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Utilisateur',
      required: true,
    },
    texte: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

messageGroupeSchema.index({ groupe: 1, createdAt: -1 });

module.exports = mongoose.model('MessageGroupe', messageGroupeSchema);
