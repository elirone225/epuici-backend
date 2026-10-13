const PubReportage = require('../models/PubReportage');
const PubReportageCommentaire = require('../models/PubReportageCommentaire');

// @route POST /api/pub-reportages
// Réservé au Super Admin : publie une vidéo publicitaire ou un reportage
const creerPubReportage = async (req, res) => {
  try {
    const { titre, description, type, villageId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Veuillez ajouter une vidéo.' });
    }

    const pubReportage = await PubReportage.create({
      titre,
      description,
      type: type === 'publicite' ? 'publicite' : 'reportage',
      village: villageId || null,
      videoUrl: req.file.path,
      auteur: req.user._id,
    });

    res.status(201).json(pubReportage);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/pub-reportages
// Public : fil de toutes les vidéos publicitaires et reportages, tous villages
// confondus, visible par tous les utilisateurs (app mobile, défilement TikTok-like)
const listerPubReportages = async (req, res) => {
  try {
    const { page = 1, limite = 20 } = req.query;

    const pubReportages = await PubReportage.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limite)
      .limit(Number(limite))
      .populate('village', 'nom');

    const avecNombreCommentaires = await Promise.all(
      pubReportages.map(async (video) => {
        const nombreCommentaires = await PubReportageCommentaire.countDocuments({
          pubReportage: video._id,
        });
        return { ...video.toObject(), nombreCommentaires };
      })
    );

    const total = await PubReportage.countDocuments();

    res.json({
      pubReportages: avecNombreCommentaires,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limite),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/pub-reportages/:id
// Réservé au Super Admin
const supprimerPubReportage = async (req, res) => {
  try {
    const pubReportage = await PubReportage.findById(req.params.id);
    if (!pubReportage) {
      return res.status(404).json({ message: 'Vidéo introuvable.' });
    }

    await pubReportage.deleteOne();
    await PubReportageCommentaire.deleteMany({ pubReportage: pubReportage._id });
    res.json({ message: 'Vidéo supprimée avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/pub-reportages/:id/like
// Public : tout utilisateur (tous villages confondus) peut liker une vidéo
const likerPubReportage = async (req, res) => {
  try {
    const pubReportage = await PubReportage.findById(req.params.id);
    if (!pubReportage) {
      return res.status(404).json({ message: 'Vidéo introuvable.' });
    }
    pubReportage.likes += 1;
    await pubReportage.save();
    res.json({ likes: pubReportage.likes });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/pub-reportages/:id/vue
// Public : incrémente le compteur de vues (appelé une fois par l'app quand
// la vidéo devient active à l'écran)
const enregistrerVue = async (req, res) => {
  try {
    const pubReportage = await PubReportage.findByIdAndUpdate(
      req.params.id,
      { $inc: { vues: 1 } },
      { new: true }
    );
    if (!pubReportage) {
      return res.status(404).json({ message: 'Vidéo introuvable.' });
    }
    res.json({ vues: pubReportage.vues });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/pub-reportages/:id/commentaires
// Public : commentaires d'une vidéo, les plus récents en premier
const listerCommentaires = async (req, res) => {
  try {
    const commentaires = await PubReportageCommentaire.find({
      pubReportage: req.params.id,
    })
      .sort({ createdAt: -1 })
      .populate('auteur', 'nom photoProfil')
      .populate({
        path: 'repondreA',
        select: 'auteur',
        populate: { path: 'auteur', select: 'nom' },
      });

    res.json(commentaires);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/pub-reportages/:id/commentaires
// Réservé aux utilisateurs connectés (habitants), tous villages confondus.
// `repondreA` (optionnel) permet de répondre au commentaire de son choix.
const ajouterCommentaire = async (req, res) => {
  try {
    const { texte, repondreA } = req.body;

    if (!texte || !texte.trim()) {
      return res.status(400).json({ message: 'Le commentaire ne peut pas être vide.' });
    }

    const pubReportage = await PubReportage.findById(req.params.id);
    if (!pubReportage) {
      return res.status(404).json({ message: 'Vidéo introuvable.' });
    }

    let commentaireParent = null;
    if (repondreA) {
      commentaireParent = await PubReportageCommentaire.findOne({
        _id: repondreA,
        pubReportage: pubReportage._id,
      });
      if (!commentaireParent) {
        return res.status(404).json({ message: 'Commentaire introuvable.' });
      }
    }

    const commentaire = await PubReportageCommentaire.create({
      pubReportage: pubReportage._id,
      auteur: req.user._id,
      texte: texte.trim(),
      repondreA: commentaireParent ? commentaireParent._id : null,
    });

    const commentaireComplet = await PubReportageCommentaire.findById(commentaire._id)
      .populate('auteur', 'nom photoProfil')
      .populate({
        path: 'repondreA',
        select: 'auteur',
        populate: { path: 'auteur', select: 'nom' },
      });

    res.status(201).json(commentaireComplet);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  creerPubReportage,
  listerPubReportages,
  supprimerPubReportage,
  likerPubReportage,
  enregistrerVue,
  listerCommentaires,
  ajouterCommentaire,
};
