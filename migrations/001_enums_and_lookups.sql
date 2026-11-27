-- 001: enums and lookup tables
-- Requires PostgreSQL 13+ (gen_random_uuid is built in).

CREATE TYPE user_role            AS ENUM ('CUSTOMER', 'TECHNICIAN', 'ADMIN');
CREATE TYPE verification_status  AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE document_type        AS ENUM ('ID', 'PROOF_OF_ADDRESS');
CREATE TYPE service_mode         AS ENUM ('DROP_OFF', 'HOME_VISIT');
CREATE TYPE request_status       AS ENUM ('OPEN', 'QUOTED', 'CLOSED');
CREATE TYPE closed_reason        AS ENUM ('ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE quote_status         AS ENUM ('ACTIVE', 'ACCEPTED', 'WITHDRAWN', 'CLOSED');
CREATE TYPE part_grade           AS ENUM ('ORIGINAL', 'COMPATIBLE', 'USED');
CREATE TYPE job_status           AS ENUM ('BOOKED', 'DIAGNOSED', 'PARTS_ORDERED', 'REPAIRING',
                                          'AWAITING_APPROVAL', 'READY', 'COMPLETED', 'CANCELLED');
CREATE TYPE change_status        AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE change_action        AS ENUM ('CANCEL', 'CONTINUE_ORIGINAL');
CREATE TYPE job_event_type       AS ENUM ('STATUS_CHANGE', 'UPDATE', 'CHANGE_REQUESTED', 'CHANGE_APPROVED',
                                          'CHANGE_REJECTED', 'SENT_BACK', 'COMPLETED', 'CANCELLED',
                                          'CLAIM_REOPENED');
CREATE TYPE payment_kind         AS ENUM ('REPAIR', 'DIAGNOSIS_FEE');
CREATE TYPE payment_method       AS ENUM ('CASH', 'TRANSFER', 'CARD', 'OTHER');
CREATE TYPE claim_status         AS ENUM ('OPEN', 'ACCEPTED', 'DECLINED', 'RESOLVED');
CREATE TYPE push_status          AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SENT', 'FAILED');
CREATE TYPE device_platform      AS ENUM ('ANDROID', 'IOS');

CREATE TABLE categories (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name   text NOT NULL UNIQUE,
  slug   text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE service_areas (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name   text NOT NULL,
  city   text NOT NULL DEFAULT 'Lagos',
  lat    numeric(9,6),
  lng    numeric(9,6),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (city, name)
);
