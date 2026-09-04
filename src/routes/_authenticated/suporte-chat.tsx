import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Headset, Loader2, MessageSquarePlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { SupportThread } from "@/components/support/SupportThread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useSession, useShop } from "@/hooks/useShop";
import { useMyConversations } from "@/hooks/useSupport";
import { friendlyError } from "@/lib/errors";
import { SUPPORT_STATUS, createConversation, relativeTime } from "@/lib/support";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/suporte-chat")({
  validateSearch: (s: Record<string, unknown>) => ({
    c: typeof s["c"] === "string" ? s["c"] : undefined,
  }),
  component: SupportChatPage,
});

function SupportChatPage() {
  const { userId } = useSession();
  const { data: shop } = useShop();
  const navigate = useNavigate();
  const { c } = Route.useSearch();
  const qc = useQueryClient();
  const { data: convs, isLoading, isError, refetch } = useMyConversations();

  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const current = useMemo(() => convs?.find((x) => x.id === c) ?? null, [convs, c]);
  const select = (id: string | undefined) =>
    navigate({ to: "/suporte-chat", search: { c: id }, replace: true });

  const create = useMutation({
    mutationFn: () =>
      createConversation({
        userId: userId!,
        barbershopId: shop?.id ?? null,
        subject,
        body: body.trim(),
      }),
    onSuccess: (id) => {
      setOpen(false);
      setSubject("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["support-conversations"] });
      select(id);
      toast.success("Conversa aberta. Nossa equipe responde em breve.");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message) || "Não foi possível abrir"),
  });

  const list = (
    <div className="space-y-2">
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={4} />
      ) : !convs?.length ? (
        <EmptyState
          icon={Headset}
          title="Nenhum atendimento ainda"
          description="Precisa de ajuda? Abra uma conversa e nossa equipe responde por aqui, em tempo real."
          action={
            <Button onClick={() => setOpen(true)}>
              <MessageSquarePlus className="size-4" /> Falar com o suporte
            </Button>
          }
        />
      ) : (
        convs.map((cv) => {
          const st = SUPPORT_STATUS[cv.status];
          const active = cv.id === c;
          return (
            <button
              key={cv.id}
              onClick={() => select(cv.id)}
              className={cn(
                "surface-row flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors",
                active && "border-primary/50 bg-primary/8",
              )}
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", st.dot)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{cv.subject}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {relativeTime(cv.last_message_at)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                  {cv.last_message_preview ?? "—"}
                </span>
                <span className="mt-1.5 flex items-center gap-1.5">
                  <Badge variant="outline" className={cn("border text-[10px]", st.tone)}>
                    {st.label}
                  </Badge>
                  {cv.barber_unread > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                      {cv.barber_unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <AppShell
      title="Suporte"
      subtitle="Fale com a equipe NAVALHA PRO"
      action={
        <Button size="sm" aria-label="Nova conversa" onClick={() => setOpen(true)}>
          <MessageSquarePlus className="size-4" />
          <span className="hidden sm:inline">Nova conversa</span>
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className={cn(current && "hidden lg:block")}>{list}</div>
        <div className={cn(!current && "hidden lg:block")}>
          {current && userId ? (
            <SupportThread
              conversation={current}
              userId={userId}
              onBack={() => select(undefined)}
            />
          ) : (
            <div className="surface-card hidden h-full min-h-[420px] items-center justify-center lg:flex">
              <EmptyState
                compact
                icon={Headset}
                title="Selecione um atendimento"
                description="Ou abra uma nova conversa com o suporte."
                className="border-0 bg-transparent"
              />
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Falar com o suporte</DialogTitle>
            <DialogDescription>
              Conte o que está acontecendo. Você pode anexar prints depois, na conversa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Assunto (ex.: problema na agenda)"
              value={subject}
              maxLength={80}
              onChange={(e) => setSubject(e.target.value)}
            />
            <Textarea
              placeholder="Descreva sua dúvida ou problema…"
              value={body}
              rows={5}
              maxLength={4000}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!body.trim() || create.isPending || !userId}
              onClick={() => create.mutate()}
            >
              {create.isPending && <Loader2 className="size-4 animate-spin" />} Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
