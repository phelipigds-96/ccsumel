import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoAsset from "@/assets/logo-sumel.png.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — SGMC" },
      { name: "description", content: "Acesse o SGMC — Sistema de Gestão de Marketing Comercial." },
      { property: "og:title", content: "Entrar — SGMC" },
      { property: "og:description", content: "Acesse o SGMC." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError("Preencha usuário e senha.");
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-navy text-navy-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 20% 20%, var(--primary) 0, transparent 40%), radial-gradient(circle at 80% 80%, var(--primary) 0, transparent 45%)" }}
        />
        <div className="relative">
          <div className="inline-flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
            <img src={logoAsset.url} alt="Sumel" className="h-10 w-auto" />
            <div className="border-l border-navy/10 pl-3">
              <div className="text-sm font-bold text-navy">Central de Campanhas</div>
              <div className="text-[10px] uppercase tracking-widest text-navy/60">Marketing e Compras</div>
            </div>
          </div>
        </div>
        <div className="relative space-y-3">
          <h1 className="text-4xl font-black leading-tight">
            Gestão comercial<br />
            <span className="text-primary">simples</span> e poderosa.
          </h1>
          <p className="text-sm text-white/70 max-w-md">
            Centralize campanhas, ofertas, verbas cooperadas e sell out em um único lugar.
          </p>
        </div>
        <div className="relative text-xs text-white/50">© {new Date().getFullYear()} Central de Campanhas Sumel</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <img src={logoAsset.url} alt="Sumel" className="h-10 w-auto" />
            <div className="text-base font-bold text-navy">Central de Campanhas</div>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Entrar</h2>
          <p className="mt-1 text-sm text-muted-foreground">Acesse sua conta para continuar.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input id="username" type="text" placeholder="seu.login"
                value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            Acesso restrito ao uso interno.{" "}
            <Link to="/" className="text-navy font-medium hover:underline">Voltar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
