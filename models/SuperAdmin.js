const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const superAdminSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    motDePasse: { type: String, required: true },
  },
  { timestamps: true }
);

superAdminSchema.pre('save', async function (next) {
  if (!this.isModified('motDePasse')) return next();
  const salt = await bcrypt.genSalt(10);
  this.motDePasse = await bcrypt.hash(this.motDePasse, salt);
  next();
});

superAdminSchema.methods.verifierMotDePasse = async function (motDePasseSaisi) {
  return bcrypt.compare(motDePasseSaisi, this.motDePasse);
};

module.exports = mongoose.model('SuperAdmin', superAdminSchema);
