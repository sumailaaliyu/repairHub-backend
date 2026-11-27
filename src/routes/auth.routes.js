const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');

const config = require('../config');
const { pool, query, withTransaction } = require('../db');
const { AppError, ok, asyncHandler } = require('../utils/respond');
const { toUser } = require('../utils/mappers');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { sendPasswordResetEmail } = require('../services/email');
const { loadProfile } = require('../services/technicianProfile');

const router = express.Router();

// A real bcrypt hash to compare against when the email is unknown, so a wrong email and a wrong
// password take about the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const signToken = (user) =>
  jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.jwtExpiresIn,
    algorithm: 'HS256',
  });

// bcrypt only reads the first 72 bytes
const password = z
  .string()
  .min(8, 'must be at least 8 characters')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'is too long');

const email = z.string().trim().toLowerCase().email('is not a valid email');

const registerSchema = z.object({
  // ADMIN is deliberately not allowed. Admin accounts come only from the seed script.
  role: z.enum(['CUSTOMER', 'TECHNICIAN']),
  email,
  password,
  fullName: z.string().trim().min(2, 'is too short').max(100),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/, 'is not a valid phone number'),
});

router.post(
  '/auth/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const hash = await bcrypt.hash(b.password, 10);
    let row;
    try {
      const r = await query(
        `INSERT INTO users (role, email, password_hash, full_name, phone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, role, email, full_name, phone, created_at`,
        [b.role, b.email, hash, b.fullName, b.phone]
      );
      row = r.rows[0];
    } catch (err) {
      if (err.code === '23505') throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
      throw err;
    }
    const user = toUser(row);
    ok(res, { user, accessToken: signToken(user) }, 201);
  })
);

router.post(
  '/auth/login',
  authLimiter,
  validate(z.object({ email, password: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const r = await query(
      `SELECT id, role, email, full_name, phone, created_at, password_hash
         FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL`,
      [req.body.email]
    );
    const row = r.rows[0];
    const valid = await bcrypt.compare(req.body.password, row ? row.password_hash : DUMMY_HASH);
    if (!row || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Wrong email or password');

    const user = toUser(row);
    ok(res, { user, accessToken: signToken(user) });
  })
);

router.get(
  '/auth/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const r = await query('SELECT id, role, email, full_name, phone, created_at FROM users WHERE id = $1', [req.user.id]);
    const technician = req.user.role === 'TECHNICIAN' ? await loadProfile(pool, req.user.id) : null;
    ok(res, { user: toUser(r.rows[0]), technician });
  })
);

router.post(
  '/me/deletion-request',
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user.role === 'ADMIN') throw new AppError(403, 'FORBIDDEN', 'Admin accounts are removed manually');
    const r = await query(
      `UPDATE users SET deletion_requested_at = COALESCE(deletion_requested_at, now()), updated_at = now()
        WHERE id = $1 RETURNING deletion_requested_at`,
      [req.user.id]
    );
    ok(res, { deletionRequestedAt: r.rows[0].deletion_requested_at }, 202);
  })
);

router.post(
  '/auth/password-reset/request',
  authLimiter,
  validate(z.object({ email })),
  asyncHandler(async (req, res) => {
    const message = 'If an account exists for that email, a reset link has been sent.';
    const r = await query('SELECT id FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL', [req.body.email]);
    const user = r.rows[0];

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await withTransaction(async (client) => {
        // Only the newest link should work
        await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
        await client.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, now() + interval '1 hour')`,
          [user.id, sha256(token)]
        );
      });
      const link = `${config.appUrl}/reset-password?token=${token}`;
      // Not awaited, so the response time does not reveal whether the account exists.
      sendPasswordResetEmail(req.body.email, link).catch((err) => console.error('Password reset email failed:', err.message));
    }
    ok(res, { message });
  })
);

router.post(
  '/auth/password-reset/confirm',
  authLimiter,
  validate(z.object({ token: z.string().min(10), newPassword: password })),
  asyncHandler(async (req, res) => {
    const hash = await bcrypt.hash(req.body.newPassword, 10);
    await withTransaction(async (client) => {
      // Marking the token used and checking it happen in one statement, so it cannot be used twice.
      const t = await client.query(
        `UPDATE password_reset_tokens SET used_at = now()
          WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
          RETURNING user_id`,
        [sha256(req.body.token)]
      );
      if (!t.rowCount) throw new AppError(422, 'TOKEN_INVALID', 'This reset link is invalid or has expired');
      const userId = t.rows[0].user_id;
      await client.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 AND deleted_at IS NULL', [hash, userId]);
      await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);
    });
    ok(res, { message: 'Password updated. You can sign in now.' });
  })
);

module.exports = router;
