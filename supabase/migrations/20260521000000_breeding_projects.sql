create table if not exists breeding_projects (
  id          text        primary key,           -- client-generated UUID
  user_id     uuid        not null references auth.users(id) on delete cascade,
  data        jsonb       not null,              -- full BreedingProject JSON blob
  updated_at  timestamptz not null default now()
);

alter table breeding_projects enable row level security;

create policy "Users can read their own projects"
  on breeding_projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on breeding_projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on breeding_projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on breeding_projects for delete
  using (auth.uid() = user_id);
