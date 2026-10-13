const Alerte = require('../models/Alerte');
const Village = require('../models/Village');
const Utilisateur = require('../models/Utilisateur');

// @route POST /api/alertes
// Réservé aux habitants connectés : signale un évènement au Village Admin
// du village choisi, avec description et photos facultatives.
const creerAlerte = async (req, res) => {
  try {
    if (req.user.alertesBloquees) {
      return res.status(403).json({
        message:
          "Vous n'êtes plus autorisé à envoyer des alertes. Contactez l'admin de votre église.",
      });
    }

    const { village, description } = req.body;

    if (!village) {
      return res.status(400).json({ message: 'Veuillez choisir une église.' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ message: "Veuillez décrire l'évènement." });
    }

    const villageExiste = await Village.findById(village);
    if (!villageExiste) {
      return res.status(404).json({ message: 'Église introuvable.' });
    }

    if (req.files && req.files.length > 3) {
      return res.status(400).json({ message: 'Maximum 3 photos par alerte.' });
    }

    const photos = (req.files || []).map((fichier) => fichier.path); // URLs Cloudinary

    const alerte = await Alerte.create({
      village,
      utilisateur: req.user._id,
      description: description.trim(),
      photos,
    });

    res.status(201).json(alerte);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/alertes/mon-village
// Réservé au Village Admin : liste les alertes envoyées par les habitants
// pour son propre village.
const alertesDeMonVillage = async (req, res) => {
  try {
    const alertes = await Alerte.find({ village: req.user.village })
      .populate('utilisateur', 'nom telephone alertesBloquees')
      .sort({ createdAt: -1 });

    res.json(alertes);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/alertes/:id/statut
// Réservé au Village Admin : marque une alerte de son village comme traitée
// (ou la remet à "nouvelle").
const changerStatutAlerte = async (req, res) => {
  try {
    const alerte = await Alerte.findById(req.params.id);
    if (!alerte) {
      return res.status(404).json({ message: 'Alerte introuvable.' });
    }

    if (alerte.village.toString() !== req.user.village.toString()) {
      return res.status(403).json({ message: 'Cette alerte ne concerne pas votre église.' });
    }

    alerte.statut = alerte.statut === 'traitee' ? 'nouvelle' : 'traitee';
    await alerte.save();

    res.json(alerte);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/alertes/:id
// Réservé au Village Admin : supprime une alerte de son village.
const supprimerAlerte = async (req, res) => {
  try {
    const alerte = await Alerte.findById(req.params.id);
    if (!alerte) {
      return res.status(404).json({ message: 'Alerte introuvable.' });
    }
    if (alerte.village.toString() !== req.user.village.toString()) {
      return res.status(403).json({ message: 'Cette alerte ne concerne pas votre église.' });
    }

    await alerte.deleteOne();
    res.json({ message: 'Alerte supprimée.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/alertes
// Réservé au Village Admin : supprime plusieurs alertes de son village.
// Body : { ids: [...] } pour une sélection, ou { tout: true } pour tout supprimer.
const supprimerAlertes = async (req, res) => {
  try {
    const { ids, tout } = req.body;

    if (tout) {
      const resultat = await Alerte.deleteMany({ village: req.user.village });
      return res.json({ message: `${resultat.deletedCount} alerte(s) supprimée(s).` });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Aucune alerte sélectionnée.' });
    }

    const resultat = await Alerte.deleteMany({
      _id: { $in: ids },
      village: req.user.village,
    });

    res.json({ message: `${resultat.deletedCount} alerte(s) supprimée(s).` });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/alertes/utilisateur/:utilisateurId/bloquer
// Réservé au Village Admin : empêche/autorise un habitant à envoyer de
// nouvelles alertes (ex: fausses alertes répétées). L'admin ne peut agir
// que sur un habitant ayant déjà envoyé une alerte à son propre village.
const bloquerEnvoiAlertesUtilisateur = async (req, res) => {
  try {
    const { utilisateurId } = req.params;

    const aDejaAlerte = await Alerte.exists({
      utilisateur: utilisateurId,
      village: req.user.village,
    });
    if (!aDejaAlerte) {
      return res
        .status(403)
        .json({ message: "Ce fidèle n'a envoyé aucune alerte à votre église." });
    }

    const utilisateur = await Utilisateur.findById(utilisateurId);
    if (!utilisateur) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    utilisateur.alertesBloquees = !utilisateur.alertesBloquees;
    await utilisateur.save();

    res.json({
      message: utilisateur.alertesBloquees
        ? "Ce fidèle ne peut plus envoyer d'alertes."
        : 'Ce fidèle peut de nouveau envoyer des alertes.',
      alertesBloquees: utilisateur.alertesBloquees,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  creerAlerte,
  alertesDeMonVillage,
  changerStatutAlerte,
  supprimerAlerte,
  supprimerAlertes,
  bloquerEnvoiAlertesUtilisateur,
};
