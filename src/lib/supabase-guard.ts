/**
 * Camada de acesso usada nas telas administrativas.
 *
 * - Visitante sem login: navega por tudo e enxerga dados de demonstração.
 * - Pelo site (navegador): qualquer alteração é bloqueada com aviso.
 * - Pelo app instalado (PWA) com login: acesso normal ao banco.
 *
 * Não altera o banco nem o layout — apenas intermedeia as chamadas.
 */
import { toast } from "sonner";

import { supabase as realClient } from "@/integrations/supabase/client";

import { demoTables } from "@/lib/demo-db";

export const MANAGE_BLOCKED_MESSAGE =
  "Para fazer alterações, instale o App e faça login.";

const WRITE_METHODS = new Set(["insert", "update", "upsert", "delete"]);

function hasSession() {
  if (typeof window === "undefined") return true;
  try {
    return Object.keys(window.localStorage).some(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token") && !!window.localStorage.getItem(k),
    );
  } catch {
    return false;
  }
}

/** Com login (app instalado ou navegador) as alterações são liberadas. */
export function canManage() {
  if (typeof window === "undefined") return false;
  return hasSession();
}

/** Mostra o aviso, evitando duplicar quando a própria tela também avisa. */
export function notifyManageBlocked() {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    const shown = Array.from(document.querySelectorAll("[data-sonner-toast]")).some((el) =>
      (el.textContent ?? "").includes(MANAGE_BLOCKED_MESSAGE),
    );
    if (!shown) toast.error(MANAGE_BLOCKED_MESSAGE, { id: "manage-blocked" });
  }, 350);
}

function blockedResult() {
  notifyManageBlocked();
  const result = {
    data: null,
    error: { message: MANAGE_BLOCKED_MESSAGE, details: "", hint: "", code: "manage_blocked" },
    count: null,
    status: 403,
    statusText: "Forbidden",
  };
  return makeThenable(() => result);
}

/** Objeto encadeável (.eq().order()...) que resolve num resultado fixo. */
function makeThenable(resolve: () => unknown): unknown {
  const chain: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(chain, {
    get(_t, prop) {
      if (prop === "then") {
        return (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(resolve()).then(onFulfilled, onRejected);
      }
      if (prop === "catch" || prop === "finally") {
        return (fn: (v: unknown) => unknown) =>
          (Promise.resolve(resolve()) as unknown as Record<string, (f: unknown) => unknown>)[
            prop as string
          ]!(fn);
      }
      if (prop === "abortSignal" || typeof prop === "symbol") return () => proxy;
      return () => proxy;
    },
  });
  return proxy;
}

function demoRows(table: string) {
  if (!demoTables[table]) demoTables[table] = [];
  return demoTables[table]!;
}

function demoId(table: string) {
  return `demo-${table}-${Math.random().toString(36).slice(2, 10)}`;
}

function demoQuery(table: string) {
  let single = false;
  let mode: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  let payload: Record<string, unknown>[] = [];
  const filters: Array<{ col: string; op: "eq" | "in"; value: unknown }> = [];

  const match = (r: Record<string, unknown>) =>
    filters.every((f) =>
      f.op === "eq"
        ? r[f.col] === f.value
        : Array.isArray(f.value) && (f.value as unknown[]).includes(r[f.col]),
    );

  const build = () => {
    const all = demoRows(table);
    let rows: Record<string, unknown>[];

    if (mode === "insert" || mode === "upsert") {
      rows = payload.map((p) => {
        const row = { id: demoId(table), created_at: new Date().toISOString(), ...p };
        const idx = all.findIndex((r) => r["id"] === row["id"]);
        if (idx >= 0) all[idx] = { ...all[idx], ...row };
        else all.push(row);
        return row;
      });
    } else if (mode === "update") {
      rows = [];
      for (let i = 0; i < all.length; i++) {
        if (match(all[i]!)) {
          all[i] = { ...all[i], ...(payload[0] ?? {}) };
          rows.push(all[i]!);
        }
      }
    } else if (mode === "delete") {
      rows = all.filter(match);
      for (const r of rows) {
        const idx = all.indexOf(r);
        if (idx >= 0) all.splice(idx, 1);
      }
    } else {
      rows = all.filter(match);
    }

    if (single) return { data: rows[0] ?? null, error: null, count: rows.length, status: 200 };
    return { data: rows, error: null, count: rows.length, status: 200 };
  };

  const chain: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(chain, {
    get(_t, prop) {
      if (prop === "then") {
        return (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(build()).then(onFulfilled, onRejected);
      }
      if (prop === "catch" || prop === "finally") {
        return (fn: (v: unknown) => unknown) =>
          (Promise.resolve(build()) as unknown as Record<string, (f: unknown) => unknown>)[
            prop as string
          ]!(fn);
      }
      if (typeof prop === "string" && WRITE_METHODS.has(prop)) {
        return (values?: unknown) => {
          mode = prop as typeof mode;
          const list = Array.isArray(values) ? values : values ? [values] : [];
          payload = list as Record<string, unknown>[];
          return proxy;
        };
      }
      if (prop === "single" || prop === "maybeSingle") {
        single = true;
        return () => proxy;
      }
      if (prop === "eq" || prop === "in") {
        return (col: string, value: unknown) => {
          filters.push({ col, op: prop as "eq" | "in", value });
          return proxy;
        };
      }
      if (prop === "abortSignal" || typeof prop === "symbol") return () => proxy;
      return () => proxy;
    },
  });
  return proxy;
}


function guardTable(table: string) {
  if (!canManage() && !hasSession()) return demoQuery(table);
  const builder = realClient.from(table as never) as unknown as Record<string, unknown>;
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && WRITE_METHODS.has(prop) && !canManage()) {
        return () => blockedResult();
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function guardStorageBucket(bucket: string) {
  const api = realClient.storage.from(bucket) as unknown as Record<string, unknown>;
  return new Proxy(api, {
    get(target, prop, receiver) {
      if (
        typeof prop === "string" &&
        ["upload", "remove", "move", "copy", "update", "createSignedUploadUrl"].includes(prop) &&
        !canManage()
      ) {
        return async () => {
          notifyManageBlocked();
          return { data: null, error: { message: MANAGE_BLOCKED_MESSAGE } };
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** Cliente com as mesmas assinaturas do Supabase, porém somente leitura no site. */
/** Funções do banco que alteram dados — bloqueadas sem login. */
const WRITE_RPCS = new Set([
  "complete_appointment",
  "refund_appointment_benefit",
  "create_subscription",
  "cancel_subscription",
  "ensure_subscription_cycle",
]);

export const supabase = new Proxy(realClient as unknown as Record<string, unknown>, {
  get(target, prop, receiver) {
    if (prop === "from") return (table: string) => guardTable(table);
    if (prop === "rpc") {
      return (fn: string, args?: unknown) => {
        if (WRITE_RPCS.has(fn) && !canManage()) return blockedResult();
        return (realClient.rpc as unknown as (f: string, a?: unknown) => unknown)(fn, args);
      };
    }

    if (prop === "storage") {
      const storage = Reflect.get(target, prop, receiver) as Record<string, unknown>;
      return new Proxy(storage, {
        get(sTarget, sProp, sReceiver) {
          if (sProp === "from") return (bucket: string) => guardStorageBucket(bucket);
          const value = Reflect.get(sTarget, sProp, sReceiver);
          return typeof value === "function" ? value.bind(sTarget) : value;
        },
      });
    }
    const value = Reflect.get(target, prop, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as unknown as typeof realClient;
