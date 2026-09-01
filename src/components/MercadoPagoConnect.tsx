import { friendlyError } from "@@/lib/errors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link2, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  disconnectMercadoPago,
  getMercadoPagoConnectUrl,
  getMercadoPagoStatus,
} from "@/lib/payments.functions";

export function MercadoPagoConnect({ shopId }: { shopId: string | undefined }) {
  const qc = useQueryClient();
  const status = useServerFn(getMercadoPagoStatus);
  const connectUrl = useServerFn(getMercadoPagoConnectUrl);
  const disconnect = useServerFn(disconnectMercadoPago);

  const { data } = useQuery({
    queryKey: ["mercado-pago-status", shopId],
    enabled: !!shopId,
    queryFn: () => status({ data: { shopId: shopId! } }),
    retry: false,
  });

  const connect = useMutation({
    mutationFn: () => connectUrl({ data: { shopId: shopId! } }),
    onSuccess: (result) => {
      if (result?.url) window.location.href = result.url;
    },
    onError: (error: Error) => toast.error(friendlyError(error.message)),
  });

  const remove = useMutation({
    mutationFn: () => disconnect({ data: { shopId: shopId! } }),
    onSuccess: () => {
      toast.success("Mercado Pago desconectado.");
      qc.invalidateQueries({ queryKey: ["mercado-pago-status"] });
    },
    onError: (error: Error) => toast.error(friendlyError(error.message)),
  });

  const connected = !!data?.connected;

  return (
    <div className="surface-card p-4">
      <h3 className="font-display text-2xl">Pagamentos</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Conecte sua conta Mercado Pago para receber os pagamentos online dos clientes.
      </p>
      <p className="mt-3 text-sm">
        Mercado Pago:{" "}
        <span className={connected ? "text-success" : "text-destructive"}>
          {connected ? "🟢 Conectado" : "🔴 Não conectado"}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {connected ? (
          <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => remove.mutate()}>
            <Unlink className="size-4" /> Desconectar Mercado Pago
          </Button>
        ) : (
          <Button size="sm" disabled={connect.isPending || !shopId} onClick={() => connect.mutate()}>
            <Link2 className="size-4" /> Conectar Mercado Pago
          </Button>
        )}
      </div>
    </div>
  );
}
