const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const villageAdminSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true },
    telephone: { type: String, required: true, unique: true },
    email: { type: String, lowercase: true },
    motDePasse: { type: String, required: true },
    village: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Village',
      required: true,
    },
    // Chaque église a deux comptes : l'admin, et le trésorier qui a accès à
    // tout, y compris aux comptes (Dons & Dîmes) et au numéro Wave de l'église.
    role: {
      type: String,
      enum: ['admin', 'tresorier'],
      default: 'admin',
    },
    statut: {
      type: String,
      enum: ['actif', 'suspendu'],
      default: 'actif',
    },
    // Référence rapide à l'abonnement en cours (mis à jour à chaque paiement validé)
    abonnementActif: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Abonnement',
      default: null,
    },
    abonnementExpireLe: { type: Date, default: null },
    creePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SuperAdmin',
    },
  },
  { timestamps: true }
);

// Un seul admin et un seul trésorier par église
villageAdminSchema.index({ village: 1, role: 1 }, { unique: true });

villageAdminSchema.pre('save', async function (next) {
  if (!this.isModified('motDePasse')) return next();
  const salt = await bcrypt.genSalt(10);
  this.motDePasse = await bcrypt.hash(this.motDePasse, salt);
  next();
});

villageAdminSchema.methods.verifierMotDePasse = async function (motDePasseSaisi) {
  return bcrypt.compare(motDePasseSaisi, this.motDePasse);
};

// Vérifie si l'admin a un abonnement valide actuellement
villageAdminSchema.methods.abonnementEstValide = function () {
  return this.abonnementExpireLe && new Date(this.abonnementExpireLe) > new Date();
};

villageAdminSchema.methods.estTresorier = function () {
  return this.role === 'tresorier';
};

module.exports = mongoose.model('VillageAdmin', villageAdminSchema);
