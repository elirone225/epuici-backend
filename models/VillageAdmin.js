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
      unique: true, // garantit un seul admin par village
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

module.exports = mongoose.model('VillageAdmin', villageAdminSchema);
