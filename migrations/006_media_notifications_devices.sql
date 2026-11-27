-- 006: media, notifications, device tokens

CREATE TABLE media (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by          uuid NOT NULL REFERENCES users(id),
  cloudinary_public_id text NOT NULL,
  url                  text NOT NULL,
  bytes                integer NOT NULL CHECK (bytes > 0 AND bytes <= 5242880),   -- 5MB
  mime_type            text NOT NULL,
  request_id           uuid REFERENCES requests(id) ON DELETE CASCADE,
  job_event_id         uuid REFERENCES job_events(id) ON DELETE CASCADE,
  claim_id             uuid REFERENCES claims(id) ON DELETE CASCADE,
  created_at           timestamptz NOT NULL DEFAULT now(),
  -- at most one parent; all three empty means an unattached upload
  CONSTRAINT media_at_most_one_parent CHECK (
    (request_id IS NOT NULL)::int + (job_event_id IS NOT NULL)::int + (claim_id IS NOT NULL)::int <= 1
  )
);
CREATE INDEX media_request_idx   ON media (request_id)   WHERE request_id IS NOT NULL;
CREATE INDEX media_job_event_idx ON media (job_event_id) WHERE job_event_id IS NOT NULL;
CREATE INDEX media_claim_idx     ON media (claim_id)     WHERE claim_id IS NOT NULL;
CREATE INDEX media_unattached_idx ON media (created_at)
  WHERE request_id IS NULL AND job_event_id IS NULL AND claim_id IS NULL;

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at     timestamptz,
  push_status push_status NOT NULL DEFAULT 'NOT_APPLICABLE',
  push_error  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE device_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE,
  platform     device_platform NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX device_tokens_user_idx ON device_tokens (user_id);
