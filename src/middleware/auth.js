const jwt = require('jsonwebtoken');
const config = require('../config');
const { query } = require('../db');
const { AppError, asyncHandler } = require('../utils/respond');

// 1. Who are you? Needs a valid token for a user who still exists.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new AppError(401, 'NO_TOKEN', 'Sign in to continue');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch (err) {
    throw new AppError(401, 'INVALID_TOKEN', 'Your session has expired. Please sign in again');
  }

  // Looked up on every request, so a deleted account stops working immediately.
  const result = await query(
    'SELECT id, role, email, full_name, phone FROM users WHERE id = $1 AND deleted_at IS NULL',
    [payload.sub]
  );
  const row = result.rows[0];
  if (!row) throw new AppError(401, 'INVALID_TOKEN', 'Your session has expired. Please sign in again');

  req.user = { id: row.id, role: row.role, email: row.email, fullName: row.full_name, phone: row.phone };
  next();
});

// 2. Is your role allowed?
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'You do not have access to this'));
  }
  next();
};

// 3. Technicians only: has an admin approved you yet?
const requireVerified = asyncHandler(async (req, res, next) => {
  const result = await query('SELECT verification_status FROM technician_profiles WHERE user_id = $1', [req.user.id]);
  const row = result.rows[0];
  if (!row || row.verification_status !== 'APPROVED') {
    throw new AppError(403, 'NOT_VERIFIED', 'Your account has not been verified yet');
  }
  next();
});

module.exports = { authenticate, requireRole, requireVerified };
