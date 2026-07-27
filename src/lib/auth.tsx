import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
  createdAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  permissions: string[];
  isAdmin: boolean;
}

interface AuthContextValue {
  user: SessionUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  users: StoredUser[];
  createUser: (u: Omit<StoredUser, "id" | "createdAt">) => StoredUser;
  updateUser: (id: string, patch: Partial<Omit<StoredUser, "id" | "createdAt">>) => void;
  deleteUser: (id: string) => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_KEY = "sgmc.auth.user";
const USERS_KEY = "sgmc.auth.users";

function loadUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return seedUsers();
    const parsed = JSON.parse(raw) as StoredUser[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seedUsers();
    return parsed;
  } catch {
    return seedUsers();
  }
}

function seedUsers(): StoredUser[] {
  const admin: StoredUser = {
    id: crypto.randomUUID(),
    name: "Administrador",
    username: "admin",
    password: "admin",
    status: "ativo",
    notes: "Usuário administrador padrão. Altere a senha após o primeiro acesso.",
    permissions: ALL_PERMISSIONS,
    isAdmin: true,
    createdAt: new Date().toISOString(),
  };
  const list = [admin];
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  return list;
}

function persistUsers(list: StoredUser[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<StoredUser[]>([]);

  useEffect(() => {
    setUsers(loadUsers());
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const refresh = () => setUsers(loadUsers());

  const login = async (username: string, password: string) => {
    const list = loadUsers();
    const found = list.find(
      (u) => u.username.trim().toLowerCase() === username.trim().toLowerCase() && u.password === password,
    );
    if (!found) throw new Error("Usuário ou senha inválidos.");
    if (found.status !== "ativo") throw new Error("Usuário inativo. Contate o administrador.");
    const session: SessionUser = {
      id: found.id,
      name: found.name,
      username: found.username,
      permissions: found.isAdmin ? ALL_PERMISSIONS : found.permissions,
      isAdmin: !!found.isAdmin,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const createUser: AuthContextValue["createUser"] = (u) => {
    const list = loadUsers();
    if (list.some((x) => x.username.trim().toLowerCase() === u.username.trim().toLowerCase())) {
      throw new Error("Já existe um usuário com esse login.");
    }
    const created: StoredUser = { ...u, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    const next = [...list, created];
    persistUsers(next);
    setUsers(next);
    return created;
  };

  const updateUser: AuthContextValue["updateUser"] = (id, patch) => {
    const list = loadUsers();
    const next = list.map((u) => {
      if (u.id !== id) return u;
      // Prevent duplicate usernames
      if (patch.username && list.some((x) => x.id !== id && x.username.trim().toLowerCase() === patch.username!.trim().toLowerCase())) {
        throw new Error("Já existe um usuário com esse login.");
      }
      return { ...u, ...patch };
    });
    persistUsers(next);
    setUsers(next);
    // if it's the logged-in user, refresh session
    if (user && user.id === id) {
      const updated = next.find((u) => u.id === id)!;
      const session: SessionUser = {
        id: updated.id,
        name: updated.name,
        username: updated.username,
        permissions: updated.isAdmin ? ALL_PERMISSIONS : updated.permissions,
        isAdmin: !!updated.isAdmin,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(session);
    }
  };

  const deleteUser: AuthContextValue["deleteUser"] = (id) => {
    const list = loadUsers();
    const target = list.find((u) => u.id === id);
    if (target?.isAdmin) {
      const admins = list.filter((u) => u.isAdmin);
      if (admins.length <= 1) throw new Error("Não é possível excluir o único administrador.");
    }
    const next = list.filter((u) => u.id !== id);
    persistUsers(next);
    setUsers(next);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, users, createUser, updateUser, deleteUser, refresh }}
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

export function isAuthenticated() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(SESSION_KEY);
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}
