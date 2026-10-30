-- Preserve Apple Calendar identity and recurrence source data so imported
-- occurrences can be synchronized without being duplicated on another device.
alter table public.tasks
  add column if not exists external_uid text,
  add column if not exists recurrence_id text,
  add column if not exists import_source text,
  add column if not exists source_calendar text,
  add column if not exists recurrence_rule text;

create unique index if not exists tasks_external_occurrence_per_user_idx
  on public.tasks (
    user_id,
    import_source,
    external_uid,
    coalesce(recurrence_id, '')
  )
  where import_source is not null
    and external_uid is not null
    and deleted_at is null;
