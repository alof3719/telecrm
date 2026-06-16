-- =============================================
-- TeleCRM Database Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- CLIENTS TABLE
-- =============================================
create table clients (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  -- Contact info
  name text not null,
  phone text not null,
  email text,
  company_name text,

  -- Pipeline
  status text default 'new' check (
    status in ('new', 'no_answer', 'follow_up', 'in_the_money', 'not_interested', 'monkey', 'broke')
  ),

  -- Deal info
  deal_value numeric(10, 2),
  assigned_to text, -- email of the team member

  -- Dates
  next_followup_date date,
  last_call_date timestamp with time zone,
  last_comment_date timestamp with time zone
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at
  before update on clients
  for each row execute function update_updated_at();

-- =============================================
-- NOTES TABLE
-- =============================================
create table notes (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  client_id uuid references clients(id) on delete cascade not null,
  content text not null,
  created_by text not null -- email of the user
);

-- =============================================
-- CALL LOGS TABLE
-- =============================================
create table call_logs (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  client_id uuid references clients(id) on delete cascade not null,
  duration integer, -- duration in seconds
  direction text check (direction in ('inbound', 'outbound')),
  call_status text, -- answered, missed, voicemail, busy
  zoom_call_id text unique, -- to prevent duplicate webhook events
  notes text -- brief auto-generated summary
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table clients enable row level security;
alter table notes enable row level security;
alter table call_logs enable row level security;

-- Allow all authenticated users to read/write everything
create policy "Authenticated full access on clients"
  on clients for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated full access on notes"
  on notes for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated full access on call_logs"
  on call_logs for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Allow service_role (used by Edge Functions / webhooks) to bypass RLS
-- This is enabled by default for the service_role key

-- =============================================
-- INDEXES for performance
-- =============================================
create index idx_clients_status on clients(status);
create index idx_clients_assigned_to on clients(assigned_to);
create index idx_clients_next_followup on clients(next_followup_date);
create index idx_notes_client_id on notes(client_id);
create index idx_call_logs_client_id on call_logs(client_id);
create index idx_call_logs_zoom_id on call_logs(zoom_call_id);
