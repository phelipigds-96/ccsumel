import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// ---------- Permissions catalog ----------
// Each key maps to a sidebar url in `app-sidebar.tsx`.
export const PERMISSIONS: { key: string; label: string }[] = [
  { key: "/dashboard", label: "Dashboard" },
  { key: "/campanhas", label: "Campanhas" },
  { key: "/campanhas-encerradas", label: "Campanhas Encerradas" },
  { key: "/verbas-cooperadas", label: "Verbas Cooperadas" },
  { key: "/sell-out", label: "Sell Out" },
  { key: "/sell-out/acertos", label: "Sell Out › Acertos" },
  { key: "/pontas-de-gondola", label: "Pontas de Gôndola" },
  { key: "/fornecedores", label: "Fornecedores" },
  { key: "/catalogo-de-produtos", label: "Catálogo de Produtos" },
  { key: "/relatorios", label: "Relatórios" },
  { key: "/usuarios", label: "Usuários" },
  { key: "/configuracoes", label: "Configurações" },
];

export const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.key);

// ---------- Types ----------
export interface StoredUser {
  id: string;
  name: string;
  username: string;
  password: string; // prototype only — plain text
  status: "ativo" | "inativo";
  notes?: string;
  permissions: string[]; // urls the user can access
  isAdmin?: boolean;
  readOnly?: boolean; // if true, can only view campanhas/ofertas (no edit)
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
  logout: () => void;
  users: StoredUser[];
  createUser: (u: Omit<StoredUser, "id" | "createdAt">) => Promise<StoredUser>;
  updateUser: (id: string, patch: Partial<Omit<StoredUser, "id" | "createdAt">>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Only the id of the signed-in user is kept in the browser (session pointer).
 * All user data, permissions and preferences live in the database.
 */
const SESSION_ID_KEY = "sgmc.session.id";

const table = () => supabase.from("usuarios" as any);

const toStored = (r: any): StoredUser => ({
  id: r.id,
  name: r.name ?? "",
  username: r.username ?? "",
  password: r.password ?? "",
  status: (r.status === "inativo" ? "inativo" : "ativo") as StoredUser["status"],
  notes: r.notes || undefined,
  permissions: Array.isArray(r.permissions) ? r.permissions : [],
  isAdmin: !!r.is_admin,
  readOnly: !!r.read_only,
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

export async function fetchUsers(): Promise<StoredUser[]> {
  const { data, error } = await table().select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map(toStored);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      setUsers(await fetchUsers());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await fetchUsers();
        if (!alive) return;
        setUsers(list);
        const id = localStorage.getItem(SESSION_ID_KEY);
        const found = id ? list.find((u) => u.id === id) : null;
        if (found && found.status === "ativo") setUser(toSession(found));
        else if (id) localStorage.removeItem(SESSION_ID_KEY);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = async (username: string, password: string) => {
    const { data, error } = await table()
      .select("*")
      .ilike("username", username.trim())
      .limit(1);
    if (error) throw new Error("Não foi possível conectar ao servidor.");
    const row = (data ?? [])[0] as any;
    if (!row || row.password !== password) throw new Error("Usuário ou senha inválidos.");
    const found = toStored(row);
    if (found.status !== "ativo") throw new Error("Usuário inativo. Contate o administrador.");
    localStorage.setItem(SESSION_ID_KEY, found.id);
    setUser(toSession(found));
    void refresh();
  };

  const logout = () => {
    localStorage.removeItem(SESSION_ID_KEY);
    setUser(null);
  };

  const createUser: AuthContextValue["createUser"] = async (u) => {
    const { data, error } = await table()
      .insert({
        name: u.name,
        username: u.username.trim(),
        password: u.password,
        status: u.status,
        notes: u.notes ?? "",
        permissions: u.permissions ?? [],
        is_admin: !!u.isAdmin,
        read_only: !!u.readOnly,
      })
      .select()
      .maybeSingle();
    if (error) {
      if (error.code === "23505") throw new Error("Já existe um usuário com esse login.");
      throw new Error(error.message);
    }
    const created = toStored(data);
    setUsers((prev) => [...prev, created]);
    return created;
  };

  const updateUser: AuthContextValue["updateUser"] = async (id, patch) => {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.username !== undefined) payload.username = patch.username.trim();
    if (patch.password !== undefined) payload.password = patch.password;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.notes !== undefined) payload.notes = patch.notes ?? "";
    if (patch.permissions !== undefined) payload.permissions = patch.permissions;
    if (patch.isAdmin !== undefined) payload.is_admin = patch.isAdmin;
    if (patch.readOnly !== undefined) payload.read_only = patch.readOnly;

    const { data, error } = await table().update(payload).eq("id", id).select().maybeSingle();
    if (error) {
      if (error.code === "23505") throw new Error("Já existe um usuário com esse login.");
      throw new Error(error.message);
    }
    const updated = toStored(data);
    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    if (user && user.id === id) setUser(toSession(updated));
  };

  const deleteUser: AuthContextValue["deleteUser"] = async (id) => {
    const list = users.length ? users : await fetchUsers();
    const target = list.find((u) => u.id === id);
    if (target?.isAdmin && list.filter((u) => u.isAdmin).length <= 1) {
      throw new Error("Não é possível excluir o único administrador.");
    }
    const { error } = await table().delete().eq("id", id);
    if (error) throw new Error(error.message);
    setUsers((prev) => prev.filter((u) => u.id !== id));
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

export function hasSessionPointer() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(SESSION_ID_KEY);
}

export const isAuthenticated = hasSessionPointer;
