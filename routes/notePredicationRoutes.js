const express = require('express');
const router = express.Router();
const { mesNotes, maNote, enregistrerNote, supprimerNote } = require('../controllers/notePredicationController');
const { protect, autoriserRoles } = require('../middleware/authMiddleware');

// Notes personnelles du fidèle connecté sur les prédications (vidéos)
router.use(protect, autoriserRoles('utilisateur'));
router.get('/', mesNotes);
router.get('/:cle', maNote);
router.put('/:cle', enregistrerNote);
router.delete('/:cle', supprimerNote);

module.exports = router;
