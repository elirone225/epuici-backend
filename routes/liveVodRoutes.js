const express = require('express');
const router = express.Router();
const {
  obtenirLiveVod,
  monLiveVod,
  modifierDirect,
  ajouterVideo,
  supprimerVideo,
} = require('../controllers/liveVodController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');
const verifierAbonnementActif = require('../middleware/subscriptionMiddleware');

// Village Admin : gère le direct et les vidéos de son église
// (publier exige un abonnement actif, comme pour les articles)
router.get('/mon-village', protect, autoriserRoles('villageadmin'), monLiveVod);
router.put(
  '/direct',
  protect,
  autoriserRoles('villageadmin'),
  verifierAbonnementActif,
  modifierDirect
);
router.post(
  '/videos',
  protect,
  autoriserRoles('villageadmin'),
  verifierAbonnementActif,
  ajouterVideo
);
router.delete('/videos/:id', protect, autoriserRoles('villageadmin'), supprimerVideo);

// Public (app mobile)
router.get('/village/:villageId', obtenirLiveVod);

module.exports = router;
