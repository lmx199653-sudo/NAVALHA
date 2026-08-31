import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

/** Verifica se o usuário já tem barbearia (vínculo de equipe ou como dono). */
async function hasShop(userId: string) {
  const { data, error } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("user_id", userId)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [fieldError, setFieldError] = useState<string | null>(null);

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
    if (loading) return;
    setFieldError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const msg = traduzErro(error.message);
      setFieldError(msg);
      toast.error(msg);
      return;
    }
    const userId = data.session?.user.id;
    const to = userId && (await hasShop(userId)) ? "/dashboard" : "/onboarding";
    navigate({ to, replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setFieldError(null);
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
    if (error) {
      const msg = traduzErro(error.message);
      setFieldError(msg);
      toast.error(msg);
      return;
    }

    if (!data.session) {
      setTab("login");
      toast.success("Conta criada! Confirme o link enviado para " + email + " e depois faça login.");
      return;
    }

    toast.success("Conta criada! Vamos configurar sua barbearia.");
    navigate({ to: "/onboarding" });
  }

  async function signInWithGoogle() {
    if (loading) return;
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Fundo: gradiente sutil + brilhos discretos */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, oklch(from var(--background) l c h) 0%, oklch(from var(--muted) l c h / 0.5) 55%, oklch(from var(--background) l c h) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] max-w-[120vw] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--primary), transparent)" }}
      />

      <div
        className="relative w-full max-w-md"
        style={{ animation: "auth-card-in .55s cubic-bezier(.22,1,.36,1) both" }}
      >
        {/* Cabeçalho */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Link to="/" className="group flex items-center gap-2.5 transition-transform duration-300 hover:scale-[1.02]">
            <img
              src={logoAsset.url}
              alt="NAVALHA PRO"
              className="size-10 shrink-0 object-contain drop-shadow-sm"
            />
            <span className="font-display text-3xl tracking-tight">
              NAVALHA <span className="text-primary">PRO</span>
            </span>
          </Link>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
            Bem-vindo de volta
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Entre na sua conta para continuar.
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-border/60 bg-card/90 p-6 shadow-[0_20px_60px_-20px_oklch(0_0_0/0.35)] backdrop-blur-sm sm:p-8"
        >
          {/* Tabs */}
          <div className="grid w-full grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1">
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setFieldError(null); }}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  tab === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          {tab === "login" && (
            <form onSubmit={signIn} className="space-y-4 pt-6" key="login">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
                <div className="group relative">
                  <Mail className={cn(
                    "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors duration-200",
                    email ? "text-primary" : "text-muted-foreground group-focus-within:text-primary",
                  )} />
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl pl-10 transition-shadow duration-200 focus-visible:shadow-[0_0_0_4px_oklch(from_var(--primary)_l_c_h_/0.12)]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                <div className="group relative">
                  <Lock className={cn(
                    "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors duration-200",
                    password ? "text-primary" : "text-muted-foreground group-focus-within:text-primary",
                  )} />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-xl pl-10 pr-11 transition-shadow duration-200 focus-visible:shadow-[0_0_0_4px_oklch(from_var(--primary)_l_c_h_/0.12)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-90"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label htmlFor="remember" className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  <Checkbox
                    id="remember"
                    checked={remember}
                    onCheckedChange={(v) => setRemember(v === true)}
                  />
                  Lembrar de mim
                </label>
                <button
                  type="button"
                  onClick={resetPassword}
                  className="text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline underline-offset-4"
                >
                  Esqueci minha senha
                </button>
              </div>

              {fieldError && (
                <p
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                  style={{ animation: "auth-card-in .3s ease both" }}
                >
                  {fieldError}
                </p>
              )}

              <Button
                className="h-11 w-full rounded-xl text-[15px] font-semibold shadow-[0_8px_24px_-8px_oklch(from_var(--primary)_l_c_h/0.6)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_12px_28px_-8px_oklch(from_var(--primary)_l_c_h/0.7)] active:translate-y-0 active:scale-[0.99]"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          )}

          {tab === "signup" && (
            <form onSubmit={signUp} className="space-y-4 pt-6" key="signup">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">Seu nome</Label>
                <div className="group relative">
                  <User className={cn(
                    "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors duration-200",
                    name ? "text-primary" : "text-muted-foreground group-focus-within:text-primary",
                  )} />
                  <Input
                    id="name"
                    required
                    autoComplete="name"
                    placeholder="Como podemos te chamar?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 rounded-xl pl-10 transition-shadow duration-200 focus-visible:shadow-[0_0_0_4px_oklch(from_var(--primary)_l_c_h_/0.12)]"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email2" className="text-sm font-medium">E-mail</Label>
                <div className="group relative">
                  <Mail className={cn(
                    "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors duration-200",
                    email ? "text-primary" : "text-muted-foreground group-focus-within:text-primary",
                  )} />
                  <Input
                    id="email2"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl pl-10 transition-shadow duration-200 focus-visible:shadow-[0_0_0_4px_oklch(from_var(--primary)_l_c_h_/0.12)]"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password2" className="text-sm font-medium">Senha</Label>
                <div className="group relative">
                  <Lock className={cn(
                    "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors duration-200",
                    password ? "text-primary" : "text-muted-foreground group-focus-within:text-primary",
                  )} />
                  <Input
                    id="password2"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-xl pl-10 pr-11 transition-shadow duration-200 focus-visible:shadow-[0_0_0_4px_oklch(from_var(--primary)_l_c_h_/0.12)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-90"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {fieldError && (
                <p
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                  style={{ animation: "auth-card-in .3s ease both" }}
                >
                  {fieldError}
                </p>
              )}

              <Button
                className="h-11 w-full rounded-xl text-[15px] font-semibold shadow-[0_8px_24px_-8px_oklch(from_var(--primary)_l_c_h/0.6)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_12px_28px_-8px_oklch(from_var(--primary)_l_c_h/0.7)] active:translate-y-0 active:scale-[0.99]"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Criando conta...
                  </span>
                ) : (
                  "Começar grátis"
                )}
              </Button>
            </form>
          )}

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border/80" />
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">ou</span>
            <span className="h-px flex-1 bg-border/80" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2.5 rounded-xl transition-all duration-200 hover:-translate-y-px hover:shadow-md active:translate-y-0"
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

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ainda não tem uma conta?{" "}
            <button
              type="button"
              onClick={() => { setTab("signup"); setFieldError(null); }}
              className="font-semibold text-primary transition-colors hover:text-primary/80 hover:underline underline-offset-4"
            >
              Criar conta
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/80">
          100% grátis para barbearias · Sem cartão de crédito
        </p>
      </div>

      <style>{`
        @keyframes auth-card-in {
          from { opacity: 0; transform: translateY(14px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
