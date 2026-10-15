const mongoose = require('mongoose');

// Catégories proposées dans l'app. La dîme a sa propre catégorie unique.
const CATEGORIES = {
  don: {
    don_libre: 'Don libre',
    construction: 'Construction',
    mission: 'Mission & évangélisation',
    action_sociale: 'Action sociale',
    offrande_speciale: 'Offrande spéciale',
  },
  dime: {
    dime: 'Dîme',
  },
};

// Montants acceptés (FCFA, sans centimes)
const MONTANT_MIN = 100;
const MONTANT_MAX = 2000000;

// en_attente : session Wave créée, paiement pas encore confirmé par Wave
// reussi / echoue / annule : fixés UNIQUEMENT côté serveur (webhook Wave,
// réconciliation serveur avec l'API Wave, ou annulation par le fidèle d'un
// paiement encore en attente).
const STATUTS = ['en_attente', 'reussi', 'echoue', 'annule'];

const transactionDonSchema = new mongoose.Schema(
  {
    village: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Village',
      required: true,
    },
    utilisateur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Utilisateur',
      required: true,
    },
    type: { type: String, enum: ['don', 'dime'], required: true },
    categorie: { type: String, required: true },
    montant: { type: Number, required: true, min: MONTANT_MIN, max: MONTANT_MAX },
    devise: { type: String, default: 'XOF' },
    statut: { type: String, enum: STATUTS, default: 'en_attente' },

    // Identifiants Wave : session de paiement (cos-...) et transaction (T_...)
    referenceWave: { type: String },
    transactionWave: { type: String },
    lienPaiement: { type: String },
    // Message d'erreur renvoyé par Wave en cas d'échec
    motifEchec: { type: String },

    // Numéro lisible affiché sur le reçu, attribué au paiement réussi
    numeroRecu: { type: String },
    dateConfirmation: { type: Date },

    // Paiement de test (WAVE_SIMULATION=true, aucune clé Wave configurée)
    simulation: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Historique du fidèle, et tableau de bord de l'admin de l'église
transactionDonSchema.index({ utilisateur: 1, createdAt: -1 });
transactionDonSchema.index({ village: 1, statut: 1, createdAt: -1 });
transactionDonSchema.index({ village: 1, type: 1, createdAt: -1 });
// Retrouver la transaction à partir du webhook Wave
transactionDonSchema.index({ referenceWave: 1 }, { sparse: true });

transactionDonSchema.statics.libelleCategorie = function (type, categorie) {
  return CATEGORIES[type]?.[categorie] || categorie;
};

module.exports = mongoose.model('TransactionDon', transactionDonSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.MONTANT_MIN = MONTANT_MIN;
module.exports.MONTANT_MAX = MONTANT_MAX;
module.exports.STATUTS = STATUTS;
