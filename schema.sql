-- SQL schema for AutoMail
-- Run this in your Supabase SQL Editor to set up the necessary tables, policies, and triggers.

-- 1. Create user profiles table
create table if not exists public.user_profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on user_profiles
alter table public.user_profiles enable row level security;

-- Policies for user_profiles
create policy "Users can view their own profile" on public.user_profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.user_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users can insert their own profile" on public.user_profiles
  for insert with check (auth.uid() = id);

-- 2. Create profiles table (stores job roles, templates, and resume base64 data)
create table if not exists public.profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  subject text not null,
  body text not null,
  resume_name text,
  resume_mime_type text,
  resume_data text, -- stores base64-encoded resume file content
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Policy for profiles
create policy "Users can manage their own profiles" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Create sent_mails table (stores email send history logs)
create table if not exists public.sent_mails (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  email text not null,
  profile_name text not null,
  resume_name text not null,
  subject text not null,
  status text not null, -- 'sent' or 'failed'
  error text,
  sent_at timestamptz default now()
);

-- Enable RLS on sent_mails
alter table public.sent_mails enable row level security;

-- Policy for sent_mails
create policy "Users can manage their own sent mails" on public.sent_mails
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Create trigger to automatically sync auth.users with public.user_profiles on registration
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it already exists to avoid duplication errors
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
