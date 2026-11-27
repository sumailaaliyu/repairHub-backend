-- 002: users, technician profile, verification, password reset

CREATE TABLE users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role                  user_role NOT NULL,
  email                 text NOT NULL,
  password_hash         text NOT NULL,
  full_name             text NOT NULL,
  phone                 text NOT NULL,
  deletion_requested_at timestamptz,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

CREATE TABLE technician_profiles (
  user_id             uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  workshop_address    text NOT NULL,
  lat                 numeric(9,6),
  lng                 numeric(9,6),
  brands              text[],
  verification_status verification_status NOT NULL DEFAULT 'PENDING',
  reviewed_by         uuid REFERENCES users(id),
  reviewed_at         timestamptz,
  rejection_reason    text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE technician_categories (
  technician_id uuid NOT NULL REFERENCES technician_profiles(user_id) ON DELETE CASCADE,
  category_id   uuid NOT NULL REFERENCES categories(id),
  PRIMARY KEY (technician_id, category_id)
);
CREATE INDEX technician_categories_category_idx ON technician_categories (category_id);

CREATE TABLE technician_service_areas (
  technician_id   uuid NOT NULL REFERENCES technician_profiles(user_id) ON DELETE CASCADE,
  service_area_id uuid NOT NULL REFERENCES service_areas(id),
  PRIMARY KEY (technician_id, service_area_id)
);
CREATE INDEX technician_service_areas_area_idx ON technician_service_areas (service_area_id);

-- Private. Never returned by any customer or technician API.
CREATE TABLE verification_documents (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id        uuid NOT NULL REFERENCES technician_profiles(user_id) ON DELETE CASCADE,
  type                 document_type NOT NULL,
  cloudinary_public_id text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_documents_technician_idx ON verification_documents (technician_id, type, created_at DESC);

CREATE TABLE password_reset_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_hash_idx ON password_reset_tokens (token_hash);
