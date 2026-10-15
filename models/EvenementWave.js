const mongoose = require('mongoose');

// Événements webhook Wave déjà traités : Wave peut renvoyer plusieurs fois
// le même événement, l'index unique garantit qu'on ne le traite qu'une fois.
const evenementWaveSchema = new mongoose.Schema(
  {
    idEvenement: { type: String, required: true, unique: true },
    type: { type: String },
    referenceWave: { type: String },
  },
  { timestamps: true }
);

// Purge automatique au bout de 90 jours
evenementWaveSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('EvenementWave', evenementWaveSchema);
