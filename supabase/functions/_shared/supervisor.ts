// Supervisor = claim protegido app_metadata.role === "supervisor".
// user_metadata é editável pelo próprio usuário (auth.updateUser) e domínio de e-mail não é identidade:
// as contas de quiosque (*_unit) usam @grupoib.internal e não podem passar por supervisor.
export function isSupervisorClaims(claims: unknown): boolean {
  const app = (claims as { app_metadata?: { role?: unknown } } | null | undefined)?.app_metadata;
  return app?.role === "supervisor";
}
