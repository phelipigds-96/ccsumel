import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoAsset from "@/assets/logo-sumel.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Central de Campanhas Sumel" },
      { name: "description", content: "Acesse a Central de Campanhas Sumel — gestão de campanhas, ofertas e verbas." },
      { property: "og:title", content: "Central de Campanhas Sumel" },
      { property: "og:description", content: "Acesse a Central de Campanhas Sumel." },
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
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-8 overflow-hidden"
      style={{ backgroundImage: "var(--gradient-auth)" }}>
      {/* decorative glows */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "linear-gradient(var(--navy-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--navy-foreground) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-navy-foreground/15 bg-navy-foreground/10 p-8 sm:p-10 backdrop-blur-xl"
          style={{ boxShadow: "var(--shadow-auth)" }}>
          <div className="flex justify-center">
            <div className="rounded-xl bg-background px-6 py-4 shadow-sm">
              <img src={logoAsset} alt="Sumel" className="h-14 w-auto" />
            </div>
          </div>

          <div className="mt-8 text-center">
            <h1 className="text-2xl font-bold text-navy-foreground">Bem-vindo de volta</h1>
            <p className="mt-1 text-sm text-navy-foreground/60">Central de Campanhas — acesse sua conta.</p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-navy-foreground/80">Usuário</Label>
              <Input id="username" type="text" placeholder="seu.login"
                className="h-11 bg-navy-foreground/10 border-navy-foreground/20 text-navy-foreground placeholder:text-navy-foreground/40"
                value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-navy-foreground/80">Senha</Label>
              <Input id="password" type="password" placeholder="••••••••"
                className="h-11 bg-navy-foreground/10 border-navy-foreground/20 text-navy-foreground placeholder:text-navy-foreground/40"
                value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            {error && (
              <p className="rounded-md bg-destructive/20 px-3 py-2 text-sm text-navy-foreground">{error}</p>
            )}
            <Button type="submit" disabled={loading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/30 transition-transform hover:-translate-y-0.5">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-navy-foreground/50">
            Acesso restrito ao uso interno.{" "}
            <Link to="/" className="font-medium text-navy-foreground/80 hover:underline">Voltar</Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-navy-foreground/40">
          © {new Date().getFullYear()} Central de Campanhas Sumel
        </p>
      </div>
    </div>
  );
}
