-- ===========================================================================
-- Abode Row-Level Security policies  (idempotent — safe to re-run)
--
-- Model:
--   * The app connects as the DB master, then does `SET LOCAL ROLE abode_app`
--     inside each request transaction (see src/server/db/rls.ts). RLS applies
--     to abode_app; the master bypasses it (used for migrations/seed/webhooks).
--   * The current user's id is provided per-transaction via
--     set_config('app.current_user_id', <uuid>, true).
--   * Membership checks are SECURITY DEFINER functions owned by the master, so
--     they read the underlying tables WITHOUT recursing into RLS.
--
-- Visibility summary:
--   tenant   → their own user row, their unit + its property, their invoices,
--              their maintenance requests, their payment methods, their convos.
--   employee → properties they're assigned to (+ units/tasks there), their tasks.
--   owner    → everything they own (properties, units, tenants, invoices, tasks…).
-- ===========================================================================

-- ----------------------------------------------------------------- app role
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'abode_app') then
    create role abode_app nologin;
  end if;
end $$;

-- allow the connecting (master) role to SET ROLE abode_app
do $$
begin
  execute format('grant abode_app to %I', current_user);
end $$;

grant usage on schema public to abode_app;
grant select, insert, update, delete on all tables in schema public to abode_app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to abode_app;

-- --------------------------------------------------------------- helper fns
create or replace function app_current_user_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.current_user_id', true), '')::uuid $$;

create or replace function app_owns_property(p uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from properties where id = p and owner_id = app_current_user_id())
$$;

create or replace function app_owns_unit(u uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from units un join properties pr on pr.id = un.property_id
    where un.id = u and pr.owner_id = app_current_user_id())
$$;

create or replace function app_tenant_of_unit(u uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from units where id = u and tenant_id = app_current_user_id())
$$;

create or replace function app_employee_of_property(p uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from property_employees
                 where property_id = p and employee_id = app_current_user_id())
$$;

create or replace function app_can_see_property(p uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select app_owns_property(p)
      or app_employee_of_property(p)
      or exists (select 1 from units where property_id = p and tenant_id = app_current_user_id())
$$;

create or replace function app_can_see_unit(u uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select app_tenant_of_unit(u)
      or app_owns_unit(u)
      or exists (select 1 from units un
                 where un.id = u and app_employee_of_property(un.property_id))
$$;

create or replace function app_can_see_invoice(inv uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from invoices i
    where i.id = inv and (app_tenant_of_unit(i.unit_id) or app_owns_unit(i.unit_id)))
$$;

create or replace function app_can_see_task(t uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tasks tk
    where tk.id = t
      and (app_can_see_property(tk.property_id) or tk.assigned_to = app_current_user_id()))
$$;

create or replace function app_in_conversation(c uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversations cv
    where cv.id = c
      and (cv.participant_a = app_current_user_id()
           or cv.participant_b = app_current_user_id()))
$$;

create or replace function app_can_see_user(target uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select target = app_current_user_id()
    or exists (select 1 from units un join properties pr on pr.id = un.property_id
               where un.tenant_id = target and pr.owner_id = app_current_user_id())
    or exists (select 1 from property_employees pe join properties pr on pr.id = pe.property_id
               where pe.employee_id = target and pr.owner_id = app_current_user_id())
    or exists (select 1 from conversations c
               where (c.participant_a = app_current_user_id() and c.participant_b = target)
                  or (c.participant_b = app_current_user_id() and c.participant_a = target))
$$;

-- ------------------------------------------------------------- enable + deny
-- Enabling RLS with a single FOR ALL policy makes everything not matched by the
-- USING clause invisible (default-deny). When app.current_user_id is unset,
-- app_current_user_id() is NULL and every predicate is false → zero rows.

alter table users                 enable row level security;
alter table properties            enable row level security;
alter table units                 enable row level security;
alter table property_employees    enable row level security;
alter table invite_codes          enable row level security;
alter table payment_methods       enable row level security;
alter table invoices              enable row level security;
alter table payments              enable row level security;
alter table maintenance_requests  enable row level security;
alter table tasks                 enable row level security;
alter table task_receipts         enable row level security;
alter table conversations         enable row level security;
alter table messages              enable row level security;
alter table notifications         enable row level security;

-- ------------------------------------------------------------------ policies

drop policy if exists users_rls on users;
create policy users_rls on users for all to abode_app
  using (app_can_see_user(id))
  with check (id = app_current_user_id());

drop policy if exists properties_rls on properties;
create policy properties_rls on properties for all to abode_app
  using (app_can_see_property(id))
  with check (owner_id = app_current_user_id());

drop policy if exists units_rls on units;
create policy units_rls on units for all to abode_app
  using (app_can_see_unit(id))
  with check (app_owns_unit(id));

drop policy if exists property_employees_rls on property_employees;
create policy property_employees_rls on property_employees for all to abode_app
  using (employee_id = app_current_user_id() or app_owns_property(property_id))
  with check (app_owns_property(property_id));

drop policy if exists invite_codes_rls on invite_codes;
create policy invite_codes_rls on invite_codes for all to abode_app
  using (owner_id = app_current_user_id())
  with check (owner_id = app_current_user_id());

drop policy if exists payment_methods_rls on payment_methods;
create policy payment_methods_rls on payment_methods for all to abode_app
  using (user_id = app_current_user_id())
  with check (user_id = app_current_user_id());

drop policy if exists invoices_rls on invoices;
create policy invoices_rls on invoices for all to abode_app
  using (app_tenant_of_unit(unit_id) or app_owns_unit(unit_id))
  with check (app_owns_unit(unit_id));

drop policy if exists payments_rls on payments;
create policy payments_rls on payments for all to abode_app
  using (app_can_see_invoice(invoice_id))
  with check (app_can_see_invoice(invoice_id));

drop policy if exists maintenance_requests_rls on maintenance_requests;
create policy maintenance_requests_rls on maintenance_requests for all to abode_app
  using (app_can_see_unit(unit_id))
  with check (app_tenant_of_unit(unit_id) or app_owns_unit(unit_id));

drop policy if exists tasks_rls on tasks;
create policy tasks_rls on tasks for all to abode_app
  using (app_can_see_property(property_id) or assigned_to = app_current_user_id())
  with check (app_owns_property(property_id) or assigned_to = app_current_user_id());

drop policy if exists task_receipts_rls on task_receipts;
create policy task_receipts_rls on task_receipts for all to abode_app
  using (app_can_see_task(task_id))
  with check (app_can_see_task(task_id));

drop policy if exists conversations_rls on conversations;
create policy conversations_rls on conversations for all to abode_app
  using (participant_a = app_current_user_id() or participant_b = app_current_user_id())
  with check (participant_a = app_current_user_id() or participant_b = app_current_user_id());

drop policy if exists messages_rls on messages;
create policy messages_rls on messages for all to abode_app
  using (app_in_conversation(conversation_id))
  with check (app_in_conversation(conversation_id) and sender_id = app_current_user_id());

drop policy if exists notifications_rls on notifications;
create policy notifications_rls on notifications for all to abode_app
  using (recipient_id = app_current_user_id())
  with check (recipient_id = app_current_user_id());
