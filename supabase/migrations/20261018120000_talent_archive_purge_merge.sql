-- Banco de Talentos: retenção (arquivado 7d / DISC 10d), auditoria de exclusão
-- e mesclagem de candidaturas duplicadas.

-- 1. Quando o candidato foi arquivado (updated_at é sobrescrito por qualquer edição).
ALTER TABLE public.talent_candidates_meta
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Backfill: quem já está arquivado começa a contar agora (ninguém é apagado de imediato).
UPDATE public.talent_candidates_meta
SET archived_at = now()
WHERE status = 'ARQUIVADO' AND archived_at IS NULL;

-- 2. Envio "manual" (token_hash manual_*) não prova que o DISC não foi feito fora do
--    sistema; expõe um booleano para o front sem expor o hash.
ALTER TABLE public.talent_disc_tokens
  ADD COLUMN IF NOT EXISTS is_manual boolean
  GENERATED ALWAYS AS (token_hash LIKE 'manual\_%') STORED;

-- 3. Tombstone + auditoria de exclusões. Impede o candidato de reaparecer se o
--    registro remoto (Faça Amigos) demorar a sumir. Escrita só via service_role.
CREATE TABLE IF NOT EXISTS public.talent_purged_candidates (
  candidate_id text PRIMARY KEY,
  purged_at timestamptz NOT NULL DEFAULT now(),
  purged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  remote_deleted boolean NOT NULL DEFAULT false
);
ALTER TABLE public.talent_purged_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS talent_purged_select ON public.talent_purged_candidates;
CREATE POLICY talent_purged_select ON public.talent_purged_candidates
  FOR SELECT TO authenticated USING (true);

-- 4. Aliases de mesclagem: alias_id => master_id.
CREATE TABLE IF NOT EXISTS public.talent_candidate_aliases (
  alias_id text PRIMARY KEY,
  master_id text NOT NULL,
  merged_at timestamptz NOT NULL DEFAULT now(),
  merged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  remote_deleted boolean NOT NULL DEFAULT false,
  CONSTRAINT talent_alias_not_self CHECK (alias_id <> master_id)
);
CREATE INDEX IF NOT EXISTS idx_talent_alias_master ON public.talent_candidate_aliases (master_id);
ALTER TABLE public.talent_candidate_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS talent_alias_select ON public.talent_candidate_aliases;
CREATE POLICY talent_alias_select ON public.talent_candidate_aliases
  FOR SELECT TO authenticated USING (true);

-- 5. Mesclagem transacional (alias -> master). Só supervisor.
--    status: o mais avançado do funil; notas concatenadas; DISC respondido preservado.
CREATE OR REPLACE FUNCTION public.merge_talent_candidates(p_master text, p_alias text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order text[] := ARRAY['ARQUIVADO','NOVO','LIDO','ESPERA','EM_ANALISE','ENTREVISTA','CONTATADO'];
  v_m public.talent_candidates_meta%ROWTYPE;
  v_a public.talent_candidates_meta%ROWTYPE;
  v_status text;
  v_notes text;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'supervisor' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_master IS NULL OR p_alias IS NULL OR p_master = p_alias THEN
    RAISE EXCEPTION 'invalid_ids';
  END IF;

  -- Garante as linhas-mãe (FK) para os dois lados.
  INSERT INTO public.talent_candidates_meta (candidate_id) VALUES (p_master) ON CONFLICT DO NOTHING;
  INSERT INTO public.talent_candidates_meta (candidate_id) VALUES (p_alias) ON CONFLICT DO NOTHING;
  SELECT * INTO v_m FROM public.talent_candidates_meta WHERE candidate_id = p_master FOR UPDATE;
  SELECT * INTO v_a FROM public.talent_candidates_meta WHERE candidate_id = p_alias FOR UPDATE;

  -- Status mais avançado (NULL = usa o remoto, não compete).
  v_status := v_m.status;
  IF v_a.status IS NOT NULL AND (
       v_m.status IS NULL
       OR array_position(v_order, v_a.status) > array_position(v_order, v_m.status)
     ) THEN
    v_status := v_a.status;
  END IF;

  v_notes := NULLIF(concat_ws(E'\n---\n', NULLIF(v_m.notes, ''), NULLIF(v_a.notes, '')), '');

  UPDATE public.talent_candidates_meta
  SET status = v_status,
      notes = v_notes,
      archived_at = CASE WHEN v_status = 'ARQUIVADO' THEN COALESCE(v_m.archived_at, v_a.archived_at, now()) ELSE NULL END,
      updated_at = now()
  WHERE candidate_id = p_master;

  -- DISC respondido: o do master prevalece; senão herda o do alias.
  IF NOT EXISTS (SELECT 1 FROM public.talent_disc_assessments WHERE candidate_id = p_master) THEN
    UPDATE public.talent_disc_assessments SET candidate_id = p_master WHERE candidate_id = p_alias;
  END IF;
  -- Token: o do master prevalece; senão herda o do alias.
  IF NOT EXISTS (SELECT 1 FROM public.talent_disc_tokens WHERE candidate_id = p_master) THEN
    UPDATE public.talent_disc_tokens SET candidate_id = p_master WHERE candidate_id = p_alias;
  END IF;
  -- Simulação por unidade.
  IF NOT EXISTS (SELECT 1 FROM public.talent_basket_assignments WHERE candidate_id = p_master) THEN
    UPDATE public.talent_basket_assignments SET candidate_id = p_master WHERE candidate_id = p_alias;
  END IF;

  UPDATE public.freelancers SET source_candidate_id = p_master WHERE source_candidate_id = p_alias;

  INSERT INTO public.talent_candidate_aliases (alias_id, master_id, merged_by)
  VALUES (p_alias, p_master, auth.uid())
  ON CONFLICT (alias_id) DO UPDATE SET master_id = EXCLUDED.master_id, merged_at = now(), merged_by = auth.uid();
  -- Aliases que apontavam para o alias passam a apontar para o master.
  UPDATE public.talent_candidate_aliases SET master_id = p_master WHERE master_id = p_alias;

  -- Resíduos do alias (CASCADE leva o que sobrou nas filhas).
  DELETE FROM public.talent_candidates_meta WHERE candidate_id = p_alias;

  RETURN jsonb_build_object('ok', true, 'master', p_master, 'alias', p_alias, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.merge_talent_candidates(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.merge_talent_candidates(text, text) TO authenticated;
