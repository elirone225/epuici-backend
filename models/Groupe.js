const mongoose = require('mongoose');

// Groupe de discussion d'une église (chorale, jeunesse, femmes...).
// Créé par l'admin de l'église, qui désigne les responsables parmi les
// fidèles abonnés. Les responsables font toujours partie des membres.
const groupeSchema = new mongoose.Schema(
  {
    village: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Village',
      required: true,
    },
    nom: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    responsables: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }],
    membres: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }],
    creePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VillageAdmin',
    },
    // Date du dernier message, pour trier "Mes groupes" comme une messagerie
    dernierMessageLe: { type: Date },
  },
  { timestamps: true }
);

groupeSchema.index({ village: 1, nom: 1 });
groupeSchema.index({ membres: 1 });

module.exports = mongoose.model('Groupe', groupeSchema);
