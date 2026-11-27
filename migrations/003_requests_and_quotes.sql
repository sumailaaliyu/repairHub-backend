-- 003: requests, quotes, quote lines

CREATE TABLE requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid NOT NULL REFERENCES users(id),
  category_id     uuid NOT NULL REFERENCES categories(id),
  service_area_id uuid NOT NULL REFERENCES service_areas(id),
  device_brand    text NOT NULL,
  device_model    text NOT NULL,
  description     text NOT NULL,
  service_mode    service_mode NOT NULL,
  address         text,                       -- hidden until booking
  preferred_time  timestamptz,
  lat             numeric(9,6),
  lng             numeric(9,6),
  status          request_status NOT NULL DEFAULT 'OPEN',
  closed_reason   closed_reason,
  quote_deadline  timestamptz NOT NULL,       -- created_at + 48 hours, set by the server
  closed_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT requests_closed_reason_matches_status
    CHECK ((status = 'CLOSED') = (closed_reason IS NOT NULL))
);
CREATE INDEX requests_status_deadline_idx ON requests (status, quote_deadline);
CREATE INDEX requests_customer_idx        ON requests (customer_id, created_at DESC);
CREATE INDEX requests_matching_idx        ON requests (category_id, service_area_id) WHERE status <> 'CLOSED';

CREATE TABLE quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  technician_id   uuid NOT NULL REFERENCES technician_profiles(user_id),
  status          quote_status NOT NULL DEFAULT 'ACTIVE',
  diagnosis_fee   integer NOT NULL CHECK (diagnosis_fee >= 0),
  labour          integer NOT NULL CHECK (labour >= 0),
  estimated_hours integer NOT NULL CHECK (estimated_hours > 0),
  warranty_days   integer NOT NULL CHECK (warranty_days >= 7),
  total           integer NOT NULL CHECK (total >= 0),   -- calculated by the server, never typed
  withdrawn_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- One active quote per technician per request
CREATE UNIQUE INDEX quotes_one_active_per_technician
  ON quotes (request_id, technician_id) WHERE status = 'ACTIVE';
CREATE INDEX quotes_request_idx ON quotes (request_id);

CREATE TABLE quote_lines (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  name     text NOT NULL,
  grade    part_grade NOT NULL,
  cost     integer NOT NULL CHECK (cost >= 0)
);
CREATE INDEX quote_lines_quote_idx ON quote_lines (quote_id);
