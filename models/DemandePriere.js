const mongoose = require('mongoose');

const demandePriereSchema = new mongoose.Schema(
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
    texte: { type: String, required: true, trim: true, maxlength: 2000 },
    statut: {
      type: String,
      enum: ['nouvelle', 'traitee'],
      default: 'nouvelle',
    },
    // privee : seulement l'admin de l'église (comme avant) ;
    // publique : affichée sur le mur de prière des membres de l'église
    visibilite: {
      type: String,
      enum: ['privee', 'publique'],
      default: 'privee',
    },
    // Sur le mur, le nom de l'auteur est masqué
    anonyme: { type: Boolean, default: false },
    // Fidèles qui ont cliqué "J'ai prié"
    priants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }],
    // Prière exaucée, avec le témoignage de l'auteur
    exaucee: { type: Boolean, default: false },
    temoignage: { type: String, trim: true, maxlength: 2000 },
    exauceeLe: { type: Date },
  },
  { timestamps: true }
);

demandePriereSchema.index({ village: 1, statut: 1, createdAt: -1 });
demandePriereSchema.index({ village: 1, visibilite: 1, createdAt: -1 });
demandePriereSchema.index({ utilisateur: 1, createdAt: -1 });

module.exports = mongoose.model('DemandePriere', demandePriereSchema);
