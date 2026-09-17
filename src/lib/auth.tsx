import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/user-email";
import { adminCreateUser, adminUpdateUser, adminDeleteUser } from "@/lib/users.functions";

// ---------- Permissions catalog ----------
// Each key maps to a sidebar url in `app-sidebar.tsx`.
export const PERMISSIONS: { key: string; label: string }[] = [
  { key: "/dashboard", label: "Dashboard" },
  { key: "/campanhas", label: "Campanhas" },
  { key: "/banco-de-oportunidades", label: "Banco de Oportunidades" },
  { key: "/campanhas-encerradas", label: "Campanhas Encerradas" },
  { key: "/verbas-cooperadas", label: "Verbas Cooperadas" },
  { key: "/sell-out", label: "Sell Out" },
  { key: "/sell-out/acertos", label: "Sell Out › Acertos" },
  { key: "/pontas-de-gondola", label: "Pontas de Gôndola" },
  { key: "/fornecedores", label: "Fornecedores" },
  { key: "/fracionamento", label: "Fracionamento" },
  { key: "/produtos-em-falta", label: "Produtos em Falta › Registrar Produtos em Falta" },
  { key: "/central-produtos-em-falta", label: "Produtos em Falta › Gerenciar Produtos em Falta" },
  { key: "/retorno-as-lojas", label: "Produtos em Falta › Retorno às Lojas" },
  { key: "/catalogo-de-produtos", label: "Catálogo de Produtos" },
  { key: "/relatorios", label: "Relatórios" },
  { key: "/usuarios", label: "Usuários" },
  { key: "/configuracoes", label: "Configurações" },
  { key: "/solicitacoes-produtos", label: "Solicitações de Novos Produtos" },
];

export const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.key);

// ---------- Types ----------
export interface StoredUser {
  id: string;
  name: string;
  username: string;
  password?: string; // only used when creating/updating (never stored client-side)
  status: "ativo" | "inativo";
  notes?: string;
  permissions: string[];
  isAdmin?: boolean;
  readOnly?: boolean;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  permissions: string[];
  isAdmin: boolean;
  readOnly: boolean;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  users: StoredUser[];
  createUser: (u: Omit<StoredUser, "id" | "createdAt">) => Promise<void>;
  updateUser: (id: string, patch: Partial<Omit<StoredUser, "id" | "createdAt">>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const profiles = () => supabase.from("profiles" as any);

const toStored = (r: any, isAdmin: boolean): StoredUser => ({
  id: r.id,
  name: r.name ?? "",
  username: r.username ?? "",
  status: (r.status === "inativo" ? "inativo" : "ativo") as StoredUser["status"],
  notes: r.notes || undefined,
  permissions: Array.isArray(r.permissions) ? r.permissions : [],
  isAdmin,
  readOnly: !isAdmin && !!r.read_only,
  createdAt: r.created_at ?? new Date().toISOString(),
});

const toSession = (u: StoredUser): SessionUser => ({
  id: u.id,
  name: u.name,
  username: u.username,
  permissions: u.isAdmin ? ALL_PERMISSIONS : u.permissions,
  isAdmin: !!u.isAdmin,
  readOnly: !u.isAdmin && !!u.readOnly,
});

async function fetchRoles(): Promise<Map<string, string>> {
  const { data } = await supabase.from("user_roles" as any).select("user_id, role");
  const map = new Map<string, string>();
  ((data ?? []) as any[]).forEach((r) => map.set(r.user_id, r.role));
  return map;
}

export async function fetchUsers(): Promise<StoredUser[]> {
  const [{ data, error }, roles] = await Promise.all([
    profiles().select("*").order("created_at", { ascending: true }),
    fetchRoles(),
  ]);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => toStored(r, roles.get(r.id) === "admin"));
}

async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const [{ data }, roles] = await Promise.all([
    profiles().select("*").eq("id", userId).maybeSingle(),
    fetchRoles(),
  ]);
  if (!data) return null;
  const stored = toStored(data, roles.get(userId) === "admin");
  if (stored.status !== "ativo") return null;
  return toSession(stored);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      setUsers(await fetchUsers());
    } catch {
      // non-admins cannot list users — ignore
    }
  };

  useEffect(() => {
    let alive = true;

    const sync = async (userId: string | null) => {
      if (!userId) {
        if (alive) {
          setUser(null);
          setUsers([]);
        }
        return;
      }
      const session = await loadSessionUser(userId);
      if (!alive) return;
      setUser(session);
      if (!session) await supabase.auth.signOut();
      else void refresh();
    };

    (async () => {
      const { data } = await supabase.auth.getSession();
      await sync(data.session?.user?.id ?? null);
      if (alive) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void sync(session?.user?.id ?? null);
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error || !data.user) throw new Error("Usuário ou senha inválidos.");
    const session = await loadSessionUser(data.user.id);
    if (!session) {
      await supabase.auth.signOut();
      throw new Error("Usuário inativo. Contate o administrador.");
    }
    setUser(session);
    void refresh();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUsers([]);
  };

  const unwrap = (res: any, fallback: string) => {
    if (res && typeof res === "object" && "ok" in res && !res.ok) {
      throw new Error(res.error || fallback);
    }
    return res;
  };

  const createUser: AuthContextValue["createUser"] = async (u) => {
    const payload = {
      name: u.name,
      username: u.username,
      password: u.password ?? "",
      status: u.status,
      notes: u.notes ?? "",
      permissions: u.permissions ?? [],
      isAdmin: !!u.isAdmin,
      readOnly: !!u.readOnly,
    };
    const res = await adminCreateUser({ data: payload });
    unwrap(res, "Não foi possível criar o usuário.");
    await refresh();
  };

  const updateUser: AuthContextValue["updateUser"] = async (id, patch) => {
    let current = users.find((x) => x.id === id);
    if (!current) {
      try {
        const fresh = await fetchUsers();
        setUsers(fresh);
        current = fresh.find((x) => x.id === id);
      } catch (err) {
        console.error("[auth.updateUser] não foi possível recarregar a lista de usuários", err);
      }
    }

    const name = (patch.name ?? current?.name ?? "").trim();
    const username = (patch.username ?? current?.username ?? "").trim().toLowerCase();
    if (!name) {
      throw new Error("Informe o nome.");
    }
    if (!username) {
      throw new Error(
        "Não foi possível identificar o usuário a ser atualizado. Recarregue a página e tente novamente.",
      );
    }

    const payload = {
      id,
      name,
      username,
      password: patch.password || undefined,
      status: patch.status ?? current?.status ?? "ativo",
      notes: patch.notes ?? current?.notes ?? "",
      permissions: patch.permissions ?? current?.permissions ?? [],
      isAdmin: patch.isAdmin !== undefined ? patch.isAdmin : !!current?.isAdmin,
      readOnly: patch.readOnly !== undefined ? patch.readOnly : !!current?.readOnly,
    };

    const res = await adminUpdateUser({ data: payload });
    unwrap(res, "Não foi possível salvar o usuário.");

    await refresh();

    if (user && user.id === id) {
      const session = await loadSessionUser(id);
      if (!session) {
        await supabase.auth.signOut();
        setUser(null);
        setUsers([]);
        return;
      }
      setUser(session);
    }
  };

  const deleteUser: AuthContextValue["deleteUser"] = async (id) => {
    const res = await adminDeleteUser({ data: { id } });
    unwrap(res, "Não foi possível excluir o usuário.");
    await refresh();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, users, createUser, updateUser, deleteUser, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
