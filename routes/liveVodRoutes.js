const express = require('express');
const router = express.Router();
const {
  obtenirLiveVod,
  listerVideos,
  monDirect,
  modifierDirect,
  ajouterVideo,
  supprimerVideo,
} = require('../controllers/liveVodController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');
const verifierAbonnementActif = require('../middleware/subscriptionMiddleware');

// Village Admin : uniquement le lien du direct de son église
// (abonnement actif requis pour le publier, comme pour les articles)
router.get('/mon-direct', protect, autoriserRoles('villageadmin'), monDirect);
router.put('/direct', protect, autoriserRoles('villageadmin'), verifierAbonnementActif, modifierDirect);

// Super Admin : vidéos visibles par tous les fidèles
router.post('/videos', protect, autoriserRoles('superadmin'), ajouterVideo);
router.delete('/videos/:id', protect, autoriserRoles('superadmin'), supprimerVideo);

// Public (app mobile)
router.get('/videos', listerVideos);
router.get('/village/:villageId', obtenirLiveVod);

module.exports = router;
