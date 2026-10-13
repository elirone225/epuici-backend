const express = require('express');
const router = express.Router();
const {
  souscrireAbonnement,
  webhookWave,
  validerPaiementManuellement,
  monHistoriqueAbonnements,
  listerTousLesAbonnements,
  supprimerAbonnement,
} = require('../controllers/abonnementController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');

// Village Admin
router.post('/souscrire', protect, autoriserRoles('villageadmin'), souscrireAbonnement);
router.get('/mon-historique', protect, autoriserRoles('villageadmin'), monHistoriqueAbonnements);

// Webhook Wave (appelé automatiquement par Wave, pas par un utilisateur connecté)
router.post('/webhook-wave', webhookWave);

// Super Admin
router.get('/', protect, autoriserRoles('superadmin'), listerTousLesAbonnements);
router.post(
  '/:id/valider-manuellement',
  protect,
  autoriserRoles('superadmin'),
  validerPaiementManuellement
);
router.delete('/:id', protect, autoriserRoles('superadmin'), supprimerAbonnement);

module.exports = router;
