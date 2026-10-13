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
    // Compteurs utiles pour le dashboard (mis à jour via les contrôleurs)
    nombreAbonnes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Village', villageSchema);
