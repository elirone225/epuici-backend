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
      enum: ['texte', 'photo', 'audio', 'fichier', 'sondage'],
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
    // Pièce jointe (PDF)
    nomFichier: { type: String, trim: true, maxlength: 200 },
    tailleFichier: { type: Number }, // en octets
    // Sondage : chaque option garde la liste de ses votants
    sondage: {
      question: { type: String, trim: true, maxlength: 300 },
      options: [
        {
          _id: false,
          texte: { type: String, trim: true, maxlength: 100 },
          votants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }],
        },
      ],
      choixMultiple: { type: Boolean, default: false },
      ferme: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

messageGroupeSchema.index({ groupe: 1, createdAt: -1 });

module.exports = mongoose.model('MessageGroupe', messageGroupeSchema);
