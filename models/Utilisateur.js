const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const utilisateurSchema = new mongoose.Schema(
  {
    nom: { type: String },
    telephone: { type: String, required: true, unique: true },
    email: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
    motDePasse: { type: String, required: true },
    photoProfil: { type: String },
    codeReinitialisation: { type: String },
    codeReinitialisationExpire: { type: Date },
    villagesSuivis: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Village',
      },
    ],
    tokenNotification: { type: String }, // token FCM pour notifications push
    derniereConnexion: { type: Date },
    statut: {
      type: String,
      enum: ['actif', 'bloque'],
      default: 'actif',
    },
    // Empêche l'envoi de nouvelles alertes (ex: habitant qui envoie de
    // fausses alertes), sans bloquer le reste du compte.
    alertesBloquees: { type: Boolean, default: false },
    // Notifications que le fidèle accepte de recevoir (Paramètres de l'app)
    preferencesNotifications: {
      publications: { type: Boolean, default: true }, // publications et événements
      directs: { type: Boolean, default: true },
      groupes: { type: Boolean, default: true },
      rappels: { type: Boolean, default: true }, // rappels de l'agenda
    },
  },
  { timestamps: true }
);

utilisateurSchema.pre('save', async function (next) {
  if (!this.isModified('motDePasse')) return next();
  const salt = await bcrypt.genSalt(10);
  this.motDePasse = await bcrypt.hash(this.motDePasse, salt);
  next();
});

utilisateurSchema.methods.verifierMotDePasse = async function (motDePasseSaisi) {
  return bcrypt.compare(motDePasseSaisi, this.motDePasse);
};

module.exports = mongoose.model('Utilisateur', utilisateurSchema);
