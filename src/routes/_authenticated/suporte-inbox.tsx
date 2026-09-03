import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Headset,
  Inbox,
  MoreVertical,
  RotateCcw,
  Search,
  ShieldAlert,
  Store,
  UserCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { SupportThread } from "@/components/support/SupportThread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useSession } from "@/hooks/useShop";
import { useInbox, useIsSupport } from "@/hooks/useSupport";
import { friendlyError } from "@/lib/errors";
import {
  SUPPORT_STATUS,
  relativeTime,
  updateConversation,
  type SupportConversation,
  type SupportStatus,
} from "@/lib/support";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/suporte-inbox")({
  validateSearch: (s: Record<string, unknown>) => ({
    c: typeof s['c'] === "string" ? s['c'] : undefined,
  }),
  component: SupportInboxPage,
});

type Filter = "all" | "unread" | SupportStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "unread", label: "Não lidos" },
  { key: "new", label: "Novos" },
  { key: "open", label: "Em atendimento" },
  { key: "resolved", label: "Resolvidos" },
];

function shopName(cv: SupportConversation) {
  return cv.barbershops?.name ?? "Sem barbearia";
}
function barberName(cv: SupportConversation) {
  return cv.profiles?.full_name || cv.profiles?.email || "Barbeiro";
}

function SupportInboxPage() {
  const { userId } = useSession();
  const { data: isSupport, isLoading: roleLoading } = useIsSupport();
  const navigate = useNavigate();
  const { c } = Route.useSearch();
  const qc = useQueryClient();
  const { data: convs, isLoading, isError, refetch } = useInbox(!!isSupport);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const current = useMemo(() => convs?.find((x) => x.id === c) ?? null, [convs, c]);
  const select = (id: string | undefined) =>
    navigate({ to: "/suporte-inbox", search: { c: id }, replace: true });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (convs ?? []).filter((cv) => {
      if (filter === "unread" && cv.support_unread === 0) return false;
      if (filter !== "all" && filter !== "unread" && cv.status !== filter) return false;
      if (!term) return true;
      return [shopName(cv), barberName(cv), cv.profiles?.email, cv.profiles?.phone, cv.subject]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [convs, q, filter]);

  const unreadTotal = (convs ?? []).reduce((t, cv) => t + cv.support_unread, 0);

  const patch = useMutation({
    mutationFn: (input: { id: string; data: Parameters<typeof updateConversation>[1]; msg: string }) =>
      updateConversation(input.id, input.data).then(() => input.msg),
    onSuccess: (msg) => {
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["support-inbox"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e.message) || "Não foi possível atualizar"),
  });

  if (!roleLoading && isSupport === false) {
    return (
      <AppShell title="Inbox de Suporte">
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          description="Esta área é exclusiva da equipe de suporte NAVALHA PRO."
        />
      </AppShell>
    );
  }

  const actions = current && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Ações">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {current.assigned_to !== userId && current.status !== "resolved" && (
          <DropdownMenuItem
            onClick={() =>
              patch.mutate({
                id: current.id,
                data: { assigned_to: userId, status: "open" },
                msg: "Atendimento assumido",
              })
            }
          >
            <UserCheck className="size-4" /> Assumir atendimento
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() =>
            patch.mutate({
              id: current.id,
              data: { urgent: !current.urgent },
              msg: current.urgent ? "Urgência removida" : "Marcado como urgente",
            })
          }
        >
          <AlertTriangle className="size-4" />
          {current.urgent ? "Remover urgência" : "Marcar como urgente"}
        </DropdownMenuItem>
        {current.status !== "resolved" ? (
          <DropdownMenuItem
            onClick={() =>
              patch.mutate({ id: current.id, data: { status: "resolved" }, msg: "Atendimento encerrado" })
            }
          >
            <CheckCircle2 className="size-4" /> Encerrar atendimento
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() =>
              patch.mutate({ id: current.id, data: { status: "open" }, msg: "Atendimento reaberto" })
            }
          >
            <RotateCcw className="size-4" /> Reabrir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const list = (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar barbeiro ou barbearia…"
          className="pl-9"
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-[12px] transition-colors",
              filter === f.key
                ? "border-primary/50 bg-primary/12 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            {f.key === "unread" && unreadTotal > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {unreadTotal}
              </span>
            )}
          </button>
        ))}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading || roleLoading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          compact
          icon={Inbox}
          title="Nada por aqui"
          description="Nenhum atendimento corresponde ao filtro."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((cv) => {
            const st = SUPPORT_STATUS[cv.status];
            const active = cv.id === c;
            return (
              <button
                key={cv.id}
                onClick={() => select(cv.id)}
                className={cn(
                  "surface-row flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors",
                  active && "border-primary/50 bg-primary/8",
                  cv.urgent && !active && "border-destructive/40",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Store className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-sm", cv.support_unread > 0 ? "font-bold" : "font-semibold")}>
                      {shopName(cv)}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {relativeTime(cv.last_message_at)}
                    </span>
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {barberName(cv)} · {cv.subject}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-foreground/80">
                    {cv.last_message_preview ?? "—"}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={cn("border text-[10px]", st.tone)}>
                      {st.label}
                    </Badge>
                    {cv.urgent && (
                      <Badge
                        variant="outline"
                        className="border-destructive/40 bg-destructive/10 text-[10px] text-destructive"
                      >
                        Urgente
                      </Badge>
                    )}
                    {cv.assigned_to === userId && (
                      <span className="text-[10px] text-muted-foreground">· com você</span>
                    )}
                    {cv.support_unread > 0 && (
                      <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {cv.support_unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <AppShell
      title="Inbox de Suporte"
      subtitle={`${convs?.length ?? 0} atendimentos · ${unreadTotal} não lidos`}
    >
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className={cn(current && "hidden lg:block")}>{list}</div>
        <div className={cn(!current && "hidden lg:block")}>
          {current && userId ? (
            <div className="space-y-3">
              <SupportThread
                conversation={current}
                userId={userId}
                onBack={() => select(undefined)}
                headerTitle={shopName(current)}
                headerSubtitle={`${barberName(current)}${
                  current.profiles?.phone ? " · " + current.profiles.phone : ""
                }${current.profiles?.email ? " · " + current.profiles.email : ""}`}
                headerExtra={actions}
              />
              <div className="surface-card grid gap-2 p-3 text-[12.5px] sm:grid-cols-3">
                <Info label="Assunto" value={current.subject} />
                <Info
                  label="Barbearia"
                  value={
                    current.barbershops
                      ? `${current.barbershops.name} · /${current.barbershops.slug}`
                      : "—"
                  }
                />
                <Info
                  label="Contato"
                  value={
                    current.barbershops?.whatsapp ||
                    current.barbershops?.phone ||
                    current.profiles?.phone ||
                    "—"
                  }
                />
              </div>
            </div>
          ) : (
            <div className="surface-card hidden min-h-[420px] items-center justify-center lg:flex">
              <EmptyState
                compact
                icon={Headset}
                title="Selecione um atendimento"
                description="Escolha uma conversa ao lado para responder."
                className="border-0 bg-transparent"
              />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow text-[10px] text-muted-foreground">{label}</p>
      <p className="truncate text-foreground">{value}</p>
    </div>
  );
}
