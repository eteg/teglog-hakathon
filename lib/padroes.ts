// Base sintética de entregas (denominador) e cálculo de padrões.
// Pontos plantados de propósito:
//  - Transportadora Beta em São Paulo → Manaus: taxa alta (rota ruim)
//  - São Paulo → Campinas: muito volume, taxa baixa (não pode aparecer no topo)
//  - Vidro temperado: produto frágil

export interface LinhaBase {
  rota: string;
  transportadora: string;
  produto: string;
  entregas: number;
  ocorrencias: number;
  custo: number; // R$ de prejuízo no mês
  frete_medio: number; // R$ por entrega
}

export const BASE: LinhaBase[] = [
  { rota: "São Paulo → Manaus", transportadora: "Transportadora Beta", produto: "eletrônico", entregas: 1_500, ocorrencias: 45, custo: 36_000, frete_medio: 92 },
  { rota: "São Paulo → Manaus", transportadora: "Transportadora Alfa", produto: "eletrônico", entregas: 1_100, ocorrencias: 9, custo: 7_200, frete_medio: 96 },
  { rota: "São Paulo → Campinas", transportadora: "Transportadora Alfa", produto: "eletrônico", entregas: 18_000, ocorrencias: 108, custo: 11_880, frete_medio: 18 },
  { rota: "São Paulo → Campinas", transportadora: "Transportadora Beta", produto: "vidro temperado", entregas: 900, ocorrencias: 27, custo: 12_690, frete_medio: 22 },
  { rota: "Curitiba → Florianópolis", transportadora: "Transportadora Alfa", produto: "móveis", entregas: 3_200, ocorrencias: 38, custo: 10_640, frete_medio: 41 },
  { rota: "Curitiba → Florianópolis", transportadora: "Transportadora Gama", produto: "móveis", entregas: 2_100, ocorrencias: 29, custo: 8_120, frete_medio: 38 },
  { rota: "Belo Horizonte → Contagem", transportadora: "Transportadora Gama", produto: "eletrodoméstico", entregas: 6_400, ocorrencias: 70, custo: 7_700, frete_medio: 15 },
  { rota: "Belo Horizonte → Contagem", transportadora: "Transportadora Alfa", produto: "eletrodoméstico", entregas: 4_800, ocorrencias: 31, custo: 3_410, frete_medio: 16 },
  { rota: "Salvador → Brumado", transportadora: "Frota própria", produto: "material de construção", entregas: 1_300, ocorrencias: 12, custo: 9_840, frete_medio: 64 },
  { rota: "Salvador → Brumado", transportadora: "Transportadora Gama", produto: "material de construção", entregas: 700, ocorrencias: 11, custo: 7_150, frete_medio: 58 },
];

export interface Agregado {
  chave: string;
  entregas: number;
  ocorrencias: number;
  custo: number;
  porMil: number;
  custoPorEntrega: number;
}

export function agregar(por: (l: LinhaBase) => string, base = BASE): Agregado[] {
  const m = new Map<string, Agregado>();
  for (const l of base) {
    const k = por(l);
    const a = m.get(k) ?? { chave: k, entregas: 0, ocorrencias: 0, custo: 0, porMil: 0, custoPorEntrega: 0 };
    a.entregas += l.entregas;
    a.ocorrencias += l.ocorrencias;
    a.custo += l.custo;
    m.set(k, a);
  }
  return [...m.values()]
    .map((a) => ({ ...a, porMil: (a.ocorrencias / a.entregas) * 1000, custoPorEntrega: a.custo / a.entregas }))
    .sort((a, b) => b.porMil - a.porMil);
}

export function totais(base = BASE) {
  const entregas = base.reduce((s, l) => s + l.entregas, 0);
  const ocorrencias = base.reduce((s, l) => s + l.ocorrencias, 0);
  const custo = base.reduce((s, l) => s + l.custo, 0);
  return { entregas, ocorrencias, custo, porMil: (ocorrencias / entregas) * 1000 };
}

export interface Acao {
  titulo: string;
  detalhe: string;
  economia: number;
}

/** As 3 ações de maior economia líquida, sempre com denominador e custo de troca. */
export function recomendar(base = BASE): Acao[] {
  const acoes: Acao[] = [];

  // Troca de transportadora na mesma rota/produto quando a alternativa tem taxa menor.
  const porRotaProduto = new Map<string, LinhaBase[]>();
  for (const l of base) {
    const k = `${l.rota}|${l.produto}`;
    porRotaProduto.set(k, [...(porRotaProduto.get(k) ?? []), l]);
  }
  for (const linhas of porRotaProduto.values()) {
    if (linhas.length < 2) continue;
    const custoUnit = (l: LinhaBase) => l.custo / l.entregas;
    const ordenadas = [...linhas].sort((a, b) => custoUnit(b) - custoUnit(a));
    const pior = ordenadas[0];
    const melhor = ordenadas[ordenadas.length - 1];
    const freteExtra = Math.max(0, melhor.frete_medio - pior.frete_medio);
    const economia = (custoUnit(pior) - custoUnit(melhor) - freteExtra) * pior.entregas;
    if (economia > 0 && pior.entregas >= 500) {
      acoes.push({
        titulo: `Trocar ${pior.transportadora} por ${melhor.transportadora} em ${pior.rota}`,
        detalhe: `${fmt(porMil(pior))} vs ${fmt(porMil(melhor))} ocorrências/mil · frete efetivo ${brl0(pior.frete_medio + custoUnit(pior))} vs ${brl0(melhor.frete_medio + custoUnit(melhor))} por entrega`,
        economia,
      });
    }
  }

  // Produto frágil: revisar embalagem (premissa: reduz 50% do custo).
  for (const a of agregar((l) => l.produto, base)) {
    if (a.porMil > 2 * totais(base).porMil) {
      acoes.push({
        titulo: `Revisar embalagem de ${a.chave}`,
        detalhe: `${fmt(a.porMil)} ocorrências/mil, mais que o dobro da média (${fmt(totais(base).porMil)})`,
        economia: a.custo * 0.5,
      });
    }
  }

  return acoes.sort((a, b) => b.economia - a.economia).slice(0, 3);
}

const porMil = (l: LinhaBase) => (l.ocorrencias / l.entregas) * 1000;
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const brl0 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
