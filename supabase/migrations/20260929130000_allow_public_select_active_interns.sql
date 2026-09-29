-- Migração: Leitura pública de estagiários ativos para autogestão de biometria facial e quiosque

DROP POLICY IF EXISTS "Permitir leitura pública de estagiários ativos" ON public.interns;
CREATE POLICY "Permitir leitura pública de estagiários ativos"
  ON public.interns FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE OR REPLACE FUNCTION public.get_public_interns(p_workspace_unit_ids text[] DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  unit_id text,
  cpf text,
  face_descriptor text,
  active boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.name, i.unit_id, i.cpf, i.face_descriptor, i.active
  FROM public.interns i
  WHERE i.active = true
    AND (p_workspace_unit_ids IS NULL OR i.unit_id = ANY(p_workspace_unit_ids))
  ORDER BY i.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_interns(text[]) TO anon, authenticated;

-- Função segura para autogestão de biometria facial (valida CPF antes de atualizar)
CREATE OR REPLACE FUNCTION public.save_intern_autogestao_biometria(
  p_intern_id uuid,
  p_face_descriptor text,
  p_cpf text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_intern_cpf text;
  v_clean_input_cpf text;
  v_clean_db_cpf text;
BEGIN
  SELECT cpf INTO v_intern_cpf
  FROM public.interns
  WHERE id = p_intern_id AND active = true;

  IF v_intern_cpf IS NULL THEN
    RAISE EXCEPTION 'Estagiário não encontrado ou inativo';
  END IF;

  v_clean_input_cpf := regexp_replace(p_cpf, '\D', '', 'g');
  v_clean_db_cpf := regexp_replace(v_intern_cpf, '\D', '', 'g');

  IF v_clean_input_cpf <> v_clean_db_cpf THEN
    RAISE EXCEPTION 'CPF informado não confere com o cadastro do estagiário';
  END IF;

  UPDATE public.interns
  SET face_descriptor = p_face_descriptor
  WHERE id = p_intern_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_intern_autogestao_biometria(uuid, text, text) TO anon, authenticated;
