import { useEffect, useState } from 'react'
import { getGridCells } from './api/gridApi'
import { LayerControl } from './components/LayerControl'
import { MaritimeMap } from './map/MaritimeMap'
import type { GridCell, GridSource } from './types/grid'

type ApiGridSource = Extract<GridSource, 'ais' | 'night-lights'>
type GridStatus = 'loading' | 'ready' | 'error'

const SOURCE_LABELS: Record<GridSource, string> = {
  ais: 'AIS',
  'night-lights': 'Night lights',
  radar: 'SAR / radar',
}

export default function App() {
  const [aisEnabled, setAisEnabled] = useState(false)
  const [aisColor, setAisColor] = useState('#38bdf8')
  const [nightLightsEnabled, setNightLightsEnabled] = useState(false)
  const [nightLightsColor, setNightLightsColor] = useState('#f5df00')
  const [radarEnabled, setRadarEnabled] = useState(false)
  const [radarColor, setRadarColor] = useState('#c084fc')
  const [aisGridCells, setAisGridCells] = useState<GridCell[]>([])
  const [nightLightsGridCells, setNightLightsGridCells] = useState<GridCell[]>(
    [],
  )
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null)
  const [gridStatuses, setGridStatuses] = useState<
    Record<ApiGridSource, GridStatus>
  >({
    ais: 'loading',
    'night-lights': 'loading',
  })
  const activeGridStatuses = [
    aisEnabled ? gridStatuses.ais : null,
    nightLightsEnabled ? gridStatuses['night-lights'] : null,
  ].filter((status): status is GridStatus => status !== null)
  const activeGridStatus: GridStatus = activeGridStatuses.includes('error')
    ? 'error'
    : activeGridStatuses.includes('loading')
      ? 'loading'
      : 'ready'

  async function loadGridLayer(source: ApiGridSource, cancelled = false) {
    setGridStatuses((statuses) => ({ ...statuses, [source]: 'loading' }))

    try {
      const cells = await getGridCells(source)

      if (!cancelled) {
        if (source === 'ais') {
          setAisGridCells(cells)
        } else {
          setNightLightsGridCells(cells)
        }

        setGridStatuses((statuses) => ({ ...statuses, [source]: 'ready' }))
      }
    } catch (error: unknown) {
      if (!cancelled) {
        console.error(`Failed to load ${source} grid cells`, error)
        setGridStatuses((statuses) => ({ ...statuses, [source]: 'error' }))
      }
    }
  }

  function retryActiveGridLayers() {
    if (aisEnabled) {
      void loadGridLayer('ais')
    }

    if (nightLightsEnabled) {
      void loadGridLayer('night-lights')
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadInitialGridLayer(source: ApiGridSource) {
      try {
        const cells = await getGridCells(source)

        if (!cancelled) {
          if (source === 'ais') {
            setAisGridCells(cells)
          } else {
            setNightLightsGridCells(cells)
          }

          setGridStatuses((statuses) => ({ ...statuses, [source]: 'ready' }))
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error(`Failed to load ${source} grid cells`, error)
          setGridStatuses((statuses) => ({ ...statuses, [source]: 'error' }))
        }
      }
    }

    void loadInitialGridLayer('ais')
    void loadInitialGridLayer('night-lights')

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="app-shell">
      <aside className="layer-panel" aria-label="Map layers">
        <div>
          <p className="eyebrow">Maritime Fusion Grid</p>
          <h1>Source Layers</h1>
        </div>

        <div className="layer-group">
          <LayerControl
            name="AIS activity"
            unit="positions / 8,000 km2"
            enabled={aisEnabled}
            onToggle={() => setAisEnabled((enabled) => !enabled)}
            color={aisColor}
            values={['1', '10', '25', '50', '100+']}
            onColorChange={setAisColor}
          />
          <LayerControl
            name="Night light detections"
            unit="detections / 8,000 km2"
            enabled={nightLightsEnabled}
            onToggle={() => setNightLightsEnabled((enabled) => !enabled)}
            color={nightLightsColor}
            values={['1', '10', '25', '50', '100+']}
            onColorChange={setNightLightsColor}
          />
          <LayerControl
            name="SAR / radar detections"
            unit="detections / 8,000 km2"
            enabled={radarEnabled}
            onToggle={() => setRadarEnabled((enabled) => !enabled)}
            color={radarColor}
            values={['1', '10', '25', '50', '100+']}
            onColorChange={setRadarColor}
          />
        </div>
      </aside>

      <section className="map-region" aria-label="Global maritime activity map">
        <MaritimeMap
          aisEnabled={aisEnabled}
          aisColor={aisColor}
          aisGridCells={aisGridCells}
          nightLightsEnabled={nightLightsEnabled}
          nightLightsColor={nightLightsColor}
          nightLightsGridCells={nightLightsGridCells}
          onSelectCell={setSelectedCell}
        />
        {activeGridStatuses.length > 0 && activeGridStatus !== 'ready' && (
          <div
            className={`grid-status grid-status--${activeGridStatus}`}
            role={activeGridStatus === 'error' ? 'alert' : 'status'}
          >
            <span>
              {activeGridStatus === 'loading'
                ? 'Loading grid layers...'
                : 'Unable to load grid layers.'}
            </span>
            {activeGridStatus === 'error' && (
              <button onClick={retryActiveGridLayers} type="button">
                Retry
              </button>
            )}
          </div>
        )}
      </section>

      <aside className="details-panel" aria-label="Selected cell details">
        <p className="eyebrow">Selection</p>
        {selectedCell ? (
          <>
            <h2>{selectedCell.properties.id}</h2>
            <dl className="cell-details">
              <div>
                <dt>Source</dt>
                <dd>{SOURCE_LABELS[selectedCell.properties.source]}</dd>
              </div>
              <div>
                <dt>Activity score</dt>
                <dd>{Math.round(selectedCell.properties.score * 100)}%</dd>
              </div>
              <div>
                <dt>Detections</dt>
                <dd>{selectedCell.properties.detectionCount}</dd>
              </div>
            </dl>
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
