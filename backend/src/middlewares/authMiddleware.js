const jwt = require('jsonwebtoken');
const storeService = require('../services/storeService');
const { getAdminAuth } = require('../config/db');
const ApiError = require('../utils/apiError');
const env = require('../config/env');

async function authGuard(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, 'Missing authentication token'));
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await storeService.findUserById(decoded.userId);

    if (user) {
      req.user = {
        id: user.id,
        name: user.name,
        email: user.email
      };
      return next();
    }
  } catch (error) {
    // Ignore legacy JWT validation failure and try Firebase token verification next.
  }

  try {
    const adminAuth = getAdminAuth();
    const decodedFirebase = await adminAuth.verifyIdToken(token);

    req.user = {
      id: decodedFirebase.uid,
      uid: decodedFirebase.uid,
      name: decodedFirebase.name || 'User',
      email: decodedFirebase.email || ''
    };

    return next();
  } catch (error) {
    return next(new ApiError(401, 'Unauthorized'));
  }
}

module.exports = { authGuard };
