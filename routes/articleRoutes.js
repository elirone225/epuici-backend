const express = require('express');
const router = express.Router();
const {
  creerArticle,
  listerArticlesParVillage,
  filDActualite,
  obtenirArticle,
  mesArticles,
  modifierArticle,
  supprimerArticle,
  likerArticle,
} = require('../controllers/articleController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');
const verifierAbonnementActif = require('../middleware/subscriptionMiddleware');
const { uploadPhotosArticle } = require('../middleware/uploadMiddleware');

// Village Admin - routes protégées
router.get('/mes-articles', protect, autoriserRoles('villageadmin'), mesArticles);

// Créer un article : connexion + rôle + ABONNEMENT ACTIF obligatoire
router.post(
  '/',
  protect,
  autoriserRoles('villageadmin'),
  verifierAbonnementActif,
  uploadPhotosArticle,
  creerArticle
);

router.put(
  '/:id',
  protect,
  autoriserRoles('villageadmin'),
  verifierAbonnementActif,
  uploadPhotosArticle,
  modifierArticle
);

router.delete('/:id', protect, autoriserRoles('villageadmin'), supprimerArticle);

// Routes publiques (app mobile, aucune connexion requise)
router.get('/fil', filDActualite);
router.get('/village/:villageId', listerArticlesParVillage);
router.get('/:id', obtenirArticle);
router.put('/:id/like', likerArticle);

module.exports = router;
