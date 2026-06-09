import type { FusionCell, GfwSource, SarMatchFilter } from '../types/grid'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(
  /\/$/,
  '',
)

type GfwConfigResponse = {
  dateRange?: {
    start?: string
    end?: string
  }
  sources?: Partial<
    Record<
      GfwSource,
      {
        interval?: string
        windowDays?: number
      }
    >
  >
}

type GfwBinsResponse = {
  entries?: number[][]
}

export type GfwConfig = {
  dateRange: {
    start: string
    end: string
  }
  sources: Partial<
    Record<
      GfwSource,
      {
        interval: string
        windowDays?: number
      }
    >
  >
}

type GfwRequestOptions = {
  includeSources?: GfwSource[]
  sarMatchFilter?: SarMatchFilter
  signal?: AbortSignal
}

function getGfwSearchParams(
  source: GfwSource,
  selectedDate: string,
  options: GfwRequestOptions = {},
) {
  const params = new URLSearchParams({
    date: selectedDate,
  })

  if (source === 'sar' && options.sarMatchFilter) {
    params.set('matched', options.sarMatchFilter)
  }

  return params
}

export function getGfwTileTemplate(
  source: GfwSource,
  selectedDate: string,
  options: GfwRequestOptions = {},
) {
  const params = getGfwSearchParams(source, selectedDate, options)

  return `${API_BASE_URL}/gfw/${source}/tiles/{z}/{x}/{y}.mvt?${params}`
}

export async function getGfwConfig(): Promise<GfwConfig> {
  const response = await fetch(`${API_BASE_URL}/gfw/config`)

  if (!response.ok) {
    throw new Error(`GFW config request failed: ${response.status}`)
  }

  const config = (await response.json()) as GfwConfigResponse
  const start = config.dateRange?.start
  const end = config.dateRange?.end

  if (!start || !end) {
    throw new Error('GFW config response is missing dateRange.')
  }

  const sources: GfwConfig['sources'] = {}

  if (config.sources?.ais?.interval) {
    sources.ais = {
      interval: config.sources.ais.interval,
      windowDays: config.sources.ais.windowDays,
    }
  }

  if (config.sources?.sar?.interval) {
    sources.sar = {
      interval: config.sources.sar.interval,
      windowDays: config.sources.sar.windowDays,
    }
  }

  return {
    dateRange: { start, end },
    sources,
  }
}

export async function getGfwBins(
  source: GfwSource,
  z: number,
  selectedDate: string,
  options: GfwRequestOptions = {},
) {
  const params = getGfwSearchParams(source, selectedDate, options)
  const response = await fetch(
    `${API_BASE_URL}/gfw/${source}/bins/${z}?${params}`,
  )

  if (!response.ok) {
    throw new Error(`GFW ${source} bins request failed: ${response.status}`)
  }

  const bins = (await response.json()) as GfwBinsResponse

  return bins.entries?.[0] ?? []
}

export async function getFusionCell(
  cellId: string,
  selectedDate: string,
  options: GfwRequestOptions = {},
): Promise<FusionCell> {
  const [z, x, y, cell] = cellId.split('/')

  if (!z || !x || !y || !cell) {
    throw new Error(`Invalid GFW cell id: ${cellId}`)
  }

  const params = getGfwSearchParams('sar', selectedDate, options)
  options.includeSources?.forEach((source) => params.append('include', source))
  const response = await fetch(
    `${API_BASE_URL}/gfw/fusion/cells/${z}/${x}/${y}/${cell}?${params}`,
    { signal: options.signal },
  )

  if (!response.ok) {
    throw new Error(`GFW fusion cell request failed: ${response.status}`)
  }

  return response.json() as Promise<FusionCell>
}
