const mongoose = require('mongoose');

// Demande d'un fidèle pour rejoindre un groupe, à valider par un responsable
const demandeGroupeSchema = new mongoose.Schema(
  {
    groupe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Groupe',
      required: true,
    },
    utilisateur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Utilisateur',
      required: true,
    },
    statut: {
      type: String,
      enum: ['en_attente', 'acceptee', 'refusee'],
      default: 'en_attente',
    },
    traitePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Utilisateur',
    },
  },
  { timestamps: true }
);

// Une seule demande en attente par fidèle et par groupe
demandeGroupeSchema.index(
  { groupe: 1, utilisateur: 1 },
  { unique: true, partialFilterExpression: { statut: 'en_attente' } }
);

module.exports = mongoose.model('DemandeGroupe', demandeGroupeSchema);
