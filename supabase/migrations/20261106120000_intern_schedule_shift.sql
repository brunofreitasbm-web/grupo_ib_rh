-- Escala de estagiários: alocação por turno (Manhã / Tarde).
-- Um estagiário pode ter até 2 linhas por dia, uma em cada turno.
ALTER TABLE public.intern_schedule_entries
  ADD COLUMN IF NOT EXISTS shift text NOT NULL DEFAULT 'Manhã'
  CHECK (shift IN ('Manhã', 'Tarde'));

ALTER TABLE public.intern_schedule_entries
  DROP CONSTRAINT IF EXISTS intern_schedule_entries_intern_id_work_date_key;

ALTER TABLE public.intern_schedule_entries
  ADD CONSTRAINT intern_schedule_entries_intern_date_shift_key
  UNIQUE (intern_id, work_date, shift);
