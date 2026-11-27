-- 007 (OPTIONAL, not part of the MVP): reviews. Run only if Sprint 4 has time.

CREATE TABLE reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        uuid NOT NULL UNIQUE REFERENCES jobs(id),   -- one review per completed job
  customer_id   uuid NOT NULL REFERENCES users(id),
  technician_id uuid NOT NULL REFERENCES technician_profiles(user_id),
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_technician_idx ON reviews (technician_id, created_at DESC);
