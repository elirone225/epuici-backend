const mongoose = require('mongoose');

const villageSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, unique: true, trim: true },
    region: { type: String, required: true },
    departement: { type: String },
    description: { type: String },
    photoCouverture: { type: String }, // URL Cloudinary
    statut: {
      type: String,
      enum: ['actif', 'inactif'],
      default: 'actif',
    },
    // Direct de l'église (onglet "Live & VOD" de l'app), géré par son admin.
    // Lien YouTube, Facebook ou vidéo directe ; "Direct terminé" est affiché
    // tant que enCours est faux.
    direct: {
      lien: { type: String, trim: true, default: '' },
      enCours: { type: Boolean, default: false },
    },
    // Numéro Wave de l'église, saisi par son trésorier (Paramètres) : sert
    // au reversement des dons et dîmes. Jamais renvoyé par les routes
    // publiques (select: false), il faut le demander explicitement.
    numeroWave: { type: String, trim: true, select: false },
    numeroWaveModifieLe: { type: Date, select: false },
    // Compteurs utiles pour le dashboard (mis à jour via les contrôleurs)
    nombreAbonnes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Village', villageSchema);
