const mongoose = require('mongoose');

// Message du chat en direct d'une église. Le chat d'un direct contient les
// messages envoyés depuis son lancement (Village.direct.demarreLe).
const messageDirectSchema = new mongoose.Schema(
  {
    village: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Village',
      required: true,
    },
    // Fidèle auteur, ou compte de l'église (admin / trésorier) : estEglise
    auteur: { type: mongoose.Schema.Types.ObjectId, required: true },
    estEglise: { type: Boolean, default: false },
    // Copie du nom et de la photo : affichage rapide sans jointure
    auteurNom: { type: String, required: true },
    auteurPhoto: { type: String },
    texte: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

messageDirectSchema.index({ village: 1, _id: 1 });
messageDirectSchema.index({ auteur: 1, createdAt: -1 });
// Les messages des directs sont effacés automatiquement au bout de 30 jours
messageDirectSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('MessageDirect', messageDirectSchema);
