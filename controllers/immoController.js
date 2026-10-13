const ImmoOffre = require('../models/ImmoOffre');

const TYPES_IMMO = ['terrain_vente', 'terrain_achat', 'maison_vente', 'maison_location'];

// @route POST /api/immo-offres
// Réservé au Village Admin, abonnement actif obligatoire
const creerOffre = async (req, res) => {
  try {
    const { type, titre, description, prix, localisation, contact } = req.body;

    if (!['terrain_vente', 'terrain_achat', 'maison_vente', 'maison_location', 'emploi'].includes(type)) {
      return res.status(400).json({ message: 'Type d\'offre invalide.' });
    }

    // Le prix est obligatoire pour les offres immo, pas pour l'emploi
    if (TYPES_IMMO.includes(type) && !prix) {
      return res.status(400).json({ message: 'Le prix est obligatoire pour ce type d\'offre.' });
    }

    const photos = req.files ? req.files.map((fichier) => fichier.path) : [];

    if (TYPES_IMMO.includes(type) && photos.length > 3) {
      return res.status(400).json({ message: 'Maximum 3 photos par offre.' });
    }

    const offre = await ImmoOffre.create({
      village: req.user.village,
      auteur: req.user._id,
      type,
      titre,
      description,
      prix: TYPES_IMMO.includes(type) ? prix : undefined,
      localisation,
      contact,
      photos,
    });

    res.status(201).json(offre);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/immo-offres/village/:villageId
// Public : liste des offres d'un village, filtrable par type
const listerOffresParVillage = async (req, res) => {
  try {
    const { type, page = 1, limite = 20 } = req.query;

    const filtre = { village: req.params.villageId, statut: 'disponible' };
    if (type) filtre.type = type;

    const offres = await ImmoOffre.find(filtre)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limite)
      .limit(Number(limite));

    const total = await ImmoOffre.countDocuments(filtre);

    res.json({ offres, total, page: Number(page), totalPages: Math.ceil(total / limite) });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/immo-offres/:id
const obtenirOffre = async (req, res) => {
  try {
    const offre = await ImmoOffre.findById(req.params.id).populate('village', 'nom');
    if (!offre) {
      return res.status(404).json({ message: 'Offre introuvable.' });
    }
    res.json(offre);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/immo-offres/mes-offres
// Le Village Admin voit toutes ses offres pour son dashboard
const mesOffres = async (req, res) => {
  try {
    const offres = await ImmoOffre.find({ village: req.user.village }).sort({ createdAt: -1 });
    res.json(offres);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/immo-offres/:id
const modifierOffre = async (req, res) => {
  try {
    const offre = await ImmoOffre.findById(req.params.id);
    if (!offre) {
      return res.status(404).json({ message: 'Offre introuvable.' });
    }
    if (offre.auteur.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Vous n'êtes pas l'auteur de cette offre." });
    }

    const { titre, description, prix, localisation, contact, statut } = req.body;

    if (titre) offre.titre = titre;
    if (description) offre.description = description;
    if (prix) offre.prix = prix;
    if (localisation) offre.localisation = localisation;
    if (contact) offre.contact = contact;
    if (statut) offre.statut = statut;

    if (req.files && req.files.length > 0) {
      if (req.files.length > 3) {
        return res.status(400).json({ message: 'Maximum 3 photos par offre.' });
      }
      offre.photos = req.files.map((fichier) => fichier.path);
    }

    const offreModifiee = await offre.save();
    res.json(offreModifiee);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/immo-offres/:id
const supprimerOffre = async (req, res) => {
  try {
    const offre = await ImmoOffre.findById(req.params.id);
    if (!offre) {
      return res.status(404).json({ message: 'Offre introuvable.' });
    }
    if (offre.auteur.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Vous n'êtes pas l'auteur de cette offre." });
    }
    await offre.deleteOne();
    res.json({ message: 'Offre supprimée avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  creerOffre,
  listerOffresParVillage,
  obtenirOffre,
  mesOffres,
  modifierOffre,
  supprimerOffre,
};
