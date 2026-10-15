const express = require('express');
const router = express.Router();
const { partageArticle, partageEvenement } = require('../controllers/partageController');

// Liens partagés sur WhatsApp & co (aperçu lisible puis ouverture de la PWA)
router.get('/article/:id', partageArticle);
router.get('/evenement/:id', partageEvenement);

module.exports = router;
