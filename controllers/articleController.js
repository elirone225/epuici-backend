const Article = require('../models/Article');
const { filtreCategorie } = require('../models/Article');
const ArticleCommentaire = require('../models/ArticleCommentaire');
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
      categorie: categorie || 'annonce',
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

    const filtre = { village: req.params.villageId, statut: 'publie', ...filtreCategorie(categorie) };

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
    const { villages, page = 1, limite = 20, categorie } = req.query;

    if (!villages) {
      return res.status(400).json({ message: 'Veuillez fournir au moins une église.' });
    }

    const idsVillages = villages.split(',');

    const articles = await Article.find({
      village: { $in: idsVillages },
      statut: 'publie',
      ...filtreCategorie(categorie),
    })
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

    // Admin et trésorier gèrent toutes les publications de leur église
    if (article.village.toString() !== req.user.village.toString()) {
      return res.status(403).json({ message: "Cet article n'appartient pas à votre église." });
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

    // Admin et trésorier gèrent toutes les publications de leur église
    if (article.village.toString() !== req.user.village.toString()) {
      return res.status(403).json({ message: "Cet article n'appartient pas à votre église." });
    }

    await ArticleCommentaire.deleteMany({ article: article._id });
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

// --- Commentaires ---

// Le fidèle doit suivre l'église de la publication pour commenter
const suitLEglise = (utilisateur, villageId) =>
  (utilisateur.villagesSuivis || []).some((v) => v.toString() === villageId.toString());

// @route GET /api/articles/:id/commentaires
// Public : commentaires d'une publication, du plus ancien au plus récent
const listerCommentaires = async (req, res) => {
  try {
    const commentaires = await ArticleCommentaire.find({ article: req.params.id })
      .populate('auteur', 'nom photoProfil')
      .sort({ createdAt: 1 })
      .limit(500);
    res.json(commentaires);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route POST /api/articles/:id/commentaires
// Fidèle connecté, membre de l'église de la publication
const ajouterCommentaire = async (req, res) => {
  try {
    const texte = (req.body.texte || '').trim();
    if (!texte) {
      return res.status(400).json({ message: 'Votre commentaire est vide.' });
    }
    if (texte.length > 1000) {
      return res.status(400).json({ message: 'Commentaire trop long (1000 caractères maximum).' });
    }

    const article = await Article.findOne({ _id: req.params.id, statut: 'publie' });
    if (!article) {
      return res.status(404).json({ message: 'Publication introuvable.' });
    }
    if (!suitLEglise(req.user, article.village)) {
      return res.status(403).json({ message: 'Seuls les membres de cette église peuvent commenter.' });
    }

    const commentaire = await ArticleCommentaire.create({
      article: article._id,
      village: article.village,
      auteur: req.user._id,
      texte,
    });
    await Article.updateOne({ _id: article._id }, { $inc: { nombreCommentaires: 1 } });
    await commentaire.populate('auteur', 'nom photoProfil');

    res.status(201).json(commentaire);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

// @route DELETE /api/articles/commentaires/:commentaireId
// L'auteur du commentaire, ou l'admin / le trésorier de l'église (modération)
const supprimerCommentaire = async (req, res) => {
  try {
    const commentaire = await ArticleCommentaire.findById(req.params.commentaireId);
    if (!commentaire) {
      return res.status(404).json({ message: 'Commentaire introuvable.' });
    }
    const autorise =
      req.role === 'utilisateur'
        ? commentaire.auteur.toString() === req.user._id.toString()
        : commentaire.village.toString() === req.user.village.toString();
    if (!autorise) {
      return res.status(403).json({ message: 'Vous ne pouvez pas supprimer ce commentaire.' });
    }

    await commentaire.deleteOne();
    await Article.updateOne(
      { _id: commentaire.article, nombreCommentaires: { $gt: 0 } },
      { $inc: { nombreCommentaires: -1 } }
    );
    res.json({ message: 'Commentaire supprimé.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', erreur: error.message });
  }
};

module.exports = {
  listerCommentaires,
  ajouterCommentaire,
  supprimerCommentaire,
  creerArticle,
  listerArticlesParVillage,
  filDActualite,
  obtenirArticle,
  mesArticles,
  modifierArticle,
  supprimerArticle,
  likerArticle,
};
