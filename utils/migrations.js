const VillageAdmin = require('../models/VillageAdmin');
const Groupe = require('../models/Groupe');
const PreferenceGroupe = require('../models/PreferenceGroupe');

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

  try {
    // Messages non lus (groupes) : à l'arrivée de la fonctionnalité, tout
    // l'historique existant est considéré comme lu par les membres actuels
    const groupes = await Groupe.find().select('membres');
    for (const groupe of groupes) {
      await PreferenceGroupe.initialiser(groupe._id, groupe.membres);
    }
  } catch (error) {
    console.error('Migration des préférences de groupe :', error.message);
  }
};

module.exports = executerMigrations;
