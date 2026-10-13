const express = require('express');
const router = express.Router();
const {
  creerPubReportage,
  listerPubReportages,
  supprimerPubReportage,
  likerPubReportage,
  enregistrerVue,
  listerCommentaires,
  ajouterCommentaire,
} = require('../controllers/pubReportageController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');
const { uploadVideoPubReportage } = require('../middleware/uploadMiddleware');

// Public : fil de vidéos pour l'app mobile
router.get('/', listerPubReportages);

// Public : liker une vidéo (tous villages confondus)
router.put('/:id/like', likerPubReportage);

// Public : enregistrer une vue (tous villages confondus)
router.put('/:id/vue', enregistrerVue);

// Commentaires : lecture publique, écriture réservée aux utilisateurs connectés
router.get('/:id/commentaires', listerCommentaires);
router.post(
  '/:id/commentaires',
  protect,
  autoriserRoles('utilisateur'),
  ajouterCommentaire
);

// Réservé au Super Admin
router.post(
  '/',
  protect,
  autoriserRoles('superadmin'),
  uploadVideoPubReportage,
  creerPubReportage
);
router.delete('/:id', protect, autoriserRoles('superadmin'), supprimerPubReportage);

module.exports = router;
