// Turns a database row into the API shape. Never returns password_hash.
const toUser = (row) => ({
  id: row.id,
  role: row.role,
  email: row.email,
  fullName: row.full_name,
  phone: row.phone,
  createdAt: row.created_at,
});

module.exports = { toUser };
