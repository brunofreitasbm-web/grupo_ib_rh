# RH Grupo IB (FaçaAmigos)

Gestão de pessoas do Grupo IB: estagiários, profissionais PJ, funcionários CLT, banco de talentos e DISC.

App React + Vite, publicado na Vercel (projeto `gestao-pessoas-grupoib`), usando um projeto Supabase compartilhado entre workspaces.

## Relação com o repo do outro workspace
- Este repo serve só o workspace `grupoib` (`VITE_WORKSPACE_ID=grupoib`).
- O banco é compartilhado e isolado por `workspace_id` + RLS. As migrations vivem no repo `rh_grupoib_porto`, que é a fonte única do schema. Para mudar o banco, abra PR lá.
- As edge functions de `supabase/functions` são deste repo. Publique com `supabase functions deploy <nome>` no projeto compartilhado.

## Desenvolvimento
```bash
cp .env.example .env   # preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm ci
npm run dev
npm test
```
