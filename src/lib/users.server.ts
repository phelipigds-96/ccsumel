export async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .single();

  if (error || !data) {
    throw new Error("Acesso restrito a administradores.");
  }
}
