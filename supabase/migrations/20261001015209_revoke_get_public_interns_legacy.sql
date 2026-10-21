-- A tela pública migrou para get_public_interns_basic (sem CPF nem assinatura facial) e o app novo já está em produção.
-- A função antiga devolvia CPF e face_descriptor de todos os estagiários ativos e deixa de ser chamável pela API.
revoke execute on function public.get_public_interns(text[]) from public, anon, authenticated;
grant execute on function public.get_public_interns(text[]) to service_role;

-- Reversão, se necessário:
-- grant execute on function public.get_public_interns(text[]) to anon, authenticated;
