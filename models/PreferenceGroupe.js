const mongoose = require('mongoose');

// Réglages d'un membre pour un groupe : jusqu'où il a lu la discussion
// (messages non lus, accusés de lecture), épinglage et mise en sourdine.
const preferenceGroupeSchema = new mongoose.Schema(
  {
    groupe: { type: mongoose.Schema.Types.ObjectId, ref: 'Groupe', required: true },
    utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    luJusquA: { type: Date, default: Date.now },
    epingle: { type: Boolean, default: false },
    epingleLe: { type: Date },
    // En sourdine : plus de notification pour ce groupe
    sourdine: { type: Boolean, default: false },
  },
  { timestamps: true }
);

preferenceGroupeSchema.index({ groupe: 1, utilisateur: 1 }, { unique: true });
preferenceGroupeSchema.index({ utilisateur: 1 });

// Crée les préférences manquantes (nouveaux membres) : tout ce qui précède
// leur arrivée est considéré comme lu
preferenceGroupeSchema.statics.initialiser = function (groupeId, idsUtilisateurs) {
  if (!idsUtilisateurs?.length) return Promise.resolve();
  return this.bulkWrite(
    idsUtilisateurs.map((utilisateur) => ({
      updateOne: {
        filter: { groupe: groupeId, utilisateur },
        update: { $setOnInsert: { luJusquA: new Date() } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
};

module.exports = mongoose.model('PreferenceGroupe', preferenceGroupeSchema);
