# RepairHub backend

Node.js + Express + PostgreSQL. This is the first slice of the API: accounts, lookups and the technician profile.
The full list of endpoints and their fields is in `RepairHub_API_Endpoints_v2.docx`.

**Status: written but not yet run.** The code has passed a syntax check only. The first person to run it
should expect to fix small things, and should tell the team what they fixed.

---

## Run it locally

You need Node 18.11 or newer and PostgreSQL 13 or newer.

```bash
createdb repairhub                      # or create the database any way you like
cd backend
npm install
cp .env.example .env                    # then edit .env (see below)
npm run db:setup                        # runs the migrations, then the seed script
npm run dev                             # http://localhost:5000/api/v1/health
```

In `.env` you must set:

- `DATABASE_URL` : your local Postgres.
- `JWT_SECRET` : 32 or more random characters. Make one with
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` : the admin account. Use a real email, because password reset needs it.

`npm run migrate` runs only the migrations. `npm run seed` runs only the seed. Both are safe to run again.

## Deploying (Railway)

These steps are from general knowledge of Railway. Check their docs if something does not match.

1. Create a project, add a PostgreSQL database, and add a service from this repo with the root directory set to `backend`.
2. Set the variables from `.env.example` on the service. `DATABASE_URL` comes from the Postgres service. Set `NODE_ENV=production`.
3. Set `CORS_ORIGINS` to the exact URLs of the web app.
4. Start command: `npm start`.
5. Run `npm run db:setup` once against the Railway database. In production, set `DEMO_PASSWORD` to something private first.

---

## For the web and mobile teams

**Base URL:** `http://localhost:5000/api/v1` locally. The hosted URL will be shared when it exists.

**Every response has the same shape.**

```json
{ "success": true,  "data": { } }
{ "success": false, "error": { "code": "EMAIL_TAKEN", "message": "An account with this email already exists" } }
```

Validation errors (400) also carry `error.details`, a list of `{ field, message }`, so you can show each message under its field.

**Signed-in requests** send `Authorization: Bearer <accessToken>`. A 401 means go to the login screen.
A 403 `NOT_VERIFIED` means a technician has not been approved yet. Store the token in secure storage on mobile.

**Money** is whole naira. **Dates** are ISO 8601 UTC strings.

### Try these first

Register (role is `CUSTOMER` or `TECHNICIAN`; `ADMIN` is rejected):

```http
POST /auth/register
{ "role": "CUSTOMER", "email": "ada@example.com", "password": "Passw0rd!23", "fullName": "Ada Obi", "phone": "+2348012345678" }

201 { "success": true, "data": { "user": { "id", "role", "email", "fullName", "phone", "createdAt" }, "accessToken": "..." } }
```

Log in:

```http
POST /auth/login
{ "email": "ada@example.com", "password": "Passw0rd!23" }

200 { "success": true, "data": { "user": { ... }, "accessToken": "..." } }
401 INVALID_CREDENTIALS
```

Lookups (no token needed):

```http
GET /categories      200 { "data": { "items": [ { "id", "name", "slug" } ] } }
GET /service-areas   200 { "data": { "items": [ { "id", "name", "city" } ] } }
```

Technician profile (technician token):

```http
POST /technicians/profile
{ "workshopAddress": "12 Allen Avenue, Ikeja", "categoryIds": ["<id>"], "serviceAreaIds": ["<id>"], "brands": ["Apple"] }

201 { "data": { "profile": { "workshopAddress", "categories", "serviceAreas", "brands",
                             "verificationStatus": "PENDING", "rejectionReason": null, "documents": [] } } }
```

### Seeded accounts (after `npm run seed` with `SEED_DEMO=true`)

| Who | Email | Password |
|---|---|---|
| Admin | the `ADMIN_EMAIL` in `.env` | the `ADMIN_PASSWORD` in `.env` |
| Customer | `customer@repairhub.test` | `Passw0rd!23`, or `DEMO_PASSWORD` if set |
| Technicians (verified) | `phones-tablets-tech1@repairhub.test` to `tech5`, and the same for `laptops-computers-` and `home-appliances-` | same as the customer |

There are 5 verified technicians in each category and every one serves every seeded area, so a request in any area can get 5 quotes to compare.

### Good to know

- **CORS.** The web app's URL must be in `CORS_ORIGINS`, or the browser will block the call. Mobile apps are not affected.
- **Rate limit.** Register, login and password reset allow 20 attempts per IP every 15 minutes. If a demo room shares one IP, raise `AUTH_RATE_LIMIT`.
- **Password reset** emails a link to `APP_URL/reset-password?token=...`. The web team needs a page at that path that sends `{ token, newPassword }` to `POST /auth/password-reset/confirm`. The mobile team needs to decide how it handles the link. With no `RESEND_API_KEY`, the link is printed in the server console.
- **Resend sending.** The default sender can only email the Resend account owner. A real sending domain must be verified in Resend before customers receive reset emails.

---

## What works now

| Endpoint | Who |
|---|---|
| `GET /health` | public |
| `GET /categories`, `GET /service-areas` | public |
| `POST /auth/register`, `POST /auth/login` | public |
| `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm` | public |
| `GET /auth/me`, `POST /me/deletion-request` | signed in |
| `POST /technicians/profile`, `GET /technicians/profile`, `PATCH /technicians/profile` | technician |

**Not built yet, in the order they will come:** photo upload and verification documents, admin verification, requests and matching,
quotes, jobs, changes, completion and claims, notifications. Until then, build against the field definitions in the endpoint document.

## For the backend team

```
src/
  app.js, server.js        the Express app, and the process that listens
  config.js                reads and checks environment variables
  db.js                    Postgres pool, and withTransaction(fn)
  middleware/              auth (authenticate, requireRole, requireVerified), validate, errors, rateLimit
  routes/                  one file per area, mounted in routes/index.js
  services/                email, technician profile loader
  utils/                   AppError, ok(), asyncHandler, row mappers
scripts/                   migrate.js, seed.js
migrations/                plain SQL, run in order
```

- A new route: `router.post('/path', authenticate, requireRole('CUSTOMER'), validate(schema), asyncHandler(async (req, res) => { ... ok(res, data) }))`.
- Throw `new AppError(status, 'CODE', 'message')` for any expected failure. Never send a raw database row: map it first.
- Ownership goes inside the query (`WHERE id = $1 AND customer_id = $2`), so someone else's record returns 404.
- `updated_at` is set by the code on every update. There are no database triggers.
- The service areas in `scripts/seed.js` are placeholders. Replace them with the agreed pilot list.
- There are no automated tests yet. The access test list is in the role-based access document.
