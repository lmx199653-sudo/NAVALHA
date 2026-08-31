import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, Loader2, User, AlertCircle } from "lucide-react";
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

/** Checkbox premium customizado: fundo escuro, check dourado, animação. */
function GoldCheckbox({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label="Lembrar de mim"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-all duration-200",
        checked
          ? "border-[oklch(0.78_0.13_85)] bg-[oklch(0.78_0.13_85)]"
          : "border-[#292D32] bg-[#0B0D0F] hover:border-[oklch(0.78_0.13_85/0.5)]",
      )}
    >
      <svg
        viewBox="0 0 12 10"
        className={cn(
          "size-2.5 transition-all duration-200",
          checked ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
      >
        <path
          d="M1 5.2 4.4 8.6 11 1.4"
          fill="none"
          stroke="#08090B"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
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

  if (checking) return <div className="min-h-screen bg-[#08090B]" />;

  const inputCls =
    "h-[52px] rounded-[13px] border-[#292D32] bg-[#0B0D0F] pl-11 text-[15px] text-white placeholder:text-[#5B6168] transition-all duration-200 hover:border-[#363B41] focus-visible:border-[oklch(0.78_0.13_85/0.7)] focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_oklch(0.78_0.13_85/0.12),0_0_24px_-6px_oklch(0.78_0.13_85/0.25)]";

  return (
    <div className="auth-page relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08090B] px-4 py-10">
      {/* Glow radial dourado sutil ao redor do card */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[720px] max-w-[140vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.10] blur-3xl"
        style={{ background: "radial-gradient(closest-side, oklch(0.78 0.13 85), transparent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[36rem] max-w-[120vw] -translate-x-1/2 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: "radial-gradient(closest-side, oklch(0.78 0.13 85), transparent)" }}
      />

      <div className="auth-card relative w-full max-w-[440px]">
        {/* Logo + identidade */}
        <div className="auth-logo mb-8 flex flex-col items-center text-center">
          <Link to="/" className="group flex items-center gap-2.5 transition-transform duration-300 hover:scale-[1.02]">
            <img
              src={logoAsset.url}
              alt="NAVALHA PRO"
              className="size-10 shrink-0 object-contain drop-shadow-[0_0_12px_oklch(0.78_0.13_85/0.3)]"
            />
            <span className="font-display text-[32px] leading-none tracking-tight text-white">
              NAVALHA <span className="text-[oklch(0.78_0.13_85)]">PRO</span>
            </span>
          </Link>
          <h1 className="mt-7 text-[26px] font-semibold tracking-tight text-white">
            Bem-vindo de volta
          </h1>
          <p className="mt-2 text-sm text-[#8A9097]">
            Entre na sua conta para continuar.
          </p>
        </div>

        {/* Card premium dark glass */}
        <div
          className="relative rounded-[20px] border border-white/[0.06] bg-[#111315]/95 p-6 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.8)] backdrop-blur-md sm:p-8"
        >
          {/* brilho dourado sutil no topo */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-10 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, oklch(0.78 0.13 85 / 0.55), transparent)" }}
          />

          {/* Tabs segmented control */}
          <div className="relative grid grid-cols-2 rounded-xl border border-white/[0.05] bg-[#0B0D0F] p-1">
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-[#181B1E] shadow-[0_0_16px_-2px_oklch(0.78_0.13_85/0.35),inset_0_0_0_1px_oklch(0.78_0.13_85/0.25)] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]",
                tab === "signup" && "translate-x-full",
              )}
              style={{ left: 4 }}
            />
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setFieldError(null); }}
                className={cn(
                  "relative z-10 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                  tab === t ? "text-white" : "text-[#7A8188] hover:text-[#B9BFC5]",
                )}
              >
                {t === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          {tab === "login" && (
            <form onSubmit={signIn} className="auth-form space-y-4 pt-6" key="login">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-[#C6CBD1]">E-mail</Label>
                <div className="group relative">
                  <Mail className={cn(
                    "pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 transition-colors duration-200",
                    email ? "text-[oklch(0.78_0.13_85)]" : "text-[#5B6168] group-focus-within:text-[oklch(0.78_0.13_85)]",
                  )} />
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-[#C6CBD1]">Senha</Label>
                <div className="group relative">
                  <Lock className={cn(
                    "pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 transition-colors duration-200",
                    password ? "text-[oklch(0.78_0.13_85)]" : "text-[#5B6168] group-focus-within:text-[oklch(0.78_0.13_85)]",
                  )} />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(inputCls, "pr-11")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#5B6168] transition-all duration-200 hover:bg-white/[0.06] hover:text-white active:scale-90"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label htmlFor="remember" className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-[#9AA1A8] transition-colors hover:text-[#C6CBD1]">
                  <GoldCheckbox id="remember" checked={remember} onChange={setRemember} />
                  Lembrar de mim
                </label>
                <button
                  type="button"
                  onClick={resetPassword}
                  className="text-sm font-medium text-[oklch(0.78_0.13_85)] transition-all duration-200 hover:text-[oklch(0.84_0.12_85)] hover:underline underline-offset-4"
                >
                  Esqueci minha senha
                </button>
              </div>

              {fieldError && (
                <p
                  role="alert"
                  className="auth-error flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-950/40 px-3.5 py-2.5 text-[13px] font-medium leading-snug text-red-300"
                >
                  <AlertCircle className="mt-px size-4 shrink-0" />
                  {fieldError}
                </p>
              )}

              <Button
                className="h-[52px] w-full rounded-[13px] bg-[oklch(0.78_0.13_85)] text-[15px] font-bold text-[#08090B] shadow-[0_10px_28px_-10px_oklch(0.78_0.13_85/0.55)] transition-all duration-200 hover:-translate-y-px hover:bg-[oklch(0.84_0.12_85)] hover:shadow-[0_14px_34px_-10px_oklch(0.78_0.13_85/0.65)] active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
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
            <form onSubmit={signUp} className="auth-form space-y-4 pt-6" key="signup">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium text-[#C6CBD1]">Seu nome</Label>
                <div className="group relative">
                  <User className={cn(
                    "pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 transition-colors duration-200",
                    name ? "text-[oklch(0.78_0.13_85)]" : "text-[#5B6168] group-focus-within:text-[oklch(0.78_0.13_85)]",
                  )} />
                  <Input
                    id="name"
                    required
                    autoComplete="name"
                    placeholder="Como podemos te chamar?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email2" className="text-sm font-medium text-[#C6CBD1]">E-mail</Label>
                <div className="group relative">
                  <Mail className={cn(
                    "pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 transition-colors duration-200",
                    email ? "text-[oklch(0.78_0.13_85)]" : "text-[#5B6168] group-focus-within:text-[oklch(0.78_0.13_85)]",
                  )} />
                  <Input
                    id="email2"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password2" className="text-sm font-medium text-[#C6CBD1]">Senha</Label>
                <div className="group relative">
                  <Lock className={cn(
                    "pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 transition-colors duration-200",
                    password ? "text-[oklch(0.78_0.13_85)]" : "text-[#5B6168] group-focus-within:text-[oklch(0.78_0.13_85)]",
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
                    className={cn(inputCls, "pr-11")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#5B6168] transition-all duration-200 hover:bg-white/[0.06] hover:text-white active:scale-90"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {fieldError && (
                <p
                  role="alert"
                  className="auth-error flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-950/40 px-3.5 py-2.5 text-[13px] font-medium leading-snug text-red-300"
                >
                  <AlertCircle className="mt-px size-4 shrink-0" />
                  {fieldError}
                </p>
              )}

              <Button
                className="h-[52px] w-full rounded-[13px] bg-[oklch(0.78_0.13_85)] text-[15px] font-bold text-[#08090B] shadow-[0_10px_28px_-10px_oklch(0.78_0.13_85/0.55)] transition-all duration-200 hover:-translate-y-px hover:bg-[oklch(0.84_0.12_85)] hover:shadow-[0_14px_34px_-10px_oklch(0.78_0.13_85/0.65)] active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
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
            <span className="h-px flex-1 bg-white/[0.07]" />
            <span className="text-[11px] font-medium uppercase tracking-widest text-[#5B6168]">ou continue com</span>
            <span className="h-px flex-1 bg-white/[0.07]" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-[52px] w-full gap-2.5 rounded-[13px] border-[#292D32] bg-transparent text-[15px] font-medium text-white transition-all duration-200 hover:-translate-y-px hover:border-[#3A4046] hover:bg-white/[0.04] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.8)] active:translate-y-0"
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

          <p className="mt-7 text-center text-sm text-[#7A8188]">
            Novo no NAVALHA PRO?{" "}
            <button
              type="button"
              onClick={() => { setTab("signup"); setFieldError(null); }}
              className="font-semibold text-[oklch(0.78_0.13_85)] transition-colors duration-200 hover:text-[oklch(0.84_0.12_85)] hover:underline underline-offset-4"
            >
              Crie sua conta gratuitamente
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-[#5B6168]">
          100% grátis para barbearias · Sem cartão de crédito
        </p>
      </div>

      <style>{`
        .auth-page { animation: auth-fade .4s ease both; }
        .auth-card { animation: auth-card-in .55s cubic-bezier(.22,1,.36,1) both; }
        .auth-logo { animation: auth-logo-in .7s cubic-bezier(.22,1,.36,1) both; }
        .auth-form { animation: auth-form-in .3s ease both; }
        .auth-error { animation: auth-form-in .3s ease both; }
        @keyframes auth-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes auth-card-in {
          from { opacity: 0; transform: translateY(14px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes auth-logo-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes auth-form-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
