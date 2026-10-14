const mongoose = require('mongoose');

// Vidéo à la demande (culte, enseignement, reportage...) ajoutée par le
// Super Admin, affichée sous le direct dans l'onglet "Live & VOD" pour tous
// les fidèles, quelle que soit leur église.
const videoVodSchema = new mongoose.Schema(
  {
    titre: { type: String, required: true, trim: true, maxlength: 200 },
    lien: { type: String, required: true, trim: true }, // YouTube, Facebook ou vidéo directe
  },
  { timestamps: true }
);

videoVodSchema.index({ createdAt: -1 });

module.exports = mongoose.model('VideoVod', videoVodSchema);
