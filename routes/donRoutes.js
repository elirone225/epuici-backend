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
const {
  resumeEglise,
  transactionsEglise,
  transactionEglise,
  exporterEglise,
} = require('../controllers/donEgliseController');
const { protect, autoriserRoles, autoriserTresorier } = require('../middleware/authMiddleware');

// Public
router.get('/config', configurationDons);

// Webhook Wave : appelé par Wave, authentifié par sa signature (pas de JWT)
router.post('/webhook-wave', webhookWave);

// Page de paiement simulée (uniquement si WAVE_SIMULATION=true sans clé Wave)
router.get('/simulation/:id', pageSimulation);
router.post('/simulation/:id', express.urlencoded({ extended: false }), validerSimulation);

// Trésorier de l'église : menu "Dons & Dîmes" (limité à son église)
router.get('/eglise/resume', protect, autoriserTresorier, resumeEglise);
router.get('/eglise/transactions', protect, autoriserTresorier, transactionsEglise);
router.get('/eglise/transactions/:id', protect, autoriserTresorier, transactionEglise);
router.get('/eglise/export', protect, autoriserTresorier, exporterEglise);

// Fidèle connecté
router.post('/', protect, autoriserRoles('utilisateur'), creerTransaction);
router.get('/mes-transactions', protect, autoriserRoles('utilisateur'), mesTransactions);
router.get('/:id', protect, autoriserRoles('utilisateur'), obtenirTransaction);
router.post('/:id/annuler', protect, autoriserRoles('utilisateur'), annulerTransaction);

// Reçu PDF : le fidèle concerné ou le trésorier de son église
router.get('/:id/recu', protect, autoriserRoles('utilisateur', 'villageadmin'), recuTransaction);

module.exports = router;
