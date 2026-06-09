import { useEffect, useState } from 'react'
import { getGfwConfig } from './api/gridApi'
import { LayerControl } from './components/LayerControl'
import { TimelineControl } from './components/TimelineControl'
import { MaritimeMap } from './map/MaritimeMap'
import type {
  FusionReviewArea,
  FusionReviewAreaProperties,
  GfwSource,
  SarMatchFilter,
  SelectedMapCell,
} from './types/grid'

const EMPTY_AIS_BINS: number[] = []
const EMPTY_SAR_BINS: number[] = []
const FUSION_LEGEND_VALUES = ['Low', 'Medium', 'High']
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

const FUSION_ASSESSMENT_LABELS: Record<string, string> = {
  'no-assessment': 'No assessment',
  'corroborated-activity': 'Corroborated vessel activity',
  'unmatched-sar-area': 'Unmatched radar activity',
  'isolated-dark-cue': 'Dark vessel cue',
  'fleet-shadow-cue': 'Mixed activity cue',
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

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
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

function FusionDetails({
  properties,
}: {
  properties: FusionReviewAreaProperties
}) {
  return (
    <section className="source-details fusion-details">
      <h3>
        {FUSION_ASSESSMENT_LABELS[properties.assessment] ??
          properties.assessment}
      </h3>
      <dl className="cell-details">
        <div>
          <dt>Priority</dt>
          <dd>{properties.priority}</dd>
        </div>
        <div>
          <dt>Priority score</dt>
          <dd>{properties.priorityScore}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{properties.confidence}</dd>
        </div>
        <div>
          <dt>Analysis window</dt>
          <dd>
            {properties.analysisStartDate} to {properties.analysisEndDate}
          </dd>
        </div>
        <div>
          <dt>Fishing AIS hours</dt>
          <dd>{formatNumber(properties.fishingAisHours)}</dd>
        </div>
        <div>
          <dt>SAR matched</dt>
          <dd>{formatNumber(properties.sarMatchedDetections)}</dd>
        </div>
        <div>
          <dt>SAR unmatched</dt>
          <dd>{formatNumber(properties.sarUnmatchedDetections)}</dd>
        </div>
        <div>
          <dt>Unmatched ratio</dt>
          <dd>{formatPercent(properties.unmatchedRatio)}</dd>
        </div>
      </dl>

      <div className="fusion-notes">
        <h4>Reasons</h4>
        <ul>
          {properties.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <div className="fusion-notes">
        <h4>Caveats</h4>
        <ul>
          {properties.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default function App() {
  const [aisEnabled, setAisEnabled] = useState(false)
  const [aisColor, setAisColor] = useState('#f45bc4')
  const [radarEnabled, setRadarEnabled] = useState(false)
  const [radarColor, setRadarColor] = useState('#f5df00')
  const [fusionEnabled, setFusionEnabled] = useState(false)
  const [fusionColor, setFusionColor] = useState('#ff5544')
  const [fusionAreas, setFusionAreas] = useState<FusionReviewArea[]>([])
  const [fusionRefreshKey, setFusionRefreshKey] = useState(0)
  const [selectedFusionArea, setSelectedFusionArea] =
    useState<FusionReviewArea | null>(null)
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

  // Fusion depends on both source families, so it keeps the timeline active
  // even when the raw AIS/SAR layers are hidden.
  const activeTimelineSources = Array.from(new Set([
    aisEnabled ? 'ais' : null,
    radarEnabled ? 'sar' : null,
    fusionEnabled ? 'ais' : null,
    fusionEnabled ? 'sar' : null,
  ].filter((source): source is GfwSource => source !== null)))

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

  function selectMapCell(cell: SelectedMapCell) {
    setSelectedCell(cell)
    setSelectedFusionArea(null)
  }

  function selectFusionArea(area: FusionReviewArea) {
    setSelectedFusionArea(area)
    setSelectedCell({
      cellId: area.cellId,
      kind: 'fusion',
      fusion: area.properties,
    })
  }

  function updateSelectedDate(date: string) {
    setSelectedDate(date)

    if (selectedCell?.kind === 'fusion') {
      setSelectedCell(null)
      setSelectedFusionArea(null)
    }
  }

  function refreshFusionAreas() {
    // Force deck.gl to rebuild Fusion tiles for the current viewport without
    // requiring the user to toggle the layer off and on.
    setFusionAreas([])
    setFusionRefreshKey((refreshKey) => refreshKey + 1)
  }

  const topFusionScore = fusionAreas[0]?.properties.priorityScore ?? null

  return (
    <main className="app-shell">
      <aside className="layer-panel" aria-label="Map layers">
        <div className="product-header">
          <div className="product-header__identity">
            <img
              alt=""
              aria-hidden="true"
              className="product-header__mark"
              src="/favicon.svg"
            />
            <div>
              <p className="eyebrow">Maritime Fusion Grid</p>
              <h1>Analyst Map</h1>
              <a
                className="product-header__repo-link"
                href="https://github.com/tobiaskaczka/maritime-fusion-grid"
                rel="noreferrer"
                target="_blank"
              >
                Source code
              </a>
            </div>
          </div>
        </div>

        <div className="panel-section-header">
          <h2>Source Layers</h2>
        </div>

        <div className="layer-group">
          <LayerControl
            name="Fishing effort (AIS)"
              unit={
                aisTileZoom === null
                  ? 'fishing hours / 7-day grid'
                  : 'fishing hours / 7-day grid'
              }
            enabled={aisEnabled}
            onToggle={() => setAisEnabled((enabled) => !enabled)}
            color={aisColor}
            values={formatBinsLegendValues(aisBins)}
            onColorChange={setAisColor}
          >
            <p className="layer-control__description">
              Cooperative AIS-derived fishing activity, used as baseline
              maritime context.
            </p>
          </LayerControl>
          <LayerControl
            name="Vessel Detections (SAR)"
              unit={
                sarTileZoom === null
                  ? 'detections / 7-day grid'
                  : 'detections / 7-day grid'
              }
            enabled={radarEnabled}
            onToggle={() => setRadarEnabled((enabled) => !enabled)}
            color={radarColor}
            values={formatBinsLegendValues(sarBins)}
            onColorChange={setRadarColor}
          >
            <p className="layer-control__description">
              Radar-observed vessel detections from SAR imagery. Use the match
              filter to separate detections associated with AIS from those that
              are not.
            </p>
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
            <p className="layer-control__description">
              Matched means the SAR detection is associated with AIS. Unmatched
              means no AIS match was identified.
            </p>
          </LayerControl>
        </div>

        <section className="fusion-module" aria-label="Fusion review areas">
          <div className="fusion-module__header">
            <div>
              <p className="fusion-module__eyebrow">Derived Intelligence</p>
              <h2>Fusion Review</h2>
            </div>
            <div className="fusion-module__score">
              <span>Top</span>
              <strong>{topFusionScore ?? '-'}</strong>
            </div>
          </div>

          <LayerControl
            name="Fusion Review Areas"
            unit="priority score / 7-day review grid"
            enabled={fusionEnabled}
            onToggle={() => setFusionEnabled((enabled) => !enabled)}
            color={fusionColor}
            values={FUSION_LEGEND_VALUES}
            onColorChange={setFusionColor}
          >
            <p className="layer-control__description">
              Derived priority review areas where SAR activity is not strongly
              explained by cooperative fishing activity.
            </p>
            <div className="fusion-module__actions">
              <button
                className="layer-control__action"
                onClick={refreshFusionAreas}
                type="button"
              >
                Refresh review areas
              </button>
              <span>{fusionAreas.length} loaded</span>
            </div>
          </LayerControl>

          {fusionEnabled && (
            <section className="review-queue" aria-label="Fusion review queue">
              <h2>Priority Queue</h2>
              {fusionAreas.length > 0 ? (
                <ol>
                  {fusionAreas.map((area) => (
                    <li key={area.cellId}>
                      <button
                        aria-current={
                          selectedCell?.kind === 'fusion' &&
                          selectedCell.cellId === area.cellId
                            ? 'true'
                            : undefined
                        }
                        onClick={() => selectFusionArea(area)}
                        type="button"
                      >
                        <span>
                          {FUSION_ASSESSMENT_LABELS[
                            area.properties.assessment
                          ] ?? area.properties.assessment}
                        </span>
                        <strong>{area.properties.priorityScore}</strong>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No loaded review areas in view.</p>
              )}
            </section>
          )}
        </section>
      </aside>

      <section className="map-region" aria-label="Global maritime activity map">
        <MaritimeMap
          aisEnabled={aisEnabled}
          aisColor={aisColor}
          sarEnabled={radarEnabled}
          sarColor={radarColor}
          sarMatchFilter={sarMatchFilter}
          fusionEnabled={fusionEnabled}
          fusionColor={fusionColor}
          fusionRefreshKey={fusionRefreshKey}
          selectedFusionArea={selectedFusionArea}
          selectedDate={selectedDate}
          onSelectCell={selectMapCell}
          onFusionAreasChange={setFusionAreas}
          onGfwBinsChange={updateGfwBins}
        />
        <TimelineControl
          activeSources={activeTimelineSources}
          dates={timelineDates}
          selectedDate={selectedDate}
          onDateChange={updateSelectedDate}
        />
      </section>

      <aside className="details-panel" aria-label="Selected cell details">
        <p className="eyebrow">Selection</p>
        {selectedCell ? (
          <>
            <h2>
              {selectedCell.kind === 'fusion'
                ? 'Fusion Review Area'
                : selectedCell.sources.ais && selectedCell.sources.sar
                  ? 'Overlapping source cell'
                  : `${SOURCE_LABELS[selectedCell.primarySource]} cell`}
            </h2>
            <p className="selection-id">{selectedCell.cellId}</p>
            {selectedCell.kind === 'fusion' ? (
              <FusionDetails properties={selectedCell.fusion} />
            ) : (
              <>
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
