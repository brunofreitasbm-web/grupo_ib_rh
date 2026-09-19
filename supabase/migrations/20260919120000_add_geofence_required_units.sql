-- Permite desativar a exigência de geolocalização (cerca virtual) por unidade
-- no fluxo de registro de ponto de estagiários. Necessário porque terminais
-- fixos (desktop) sem GPS podem depender de geolocalização por IP, que é
-- imprecisa e pode bloquear registros legítimos.
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS geofence_required boolean NOT NULL DEFAULT true;
