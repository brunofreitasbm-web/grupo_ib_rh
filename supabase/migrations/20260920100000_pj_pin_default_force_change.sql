-- Todo prestador PJ (professionals) deve ter um PIN desde a validação do
-- cadastro, começando sempre em '000000', e é obrigado a trocá-lo antes de
-- registrar sua primeira presença (bater ponto). Hoje um profissional
-- validado podia ficar sem nenhuma linha em professional_pins até um
-- supervisor rodar set_professional_pin manualmente (register_professional_presence
-- então falhava com 'pin_not_set'). Esta migração:
--   1. adiciona a flag must_change_pin em professional_pins;
--   2. cria um trigger que provisiona o PIN padrão '000000' (com
--      must_change_pin = true) assim que o cadastro fica 'validated',
--      seja na criação direta pelo supervisor ou na validação de um
--      autocadastro pendente;
--   3. faz o backfill dos profissionais já validados que ainda não têm PIN;
--   4. bloqueia register_professional_presence enquanto must_change_pin
--      estiver ligado, exigindo a troca antes de qualquer entrada/saída;
--   5. change_professional_pin desliga a flag ao trocar o PIN com sucesso;
--   6. set_professional_pin (reset feito pelo supervisor) volta a ligar a
--      flag, mesma lógica de reset_intern_password/is_first_login.

ALTER TABLE public.professional_pins
  ADD COLUMN IF NOT EXISTS must_change_pin boolean NOT NULL DEFAULT false;

