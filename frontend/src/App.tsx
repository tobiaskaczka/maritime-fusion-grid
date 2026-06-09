import { useEffect, useState } from 'react'
import { getGfwConfig } from './api/gridApi'
import { LayerControl } from './components/LayerControl'
import { TimelineControl } from './components/TimelineControl'
import { MaritimeMap } from './map/MaritimeMap'
import type {
  GfwSource,
  SarMatchFilter,
  SelectedMapCell,
} from './types/grid'

const EMPTY_AIS_BINS: number[] = []
const EMPTY_SAR_BINS: number[] = []
const SAR_MATCH_FILTERS: Array<{
  label: string
  value: SarMatchFilter
}> = [
  { label: 'All', value: 'all' },
  { label: 'Matched', value: 'matched' },
  { label: 'Unmatched', value: 'unmatched' },
]

const SOURCE_LABELS: Record<GfwSource, string> = {
  ais: 'Fishing effort',
  sar: 'SAR vessel detections',
}

const FALLBACK_TIMELINE_START_DATE = '2026-01-01'
const FALLBACK_TIMELINE_END_DATE = '2026-06-01'

function buildDateSeries(startDate: string, endDate: string) {
  const dates: string[] = []
  const currentDate = new Date(`${startDate}T00:00:00Z`)
  const finalDate = new Date(`${endDate}T00:00:00Z`)

  while (currentDate <= finalDate) {
    dates.push(currentDate.toISOString().slice(0, 10))
    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
  }

  return dates
}

const FALLBACK_TIMELINE_DATES = buildDateSeries(
  FALLBACK_TIMELINE_START_DATE,
  FALLBACK_TIMELINE_END_DATE,
)

function formatCount(value: number) {
  if (value >= 1_000_000) {
    return `${Number.parseFloat((value / 1_000_000).toFixed(1))}M`
  }

  if (value >= 1_000) {
    return `${Number.parseFloat((value / 1_000).toFixed(1))}K`
  }

  return String(value)
}

function formatBinsLegendValues(bins: number[]) {
  if (bins.length === 0) {
    return ['-', '-', '-', '-', '-']
  }

  const lastIndex = bins.length - 1
  const displayBins =
    bins.length >= 9
      ? [bins[1], bins[3], bins[5], bins[7], bins[8]]
      : [
          bins[Math.min(1, lastIndex)],
          bins[Math.round(lastIndex * 0.35)],
          bins[Math.round(lastIndex * 0.55)],
          bins[Math.round(lastIndex * 0.8)],
          bins[lastIndex],
        ]

  return displayBins.map((value, index) => {
    const formattedValue = formatCount(Math.max(0, Math.round(value)))

    return index === displayBins.length - 1
      ? `>=${formattedValue}`
      : formattedValue
  })
}

function formatPropertyValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }

  if (typeof value === 'string') {
    return value
  }

  if (value === null || value === undefined) {
    return '-'
  }

  return JSON.stringify(value)
}

function SourceDetails({
  properties,
  source,
}: {
  properties: Record<string, unknown>
  source: GfwSource
}) {
  return (
    <section className="source-details">
      <h3>{SOURCE_LABELS[source]}</h3>
      <dl className="cell-details">
        {Object.entries(properties)
          .slice(0, 8)
          .map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{formatPropertyValue(value)}</dd>
            </div>
          ))}
      </dl>
    </section>
  )
}

