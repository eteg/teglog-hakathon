import type { Local } from "./types";

const DESVIO_MAXIMO_GRAUS = 0.002;

function sorteioDe(semente: string) {
  let estado = [...semente].reduce((hash, letra) => Math.imul(hash ^ letra.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 2 ** 32;
  };
}

const arredondar = (grau: number) => Math.round(grau * 100000) / 100000;

export function localNaEstrada(caminho: [number, number][], semente?: string): Local {
  const sorteio = semente === undefined ? Math.random : sorteioDe(semente);
  const posicao = sorteio() ** 1.5 * (caminho.length - 1);
  const trecho = Math.floor(posicao);
  const fracao = posicao - trecho;
  const [lat0, lng0] = caminho[trecho];
  const [lat1, lng1] = caminho[Math.min(trecho + 1, caminho.length - 1)];
  const desvio = () => (sorteio() - 0.5) * 2 * DESVIO_MAXIMO_GRAUS;
  return {
    latitude: arredondar(lat0 + (lat1 - lat0) * fracao + desvio()),
    longitude: arredondar(lng0 + (lng1 - lng0) * fracao + desvio()),
  };
}

export function localValido(valor: unknown): valor is Local {
  const { latitude, longitude } = (valor ?? {}) as Partial<Local>;
  return (
    typeof latitude === "number" && typeof longitude === "number" && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
  );
}