-- 1. PIN padrão '000000' criado automaticamente na validação do cadastro.
-- SECURITY DEFINER: precisa escrever em professional_pins, que não tem
-- nenhuma policy (mesmo padrão das RPCs do módulo PJ).
CREATE OR REPLACE FUNCTION public.professional_assign_default_pin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.registration_status = 'validated' THEN
    INSERT INTO public.professional_pins (professional_id, pin_hash, failed_attempts, locked_until, must_change_pin, updated_at)
    VALUES (NEW.id, crypt('000000', gen_salt('bf')), 0, NULL, true, now())
    ON CONFLICT (professional_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_professional_assign_default_pin ON public.professionals;
CREATE TRIGGER trg_professional_assign_default_pin
  AFTER INSERT OR UPDATE OF registration_status ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.professional_assign_default_pin();

-- 2. Backfill: profissionais já validados sem nenhum PIN também nascem com
-- '000000' e obrigação de troca (nunca sobrescreve quem já tem PIN).
INSERT INTO public.professional_pins (professional_id, pin_hash, failed_attempts, locked_until, must_change_pin, updated_at)
SELECT p.id, crypt('000000', gen_salt('bf')), 0, NULL, true, now()
  FROM public.professionals p
 WHERE p.registration_status = 'validated'
   AND NOT EXISTS (SELECT 1 FROM public.professional_pins pp WHERE pp.professional_id = p.id);

-- 3. Reset pelo supervisor volta a exigir troca no próximo acesso.
CREATE OR REPLACE FUNCTION public.set_professional_pin(p_professional_id uuid, p_pin text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit text;
  v_status text;
BEGIN
  SELECT unit_id, registration_status INTO v_unit, v_status FROM public.professionals WHERE id = p_professional_id;
  IF v_unit IS NULL OR NOT public.jwt_is_supervisor_for_unit(v_unit) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF v_status IS DISTINCT FROM 'validated' THEN
    RAISE EXCEPTION 'professional_pending_validation';
  END IF;
  IF NOT public.is_valid_professional_pin(p_pin) THEN
    RAISE EXCEPTION 'pin_invalid_format';
  END IF;

  INSERT INTO public.professional_pins (professional_id, pin_hash, failed_attempts, locked_until, must_change_pin, updated_at)
  VALUES (p_professional_id, crypt(p_pin, gen_salt('bf')), 0, NULL, true, now())
  ON CONFLICT (professional_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash, failed_attempts = 0, locked_until = NULL, must_change_pin = true, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.set_professional_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_professional_pin(uuid, text) TO authenticated;

-- 4. Troca de PIN pelo próprio prestador desliga a obrigação.
CREATE OR REPLACE FUNCTION public.change_professional_pin(p_professional_id uuid, p_current_pin text, p_new_pin text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit text;
BEGIN
  SELECT unit_id INTO v_unit FROM public.professionals WHERE id = p_professional_id AND active;
  IF v_unit IS NULL OR NOT (public.jwt_is_professional_kiosk_for_unit(v_unit) OR public.jwt_is_supervisor_for_unit(v_unit)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF NOT public.is_valid_professional_pin(p_new_pin) THEN
    RAISE EXCEPTION 'pin_invalid_format';
  END IF;
  PERFORM public.verify_professional_pin_internal(p_professional_id, p_current_pin);
  UPDATE public.professional_pins
     SET pin_hash = crypt(p_new_pin, gen_salt('bf')), failed_attempts = 0, locked_until = NULL, must_change_pin = false, updated_at = now()
   WHERE professional_id = p_professional_id;
END;
$$;
REVOKE ALL ON FUNCTION public.change_professional_pin(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_professional_pin(uuid, text, text) TO authenticated;

-- 5. Registro de presença bloqueado enquanto a troca obrigatória não for feita.
CREATE OR REPLACE FUNCTION public.register_professional_presence(
  p_professional_id uuid,
  p_pin text,
  p_action text,
  p_geo jsonb DEFAULT '{}'::jsonb,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prof public.professionals%ROWTYPE;
  v_pj_enabled boolean;
  v_must_change_pin boolean;
  v_last_action text;
  v_new_id uuid;
  v_ts timestamp with time zone := now();
BEGIN
  IF p_action NOT IN ('entrada', 'saida') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  SELECT * INTO v_prof FROM public.professionals WHERE id = p_professional_id;
  IF NOT FOUND OR NOT v_prof.active THEN
    RAISE EXCEPTION 'professional_inactive';
  END IF;
  IF v_prof.registration_status IS DISTINCT FROM 'validated' THEN
    RAISE EXCEPTION 'professional_pending_validation';
  END IF;
  IF NOT (public.jwt_is_professional_kiosk_for_unit(v_prof.unit_id) OR public.jwt_is_supervisor_for_unit(v_prof.unit_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT pj_enabled INTO v_pj_enabled FROM public.units WHERE id = v_prof.unit_id;
  IF NOT COALESCE(v_pj_enabled, false) THEN
    RAISE EXCEPTION 'unit_pj_disabled';
  END IF;

  PERFORM public.verify_professional_pin_internal(p_professional_id, p_pin);

  SELECT must_change_pin INTO v_must_change_pin FROM public.professional_pins WHERE professional_id = p_professional_id;
  IF COALESCE(v_must_change_pin, false) THEN
    RAISE EXCEPTION 'pin_must_be_changed';
  END IF;

  IF v_prof.terms_accepted_at IS NULL THEN
    RAISE EXCEPTION 'terms_not_accepted';
  END IF;

  SELECT action INTO v_last_action
    FROM public.professional_presence
   WHERE professional_id = p_professional_id
     AND (timestamp AT TIME ZONE 'America/Belem')::date = (v_ts AT TIME ZONE 'America/Belem')::date
   ORDER BY timestamp DESC
   LIMIT 1;

  IF p_action = 'entrada' AND v_last_action = 'entrada' THEN
    RAISE EXCEPTION 'sequence_open_entry';
  END IF;
  IF p_action = 'saida' AND (v_last_action IS NULL OR v_last_action <> 'entrada') THEN
    RAISE EXCEPTION 'sequence_no_entry';
  END IF;

  INSERT INTO public.professional_presence (professional_id, professional_name, unit_id, action, timestamp, auth_method, geo, note, created_by)
  VALUES (p_professional_id, v_prof.name, v_prof.unit_id, p_action, v_ts, 'pin', COALESCE(p_geo, '{}'::jsonb), NULLIF(trim(p_note), ''), auth.uid())
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'id', v_new_id, 'timestamp', v_ts, 'action', p_action, 'name', v_prof.name);
END;
$$;
REVOKE ALL ON FUNCTION public.register_professional_presence(uuid, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_professional_presence(uuid, text, text, jsonb, text) TO authenticated;

-- 6. Indica ao quiosque, antes mesmo de tentar bater o ponto, que a troca é
-- obrigatória (mesmo padrão de professional_has_pin: sem expor o hash).
CREATE OR REPLACE FUNCTION public.professional_must_change_pin(p_professional_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit text;
BEGIN
  SELECT unit_id INTO v_unit FROM public.professionals WHERE id = p_professional_id;
  IF v_unit IS NULL OR NOT (public.jwt_is_supervisor_for_unit(v_unit) OR public.jwt_is_professional_kiosk_for_unit(v_unit)) THEN
    RETURN false;
  END IF;
  RETURN COALESCE((SELECT must_change_pin FROM public.professional_pins WHERE professional_id = p_professional_id), false);
END;
$$;
REVOKE ALL ON FUNCTION public.professional_must_change_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.professional_must_change_pin(uuid) TO authenticated;
