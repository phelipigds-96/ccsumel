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
      if (!data.id) throw new Error("Usuário não informado para atualização.");

      const username = (data.username ?? "").trim().toLowerCase();
      if (!username) throw new Error("Informe o nome de usuário (login).");
      if (data.password && data.password.length < 6) {
        throw new Error("A senha deve ter ao menos 6 caracteres.");
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1) O usuário precisa existir no auth antes de qualquer alteração.
      const { data: existing, error: ge } = await supabaseAdmin.auth.admin.getUserById(data.id);
      if (ge || !existing?.user) {
        throw new Error("Usuário não encontrado no sistema de autenticação.");
      }

      // 2) Validações antes de mutar qualquer coisa.
      const { data: currentRole } = await (supabaseAdmin as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", data.id)
        .maybeSingle();
      if (!data.isAdmin && currentRole?.role === "admin") {
        const { count } = await (supabaseAdmin as any)
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "admin");
        if ((count ?? 0) <= 1) {
          throw new Error("Não é possível remover os privilégios do único administrador.");
        }
      }

      // 3) Login e senha: envia ao auth apenas o que realmente mudou.
      const nextEmail = usernameToEmail(username);
      const currentEmail = (existing.user.email ?? "").toLowerCase();
      const authAttrs: Record<string, unknown> = {};
      if (currentEmail !== nextEmail.toLowerCase()) {
        authAttrs.email = nextEmail;
        authAttrs.email_confirm = true;
      }
      if (data.password) authAttrs.password = data.password;

      if (Object.keys(authAttrs).length > 0) {
        const { error: ae } = await supabaseAdmin.auth.admin.updateUserById(
          data.id,
          authAttrs as any,
        );
        if (ae) {
          throw new Error(
            /already|registered|exists/i.test(ae.message)
              ? "Já existe um usuário com esse login."
              : ae.message,
          );
        }
      }

      // 4) Perfil: confirma que a linha realmente foi gravada.
      const profile = {
        name: data.name,
        username,
        status: data.status,
        notes: data.notes ?? "",
        permissions: data.permissions ?? [],
        read_only: data.readOnly,
      };
      const { data: updated, error: ue } = await (supabaseAdmin as any)
        .from("profiles")
        .update(profile)
        .eq("id", data.id)
        .select("id");
      if (ue) {
        throw new Error(ue.code === "23505" ? "Já existe um usuário com esse login." : ue.message);
      }
      if (!updated || updated.length === 0) {
        const { error: ie } = await (supabaseAdmin as any)
          .from("profiles")
          .insert({ id: data.id, ...profile });
        if (ie) {
          throw new Error(ie.code === "23505" ? "Já existe um usuário com esse login." : ie.message);
        }
      }

      // 5) Perfil de acesso: atualiza sem apagar antes, para não deixar o usuário sem role.
      const nextRole = data.isAdmin ? "admin" : "user";
      if (currentRole?.role !== nextRole) {
        const { data: roleRows, error: rpe } = await (supabaseAdmin as any)
          .from("user_roles")
          .update({ role: nextRole })
          .eq("user_id", data.id)
          .select("id");
        if (rpe) throw new Error(rpe.message);
        if (!roleRows || roleRows.length === 0) {
          const { error: re } = await (supabaseAdmin as any)
            .from("user_roles")
            .insert({ user_id: data.id, role: nextRole });
          if (re) {
            throw new Error(
              `O perfil foi salvo, mas não foi possível aplicar o perfil de acesso: ${re.message}`,
            );
          }
        }
      }

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
