-- 004: jobs, events, changes, parts, payments

CREATE TABLE jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          uuid NOT NULL UNIQUE REFERENCES requests(id),
  quote_id            uuid NOT NULL UNIQUE REFERENCES quotes(id),
  customer_id         uuid NOT NULL REFERENCES users(id),
  technician_id       uuid NOT NULL REFERENCES technician_profiles(user_id),
  status              job_status NOT NULL DEFAULT 'BOOKED',
  service_mode        service_mode NOT NULL,
  scheduled_at        timestamptz NOT NULL,
  diagnosis_fee       integer NOT NULL CHECK (diagnosis_fee >= 0),   -- copied from the quote at booking
  total               integer NOT NULL CHECK (total >= 0),
  state_before_change job_status,                                    -- set while AWAITING_APPROVAL
  sent_back_once      boolean NOT NULL DEFAULT false,
  ready_at            timestamptz,
  warranty_days       integer CHECK (warranty_days IS NULL OR warranty_days >= 7),
  completed_at        timestamptz,
  warranty_ends_at    timestamptz,
  commission_rate     numeric(5,2) NOT NULL DEFAULT 0 CHECK (commission_rate BETWEEN 0 AND 100),
  commission_amount   integer CHECK (commission_amount IS NULL OR commission_amount >= 0),
  cancelled_by        uuid REFERENCES users(id),
  cancel_reason       text,
  cancelled_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_customer_status_idx   ON jobs (customer_id, status);
CREATE INDEX jobs_technician_status_idx ON jobs (technician_id, status);

CREATE TABLE job_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES users(id),             -- null for system actions
  type        job_event_type NOT NULL,
  from_status job_status,
  to_status   job_status,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_events_job_idx ON job_events (job_id, created_at);

CREATE TABLE change_requests (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                  uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  requested_by            uuid NOT NULL REFERENCES users(id),
  reason                  text NOT NULL,
  new_total               integer NOT NULL CHECK (new_total >= 0),
  original_scope_possible boolean NOT NULL DEFAULT false,
  status                  change_status NOT NULL DEFAULT 'PENDING',
  decision_action         change_action,
  decided_by              uuid REFERENCES users(id),
  decided_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);
-- Only one pending change per job
CREATE UNIQUE INDEX change_requests_one_pending_per_job
  ON change_requests (job_id) WHERE status = 'PENDING';
CREATE INDEX change_requests_job_idx ON change_requests (job_id, created_at);

CREATE TABLE change_request_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id uuid NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  name              text NOT NULL,
  grade             part_grade NOT NULL,
  cost              integer NOT NULL CHECK (cost >= 0)
);
CREATE INDEX change_request_lines_change_idx ON change_request_lines (change_request_id);

CREATE TABLE parts_used (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name       text NOT NULL,
  grade      part_grade NOT NULL,
  cost       integer NOT NULL CHECK (cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX parts_used_job_idx ON parts_used (job_id);

CREATE TABLE payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            uuid NOT NULL UNIQUE REFERENCES jobs(id),   -- one payment per job
  kind              payment_kind NOT NULL,
  amount            integer NOT NULL CHECK (amount >= 0),
  method            payment_method NOT NULL,
  recorded_by       uuid NOT NULL REFERENCES users(id),
  recorded_at       timestamptz NOT NULL DEFAULT now(),
  gateway_reference text,                                       -- empty in the MVP
  gateway_status    text                                        -- empty in the MVP
);
