-- 005: warranty claims

CREATE TABLE claims (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid NOT NULL REFERENCES jobs(id),
  customer_id    uuid NOT NULL REFERENCES users(id),
  description    text NOT NULL,
  status         claim_status NOT NULL DEFAULT 'OPEN',
  responded_at   timestamptz,
  decline_reason text,
  admin_id       uuid REFERENCES users(id),
  outcome        text,
  outcome_reason text,
  resolved_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),   -- the 24-hour clock is read from here
  updated_at     timestamptz NOT NULL DEFAULT now()
);
-- One open claim per job
CREATE UNIQUE INDEX claims_one_open_per_job ON claims (job_id) WHERE status = 'OPEN';
-- Admin escalated queue
CREATE INDEX claims_status_created_idx ON claims (status, created_at);
CREATE INDEX claims_job_idx ON claims (job_id);
