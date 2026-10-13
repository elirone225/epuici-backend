const jwt = require('jsonwebtoken');

// role: 'superadmin' | 'villageadmin' | 'utilisateur'
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

module.exports = generateToken;
