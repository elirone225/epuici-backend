// À utiliser uniquement sur les routes de PUBLICATION (créer article, créer offre immo)
// Le Village Admin peut se connecter et voir son dashboard même sans abonnement valide,
// mais ne peut pas publier tant qu'il n'a pas payé.
const verifierAbonnementActif = (req, res, next) => {
  const admin = req.user;

  if (!admin.abonnementEstValide || !admin.abonnementEstValide()) {
    return res.status(402).json({
      message:
        "Votre abonnement a expiré ou n'est pas encore activé. Veuillez souscrire à une formule pour publier.",
      code: 'ABONNEMENT_REQUIS',
    });
  }

  next();
};

module.exports = verifierAbonnementActif;
