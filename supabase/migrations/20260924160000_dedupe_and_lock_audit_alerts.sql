-- Remove duplicate "[AUDITORIA SISTÊMICA]" occurrence records that were created
-- by concurrent/re-entrant runs of the client-side point audit engine
-- (same intern + same alert text inserted more than once), keeping the
-- oldest row of each duplicate group.
DELETE FROM public.records r
USING public.records r2
WHERE r.action = 'ocorrencia'
  AND r.justification LIKE '[AUDITORIA SISTÊMICA]%'
  AND r2.action = 'ocorrencia'
  AND r2.justification LIKE '[AUDITORIA SISTÊMICA]%'
  AND r.intern_id = r2.intern_id
  AND r.justification = r2.justification
  AND (r.created_at, r.id) > (r2.created_at, r2.id);

-- Prevent the same audit alert (intern + exact alert text, which already
-- encodes the alert type and date) from ever being inserted twice again,
-- regardless of how many concurrent audit runs race to insert it.
CREATE UNIQUE INDEX IF NOT EXISTS records_audit_alert_unique_idx
  ON public.records (intern_id, justification)
  WHERE action = 'ocorrencia' AND justification LIKE '[AUDITORIA SISTÊMICA]%';
