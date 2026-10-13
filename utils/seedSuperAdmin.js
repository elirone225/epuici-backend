const SuperAdmin = require('../models/SuperAdmin');

const seedSuperAdmin = async () => {
  try {
    const existant = await SuperAdmin.findOne({ email: process.env.SUPERADMIN_EMAIL });

    if (!existant) {
      await SuperAdmin.create({
        nom: 'Super Admin',
        email: process.env.SUPERADMIN_EMAIL,
        motDePasse: process.env.SUPERADMIN_PASSWORD,
      });
      console.log(`Compte Super Admin créé : ${process.env.SUPERADMIN_EMAIL}`);
    } else {
      console.log('Compte Super Admin déjà existant.');
    }
  } catch (error) {
    console.error('Erreur lors de la création du Super Admin :', error.message);
  }
};

module.exports = seedSuperAdmin;
