const Abonnement = require('../models/Abonnement');
const { FORMULES } = require('../models/Abonnement');
const VillageAdmin = require('../models/VillageAdmin');
const { initierPaiementWave } = require('../services/waveService');

// @route POST /api/abonnements/souscrire
// Le Village Admin choisit une formule et initie le paiement
const souscrireAbonnement = async (req, res) => {
  try {
    const { formule } = req.body;

    if (!FORMULES[formule]) {
      return res.status(400).json({
        message: 'Formule invalide.',
        formulesDisponibles: Object.keys(FORMULES),
      });
    }

    const { prix } = FORMULES[formule];

    const abonnement = await Abonnement.create({
      villageAdmin: req.user._id,
      formule,
      montant: prix,
      statutPaiement: 'en_attente',
    });

    const paiement = await initierPaiementWave({
      montant: prix,
      referenceCommande: abonnement._id.toString(),
      description: `Abonnement EPUICI - Formule ${formule}`,
    });

    abonnement.referenceWave = paiement.idTransaction;
    await abonnement.save();

    res.status(201).json({
      abonnementId: abonnement._id,
      montant: prix,
      lienPaiement: paiement.lienPaiement,
      simulation: paiement.simulation || false,
      message: paiement.simulation
        ? 'Mode simulation : Wave non encore configuré. Utilisez la validation manuelle pour tester.'
        : "Redirigez l'admin de l'église vers ce lien pour finaliser le paiement Wave.",
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// Fonction commune : active l'abonnement une fois le paiement confirmé
const activerAbonnement = async (abonnement) => {
  const { jours } = FORMULES[abonnement.formule];

  abonnement.statutPaiement = 'valide';
  abonnement.dateDebut = new Date();
  abonnement.dateFin = new Date(Date.now() + jours * 24 * 60 * 60 * 1000);
  await abonnement.save();

  const admin = await VillageAdmin.findById(abonnement.villageAdmin);

  // Si l'admin a déjà un abonnement actif en cours, on prolonge à partir de sa date de fin
  // plutôt que d'écraser (utile pour un renouvellement anticipé)
  const dateDepart =
    admin.abonnementExpireLe && new Date(admin.abonnementExpireLe) > new Date()
      ? new Date(admin.abonnementExpireLe)
      : new Date();

  admin.abonnementActif = abonnement._id;
  admin.abonnementExpireLe = new Date(dateDepart.getTime() + jours * 24 * 60 * 60 * 1000);
  await admin.save();

  return admin;
};

// @route POST /api/abonnements/webhook-wave
// Appelée automatiquement par Wave quand un paiement est confirmé
const webhookWave = async (req, res) => {
  try {
    // À ajuster selon le format exact envoyé par Wave (nom des champs, signature à vérifier)
    const { client_reference, status } = req.body;

    if (status !== 'succeeded' && status !== 'completed') {
      return res.status(200).json({ message: 'Paiement non confirmé, ignoré.' });
    }

    const abonnement = await Abonnement.findById(client_reference);
    if (!abonnement) {
      return res.status(404).json({ message: 'Abonnement introuvable.' });
    }

    if (abonnement.statutPaiement === 'valide') {
      return res.status(200).json({ message: 'Déjà validé.' });
    }

    await activerAbonnement(abonnement);
    res.status(200).json({ message: 'Abonnement activé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/abonnements/:id/valider-manuellement
// Réservé au Super Admin — utile pour TESTER en attendant l'intégration Wave réelle,
// ou pour régulariser un paiement reçu hors-ligne (Orange Money, espèces, etc.)
const validerPaiementManuellement = async (req, res) => {
  try {
    const abonnement = await Abonnement.findById(req.params.id);
    if (!abonnement) {
      return res.status(404).json({ message: 'Abonnement introuvable.' });
    }

    if (abonnement.statutPaiement === 'valide') {
      return res.status(400).json({ message: 'Cet abonnement est déjà validé.' });
    }

    const admin = await activerAbonnement(abonnement);

    res.json({
      message: 'Paiement validé manuellement, abonnement activé.',
      abonnement,
      abonnementExpireLe: admin.abonnementExpireLe,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/abonnements/mon-historique
// Le Village Admin consulte l'historique de ses paiements
const monHistoriqueAbonnements = async (req, res) => {
  try {
    const historique = await Abonnement.find({ villageAdmin: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(historique);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/abonnements
// Réservé au Super Admin — vue globale de tous les abonnements
const listerTousLesAbonnements = async (req, res) => {
  try {
    const abonnements = await Abonnement.find()
      .populate({
        path: 'villageAdmin',
        select: 'nom telephone village',
        populate: { path: 'village', select: 'nom' },
      })
      .sort({ createdAt: -1 });
    res.json(abonnements);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/abonnements/:id
// Réservé au Super Admin — supprime manuellement un abonnement de la liste
const supprimerAbonnement = async (req, res) => {
  try {
    const abonnement = await Abonnement.findById(req.params.id);
    if (!abonnement) {
      return res.status(404).json({ message: 'Abonnement introuvable.' });
    }

    await abonnement.deleteOne();
    res.json({ message: 'Abonnement supprimé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  activerAbonnement, // réutilisé par le webhook Wave commun (/api/dons/webhook-wave)
  souscrireAbonnement,
  webhookWave,
  validerPaiementManuellement,
  monHistoriqueAbonnements,
  listerTousLesAbonnements,
  supprimerAbonnement,
};
