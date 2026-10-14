const DemandePriere = require('../models/DemandePriere');

// @route POST /api/demandes-priere
// Réservé aux fidèles connectés : envoie une demande de prière directement
// à l'admin de l'église que le fidèle suit.
const creerDemandePriere = async (req, res) => {
  try {
    const { texte } = req.body;

    if (!texte || !texte.trim()) {
      return res.status(400).json({ message: 'Veuillez écrire votre demande de prière.' });
    }

    const village = req.user.villagesSuivis?.[0];
    if (!village) {
      return res.status(400).json({
        message: "Vous devez d'abord choisir votre église dans le menu.",
      });
    }

    const demande = await DemandePriere.create({
      village,
      utilisateur: req.user._id,
      texte: texte.trim(),
    });

    res.status(201).json(demande);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/demandes-priere/mon-village
// Réservé au Village Admin : demandes de prière reçues par son église.
const demandesDeMonVillage = async (req, res) => {
  try {
    const demandes = await DemandePriere.find({ village: req.user.village })
      .populate('utilisateur', 'nom telephone')
      .sort({ createdAt: -1 });

    res.json(demandes);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/demandes-priere/:id/statut
// Réservé au Village Admin : marque une demande comme priée (ou la rouvre).
const changerStatutDemande = async (req, res) => {
  try {
    const demande = await DemandePriere.findById(req.params.id);
    if (!demande) {
      return res.status(404).json({ message: 'Demande introuvable.' });
    }
    if (demande.village.toString() !== req.user.village.toString()) {
      return res.status(403).json({ message: 'Cette demande ne concerne pas votre église.' });
    }

    demande.statut = demande.statut === 'traitee' ? 'nouvelle' : 'traitee';
    await demande.save();
    await demande.populate('utilisateur', 'nom telephone');

    res.json(demande);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/demandes-priere/:id
// Réservé au Village Admin : supprime une demande de son église.
const supprimerDemande = async (req, res) => {
  try {
    const demande = await DemandePriere.findById(req.params.id);
    if (!demande) {
      return res.status(404).json({ message: 'Demande introuvable.' });
    }
    if (demande.village.toString() !== req.user.village.toString()) {
      return res.status(403).json({ message: 'Cette demande ne concerne pas votre église.' });
    }

    await demande.deleteOne();
    res.json({ message: 'Demande supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  creerDemandePriere,
  demandesDeMonVillage,
  changerStatutDemande,
  supprimerDemande,
};
