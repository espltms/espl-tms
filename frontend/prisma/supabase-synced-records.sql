-- Run this once in Supabase SQL Editor before using cross-device synced local records.
create table if not exists "SyncedRecord" (
  "id" text primary key default gen_random_uuid()::text,
  "userId" text not null references "User"("id") on delete cascade,
  "recordType" text not null,
  "recordKey" text not null,
  "payload" jsonb not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "SyncedRecord_userId_recordType_recordKey_key"
  on "SyncedRecord" ("userId", "recordType", "recordKey");

create index if not exists "SyncedRecord_userId_recordType_idx"
  on "SyncedRecord" ("userId", "recordType");

create index if not exists "SyncedRecord_recordKey_idx"
  on "SyncedRecord" ("recordKey");
