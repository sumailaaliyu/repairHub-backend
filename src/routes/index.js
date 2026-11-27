const express = require('express');
const { query } = require('../db');
const { ok, asyncHandler } = require('../utils/respond');

const router = express.Router();

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    let db = true;
    try {
      await query('SELECT 1');
    } catch (err) {
      db = false;
    }
    ok(res, { status: 'ok', db, time: new Date().toISOString() });
  })
);

router.use(require('./lookups.routes'));
router.use(require('./auth.routes'));
router.use(require('./technicians.routes'));

module.exports = router;
