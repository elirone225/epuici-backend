const Article = require('../models/Article');
const { notifierAbonnesDuVillage } = require('../services/notificationService');

// @route POST /api/articles
// Réservé au Village Admin, avec abonnement actif obligatoire
const creerArticle = async (req, res) => {
  try {
    const { titre, contenu, categorie, statut } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Veuillez ajouter entre 1 et 3 photos.' });
    }
    if (req.files.length > 3) {
      return res.status(400).json({ message: 'Maximum 3 photos par article.' });
    }

    const photos = req.files.map((fichier) => fichier.path); // URL Cloudinary

    const article = await Article.create({
      village: req.user.village,
      auteur: req.user._id,
      titre,
      contenu,
      categorie: categorie || 'actualites',
      photos,
      statut: statut === 'publie' ? 'publie' : 'brouillon',
    });

    if (article.statut === 'publie') {
      notifierAbonnesDuVillage(article);
    }

    res.status(201).json(article);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/articles/village/:villageId
// Public : fil d'actualité d'un village pour l'app mobile (articles publiés uniquement)
const listerArticlesParVillage = async (req, res) => {
  try {
    const { page = 1, limite = 20, categorie } = req.query;

    const filtre = { village: req.params.villageId, statut: 'publie' };
    if (categorie) filtre.categorie = categorie;

    const articles = await Article.find(filtre)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limite)
      .limit(Number(limite))
      .populate('village', 'nom');

    const total = await Article.countDocuments(filtre);

    res.json({ articles, total, page: Number(page), totalPages: Math.ceil(total / limite) });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/articles/fil
// Public : fil combiné pour plusieurs villages suivis (app mobile, écran "Pour vous")
// Query param : ?villages=id1,id2,id3
const filDActualite = async (req, res) => {
  try {
    const { villages, page = 1, limite = 20 } = req.query;

    if (!villages) {
      return res.status(400).json({ message: 'Veuillez fournir au moins une église.' });
    }

    const idsVillages = villages.split(',');

    const articles = await Article.find({ village: { $in: idsVillages }, statut: 'publie' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limite)
      .limit(Number(limite))
      .populate('village', 'nom');

    res.json(articles);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/articles/:id
const obtenirArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id).populate('village', 'nom');
    if (!article) {
      return res.status(404).json({ message: 'Article introuvable.' });
    }

    // Incrémente les vues à chaque consultation
    article.vues += 1;
    await article.save();

    res.json(article);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route GET /api/articles/mes-articles
// Le Village Admin voit tous SES articles (brouillons + publiés) pour son dashboard
const mesArticles = async (req, res) => {
  try {
    const articles = await Article.find({ village: req.user.village }).sort({ createdAt: -1 });
    res.json(articles);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/articles/:id
// Réservé à l'auteur (Village Admin), abonnement actif requis pour republier
const modifierArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ message: 'Article introuvable.' });
    }

    if (article.auteur.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Vous n'êtes pas l'auteur de cet article." });
    }

    const { titre, contenu, categorie, statut } = req.body;
    const statutAvant = article.statut;

    if (titre) article.titre = titre;
    if (contenu) article.contenu = contenu;
    if (categorie) article.categorie = categorie;
    if (statut) article.statut = statut;

    if (req.files && req.files.length > 0) {
      if (req.files.length > 3) {
        return res.status(400).json({ message: 'Maximum 3 photos par article.' });
      }
      article.photos = req.files.map((fichier) => fichier.path);
    }

    const articleModifie = await article.save();

    if (statutAvant !== 'publie' && articleModifie.statut === 'publie') {
      notifierAbonnesDuVillage(articleModifie);
    }

    res.json(articleModifie);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/articles/:id
const supprimerArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ message: 'Article introuvable.' });
    }

    if (article.auteur.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Vous n'êtes pas l'auteur de cet article." });
    }

    await article.deleteOne();
    res.json({ message: 'Article supprimé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route PUT /api/articles/:id/like
// Public : un habitant like un article
const likerArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ message: 'Article introuvable.' });
    }
    article.likes += 1;
    await article.save();
    res.json({ likes: article.likes });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  creerArticle,
  listerArticlesParVillage,
  filDActualite,
  obtenirArticle,
  mesArticles,
  modifierArticle,
  supprimerArticle,
  likerArticle,
};
