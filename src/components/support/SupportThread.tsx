import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Headset, ImagePlus, Loader2, Send, User } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ListSkeleton } from "@/components/ui/states";
import { useMessages } from "@/hooks/useSupport";
import { friendlyError } from "@/lib/errors";
import {
  SUPPORT_STATUS,
  markRead,
  sendMessage,
  signedAttachmentUrl,
  uploadAttachment,
  type SupportConversation,
  type SupportMessage,
} from "@/lib/support";
import { cn } from "@/lib/utils";

function Attachment({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    signedAttachmentUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) return <div className="h-32 w-44 animate-pulse rounded-lg bg-muted/50" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt="Anexo"
        loading="lazy"
        className="max-h-64 max-w-full rounded-lg border border-border/60 object-cover"
      />
    </a>
  );
}

function Bubble({ msg, mine }: { msg: SupportMessage; mine: boolean }) {
  const isSupport = msg.sender_role === "support";
  return (
    <div className={cn("flex w-full gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && (
        <span
          className={cn(
            "mt-auto grid size-7 shrink-0 place-items-center rounded-full ring-1",
            isSupport
              ? "bg-primary/12 text-primary ring-primary/25"
              : "bg-muted text-muted-foreground ring-border/60",
          )}
        >
          {isSupport ? <Headset className="size-3.5" /> : <User className="size-3.5" />}
        </span>
      )}
      <div
        className={cn(
          "max-w-[82%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm sm:max-w-[70%]",
          mine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border border-border/60 bg-card text-foreground",
        )}
      >
        {msg.attachment_path && <Attachment path={msg.attachment_path} />}
        {msg.body && <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>}
        <p
          className={cn(
            "text-[10px] leading-none",
            mine ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {new Date(msg.created_at).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

export function SupportThread({
  conversation,
  userId,
  onBack,
  headerExtra,
  headerTitle,
  headerSubtitle,
  disabled,
}: {
  conversation: SupportConversation;
  userId: string;
  onBack?: () => void;
  headerExtra?: ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const { data: messages, isLoading } = useMessages(conversation.id);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const status = SUPPORT_STATUS[conversation.status];

  // Marca como lida ao abrir e quando chegam mensagens novas.
  useEffect(() => {
    void markRead(conversation.id).then(() => {
      qc.invalidateQueries({ queryKey: ["support-conversations"] });
      qc.invalidateQueries({ queryKey: ["support-inbox"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [conversation.id, messages?.length, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  const send = useMutation({
    mutationFn: async () => {
      const body = text.trim();
      if (!body && !file) return;
      let path: string | null = null;
      if (file) path = await uploadAttachment(conversation.id, file);
      await sendMessage({
        conversationId: conversation.id,
        senderId: userId,
        body,
        attachmentPath: path,
      });
    },
    onSuccess: () => {
      setText("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["support-messages", conversation.id] });
      qc.invalidateQueries({ queryKey: ["support-conversations"] });
      qc.invalidateQueries({ queryKey: ["support-inbox"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e.message) || "Não foi possível enviar"),
  });

  return (
    <div className="surface-card flex h-[calc(100dvh-15rem)] min-h-[420px] flex-col overflow-hidden lg:h-[calc(100dvh-13.5rem)]">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5 sm:px-4">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onBack}
            aria-label="Voltar"
          >
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{headerTitle ?? conversation.subject}</p>
          <p className="truncate text-[12px] text-muted-foreground">
            {headerSubtitle ?? "Equipe de suporte NAVALHA PRO"}
          </p>
        </div>
        {conversation.urgent && (
          <Badge
            variant="outline"
            className="border-destructive/40 bg-destructive/10 text-destructive"
          >
            Urgente
          </Badge>
        )}
        <Badge variant="outline" className={cn("border", status.tone)}>
          {status.label}
        </Badge>
        {headerExtra}
      </div>

      {/* Mensagens */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : (
          (messages ?? []).map((m) => <Bubble key={m.id} msg={m} mine={m.sender_id === userId} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 p-2.5 sm:p-3">
        {file && (
          <div className="mb-2 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs">
            <span className="truncate">📎 {file.name}</span>
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              remover
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label="Anexar imagem"
            disabled={disabled || send.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="size-4" />
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={disabled ? "Conversa encerrada" : "Escreva sua mensagem…"}
            rows={1}
            disabled={disabled}
            className="max-h-32 min-h-[40px] flex-1 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (!send.isPending) send.mutate();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            className="shrink-0"
            aria-label="Enviar"
            disabled={disabled || send.isPending || (!text.trim() && !file)}
            onClick={() => send.mutate()}
          >
            {send.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
