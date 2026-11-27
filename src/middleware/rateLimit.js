const rateLimit = require('express-rate-limit');
const config = require('../config');

const tooMany = (req, res) =>
  res.status(429).json({
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Please try again later.' },
  });

// Used on login, register and password reset
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.authRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany,
});

module.exports = { authLimiter };
