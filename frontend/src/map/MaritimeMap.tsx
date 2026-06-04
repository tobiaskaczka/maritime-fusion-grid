import { useEffect, useRef, useState } from 'react'
import { GeoJsonLayer } from '@deck.gl/layers'
import { MapboxOverlay } from '@deck.gl/mapbox'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { aisGridCells } from '../fixtures/gridCells'
import type { GridCell, GridCellProperties } from '../types/grid'
import './MaritimeMap.css'

type MaritimeMapProps = {
  aisEnabled: boolean
  aisColor: string
  onSelectCell: (cell: GridCell) => void
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

export function MaritimeMap({
  aisEnabled,
  aisColor,
  onSelectCell,
}: MaritimeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const [cursorCoordinates, setCursorCoordinates] = useState<{
    latitude: number
    longitude: number
  } | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      //style: 'https://demotiles.maplibre.org/style.json',
      style: '/styles/maritime-dark.json',
      center: [0, 20],
      zoom: 1.4,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    const overlay = new MapboxOverlay({ interleaved: false, layers: [] })
    map.addControl(overlay)
    overlayRef.current = overlay

    map.on('mousemove', (event) => {
      setCursorCoordinates({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      })
    })

    map.getCanvas().addEventListener('mouseleave', () => {
      setCursorCoordinates(null)
    })

    return () => {
      overlayRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const overlay = overlayRef.current

    if (!overlay) {
      return
    }

    const [red, green, blue] = hexToRgb(aisColor)
    const layers = aisEnabled
      ? [
          new GeoJsonLayer<GridCellProperties>({
            id: 'ais-grid',
            data: aisGridCells,
            filled: true,
            stroked: true,
            pickable: true,
            getFillColor: (cell) => [
              red,
              green,
              blue,
              Math.round(35 + cell.properties.score * 190),
            ],
            getLineColor: [red, green, blue, 210],
            getLineWidth: 1,
            lineWidthUnits: 'pixels',
            onClick: ({ object }) => {
              if (object) {
                onSelectCell(object)
              }
            },
            updateTriggers: {
              getFillColor: aisColor,
              getLineColor: aisColor,
            },
          }),
        ]
      : []

    overlay.setProps({ layers })
  }, [aisColor, aisEnabled, onSelectCell])

  return (
    <div className="map-view">
      <div className="map-shell" ref={mapContainerRef} />
      {cursorCoordinates && (
        <div className="coordinate-readout">
          <span>LAT {cursorCoordinates.latitude.toFixed(4)}</span>
          <span>LON {cursorCoordinates.longitude.toFixed(4)}</span>
        </div>
      )}
    </div>
  )
}
