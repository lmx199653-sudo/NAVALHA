import barba from "@/assets/servicos/Barba.jpeg.asset.json";
import corteInfantil from "@/assets/servicos/Corte_Infantil.jpeg.asset.json";
import corteMaquina from "@/assets/servicos/Corte_Maquina.jpeg.asset.json";
import corteTesoura from "@/assets/servicos/Corte_Tesoura.jpeg.asset.json";
import navalhado from "@/assets/servicos/Navalhado.jpeg.asset.json";
import nevou from "@/assets/servicos/Nevou.jpeg.asset.json";
import pigmentacao from "@/assets/servicos/Pigmentacao.jpeg.asset.json";
import reflexo from "@/assets/servicos/Reflexo.jpeg.asset.json";
import sobrancelha from "@/assets/servicos/Sobrancelha.jpeg.asset.json";

function norm(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Grupos de imagens por serviço — a chave é o nome do serviço visível na imagem. */
const GROUPS: { key: string; images: string[] }[] = [
  { key: "corte infantil", images: [corteInfantil.url] },
  { key: "infantil", images: [corteInfantil.url] },
  { key: "corte maquina", images: [corteMaquina.url] },
  { key: "corte tesoura", images: [corteTesoura.url] },
  { key: "navalhado", images: [navalhado.url] },
  { key: "nevou", images: [nevou.url] },
  { key: "pigmentacao", images: [pigmentacao.url] },
  { key: "reflexo", images: [reflexo.url] },
  { key: "sobrancelha", images: [sobrancelha.url] },
  { key: "barba", images: [barba.url] },
  // "Corte" genérico e combos usam a foto de corte na tesoura
  { key: "corte barba", images: [corteTesoura.url, barba.url] },
  { key: "corte", images: [corteTesoura.url] },
];

export const DEFAULT_SERVICE_IMAGES = [
  { name: "NAVALHADO", url: navalhado.url },
  { name: "CORTE MÁQUINA", url: corteMaquina.url },
  { name: "CORTE TESOURA", url: corteTesoura.url },
  { name: "SOBRANCELHA", url: sobrancelha.url },
  { name: "INFANTIL", url: corteInfantil.url },
  { name: "BARBA", url: barba.url },
  { name: "REFLEXO", url: reflexo.url },
  { name: "PIGMENTAÇÃO", url: pigmentacao.url },
  { name: "NEVOU", url: nevou.url },
] as const;

/** Retorna as imagens do serviço, na ordem, sem misturar com outros serviços. */
export function serviceImages(serviceName: string): string[] {
  const n = norm(serviceName);
  const exact = GROUPS.find((g) => g.key === n);
  if (exact) return exact.images;
  const partial = GROUPS.find((g) => n.includes(g.key));
  return partial ? partial.images : [];
}

export function serviceImage(serviceName: string): string | null {
  return serviceImages(serviceName)[0] ?? null;
}
