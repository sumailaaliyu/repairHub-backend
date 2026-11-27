// Fills the database with starting data. Safe to run more than once: anything that exists is left alone.
//
//   Always:        categories, service areas
//   If set:        the admin account (ADMIN_EMAIL + ADMIN_PASSWORD)
//   If SEED_DEMO:  a demo customer and 5 verified demo technicians per category
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const { pool, withTransaction } = require('../src/db');

const CATEGORIES = [
  { name: 'Phones & Tablets', slug: 'phones-tablets' },
  { name: 'Laptops & Computers', slug: 'laptops-computers' },
  { name: 'Home Appliances', slug: 'home-appliances' },
];

// PLACEHOLDER LIST. Replace with the areas the team agrees for the pilot.
const SERVICE_AREAS = ['Ikeja', 'Yaba', 'Surulere', 'Lekki', 'Ajah', 'Victoria Island', 'Ikorodu', 'Gbagada', 'Maryland', 'Oshodi'];

const DEMO_TECHNICIANS = {
  'phones-tablets': ['Emeka Okafor', 'Tunde Bakare', 'Chidi Nwosu', 'Ibrahim Musa', 'Segun Adeyemi'],
  'laptops-computers': ['Ngozi Eze', 'Kunle Ogunleye', 'Femi Balogun', 'Yusuf Abdullahi', 'Amaka Obi'],
  'home-appliances': ['Bayo Salami', 'Chinedu Okeke', 'Dayo Alabi', 'Musa Garba', 'Kelechi Ume'],
};

async function ensureUser(client, { role, email, password, fullName, phone }) {
  const found = await client.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
  if (found.rowCount) return { id: found.rows[0].id, created: false };
  const hash = await bcrypt.hash(password, 10);
  const r = await client.query(
    'INSERT INTO users (role, email, password_hash, full_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [role, email.toLowerCase(), hash, fullName, phone]
  );
  return { id: r.rows[0].id, created: true };
}

(async () => {
  const summary = [];

  await withTransaction(async (client) => {
    for (const c of CATEGORIES) {
      await client.query('INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING', [c.name, c.slug]);
    }
    for (const name of SERVICE_AREAS) {
      await client.query("INSERT INTO service_areas (name, city) VALUES ($1, 'Lagos') ON CONFLICT (city, name) DO NOTHING", [name]);
    }
    summary.push(`categories: ${CATEGORIES.length}, service areas: ${SERVICE_AREAS.length}`);

    // ---- admin ----
    let adminId = null;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      const a = await ensureUser(client, {
        role: 'ADMIN',
        email: adminEmail,
        password: adminPassword,
        fullName: 'RepairHub Admin',
        phone: '+2340000000000',
      });
      adminId = a.id;
      summary.push(`admin ${adminEmail}: ${a.created ? 'created' : 'already existed'}`);
    } else {
      summary.push('admin: SKIPPED (set ADMIN_EMAIL and ADMIN_PASSWORD)');
    }

    // ---- demo data ----
    if (process.env.SEED_DEMO === 'true') {
      if (config.isProd && !process.env.DEMO_PASSWORD) {
        throw new Error('Set DEMO_PASSWORD to something private before seeding demo accounts in production');
      }
      const demoPassword = process.env.DEMO_PASSWORD || 'Passw0rd!23';

      await ensureUser(client, {
        role: 'CUSTOMER',
        email: 'customer@repairhub.test',
        password: demoPassword,
        fullName: 'Demo Customer',
        phone: '+2348010000000',
      });

      const cats = (await client.query('SELECT id, slug FROM categories')).rows;
      const areaIds = (await client.query("SELECT id FROM service_areas WHERE city = 'Lagos'")).rows.map((r) => r.id);

      let n = 0;
      for (const cat of cats) {
        const names = DEMO_TECHNICIANS[cat.slug] || [];
        for (let i = 0; i < names.length; i++) {
          n += 1;
          const email = `${cat.slug}-tech${i + 1}@repairhub.test`;
          const u = await ensureUser(client, {
            role: 'TECHNICIAN',
            email,
            password: demoPassword,
            fullName: names[i],
            phone: `+23480200000${String(n).padStart(2, '0')}`,
          });
          if (!u.created) continue;
          await client.query(
            `INSERT INTO technician_profiles (user_id, workshop_address, verification_status, reviewed_by, reviewed_at)
             VALUES ($1, $2, 'APPROVED', $3, now())`,
            [u.id, `${i + 1} Demo Workshop Street, Lagos`, adminId]
          );
          await client.query('INSERT INTO technician_categories (technician_id, category_id) VALUES ($1, $2)', [u.id, cat.id]);
          // Every demo technician serves every area, so any request in any area gets 5 quotes to compare.
          await client.query(
            'INSERT INTO technician_service_areas (technician_id, service_area_id) SELECT $1, unnest($2::uuid[])',
            [u.id, areaIds]
          );
        }
      }
      summary.push('demo: customer@repairhub.test and 15 verified technicians (5 per category)');
      summary.push(`demo logins: <email above> / ${process.env.DEMO_PASSWORD ? '(your DEMO_PASSWORD)' : demoPassword}`);
    } else {
      summary.push('demo data: skipped (set SEED_DEMO=true)');
    }
  });

  console.log('Seed finished:\n  ' + summary.join('\n  '));
  await pool.end();
})().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await pool.end();
  process.exit(1);
});
