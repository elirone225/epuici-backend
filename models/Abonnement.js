const mongoose = require('mongoose');

// Les 4 formules disponibles, avec leur durée en jours
const FORMULES = {
  '1mois': { prix: 15000, jours: 30 },
  '3mois': { prix: 45000, jours: 90 },
  '6mois': { prix: 80000, jours: 180 },
  '12mois': { prix: 150000, jours: 365 },
};

const abonnementSchema = new mongoose.Schema(
  {
    villageAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VillageAdmin',
      required: true,
    },
    formule: {
      type: String,
      enum: Object.keys(FORMULES),
      required: true,
    },
    montant: { type: Number, required: true },
    statutPaiement: {
      type: String,
      enum: ['en_attente', 'valide', 'echoue'],
      default: 'en_attente',
    },
    referenceWave: { type: String }, // ID de transaction retourné par Wave
    dateDebut: { type: Date },
    dateFin: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Abonnement', abonnementSchema);
module.exports.FORMULES = FORMULES;
