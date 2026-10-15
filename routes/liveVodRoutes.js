const express = require('express');
const router = express.Router();
const {
  obtenirLiveVod,
  listerVideos,
  monDirect,
  modifierDirect,
  ajouterVideo,
  supprimerVideo,
  chatDirect,
  envoyerMessageDirect,
  supprimerMessageDirect,
} = require('../controllers/liveVodController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');
const verifierAbonnementActif = require('../middleware/subscriptionMiddleware');
const { uploadVideoPubReportage } = require('../middleware/uploadMiddleware');

// Village Admin : uniquement le lien du direct de son église
// (abonnement actif requis pour le publier, comme pour les articles)
router.get('/mon-direct', protect, autoriserRoles('villageadmin'), monDirect);
router.put('/direct', protect, autoriserRoles('villageadmin'), verifierAbonnementActif, modifierDirect);

// Super Admin : vidéos visibles par tous les fidèles
router.post('/videos', protect, autoriserRoles('superadmin'), uploadVideoPubReportage, ajouterVideo);
router.delete('/videos/:id', protect, autoriserRoles('superadmin'), supprimerVideo);

// Chat en direct : fidèles de l'église et ses comptes admin
const membresEtEglise = [protect, autoriserRoles('utilisateur', 'villageadmin')];
router.get('/village/:villageId/chat', ...membresEtEglise, chatDirect);
router.post('/village/:villageId/chat', ...membresEtEglise, envoyerMessageDirect);
router.delete('/chat/:messageId', ...membresEtEglise, supprimerMessageDirect);

// Public (app mobile)
router.get('/videos', listerVideos);
router.get('/village/:villageId', obtenirLiveVod);

module.exports = router;
