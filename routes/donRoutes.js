const express = require('express');
const router = express.Router();
const {
  configurationDons,
  creerTransaction,
  obtenirTransaction,
  annulerTransaction,
  mesTransactions,
  recuTransaction,
  webhookWave,
  pageSimulation,
  validerSimulation,
} = require('../controllers/donController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');

// Public
router.get('/config', configurationDons);

// Webhook Wave : appelé par Wave, authentifié par sa signature (pas de JWT)
router.post('/webhook-wave', webhookWave);

// Page de paiement simulée (uniquement si WAVE_SIMULATION=true sans clé Wave)
router.get('/simulation/:id', pageSimulation);
router.post('/simulation/:id', express.urlencoded({ extended: false }), validerSimulation);

// Fidèle connecté
router.post('/', protect, autoriserRoles('utilisateur'), creerTransaction);
router.get('/mes-transactions', protect, autoriserRoles('utilisateur'), mesTransactions);
router.get('/:id', protect, autoriserRoles('utilisateur'), obtenirTransaction);
router.post('/:id/annuler', protect, autoriserRoles('utilisateur'), annulerTransaction);

// Reçu PDF : le fidèle concerné ou l'admin de son église
router.get('/:id/recu', protect, autoriserRoles('utilisateur', 'villageadmin'), recuTransaction);

module.exports = router;
