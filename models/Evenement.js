const mongoose = require('mongoose');

// Événement de l'agenda d'une église (culte spécial, conférence, veillée...)
const evenementSchema = new mongoose.Schema(
  {
    village: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Village',
      required: true,
    },
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VillageAdmin',
    },
    titre: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    lieu: { type: String, trim: true, maxlength: 200, default: '' },
    dateDebut: { type: Date, required: true },
    dateFin: { type: Date },
    photo: { type: String }, // affiche facultative (URL Cloudinary)

    // Fidèles qui ont cliqué "Je participe". rappel : recevoir les
    // notifications de rappel (la veille et une heure avant).
    participants: [
      {
        _id: false,
        utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
        rappel: { type: Boolean, default: true },
        inscritLe: { type: Date, default: Date.now },
      },
    ],

    // Rappels déjà envoyés (évite tout doublon)
    rappelVeilleEnvoyeLe: { type: Date, default: null },
    rappelHeureEnvoyeLe: { type: Date, default: null },
  },
  { timestamps: true }
);

evenementSchema.index({ village: 1, dateDebut: 1 });
// Recherche des rappels à envoyer
evenementSchema.index({ dateDebut: 1, rappelVeilleEnvoyeLe: 1, rappelHeureEnvoyeLe: 1 });

// Fin effective : dateFin, ou 2 heures après le début par défaut
evenementSchema.methods.finEffective = function () {
  return this.dateFin || new Date(this.dateDebut.getTime() + 2 * 60 * 60 * 1000);
};

module.exports = mongoose.model('Evenement', evenementSchema);
