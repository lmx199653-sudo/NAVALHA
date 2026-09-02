import { createFileRoute } from "@tanstack/react-router";
import { SubscriptionAlerts } from "@/components/subscriptions/SubscriptionAlerts";
import { buildAlerts } from "@/lib/subscription-alerts";

const d = (n: number) => {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mk = (o: any) =>
  ({
    sub: { id: o.id, status: "active", payment_status: o.pay ?? "paid", price_cents: 5990, started_on: d(-40), barbershop_id: "s", customer_id: "c", plan_id: "p", next_payment: null, cancelled_at: null, cancel_reason: null, created_at: "" },
    customer: { id: "c", name: o.id, phone: "11999999999", cpf: null },
    plan: { name: "Gold" },
    balance: o.end === undefined ? null : { cycle_id: "cy", period_end: d(o.end), period_start: d(o.end - 30), cuts_left: o.cuts ?? 2, cuts_credits: 4 },
    payments: o.due === undefined ? [] : [{ id: "pay", subscription_id: o.id, amount_cents: 5990, status: "pending", due_date: d(o.due), paid_at: null }],
  }) as never;

export const Route = createFileRoute("/dev-preview")({
  ssr: false,
  component: () => (
    <div className="mx-auto max-w-4xl p-6">
      <SubscriptionAlerts
        alerts={buildAlerts([
          mk({ id: "Carlos Silva", pay: "pending", due: -10, end: 20 }),
          mk({ id: "João Pedro", pay: "pending", due: -1, end: 20 }),
          mk({ id: "Rafael Souza", end: -2 }),
          mk({ id: "Lucas Lima", end: 3 }),
          mk({ id: "Bruno Alves", end: 10, cuts: 0 }),
        ])}
        shopName="Navalha"
        onMarkPaid={() => {}}
        onRenew={() => {}}
        onCancel={() => {}}
      />
    </div>
  ),
});
