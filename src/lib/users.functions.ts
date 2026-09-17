import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { usernameToEmail } from "@/lib/user-email";
import { assertAdmin } from "@/lib/users.server";

interface UpsertInput {
  id?: string;
  name: string;
  username: string;
  password?: string;
  status: "ativo" | "inativo";
  notes?: string;
  permissions: string[];
  isAdmin: boolean;
  readOnly: boolean;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(err: unknown, fallback: string): { ok: false; error: string } {
  const message =
    err instanceof Error && err.message
      ? err.message
      : typeof err === "string" && err
        ? err
        : fallback;
  console.error("[users.functions]", message);
  return { ok: false, error: message };
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UpsertInput) => input)
  .handler(async ({ data, context }): Promise<Result<{ id: string }>> => {
    try {
      await assertAdmin(context as any);
      if (!data.password || data.password.length < 6) {
        throw new Error("A senha deve ter ao menos 6 caracteres.");
      }
      const username = data.username.trim().toLowerCase();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: usernameToEmail(username),
        password: data.password,
        email_confirm: true,
      });
      if (error || !created?.user) {
        throw new Error(
          /already/i.test(error?.message ?? "")
            ? "Já existe um usuário com esse login."
            : (error?.message ?? "Não foi possível criar o usuário."),
        );
      }

      const id = created.user.id;
      const { error: pe } = await (supabaseAdmin as any).from("profiles").insert({
        id,
        name: data.name,
        username,
        status: data.status,
        notes: data.notes ?? "",
        permissions: data.permissions,
        read_only: data.readOnly,
      });
      if (pe) {
        await supabaseAdmin.auth.admin.deleteUser(id);
        throw new Error(
          pe.code === "23505" ? "Já existe um usuário com esse login." : pe.message,
        );
      }
      await (supabaseAdmin as any)
        .from("user_roles")
        .insert({ user_id: id, role: data.isAdmin ? "admin" : "user" });

      return { ok: true, data: { id } };
    } catch (err) {
      return fail(err, "Não foi possível criar o usuário.");
    }
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UpsertInput & { id: string }) => input)
  .handler(async ({ data, context }): Promise<Result<{ id: string }>> => {
    try {
      await assertAdmin(context as any);
      const username = data.username.trim().toLowerCase();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const attrs: Record<string, unknown> = { email: usernameToEmail(username), email_confirm: true };
      if (data.password) {
        if (data.password.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres.");
        attrs.password = data.password;
      }
      const { error: ae } = await supabaseAdmin.auth.admin.updateUserById(data.id, attrs as any);
      if (ae) {
        throw new Error(
          /already/i.test(ae.message) ? "Já existe um usuário com esse login." : ae.message,
        );
      }

      if (!data.isAdmin) {
        const { data: currentRole } = await (supabaseAdmin as any)
          .from("user_roles")
          .select("role")
          .eq("user_id", data.id)
          .maybeSingle();
        if (currentRole?.role === "admin") {
          const { count } = await (supabaseAdmin as any)
            .from("user_roles")
            .select("user_id", { count: "exact", head: true })
            .eq("role", "admin");
          if ((count ?? 0) <= 1) {
            throw new Error("Não é possível remover os privilégios do único administrador.");
          }
        }
      }

      const { error: pe } = await (supabaseAdmin as any)
        .from("profiles")
        .update({
          name: data.name,
          username,
          status: data.status,
          notes: data.notes ?? "",
          permissions: data.permissions,
          read_only: data.readOnly,
        })
        .eq("id", data.id);
      if (pe) {
        throw new Error(pe.code === "23505" ? "Já existe um usuário com esse login." : pe.message);
      }

      await (supabaseAdmin as any).from("user_roles").delete().eq("user_id", data.id);
      await (supabaseAdmin as any)
        .from("user_roles")
        .insert({ user_id: data.id, role: data.isAdmin ? "admin" : "user" });

      return { ok: true, data: { id: data.id } };
    } catch (err) {
      return fail(err, "Não foi possível salvar o usuário.");
    }
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<Result<{ id: string }>> => {
    try {
      await assertAdmin(context as any);
      if (data.id === context.userId) throw new Error("Você não pode excluir a si mesmo.");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { count } = await (supabaseAdmin as any)
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      const { data: target } = await (supabaseAdmin as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", data.id)
        .maybeSingle();
      if (target?.role === "admin" && (count ?? 0) <= 1) {
        throw new Error("Não é possível excluir o único administrador.");
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
      if (error) throw new Error(error.message);
      return { ok: true, data: { id: data.id } };
    } catch (err) {
      return fail(err, "Não foi possível excluir o usuário.");
    }
  });
