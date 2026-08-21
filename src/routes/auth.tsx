import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/navalha-pro-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar | NAVALHA PRO — Agendamento para barbearias" },
      {
        name: "description",
        content:
          "Acesse sua conta NAVALHA PRO para gerenciar agenda, clientes e faturamento da sua barbearia.",
      },
      { property: "og:title", content: "Entrar no NAVALHA PRO" },
      {
        property: "og:description",
        content: "Painel de agendamento online para barbearias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [checking, setChecking] = useState(true);

  // Já logado: não fica preso na tela de login.
  useEffect(() => {
    let active = true;
    const go = async (userId: string) => {
      if (!active) return;
      const to = (await hasShop(userId)) ? "/dashboard" : "/onboarding";
      navigate({ to, replace: true });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) void go(data.session.user.id);
      else setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void go(session.user.id);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);


  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  function traduzErro(msg: string) {
    const m = msg.toLowerCase();
    if (m.includes("weak") || m.includes("pwned"))
      return "Essa senha é muito comum e foi vazada em outros sites. Escolha uma senha mais forte (letras, números e símbolos).";
    if (m.includes("password should be at least"))
      return "A senha precisa ter pelo menos 6 caracteres.";
    if (m.includes("already registered") || m.includes("user already"))
      return "Já existe uma conta com esse e-mail. Faça login ou recupere a senha.";
    if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
    if (m.includes("email address") && m.includes("invalid"))
      return "E-mail inválido. Use um e-mail real (gmail, outlook, etc.).";
    if (m.includes("email not confirmed"))
      return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
    if (m.includes("rate limit") || m.includes("too many"))
      return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    return msg;
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(traduzErro(error.message)); return; }
    navigate({ to: "/dashboard" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Rota pública: o link de confirmação precisa abrir antes da sessão existir.
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) { toast.error(traduzErro(error.message)); return; }

    if (!data.session) {
      setTab("login");
      toast.success("Conta criada! Confirme o link enviado para " + email + " e depois faça login.");
      return;
    }

    toast.success("Conta criada! Vamos configurar sua barbearia.");
    navigate({ to: "/onboarding" });
  }

  async function signInWithGoogle() {
    setLoading(true);
    try {
      await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao entrar com Google");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!email) { toast.error("Informe seu e-mail primeiro."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Enviamos um link de recuperação para seu e-mail.");
  }

  if (checking) return <div className="min-h-screen bg-background" />;

  return (
    <div className="grid-noise flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-4 flex items-center justify-center gap-2">
          <img
            src={logoAsset.url}
            alt="NAVALHA PRO"
            className="size-8 shrink-0 object-contain"
          />
          <span className="font-display text-3xl">
            NAVALHA <span className="text-primary">PRO</span>
          </span>
        </Link>

        <p className="mb-6 text-center text-sm font-medium text-primary">
          Cadastre sua barbearia e comece grátis por 7 dias.
        </p>

        <div className="surface-card p-6">
          <div>
            <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setTab("login")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === "login" ? "bg-background text-foreground shadow" : "text-muted-foreground",
                )}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === "signup" ? "bg-background text-foreground shadow" : "text-muted-foreground",
                )}
              >
                Criar conta
              </button>
            </div>

            {tab === "login" && (
              <form onSubmit={signIn} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button className="w-full" disabled={loading}>
                  Entrar
                </Button>
                <button type="button" onClick={resetPassword} className="w-full text-xs text-muted-foreground hover:text-primary">
                  Esqueci minha senha
                </button>
              </form>
            )}

            {tab === "signup" && (
              <form onSubmit={signUp} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Seu nome</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">E-mail</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Senha</Label>
                  <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button className="w-full" disabled={loading}>
                  Começar grátis
                </Button>
              </form>
            )}
          </div>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">ou</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={loading}
            onClick={signInWithGoogle}
          >
            <svg className="size-4" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.8l7.8 6.1C12.3 13.7 17.6 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.4-4.1 7.1-10.2 7.1-17.5z" />
              <path fill="#FBBC05" d="M10.4 28.1a14.5 14.5 0 0 1 0-9.2l-7.8-6.1a24 24 0 0 0 0 21.4l7.8-6.1z" />
              <path fill="#34A853" d="M24 47.5c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.7-4.2-13.6-10.1l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z" />
            </svg>
            Continuar com Google
          </Button>
        </div>
      </div>
    </div>
  );
}
