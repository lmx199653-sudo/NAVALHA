/* Service worker de desenvolvimento. Em produção este arquivo é substituído
   pelo service worker gerado no build, que importa o mesmo push-handler.js. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

importScripts("/push-handler.js");