export default function App() {
  const [aisEnabled, setAisEnabled] = useState(false)
  const [aisColor, setAisColor] = useState('#f45bc4')
  const [radarEnabled, setRadarEnabled] = useState(false)
  const [radarColor, setRadarColor] = useState('#f5df00')
  const [sarMatchFilter, setSarMatchFilter] =
    useState<SarMatchFilter>('all')
  const [selectedCell, setSelectedCell] = useState<SelectedMapCell | null>(null)
  const [aisBins, setAisBins] = useState(EMPTY_AIS_BINS)
  const [aisTileZoom, setAisTileZoom] = useState<number | null>(null)
  const [sarBins, setSarBins] = useState(EMPTY_SAR_BINS)
  const [sarTileZoom, setSarTileZoom] = useState<number | null>(null)
  const [timelineDates, setTimelineDates] = useState(FALLBACK_TIMELINE_DATES)
  const [selectedDate, setSelectedDate] = useState(
    FALLBACK_TIMELINE_START_DATE,
  )
  const activeTimelineSources = [
    aisEnabled ? 'ais' : null,
    radarEnabled ? 'sar' : null,
  ].filter((source): source is GfwSource => source !== null)

  useEffect(() => {
    let ignoreResult = false

    async function loadGfwConfig() {
      try {
        const config = await getGfwConfig()
        const configuredDates = buildDateSeries(config.dateRange.start, config.dateRange.end)

        if (ignoreResult || configuredDates.length === 0) {
          return
        }

        setTimelineDates(configuredDates)
        setSelectedDate((currentDate) =>
          configuredDates.includes(currentDate)
            ? currentDate
            : configuredDates[0],
        )
      } catch (error) {
        console.error('Failed to load GFW timeline config', error)
      }
    }

    void loadGfwConfig()

    return () => {
      ignoreResult = true
    }
  }, [])

  function updateGfwBins(source: GfwSource, bins: number[], tileZoom: number) {
    if (source === 'ais') {
      setAisBins(bins)
      setAisTileZoom(tileZoom)
    } else {
      setSarBins(bins)
      setSarTileZoom(tileZoom)
    }
  }

  return (
    <main className="app-shell">
      <aside className="layer-panel" aria-label="Map layers">
        <div>
          <p className="eyebrow">Maritime Fusion Grid</p>
          <h1>Source Layers</h1>
        </div>

        <div className="layer-group">
          <LayerControl
            name="Fishing effort"
            unit={
              aisTileZoom === null
                ? 'fishing hours / 7-day GFW grid'
                : `fishing hours / 7-day GFW grid z${aisTileZoom}`
            }
            enabled={aisEnabled}
            onToggle={() => setAisEnabled((enabled) => !enabled)}
            color={aisColor}
            values={formatBinsLegendValues(aisBins)}
            onColorChange={setAisColor}
          />
          <LayerControl
            name="SAR vessel detections"
            unit={
              sarTileZoom === null
                ? 'detections / 7-day GFW grid'
                : `detections / 7-day GFW grid z${sarTileZoom}`
            }
            enabled={radarEnabled}
            onToggle={() => setRadarEnabled((enabled) => !enabled)}
            color={radarColor}
            values={formatBinsLegendValues(sarBins)}
            onColorChange={setRadarColor}
          >
            <div className="layer-control__segmented" aria-label="SAR match filter">
              {SAR_MATCH_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  aria-pressed={sarMatchFilter === filter.value}
                  onClick={() => setSarMatchFilter(filter.value)}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </LayerControl>
        </div>
      </aside>

      <section className="map-region" aria-label="Global maritime activity map">
        <MaritimeMap
          aisEnabled={aisEnabled}
          aisColor={aisColor}
          sarEnabled={radarEnabled}
          sarColor={radarColor}
          sarMatchFilter={sarMatchFilter}
          selectedDate={selectedDate}
          onSelectCell={setSelectedCell}
          onGfwBinsChange={updateGfwBins}
        />
        <TimelineControl
          activeSources={activeTimelineSources}
          dates={timelineDates}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />
      </section>

      <aside className="details-panel" aria-label="Selected cell details">
        <p className="eyebrow">Selection</p>
        {selectedCell ? (
          <>
            <h2>
              {selectedCell.sources.ais && selectedCell.sources.sar
                ? 'Overlapping GFW cell'
                : `${SOURCE_LABELS[selectedCell.primarySource]} cell`}
            </h2>
            <p className="selection-id">{selectedCell.cellId}</p>
            {selectedCell.sources.ais && (
              <SourceDetails
                properties={selectedCell.sources.ais}
                source="ais"
              />
            )}
            {selectedCell.sources.sar && (
              <SourceDetails
                properties={selectedCell.sources.sar}
                source="sar"
              />
            )}
          </>
        ) : (
          <>
            <h2>No cell selected</h2>
            <p>
              Click a grid cell to inspect source contributions, detections,
              and evidence notes.
            </p>
          </>
        )}
      </aside>
    </main>
  )
}
