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
    <div className="login-root">
      {/* ── Left panel: branding + animated background ── */}
      <div className="login-panel-left">
        <div className="login-left-inner">
          <img src={logoAsset} alt="Sumel" className="h-16 w-auto" />
          <h2 className="login-left-title">Central de Campanhas</h2>
          <p className="login-left-sub">
            Gestão completa de campanhas, ofertas, verbas cooperadas e sell-out —
            tudo em um só lugar.
          </p>
          <ul className="login-left-features">
            <li>Campanhas com encartes digitais e checklist</li>
            <li>Ofertas com preço, margem e corredor</li>
            <li>Produtos em falta e oportunidades de compra</li>
            <li>Sell-out e acertos com fornecedores</li>
          </ul>
        </div>

        {/* floating shapes */}
        <div className="login-shape login-shape-1" />
        <div className="login-shape login-shape-2" />
        <div className="login-shape login-shape-3" />
        <div className="login-shape login-shape-4" />
      </div>

      {/* ── Right panel: form ── */}
      <div className="login-panel-right">
        <div className="login-form-wrap">
          <div className="login-mobile-logo">
            <img src={logoAsset} alt="Sumel" className="h-12 w-auto" />
          </div>

          <div className="login-form-header">
            <h1 className="text-2xl font-bold text-navy">Bem-vindo de volta</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acesse sua conta para continuar.
            </p>
          </div>

          <form onSubmit={onSubmit} className="login-form-body">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium">
                Usuário
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="seu.login"
                className="h-11"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full font-semibold"
            >
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          <p className="login-footer-link">
            <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              ← Voltar para início
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
