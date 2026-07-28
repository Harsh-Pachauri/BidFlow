-- Lifetime invariant: bidCloseAt may equal forcedCloseAt (the valid
-- Force-Closed terminal state) but must never exceed it. This is
-- deliberately NOT the same as the strict "forcedCloseAt > bidCloseAt"
-- rule enforced at RFQ creation in the application layer (see
-- docs/DATABASE_SCHEMA.md, Validation Rules) -- that rule is strict and
-- only applies once, at creation.
ALTER TABLE "Rfq" ADD CONSTRAINT "bid_close_within_forced_close"
  CHECK ("bidCloseAt" <= "forcedCloseAt");