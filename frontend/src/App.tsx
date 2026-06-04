import { useEffect, useState } from 'react'
import { getGridCells } from './api/gridApi'
import { LayerControl } from './components/LayerControl'
import { MaritimeMap } from './map/MaritimeMap'
import type { GridCell } from './types/grid'

export default function App() {
  const [aisEnabled, setAisEnabled] = useState(true)
  const [aisColor, setAisColor] = useState('#38bdf8')
  const [nightLightsEnabled, setNightLightsEnabled] = useState(false)
  const [nightLightsColor, setNightLightsColor] = useState('#f5df00')
  const [radarEnabled, setRadarEnabled] = useState(false)
  const [radarColor, setRadarColor] = useState('#c084fc')
  const [aisGridCells, setAisGridCells] = useState<GridCell[]>([])
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null)
  const [gridStatus, setGridStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )

  async function retryAisGrid() {
    setGridStatus('loading')

    try {
      const cells = await getGridCells('ais')
      setAisGridCells(cells)
      setGridStatus('ready')
    } catch (error: unknown) {
      console.error('Failed to load AIS grid cells', error)
      setGridStatus('error')
    }
  }

  useEffect(() => {
    let cancelled = false

    getGridCells('ais')
      .then((cells) => {
        if (!cancelled) {
          setAisGridCells(cells)
          setGridStatus('ready')
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error('Failed to load AIS grid cells', error)
          setGridStatus('error')
        }
      })

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
          onSelectCell={setSelectedCell}
        />
        {gridStatus !== 'ready' && (
          <div
            className={`grid-status grid-status--${gridStatus}`}
            role={gridStatus === 'error' ? 'alert' : 'status'}
          >
            <span>
              {gridStatus === 'loading'
                ? 'Loading AIS grid...'
                : 'Unable to load AIS grid.'}
            </span>
            {gridStatus === 'error' && (
              <button onClick={() => void retryAisGrid()} type="button">
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
                <dd>AIS</dd>
              </div>
              <div>
                <dt>Activity score</dt>
                <dd>{Math.round(selectedCell.properties.score * 100)}%</dd>
              </div>
              <div>
                <dt>Positions</dt>
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
