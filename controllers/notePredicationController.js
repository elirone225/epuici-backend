const NotePredication = require('../models/NotePredication');

// Notes de prédication : données personnelles du fidèle connecté uniquement

const CLE_VALIDE = /^(vod:[a-f0-9]{24}|direct:[a-f0-9]{24}:\d{4}-\d{2}-\d{2})$/;
const LIEN_VALIDE = /^https?:\/\/\S+$/i;

const versClient = (note) => ({
  cleVideo: note.cleVideo,
  titreVideo: note.titreVideo,
  lienVideo: note.lienVideo,
  texte: note.texte,
  updatedAt: note.updatedAt,
});

// @route GET /api/notes-predication
// Toutes mes notes, les plus récemment modifiées d'abord
const mesNotes = async (req, res) => {
  try {
    const notes = await NotePredication.find({ utilisateur: req.user._id, texte: { $ne: '' } })
      .sort({ updatedAt: -1 })
      .limit(300);
    res.json(notes.map(versClient));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/notes-predication/:cle
const maNote = async (req, res) => {
  try {
    if (!CLE_VALIDE.test(req.params.cle)) {
      return res.status(400).json({ message: 'Vidéo invalide.' });
    }
    const note = await NotePredication.findOne({ utilisateur: req.user._id, cleVideo: req.params.cle });
    res.json(note ? versClient(note) : { cleVideo: req.params.cle, texte: '', titreVideo: '', lienVideo: '', updatedAt: null });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/notes-predication/:cle   { texte, titreVideo, lienVideo }
// Enregistrement automatique depuis l'app (crée la note si besoin)
const enregistrerNote = async (req, res) => {
  try {
    if (!CLE_VALIDE.test(req.params.cle)) {
      return res.status(400).json({ message: 'Vidéo invalide.' });
    }
    const texte = String(req.body.texte ?? '');
    if (texte.length > 20000) {
      return res.status(400).json({ message: 'Notes trop longues (20 000 caractères maximum).' });
    }
    const lien = String(req.body.lienVideo || '').trim();
    const note = await NotePredication.findOneAndUpdate(
      { utilisateur: req.user._id, cleVideo: req.params.cle },
      {
        texte,
        titreVideo: String(req.body.titreVideo || '').trim().slice(0, 200),
        lienVideo: LIEN_VALIDE.test(lien) ? lien.slice(0, 500) : '',
      },
      { upsert: true, new: true, runValidators: true }
    );
    res.json(versClient(note));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/notes-predication/:cle
const supprimerNote = async (req, res) => {
  try {
    await NotePredication.deleteOne({ utilisateur: req.user._id, cleVideo: req.params.cle });
    res.json({ message: 'Notes supprimées.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = { mesNotes, maNote, enregistrerNote, supprimerNote };
