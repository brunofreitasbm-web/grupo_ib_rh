-- Escala mensal de estagiários: um registro por estagiário e dia escalado.
CREATE TABLE IF NOT EXISTS public.intern_schedule_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  unit_id     text NOT NULL,
  intern_id   uuid NOT NULL REFERENCES public.interns(id) ON DELETE CASCADE,
  work_date   date NOT NULL,
  hours       numeric(4,1) NOT NULL CHECK (hours > 0 AND hours <= 6),
  source      text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  UNIQUE (intern_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_intern_schedule_workspace_unit_date
  ON public.intern_schedule_entries (workspace_id, unit_id, work_date);

ALTER TABLE public.intern_schedule_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intern_schedule_select ON public.intern_schedule_entries;
CREATE POLICY intern_schedule_select ON public.intern_schedule_entries
  FOR SELECT TO authenticated
  USING (public.jwt_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS intern_schedule_write ON public.intern_schedule_entries;
CREATE POLICY intern_schedule_write ON public.intern_schedule_entries
  FOR ALL TO authenticated
  USING (public.jwt_has_workspace_access(workspace_id) AND public.jwt_is_supervisor_for_unit(unit_id))
  WITH CHECK (public.jwt_has_workspace_access(workspace_id) AND public.jwt_is_supervisor_for_unit(unit_id));
