const mongoose = require('mongoose');

// Notes personnelles d'un fidèle sur une prédication (vidéo VOD ou direct).
// cleVideo : "vod:<id de la vidéo>" ou "direct:<id de l'église>:<AAAA-MM-JJ>"
const notePredicationSchema = new mongoose.Schema(
  {
    utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    cleVideo: { type: String, required: true, trim: true, maxlength: 120 },
    titreVideo: { type: String, trim: true, maxlength: 200, default: '' },
    lienVideo: { type: String, trim: true, maxlength: 500, default: '' },
    texte: { type: String, maxlength: 20000, default: '' },
  },
  { timestamps: true }
);

notePredicationSchema.index({ utilisateur: 1, cleVideo: 1 }, { unique: true });
notePredicationSchema.index({ utilisateur: 1, updatedAt: -1 });

module.exports = mongoose.model('NotePredication', notePredicationSchema);
