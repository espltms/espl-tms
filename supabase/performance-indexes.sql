-- Performance indexes for 500-user readiness.
-- Run this in Supabase SQL Editor after confirming the production database is backed up.
-- These indexes support the dashboard, filtered lists, status counters, and recent-record ordering.

CREATE INDEX IF NOT EXISTS "Driver_status_createdAt_idx"
  ON "Driver" ("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Driver_complianceVerified_idx"
  ON "Driver" ("complianceVerified");

CREATE INDEX IF NOT EXISTS "Truck_status_createdAt_idx"
  ON "Truck" ("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Truck_complianceVerified_idx"
  ON "Truck" ("complianceVerified");

CREATE INDEX IF NOT EXISTS "PurchaseOrder_status_createdAt_idx"
  ON "PurchaseOrder" ("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "PurchaseOrder_clientName_idx"
  ON "PurchaseOrder" ("clientName");

CREATE INDEX IF NOT EXISTS "Trip_status_createdAt_idx"
  ON "Trip" ("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Trip_scheduledStartDate_idx"
  ON "Trip" ("scheduledStartDate" DESC);

CREATE INDEX IF NOT EXISTS "Trip_purchaseOrderId_idx"
  ON "Trip" ("purchaseOrderId");

CREATE INDEX IF NOT EXISTS "Trip_driverId_idx"
  ON "Trip" ("driverId");

CREATE INDEX IF NOT EXISTS "Trip_truckId_idx"
  ON "Trip" ("truckId");

CREATE INDEX IF NOT EXISTS "WeighTicket_status_timestamp_idx"
  ON "WeighTicket" ("status", "timestamp" DESC);

CREATE INDEX IF NOT EXISTS "WeighTicket_truckPlate_idx"
  ON "WeighTicket" ("truckPlate");

CREATE INDEX IF NOT EXISTS "WeighTicket_timestamp_idx"
  ON "WeighTicket" ("timestamp" DESC);

CREATE INDEX IF NOT EXISTS "Invoice_status_createdAt_idx"
  ON "Invoice" ("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Invoice_tripId_idx"
  ON "Invoice" ("tripId");

CREATE INDEX IF NOT EXISTS "Invoice_dueDate_idx"
  ON "Invoice" ("dueDate");
