require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const seedSuperAdmin = require('./utils/seedSuperAdmin');

connectDB().then(() => {
  seedSuperAdmin();
});

const app = express();

app.use(cors());
// Le corps brut est conservé pour vérifier la signature des webhooks Wave
app.use(
  express.json({
    verify: (req, res, tampon) => {
      if (req.originalUrl.startsWith('/api/dons/webhook-wave')) req.rawBody = tampon;
    },
  })
);
app.use(morgan('dev'));

// Empêche un JSON mal formé envoyé par erreur de faire planter le serveur
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'JSON envoyé invalide. Vérifiez le corps de la requête.' });
  }
  next(err);
});

// Route de test pour vérifier que le serveur tourne
app.get('/api/health', (req, res) => {
  res.json({ message: 'EPUICI API opérationnelle 🚀' });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/villages', require('./routes/villageRoutes'));
app.use('/api/abonnements', require('./routes/abonnementRoutes'));
app.use('/api/articles', require('./routes/articleRoutes'));
app.use('/api/groupes', require('./routes/groupeRoutes'));
app.use('/api/utilisateurs', require('./routes/utilisateurRoutes'));
app.use('/api/alertes', require('./routes/alerteRoutes'));
app.use('/api/pub-reportages', require('./routes/pubReportageRoutes'));
app.use('/api/bannieres-pub', require('./routes/bannierePubRoutes'));
app.use('/api/demandes-priere', require('./routes/demandePriereRoutes'));
app.use('/api/live-vod', require('./routes/liveVodRoutes'));
app.use('/api/dons', require('./routes/donRoutes'));

// Toutes les routes principales du backend sont maintenant branchées.

// Gestionnaire d'erreurs global : garantit une réponse JSON propre,
// quelle que soit l'erreur qui survient dans l'application.
app.use((err, req, res, next) => {
  console.error('Erreur non gérée :', err);
  res.status(err.status || 500).json({
    message: err.message || 'Erreur interne du serveur.',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
