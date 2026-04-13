const { success } = require('../utils/response');
const authService = require('../services/authService');

async function signup(req, res, next) {
  try {
    const payload = await authService.signup(req.body);
    return success(res, payload, 'Signup successful', 201);
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const payload = await authService.login(req.body);
    return success(res, payload, 'Login successful');
  } catch (error) {
    return next(error);
  }
}

module.exports = { signup, login };
