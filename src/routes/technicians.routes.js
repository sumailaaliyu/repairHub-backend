const express = require('express');
const { z } = require('zod');
const { pool, withTransaction } = require('../db');
const { AppError, ok, asyncHandler } = require('../utils/respond');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { loadProfile } = require('../services/technicianProfile');

const router = express.Router();
router.use('/technicians', authenticate, requireRole('TECHNICIAN'));

const ids = z.array(z.string().uuid()).min(1, 'choose at least one').max(50);
const lat = z.number().min(-90).max(90).nullable().optional();
const lng = z.number().min(-180).max(180).nullable().optional();

const createSchema = z.object({
  workshopAddress: z.string().trim().min(5, 'is too short').max(300),
  categoryIds: ids,
  serviceAreaIds: ids,
  brands: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  lat,
  lng,
});

const updateSchema = z
  .object({
    workshopAddress: z.string().trim().min(5).max(300).optional(),
    categoryIds: ids.optional(),
    serviceAreaIds: ids.optional(),
    brands: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
    lat,
    lng,
  })
  .refine((v) => Object.keys(v).length > 0, 'send at least one field to change');

async function assertLookups(client, categoryIds, serviceAreaIds) {
  if (categoryIds) {
    const unique = [...new Set(categoryIds)];
    const r = await client.query('SELECT count(*)::int AS n FROM categories WHERE id = ANY($1::uuid[]) AND active', [unique]);
    if (r.rows[0].n !== unique.length) throw new AppError(400, 'VALIDATION_ERROR', 'categoryIds: one or more categories do not exist');
  }
  if (serviceAreaIds) {
    const unique = [...new Set(serviceAreaIds)];
    const r = await client.query('SELECT count(*)::int AS n FROM service_areas WHERE id = ANY($1::uuid[]) AND active', [unique]);
    if (r.rows[0].n !== unique.length) throw new AppError(400, 'VALIDATION_ERROR', 'serviceAreaIds: one or more areas do not exist');
  }
}

// A list that is sent replaces the old one.
async function replaceLinks(client, userId, categoryIds, serviceAreaIds) {
  if (categoryIds) {
    await client.query('DELETE FROM technician_categories WHERE technician_id = $1', [userId]);
    await client.query(
      'INSERT INTO technician_categories (technician_id, category_id) SELECT $1, unnest($2::uuid[])',
      [userId, [...new Set(categoryIds)]]
    );
  }
  if (serviceAreaIds) {
    await client.query('DELETE FROM technician_service_areas WHERE technician_id = $1', [userId]);
    await client.query(
      'INSERT INTO technician_service_areas (technician_id, service_area_id) SELECT $1, unnest($2::uuid[])',
      [userId, [...new Set(serviceAreaIds)]]
    );
  }
}

router.post(
  '/technicians/profile',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const uid = req.user.id;
    const b = req.body;
    try {
      await withTransaction(async (client) => {
        const exists = await client.query('SELECT 1 FROM technician_profiles WHERE user_id = $1', [uid]);
        if (exists.rowCount) throw new AppError(409, 'PROFILE_EXISTS', 'You already have a profile. Use PATCH to change it');
        await assertLookups(client, b.categoryIds, b.serviceAreaIds);
        await client.query(
          'INSERT INTO technician_profiles (user_id, workshop_address, brands, lat, lng) VALUES ($1, $2, $3, $4, $5)',
          [uid, b.workshopAddress, b.brands || null, b.lat ?? null, b.lng ?? null]
        );
        await replaceLinks(client, uid, b.categoryIds, b.serviceAreaIds);
      });
    } catch (err) {
      if (err.code === '23505') throw new AppError(409, 'PROFILE_EXISTS', 'You already have a profile. Use PATCH to change it');
      throw err;
    }
    ok(res, { profile: await loadProfile(pool, uid) }, 201);
  })
);

router.get(
  '/technicians/profile',
  asyncHandler(async (req, res) => {
    const profile = await loadProfile(pool, req.user.id);
    if (!profile) throw new AppError(404, 'NOT_FOUND', 'You have not created a profile yet');
    ok(res, { profile });
  })
);

router.patch(
  '/technicians/profile',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const uid = req.user.id;
    const b = req.body;
    await withTransaction(async (client) => {
      const exists = await client.query('SELECT 1 FROM technician_profiles WHERE user_id = $1', [uid]);
      if (!exists.rowCount) throw new AppError(404, 'NOT_FOUND', 'You have not created a profile yet');
      await assertLookups(client, b.categoryIds, b.serviceAreaIds);

      // Column names below are fixed strings, never user input.
      const sets = [];
      const vals = [uid];
      const add = (col, value) => {
        vals.push(value);
        sets.push(`${col} = $${vals.length}`);
      };
      if (b.workshopAddress !== undefined) add('workshop_address', b.workshopAddress);
      if (b.brands !== undefined) add('brands', b.brands);
      if (b.lat !== undefined) add('lat', b.lat);
      if (b.lng !== undefined) add('lng', b.lng);
      if (sets.length) {
        await client.query(`UPDATE technician_profiles SET ${sets.join(', ')}, updated_at = now() WHERE user_id = $1`, vals);
      }
      await replaceLinks(client, uid, b.categoryIds, b.serviceAreaIds);
    });
    ok(res, { profile: await loadProfile(pool, uid) });
  })
);

module.exports = router;
