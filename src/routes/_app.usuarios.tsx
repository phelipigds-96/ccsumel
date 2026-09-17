import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, Search, ShieldCheck, User as UserIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  useAuth,
  PERMISSIONS,
  ALL_PERMISSIONS,
  type StoredUser,
} from "@/lib/auth";

export const Route = createFileRoute("/_app/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Central de Campanhas Sumel" },
      { name: "description", content: "Gerencie usuários, permissões e acessos aos módulos da Central Sumel." },
      { property: "og:title", content: "Usuários — Central de Campanhas" },
      { property: "og:description", content: "Cadastro e permissões dos usuários internos." },
    ],
  }),
  component: UsuariosPage,
});

interface FormState {
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
  status: "ativo" | "inativo";
  notes: string;
  permissions: string[];
  isAdmin: boolean;
  readOnly: boolean;
}

const emptyForm = (): FormState => ({
  name: "",
  username: "",
  password: "",
  confirmPassword: "",
  status: "ativo",
  notes: "",
  permissions: [],
  isAdmin: false,
  readOnly: false,
});

function UsuariosPage() {
  const { user: sessionUser, users, createUser, updateUser, deleteUser } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StoredUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<StoredUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? users.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.username.toLowerCase().includes(q) ||
            (u.notes ?? "").toLowerCase().includes(q),
        )
      : users;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [users, search]);

  function openNew() {
    console.log(
      "[Usuários][Cadastro] 1/6 — Botão 'Novo Usuário' clicado. Abrindo o formulário em branco.",
    );
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(u: StoredUser) {
    console.log(
      `[Usuários][Edição] 1/6 — Botão 'Editar' clicado para o usuário ${u.username} (id ${u.id}). Preenchendo o formulário com os dados atuais.`,
    );
    setEditing(u);
    setForm({
      name: u.name,
      username: u.username,
      password: "",
      confirmPassword: "",
      status: u.status,
      notes: u.notes ?? "",
      permissions: u.permissions,
      isAdmin: !!u.isAdmin,
      readOnly: !!u.readOnly,
    });
    setDialogOpen(true);
  }

  function togglePermission(key: string) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((k) => k !== key)
        : [...prev.permissions, key],
    }));
  }

  function toggleAllPermissions(checked: boolean) {
    setForm((prev) => ({
      ...prev,
      permissions: checked ? [...ALL_PERMISSIONS] : [],
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const mode = editing ? "Edição" : "Cadastro";

    console.log(
      `[Usuários][${mode}] 2/6 — onSubmit do formulário disparado. Iniciando a validação dos campos.`,
      {
        modo: mode,
        editingId: editing?.id ?? null,
        form: {
          name: form.name,
          username: form.username,
          status: form.status,
          isAdmin: form.isAdmin,
          readOnly: form.readOnly,
          permissions: form.permissions.length,
          senhaPreenchida: !!form.password,
          confirmacaoPreenchida: !!form.confirmPassword,
        },
      },
    );

    const name = form.name.trim();
    const username = form.username.trim();

    if (!name) {
      console.warn(`[Usuários][${mode}] 3/6 — BLOQUEIO na validação: campo 'Nome' vazio. Abortando com return antes de qualquer chamada ao backend.`);
      return toast.error("Informe o nome.");
    }
    if (!username) {
      console.warn(`[Usuários][${mode}] 3/6 — BLOQUEIO na validação: campo 'Login' vazio. Abortando com return antes de qualquer chamada ao backend.`);
      return toast.error("Informe o nome de usuário (login).");
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      console.warn(`[Usuários][${mode}] 3/6 — BLOQUEIO na validação: login com caracteres inválidos:`, username);
      return toast.error("Use apenas letras, números, ponto, hífen ou underline no login.");
    }

    if (!editing) {
      if (!form.password) {
        console.warn("[Usuários][Cadastro] 3/6 — BLOQUEIO na validação: senha vazia.");
        return toast.error("Informe a senha.");
      }
      if (form.password.length < 6) {
        console.warn("[Usuários][Cadastro] 3/6 — BLOQUEIO na validação: senha com menos de 6 caracteres.");
        return toast.error("A senha deve ter ao menos 6 caracteres.");
      }
      if (form.password !== form.confirmPassword) {
        console.warn("[Usuários][Cadastro] 3/6 — BLOQUEIO na validação: senha e confirmação diferentes.");
        return toast.error("As senhas não coincidem.");
      }
    } else if (form.password || form.confirmPassword) {
      if (form.password.length < 6) {
        console.warn("[Usuários][Edição] 3/6 — BLOQUEIO na validação: nova senha com menos de 6 caracteres.");
        return toast.error("A nova senha deve ter ao menos 6 caracteres.");
      }
      if (form.password !== form.confirmPassword) {
        console.warn("[Usuários][Edição] 3/6 — BLOQUEIO na validação: nova senha e confirmação diferentes.");
        return toast.error("As senhas não coincidem.");
      }
    }

    console.log(`[Usuários][${mode}] 3/6 — Validação concluída sem bloqueio. Prosseguindo para o envio.`);

    setIsSubmitting(true);
    console.log(
      `[Usuários][${mode}] 4/6 — setIsSubmitting(true) aplicado (botões desabilitados). Chamando a função de auth agora.`,
    );

    try {
      if (editing) {
        const patch: Partial<StoredUser> = {
          name,
          username,
          status: form.status,
          notes: form.notes.trim() || undefined,
          permissions: form.isAdmin ? ALL_PERMISSIONS : form.permissions,
          isAdmin: form.isAdmin,
          readOnly: !form.isAdmin && form.readOnly,
        };
        if (form.password) patch.password = form.password;

        console.log("[Usuários][Edição] 5/6 — Chamando updateUser() do contexto de auth.", {
          id: editing.id,
          patch: { ...patch, password: patch.password ? "***" : undefined },
        });

        await updateUser(editing.id, patch);

        console.log("[Usuários][Edição] 6/6 — updateUser() retornou sem lançar erro.");
        toast.success("Usuário atualizado.");
      } else {
        const payload: Omit<StoredUser, "id" | "createdAt"> = {
          name,
          username,
          password: form.password,
          status: form.status,
          notes: form.notes.trim() || undefined,
          permissions: form.isAdmin ? ALL_PERMISSIONS : form.permissions,
          isAdmin: form.isAdmin,
          readOnly: !form.isAdmin && form.readOnly,
        };

        console.log("[Usuários][Cadastro] 5/6 — Chamando createUser() do contexto de auth.", {
          ...payload,
          password: "***",
        });

        await createUser(payload);

        console.log("[Usuários][Cadastro] 6/6 — createUser() retornou sem lançar erro.");
        toast.success("Usuário cadastrado.");
      }

      console.log(`[Usuários][${mode}] 6/6 — Fechando o formulário (setDialogOpen(false)).`);
      setDialogOpen(false);
    } catch (err) {
      console.error(
        `[Usuários][${mode}] ERRO capturado no handleSubmit — o fluxo foi interrompido neste ponto:`,
        err,
      );
      toast.error(err instanceof Error ? err.message : "Erro crítico ao salvar usuário.");
    } finally {
      console.log(`[Usuários][${mode}] finally — setIsSubmitting(false) (botões reabilitados).`);
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setIsSubmitting(true);
    try {
      await deleteUser(confirmDelete.id);
      toast.success("Usuário removido.");
      setConfirmDelete(null);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro crítico ao remover usuário.");
    } finally {
      setIsSubmitting(false);
    }
  }


  const allSelected = form.permissions.length === ALL_PERMISSIONS.length;

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gerencie os usuários internos e as permissões de acesso aos módulos."
        actions={
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Novo Usuário
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, login ou observações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} de {users.length}
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead className="w-[120px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="font-mono text-xs">{u.username}</TableCell>
                <TableCell>
                  {u.status === "ativo" ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Ativo</Badge>
                  ) : (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {u.isAdmin ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" /> Administrador
                    </span>
                  ) : u.readOnly ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                      <UserIcon className="h-3.5 w-3.5" /> Somente leitura
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <UserIcon className="h-3.5 w-3.5" /> Usuário
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {u.isAdmin ? "Todos os módulos" : `${u.permissions.length} módulo(s)`}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmDelete(u)}
                    disabled={u.id === sessionUser?.id}
                    title={u.id === sessionUser?.id ? "Você não pode excluir a si mesmo" : "Excluir"}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Atualize os dados do usuário. Deixe a senha em branco para mantê-la."
                : "Preencha os dados e selecione os módulos que o usuário poderá acessar."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Login</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{editing ? "Nova senha (opcional)" : "Senha"}</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Status</div>
                  <div className="text-xs text-muted-foreground">
                    Usuários inativos não conseguem entrar no sistema.
                  </div>
                </div>
                <Switch
                  checked={form.status === "ativo"}
                  onCheckedChange={(v) => setForm({ ...form, status: v ? "ativo" : "inativo" })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Administrador</div>
                  <div className="text-xs text-muted-foreground">
                    Acesso total a todos os módulos.
                  </div>
                </div>
                <Switch
                  checked={form.isAdmin}
                  onCheckedChange={(v) => setForm({ ...form, isAdmin: v })}
                />
              </div>
            </div>

            {!form.isAdmin && (
              <div className="flex items-center justify-between rounded-md border p-3 bg-amber-50/50">
                <div>
                  <div className="text-sm font-medium">Somente leitura em Campanhas</div>
                  <div className="text-xs text-muted-foreground">
                    O usuário poderá visualizar as campanhas, as ofertas e os anexos, mas não poderá criar, editar ou excluir.
                  </div>
                </div>
                <Switch
                  checked={form.readOnly}
                  onCheckedChange={(v) => setForm({ ...form, readOnly: v })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Permissões de módulos</div>
                  <div className="text-xs text-muted-foreground">
                    Somente os módulos marcados aparecerão no menu do usuário.
                  </div>
                </div>
                {!form.isAdmin && (
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(v) => toggleAllPermissions(v === true)}
                    />
                    Selecionar todos
                  </label>
                )}
              </div>

              {form.isAdmin ? (
                <p className="text-xs text-muted-foreground italic">
                  Administradores possuem acesso a todos os módulos automaticamente.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {PERMISSIONS.map((perm) => {
                    const checked = form.permissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => togglePermission(perm.key)}
                        />
                        <span className="flex-1">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90"
                disabled={isSubmitting}
                onClick={() =>
                  console.log(
                    `[Usuários][${editing ? "Edição" : "Cadastro"}] 1/6 — Botão '${editing ? "Salvar alterações" : "Cadastrar usuário"}' clicado. Disparando o submit do formulário.`,
                  )
                }
              >
                {isSubmitting ? "Processando..." : editing ? "Salvar alterações" : "Cadastrar usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o usuário <strong>{confirmDelete?.name}</strong> permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
