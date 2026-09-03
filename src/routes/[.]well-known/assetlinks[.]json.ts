import { createFileRoute } from "@tanstack/react-router";

/**
 * Digital Asset Links para o app Android (Trusted Web Activity).
 * Fonte única: public/.well-known/assetlinks.json (copiado aqui para garantir
 * que a URL responda em qualquer ambiente). Substitua a impressão digital
 * SHA-256 pela do Play App Signing — veja docs/google-play.md.
 */
export const ASSET_LINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "app.lovable.pronavalha.twa",
      sha256_cert_fingerprints: [
        "SUBSTITUA_PELO_SHA256_DA_CHAVE_DE_ASSINATURA_DO_PLAY_APP_SIGNING",
      ],
    },
  },
];

export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(ASSET_LINKS, null, 2), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        }),
    },
  },
});
