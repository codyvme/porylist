create table if not exists shiny_hunts (
  id          text        primary key,           -- client-generated ID
  user_id     uuid        not null references auth.users(id) on delete cascade,
  data        jsonb       not null,              -- full ShinyHunt JSON blob
  updated_at  timestamptz not null default now()
);

alter table shiny_hunts enable row level security;

create policy "Users can read their own shiny hunts"
  on shiny_hunts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own shiny hunts"
  on shiny_hunts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own shiny hunts"
  on shiny_hunts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own shiny hunts"
  on shiny_hunts for delete
  using (auth.uid() = user_id);
