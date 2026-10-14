const mongoose = require('mongoose');

// Vidéo à la demande (rediffusion, culte, enseignement...) ajoutée par
// l'admin d'une église, affichée sous le direct dans l'onglet "Live & VOD".
const videoVodSchema = new mongoose.Schema(
  {
    village: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Village',
      required: true,
    },
    titre: { type: String, required: true, trim: true, maxlength: 200 },
    lien: { type: String, required: true, trim: true }, // YouTube, Facebook ou vidéo directe
  },
  { timestamps: true }
);

videoVodSchema.index({ village: 1, createdAt: -1 });

module.exports = mongoose.model('VideoVod', videoVodSchema);
