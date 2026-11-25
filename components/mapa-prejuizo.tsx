'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import { Loader2 } from 'lucide-react'
import type { GeoJSONSource, Map } from 'maplibre-gl'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { EVENTO_ATUALIZAR } from '@/components/fila-ao-vivo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const INTERVALO_MS = 5000
const LIMITE_CARREGANDO_MS = 10_000
const ESTILO = 'https://tiles.openfreemap.org/styles/positron'
const PREJUIZO_DE_PESO_MAXIMO = 50_000
const SUDESTE: [number, number] = [-46, -21.5]
const ZOOM_DO_CASO = 11
const ESCALA: [number, string][] = [
  [0.1, 'rgb(34,197,94)'],
  [0.35, 'rgb(190,220,40)'],
  [0.55, 'rgb(250,204,21)'],
  [0.75, 'rgb(249,115,22)'],
  [1, 'rgb(220,38,38)'],
]
const GRADIENTE = `linear-gradient(to right, ${ESCALA.map(([ponto, cor]) => `${cor} ${ponto * 100}%`).join(', ')})`
const SEM_PONTOS: Pontos = { type: 'FeatureCollection', features: [] }

type Pontos = GeoJSON.FeatureCollection<GeoJSON.Point>

async function buscarPontos() {
  const resposta = await fetch('/api/mapa', { cache: 'no-store' }).catch(() => null)
  return resposta?.ok ? ((await resposta.json()) as Pontos) : null
}

export function MapaPrejuizo() {
  const container = useRef<HTMLDivElement>(null)
  const mapa = useRef<Map | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [pronto, setPronto] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const [casoAusente, setCasoAusente] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const casoEmFoco = useSearchParams().get('caso')

  useEffect(() => {
    let ativo = true
    let intervalo: ReturnType<typeof setInterval> | undefined
    let carregado = false
    const pontosIniciais = buscarPontos()
    const limite = setTimeout(() => setPronto(true), LIMITE_CARREGANDO_MS)
    if (casoEmFoco) container.current?.scrollIntoView({ block: 'center' })

    const atualizar = async () => {
      const pontos = await buscarPontos()
      if (!ativo || !pontos) return
      setTotal(pontos.features.length)
      if (carregado && mapa.current) (mapa.current.getSource('incidentes') as GeoJSONSource).setData(pontos)
    }

    const falharCarregamento = () => {
      if (!ativo) return
      setFalhou(true)
      setPronto(true)
    }

    import('maplibre-gl').then((maplibre) => {
      maplibre.setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString())
      if (!ativo || !container.current) return
      const instancia = new maplibre.Map({ container: container.current, style: ESTILO, center: SUDESTE, zoom: 5.3 })
      mapa.current = instancia
      instancia.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right')
      instancia.on('error', () => {
        if (!carregado) falharCarregamento()
      })
      instancia.on('load', async () => {
        const pontos = (await pontosIniciais) ?? SEM_PONTOS
        if (!ativo) return
        setFalhou(false)
        setTotal(pontos.features.length)
        const alvo = pontos.features.find((ponto) => ponto.properties?.id === casoEmFoco)
        setCasoAusente(Boolean(casoEmFoco) && !alvo)
        if (alvo) instancia.jumpTo({ center: alvo.geometry.coordinates as [number, number], zoom: ZOOM_DO_CASO })
        instancia.addSource('incidentes', { type: 'geojson', data: pontos })
        instancia.addLayer({
          id: 'calor',
          type: 'heatmap',
          source: 'incidentes',
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'prejuizo'], 0, 0.4, PREJUIZO_DE_PESO_MAXIMO, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 10, 2.5],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 14, 6, 28, 10, 60],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.9, 12, 0.5],
            'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(34,197,94,0)', ...ESCALA.flat()],
          },
        })
        instancia.addLayer({
          id: 'pontos',
          type: 'circle',
          source: 'incidentes',
          minzoom: 9,
          paint: {
            'circle-radius': 5,
            'circle-color': 'rgb(185,28,28)',
            'circle-stroke-color': 'white',
            'circle-stroke-width': 1.5,
          },
        })
        if (casoEmFoco) {
          instancia.addLayer({
            id: 'caso-em-foco',
            type: 'circle',
            source: 'incidentes',
            filter: ['==', ['get', 'id'], casoEmFoco],
            paint: {
              'circle-radius': 9,
              'circle-color': 'rgb(37,99,235)',
              'circle-stroke-color': 'white',
              'circle-stroke-width': 2.5,
            },
          })
        }
        carregado = true
        setPronto(true)
        intervalo = setInterval(atualizar, INTERVALO_MS)
      })
    }).catch(falharCarregamento)

    window.addEventListener(EVENTO_ATUALIZAR, atualizar)
    return () => {
      ativo = false
      clearTimeout(limite)
      clearInterval(intervalo)
      window.removeEventListener(EVENTO_ATUALIZAR, atualizar)
      mapa.current?.remove()
      mapa.current = null
    }
  }, [casoEmFoco, tentativa])

  const tentarNovamente = () => {
    setFalhou(false)
    setPronto(false)
    setTotal(null)
    setTentativa((atual) => atual + 1)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="border-border relative h-[420px] w-full overflow-hidden rounded-md border">
        <div ref={container} className="size-full" />
        <div
          className={cn(
            'bg-muted/60 absolute inset-0 flex flex-col items-center justify-center gap-2 backdrop-blur-sm transition-opacity duration-500',
            pronto ? 'pointer-events-none opacity-0' : 'opacity-100',
          )}
          role="status"
          aria-hidden={pronto}
        >
          <Loader2 className="text-primary size-6 animate-spin" />
          <span className="text-muted-foreground text-sm">Carregando mapa de calor…</span>
        </div>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          {falhou
            ? 'Não foi possível carregar o mapa.'
            : total === null
              ? 'Carregando ocorrências…'
              : `${total} ocorrências no mapa`}
          {casoAusente && ` · Caso ${casoEmFoco} não encontrado`}
          {falhou && (
            <Button variant="outline" size="xs" className="ml-2" onClick={tentarNovamente}>
              Tentar novamente
            </Button>
          )}
        </span>
        <span className="flex items-center gap-2">
          Menos
          <span className="h-2 w-32 rounded-full" style={{ background: GRADIENTE }} />
          Mais ocorrências e prejuízo
        </span>
      </div>
    </div>
  )
}
