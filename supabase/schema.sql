-- PATITAS: ejecutar en Supabase SQL Editor en un proyecto nuevo.
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.staff_role as enum ('admin','vet','reception');
create type public.appointment_status as enum ('scheduled','confirmed','completed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.staff_role not null default 'reception',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.current_staff_role()
returns public.staff_role language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() and active=true $$;
create or replace function public.is_staff_active()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and active=true) $$;

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text not null,
  breed text,
  sex text,
  birth_date date,
  weight_kg numeric(7,2) check(weight_kg is null or weight_kg>=0),
  owner_name text not null,
  owner_phone text,
  owner_email text,
  reminder_consent boolean not null default false,
  photo_url text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null unique references public.pets(id) on delete cascade,
  clinical_notes text,
  medical_history text,
  notes text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text not null,
  vet_name text,
  status public.appointment_status not null default 'scheduled',
  notes text,
  created_by uuid references public.profiles(id),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_positive_duration check(end_at>start_at),
  constraint appointments_no_overlap exclude using gist (tstzrange(start_at,end_at,'[)') with &&) where (status <> 'cancelled')
);
create index appointments_start_at_idx on public.appointments(start_at);
create index appointments_pet_id_idx on public.appointments(pet_id);

create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  vaccine_name text not null,
  administered_at date not null,
  lot_number text not null,
  professional_name text not null,
  administered_by uuid references public.profiles(id),
  next_dose_at date,
  notes text,
  created_at timestamptz not null default now(),
  constraint vaccine_next_date_check check(next_dose_at is null or next_dose_at>=administered_at)
);
create index vaccinations_next_dose_idx on public.vaccinations(next_dose_at) where next_dose_at is not null;

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check(category in ('Medicamentos','Insumos médicos','Alimentos','Pet shop','Otros')),
  quantity integer not null default 0 check(quantity>=0),
  min_quantity integer not null default 0 check(min_quantity>=0),
  unit_cost numeric(12,2) not null default 0 check(unit_cost>=0),
  unit text not null default 'unidades',
  expires_on date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  record_id text,
  changed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.reminder_queue (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  channel text not null default 'email' check(channel in ('email','sms')),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check(status in ('pending','sent','failed','cancelled')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create unique index reminder_queue_pending_unique on public.reminder_queue(appointment_id,channel,scheduled_for) where status='pending';

-- Los perfiles se crean manualmente tras crear el usuario en Authentication.
-- No hay política de auto-registro: solo usuarios creados por el administrador.
alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.clinical_records enable row level security;
alter table public.appointments enable row level security;
alter table public.vaccinations enable row level security;
alter table public.inventory enable row level security;
alter table public.audit_logs enable row level security;
alter table public.reminder_queue enable row level security;

create policy "staff read own profile and admins read all" on public.profiles for select to authenticated
using (id=auth.uid() or public.current_staff_role()='admin');
create policy "admin manages profiles" on public.profiles for all to authenticated
using (public.current_staff_role()='admin') with check (public.current_staff_role()='admin');

create policy "active staff read pets" on public.pets for select to authenticated using(public.is_staff_active());
create policy "admin vet reception manage pets" on public.pets for insert to authenticated with check(public.current_staff_role() in ('admin','vet','reception'));
create policy "admin vet reception update pets" on public.pets for update to authenticated using(public.current_staff_role() in ('admin','vet','reception')) with check(public.current_staff_role() in ('admin','vet','reception'));
create policy "admin can delete pets" on public.pets for delete to authenticated using(public.current_staff_role()='admin');
create policy "active clinical staff read clinical records" on public.clinical_records for select to authenticated using(public.current_staff_role() in ('admin','vet'));
create policy "vet admin insert clinical records" on public.clinical_records for insert to authenticated with check(public.current_staff_role() in ('admin','vet'));
create policy "vet admin update clinical records" on public.clinical_records for update to authenticated using(public.current_staff_role() in ('admin','vet')) with check(public.current_staff_role() in ('admin','vet'));
create policy "admin deletes clinical records" on public.clinical_records for delete to authenticated using(public.current_staff_role()='admin');

create policy "active staff read appointments" on public.appointments for select to authenticated using(public.is_staff_active());
create policy "staff create appointments" on public.appointments for insert to authenticated with check(public.current_staff_role() in ('admin','vet','reception'));
create policy "staff update appointments" on public.appointments for update to authenticated using(public.current_staff_role() in ('admin','vet','reception')) with check(public.current_staff_role() in ('admin','vet','reception'));
create policy "admin delete appointments" on public.appointments for delete to authenticated using(public.current_staff_role()='admin');

create policy "active staff read vaccinations" on public.vaccinations for select to authenticated using(public.is_staff_active());
create policy "vet admin create vaccinations" on public.vaccinations for insert to authenticated with check(public.current_staff_role() in ('admin','vet'));
create policy "vet admin update vaccinations" on public.vaccinations for update to authenticated using(public.current_staff_role() in ('admin','vet')) with check(public.current_staff_role() in ('admin','vet'));
create policy "admin delete vaccinations" on public.vaccinations for delete to authenticated using(public.current_staff_role()='admin');

create policy "active staff read inventory" on public.inventory for select to authenticated using(public.is_staff_active());
create policy "admin manages inventory" on public.inventory for all to authenticated using(public.current_staff_role()='admin') with check(public.current_staff_role()='admin');
create policy "admin reads audit logs" on public.audit_logs for select to authenticated using(public.current_staff_role()='admin');
create policy "admin reads reminder queue" on public.reminder_queue for select to authenticated using(public.current_staff_role()='admin');

-- Auditoría de cambios: el actor se toma de auth.uid(), no del cliente.
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.audit_logs(actor_id,action,table_name,record_id,metadata)
  values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce((case when TG_OP='DELETE' then OLD.id else NEW.id end)::text,''),
    jsonb_build_object('at',now()));
  if TG_OP='DELETE' then return OLD; else return NEW; end if;
end $$;
create trigger audit_pets after insert or update or delete on public.pets for each row execute function public.audit_row_change();
create trigger audit_clinical_records after insert or update or delete on public.clinical_records for each row execute function public.audit_row_change();
create trigger audit_appointments after insert or update or delete on public.appointments for each row execute function public.audit_row_change();
create trigger audit_vaccinations after insert or update or delete on public.vaccinations for each row execute function public.audit_row_change();
create trigger audit_inventory after insert or update or delete on public.inventory for each row execute function public.audit_row_change();

-- updated_at mantenido en el servidor.
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger pets_updated_at before update on public.pets for each row execute function public.set_updated_at();
create trigger appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger inventory_updated_at before update on public.inventory for each row execute function public.set_updated_at();

-- Recomendación: usar Storage privado para fotos. No hacer público el bucket de historias clínicas.
-- Recordatorios: la cola debe ser procesada por una Edge Function programada (Supabase Cron),
-- conectada a un proveedor de correo/SMS. No se envían mensajes automáticamente solo por crear la tabla.


-- Genera recordatorios pendientes 24 horas antes de cada turno.
create or replace function public.queue_appointment_reminder()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if TG_OP='DELETE' then
    update public.reminder_queue set status='cancelled' where appointment_id=OLD.id and status='pending';
    return OLD;
  end if;
  if NEW.status='cancelled' then
    update public.reminder_queue set status='cancelled' where appointment_id=NEW.id and status='pending';
  else
    update public.reminder_queue set status='cancelled' where appointment_id=NEW.id and status='pending';
    if NEW.start_at > now() then
      insert into public.reminder_queue(appointment_id,channel,scheduled_for,status)
      values(NEW.id,'email',greatest(now(),NEW.start_at - interval '24 hours'),'pending')
      on conflict(appointment_id,channel,scheduled_for) where status='pending' do nothing;
    end if;
  end if;
  return NEW;
end $$;
create trigger queue_appointment_reminder_trigger after insert or update of start_at,status on public.appointments
for each row execute function public.queue_appointment_reminder();
