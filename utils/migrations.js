const VillageAdmin = require('../models/VillageAdmin');

// Mises à niveau de la base exécutées au démarrage (sans effet si déjà faites).
const executerMigrations = async () => {
  try {
    // Comptes créés avant l'arrivée du trésorier : ce sont les admins
    const { modifiedCount } = await VillageAdmin.updateMany(
      { role: { $exists: false } },
      { $set: { role: 'admin' } }
    );
    if (modifiedCount) console.log(`Migration : ${modifiedCount} compte(s) d'église marqué(s) admin.`);

    // Remplace l'ancien index "un seul compte par église" par
    // "un admin et un trésorier par église"
    await VillageAdmin.syncIndexes();
  } catch (error) {
    console.error('Migration des comptes d\'église :', error.message);
  }
};

module.exports = executerMigrations;
