const mongoose = require('mongoose');

// Bande publicitaire (photo au format banderole) affichée en haut du fil
// d'actualité de l'app mobile. Gérée uniquement par le Super Admin.
const bannierePubSchema = new mongoose.Schema(
  {
    titre: { type: String, trim: true },
    imageUrl: { type: String, required: true },
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SuperAdmin',
      required: true,
    },
  },
  { timestamps: true }
);

bannierePubSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BannierePub', bannierePubSchema);
