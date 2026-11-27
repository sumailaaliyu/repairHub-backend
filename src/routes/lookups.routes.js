const express = require('express');
const { query } = require('../db');
const { ok, asyncHandler } = require('../utils/respond');

const router = express.Router();

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const r = await query('SELECT id, name, slug FROM categories WHERE active ORDER BY name');
    ok(res, { items: r.rows });
  })
);

router.get(
  '/service-areas',
  asyncHandler(async (req, res) => {
    const r = await query('SELECT id, name, city FROM service_areas WHERE active ORDER BY name');
    ok(res, { items: r.rows });
  })
);

module.exports = router;
