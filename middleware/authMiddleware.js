const jwt = require('jsonwebtoken');
const SuperAdmin = require('../models/SuperAdmin');
const VillageAdmin = require('../models/VillageAdmin');
const Utilisateur = require('../models/Utilisateur');

// Vérifie que la requête contient un token JWT valide
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // On va chercher l'utilisateur correspondant selon son rôle
      if (decoded.role === 'superadmin') {
        req.user = await SuperAdmin.findById(decoded.id).select('-motDePasse');
      } else if (decoded.role === 'villageadmin') {
        req.user = await VillageAdmin.findById(decoded.id).select('-motDePasse');
      } else if (decoded.role === 'utilisateur') {
        req.user = await Utilisateur.findById(decoded.id).select('-motDePasse');
      }

      if (!req.user) {
        return res.status(401).json({ message: 'Utilisateur introuvable, token invalide.' });
      }

      req.role = decoded.role;

      // Rafraîchit le "dernier vu" des habitants à chaque appel authentifié,
      // pour que "actifs maintenant" reflète l'usage réel de l'app (pas juste le login).
      if (decoded.role === 'utilisateur') {
        Utilisateur.updateOne(
          { _id: req.user._id },
          { derniereConnexion: new Date() }
        ).catch(() => {});
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Non autorisé, token invalide.' });
    }
  } else {
    return res.status(401).json({ message: 'Non autorisé, aucun token fourni.' });
  }
};

// Restreint l'accès à certains rôles uniquement
// Exemple : autoriserRoles('superadmin')  ou  autoriserRoles('superadmin', 'villageadmin')
const autoriserRoles = (...rolesAutorises) => {
  return (req, res, next) => {
    if (!rolesAutorises.includes(req.role)) {
      return res.status(403).json({
        message: `Accès refusé. Rôle requis : ${rolesAutorises.join(' ou ')}.`,
      });
    }
    next();
  };
};

// Réservé au trésorier de l'église (Dons & Dîmes, numéro Wave).
// À placer après protect.
const autoriserTresorier = (req, res, next) => {
  if (req.role !== 'villageadmin' || req.user.role !== 'tresorier') {
    return res.status(403).json({
      message: "Accès réservé au trésorier de l'église.",
    });
  }
  next();
};

module.exports = { protect, autoriserRoles, autoriserTresorier };
