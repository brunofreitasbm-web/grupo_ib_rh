// Quem é supervisor nas edge functions do RH: só o claim protegido app_metadata.role.
// Rodar: deno test --no-check --allow-none supabase/functions/_shared/supervisor_test.ts
import { isSupervisorClaims } from "./supervisor.ts";

function igual(real: unknown, esperado: unknown, msg: string) {
  if (real !== esperado) throw new Error(`${msg}: esperado ${esperado}, veio ${real}`);
}

Deno.test("supervisor_so_por_app_metadata", () => {
  igual(isSupervisorClaims({ app_metadata: { role: "supervisor" } }), true, "app_metadata supervisor");
  igual(isSupervisorClaims({ app_metadata: { role: "intern_unit" }, email: "parqueshopping@grupoib.internal" } as never), false, "quiosque com domínio interno");
  igual(isSupervisorClaims({ user_metadata: { role: "supervisor" } } as never), false, "user_metadata é editável pelo usuário");
  igual(isSupervisorClaims({ email: "x@portoterapia.com" } as never), false, "domínio de e-mail não dá acesso");
  igual(isSupervisorClaims(null), false, "sem claims");
  igual(isSupervisorClaims(undefined), false, "sem claims");
});
