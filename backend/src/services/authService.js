const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const storeService = require('./storeService');
const ApiError = require('../utils/apiError');
const env = require('../config/env');

async function signup({ name, email, password }) {
  const existing = await storeService.findUserByEmail(email);
  if (existing) {
    throw new ApiError(409, 'Email already registered');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await storeService.createUser({ name, email, password: hashedPassword });
  const token = jwt.sign({ userId: user.id }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  };
}

async function login({ email, password }) {
  const user = await storeService.findUserByEmail(email);
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = jwt.sign({ userId: user.id }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  };
}

module.exports = { signup, login };
