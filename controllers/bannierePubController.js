const BannierePub = require('../models/BannierePub');

// @route POST /api/bannieres-pub
// Réservé au Super Admin : ajoute une bande publicitaire
const creerBannierePub = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Veuillez ajouter une image.' });
    }

    const banniere = await BannierePub.create({
      titre: req.body.titre,
      imageUrl: req.file.path,
      auteur: req.user._id,
    });

    res.status(201).json(banniere);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/bannieres-pub
// Public : bandes publicitaires affichées en haut du fil d'actualité
const listerBannieresPub = async (req, res) => {
  try {
    const bannieres = await BannierePub.find().sort({ createdAt: -1 });
    res.json(bannieres);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/bannieres-pub/:id
// Réservé au Super Admin
const supprimerBannierePub = async (req, res) => {
  try {
    const banniere = await BannierePub.findById(req.params.id);
    if (!banniere) {
      return res.status(404).json({ message: 'Bande pub introuvable.' });
    }

    await banniere.deleteOne();
    res.json({ message: 'Bande pub supprimée avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  creerBannierePub,
  listerBannieresPub,
  supprimerBannierePub,
};
