// Builds the TechnicianProfile shape from the API document. `db` is the pool or a transaction client.
async function loadProfile(db, userId) {
  const p = (
    await db.query(
      'SELECT workshop_address, brands, verification_status, rejection_reason FROM technician_profiles WHERE user_id = $1',
      [userId]
    )
  ).rows[0];
  if (!p) return null;

  const cats = await db.query(
    `SELECT c.id, c.name, c.slug FROM technician_categories tc
       JOIN categories c ON c.id = tc.category_id
      WHERE tc.technician_id = $1 ORDER BY c.name`,
    [userId]
  );
  const areas = await db.query(
    `SELECT sa.id, sa.name, sa.city FROM technician_service_areas ts
       JOIN service_areas sa ON sa.id = ts.service_area_id
      WHERE ts.technician_id = $1 ORDER BY sa.name`,
    [userId]
  );
  // Document types only. The files are never returned to the technician.
  const docs = await db.query(
    `SELECT DISTINCT ON (type) type, created_at FROM verification_documents
      WHERE technician_id = $1 ORDER BY type, created_at DESC`,
    [userId]
  );

  return {
    workshopAddress: p.workshop_address,
    categories: cats.rows,
    serviceAreas: areas.rows,
    brands: p.brands || [],
    verificationStatus: p.verification_status,
    rejectionReason: p.rejection_reason,
    documents: docs.rows.map((d) => ({ type: d.type, uploadedAt: d.created_at })),
  };
}

module.exports = { loadProfile };
