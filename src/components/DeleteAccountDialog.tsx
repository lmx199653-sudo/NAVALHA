import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount, getMyDataSummary } from "@/lib/account.functions";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Props = { className?: string; triggerLabel?: string };

/** Botão + confirmação para excluir a conta e todos os dados (requisito Google Play). */
export function DeleteAccountDialog({ className, triggerLabel = "Excluir minha conta" }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const qc = useQueryClient();
  const summaryFn = useServerFn(getMyDataSummary);
  const deleteFn = useServerFn(deleteMyAccount);

  const summary = useQuery({
    queryKey: ["my-data-summary"],
    queryFn: () => summaryFn(),
    enabled: open,
  });

  const del = useMutation({
    mutationFn: () => deleteFn({ data: { confirmation } }),
    onSuccess: async () => {
      toast.success("Conta excluída. Sentiremos sua falta.");
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut().catch(() => undefined);
      window.location.href = "/auth?deleted=1";
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const ready = confirmation.trim().toUpperCase() === "EXCLUIR";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setConfirmation("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className={cn("w-full sm:w-auto", className)}>
          <Trash2 className="size-4" /> {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" /> Excluir conta definitivamente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Esta ação é <strong>irreversível</strong>. Serão apagados permanentemente:
              </p>
              <ul className="surface-row list-disc space-y-1 py-3 pl-8 pr-3">
                <li>Sua conta de acesso (e-mail/Google)</li>
                {summary.data?.shops.length ? (
                  <li>
                    Barbearia{summary.data.shops.length > 1 ? "s" : ""}:{" "}
                    <strong>{summary.data.shops.join(", ")}</strong>
                  </li>
                ) : (
                  <li>Barbearias das quais você é dono</li>
                )}
                <li>
                  {summary.data
                    ? `${summary.data.customers} cliente(s) e ${summary.data.appointments} agendamento(s)`
                    : "Clientes, agenda e histórico"}
                </li>
                <li>Serviços, profissionais, assinaturas, pagamentos e configurações</li>
              </ul>
              <div className="space-y-1.5">
                <Label htmlFor="delete-confirm">
                  Digite <span className="font-mono font-semibold text-foreground">EXCLUIR</span>{" "}
                  para confirmar
                </Label>
                <Input
                  id="delete-confirm"
                  autoComplete="off"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="EXCLUIR"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!ready || del.isPending}
            onClick={(e) => {
              e.preventDefault();
              del.mutate();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {del.isPending ? "Excluindo..." : "Excluir tudo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
