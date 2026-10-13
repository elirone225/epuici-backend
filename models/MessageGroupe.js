const mongoose = require('mongoose');

// Message d'un groupe : texte, photo (avec légende facultative) ou vocal
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
    type: {
      type: String,
      enum: ['texte', 'photo', 'audio'],
      default: 'texte',
    },
    // Obligatoire pour un message texte, légende facultative pour une photo
    texte: {
      type: String,
      trim: true,
      maxlength: 2000,
      required: function () {
        return this.type === 'texte';
      },
    },
    mediaUrl: { type: String },
    // Identifiant Cloudinary, pour supprimer le fichier avec le groupe
    mediaPublicId: { type: String },
    dureeAudio: { type: Number }, // en secondes
  },
  { timestamps: true }
);

messageGroupeSchema.index({ groupe: 1, createdAt: -1 });

module.exports = mongoose.model('MessageGroupe', messageGroupeSchema);
