import { useCallback, useEffect, useRef, useState } from 'react'
import { GeoJsonLayer } from '@deck.gl/layers'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Feature, Polygon } from 'geojson'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getFusionCell, getGfwBins } from '../api/gridApi'
import type {
  GfwSource,
  SarMatchFilter,
  SelectedMapCell,
} from '../types/grid'
import {
  getCellId,
  getFeatureBounds,
  getOutlineFeature,
  type GfwFeatureLike,
  type OutlineFeatureProperties,
} from './gfwFeatureUtils'
import { createGfwLayer, type LoadedGfwTile } from './gfwLayer'
import './MaritimeMap.css'

type MaritimeMapProps = {
  aisEnabled: boolean
  aisColor: string
  sarEnabled: boolean
  sarColor: string
  sarMatchFilter: SarMatchFilter
  selectedDate: string
  onSelectCell: (cell: SelectedMapCell) => void
  onGfwBinsChange: (
    source: GfwSource,
    bins: number[],
    tileZoom: number,
  ) => void
}

const GFW_MAX_TILE_ZOOM = 4
const GFW_MAX_CACHED_TILES = 64

export function MaritimeMap({
  aisEnabled,
  aisColor,
  sarEnabled,
  sarColor,
  sarMatchFilter,
  selectedDate,
  onSelectCell,
  onGfwBinsChange,
}: MaritimeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const latestSelectionRequestId = useRef(0)
  const selectionAbortController = useRef<AbortController | null>(null)
  const [cursorCoordinates, setCursorCoordinates] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [gfwTileZooms, setGfwTileZooms] = useState<
    Partial<Record<GfwSource, number>>
  >({})
  const [hoverFeature, setHoverFeature] =
    useState<Feature<Polygon, OutlineFeatureProperties> | null>(null)
  const [selectedFeature, setSelectedFeature] =
    useState<Feature<Polygon, OutlineFeatureProperties> | null>(null)

  const storeGfwTileStats = useCallback(
    (source: GfwSource, tile: LoadedGfwTile) => {
      const { z } = tile.index
      setGfwTileZooms((tileZooms) => ({ ...tileZooms, [source]: z }))
    },
    [],
  )

  const setMapCursor = useCallback((cursor: string) => {
    const canvas = mapRef.current?.getCanvas()

    if (canvas) {
      canvas.style.cursor = cursor
    }
  }, [])

  const selectGfwFeature = useCallback(
    async (source: GfwSource, feature: GfwFeatureLike) => {
      if (!feature.properties) {
        return
      }

      const requestId = latestSelectionRequestId.current + 1
      latestSelectionRequestId.current = requestId
      selectionAbortController.current?.abort()

      const abortController = new AbortController()
      selectionAbortController.current = abortController

      const cellId = getCellId(feature.properties)
      const bounds = getFeatureBounds(feature)

      if (cellId && bounds) {
        setSelectedFeature(getOutlineFeature(cellId, bounds))
      }

      if (!cellId) {
        onSelectCell({
          cellId: 'unknown',
          kind: 'gfw',
          primarySource: source,
          sources: {
            [source]: feature.properties,
          },
        })
        return
      }

      try {
        const includeSources: GfwSource[] = [
          ...(aisEnabled ? (['ais'] as const) : []),
          ...(sarEnabled ? (['sar'] as const) : []),
        ]
        const fusionCell = await getFusionCell(cellId, selectedDate, {
          includeSources,
          sarMatchFilter,
          signal: abortController.signal,
        })

        if (requestId !== latestSelectionRequestId.current) {
          return
        }

        onSelectCell({
          cellId: fusionCell.cellId,
          kind: 'gfw',
          primarySource: source,
          sources: fusionCell.sources,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        if (requestId !== latestSelectionRequestId.current) {
          return
        }

        console.error('Failed to load fused GFW cell', error)
        onSelectCell({
          cellId,
          kind: 'gfw',
          primarySource: source,
          sources: {
            [source]: feature.properties,
          },
        })
      }
    },
    [aisEnabled, onSelectCell, sarEnabled, sarMatchFilter, selectedDate],
  )

  useEffect(() => {
    let cancelled = false

    async function loadGfwBins(source: GfwSource, tileZoom: number) {
      try {
        const bins = await getGfwBins(source, tileZoom, selectedDate, {
          sarMatchFilter,
        })

        if (!cancelled) {
          onGfwBinsChange(source, bins, tileZoom)
        }
      } catch (error) {
        console.error(`Failed to load GFW ${source} bins`, error)
      }
    }

    if (aisEnabled && gfwTileZooms.ais !== undefined) {
      void loadGfwBins('ais', gfwTileZooms.ais)
    }

    if (sarEnabled && gfwTileZooms.sar !== undefined) {
      void loadGfwBins('sar', gfwTileZooms.sar)
    }

    return () => {
      cancelled = true
    }
  }, [
    aisEnabled,
    sarEnabled,
    gfwTileZooms.ais,
    gfwTileZooms.sar,
    sarMatchFilter,
    selectedDate,
    onGfwBinsChange,
  ])

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: '/styles/maritime-dark.json',
      center: [0, 20],
      zoom: 1.4,
    })
    mapRef.current = map

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
      setHoverFeature(null)
      map.getCanvas().style.cursor = ''
    })

    return () => {
      mapRef.current = null
      overlayRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const overlay = overlayRef.current

    if (!overlay) {
      return
    }

    const layers = [
      ...(aisEnabled
        ? [
            createGfwLayer({
              color: aisColor,
              maxCacheSize: GFW_MAX_CACHED_TILES,
              maxZoom: GFW_MAX_TILE_ZOOM,
              onHoverFeatureChange: setHoverFeature,
              onSelectFeature: (source, feature) => {
                void selectGfwFeature(source, feature)
              },
              onTileLoad: storeGfwTileStats,
              selectedDate,
              sarMatchFilter,
              setMapCursor,
              source: 'ais',
            }),
          ]
        : []),
      ...(sarEnabled
        ? [
            createGfwLayer({
              color: sarColor,
              maxCacheSize: GFW_MAX_CACHED_TILES,
              maxZoom: GFW_MAX_TILE_ZOOM,
              onHoverFeatureChange: setHoverFeature,
              onSelectFeature: (source, feature) => {
                void selectGfwFeature(source, feature)
              },
              onTileLoad: storeGfwTileStats,
              selectedDate,
              sarMatchFilter,
              setMapCursor,
              source: 'sar',
            }),
          ]
        : []),
      ...(hoverFeature
        ? [
            new GeoJsonLayer<OutlineFeatureProperties>({
              id: 'gfw-hover-outline',
              data: hoverFeature,
              filled: false,
              stroked: true,
              pickable: false,
              getLineColor: [255, 255, 255, 240],
              getLineWidth: 2.5,
              lineWidthUnits: 'pixels',
            }),
          ]
        : []),
      ...(selectedFeature && (aisEnabled || sarEnabled)
        ? [
            new GeoJsonLayer<OutlineFeatureProperties>({
              id: 'gfw-selected-outline',
              data: selectedFeature,
              filled: false,
              stroked: true,
              pickable: false,
              getLineColor: [255, 255, 255, 255],
              getLineWidth: 3.5,
              lineWidthUnits: 'pixels',
            }),
          ]
        : []),
    ]

    overlay.setProps({ layers })
  }, [
    aisColor,
    aisEnabled,
    sarColor,
    sarEnabled,
    hoverFeature,
    onGfwBinsChange,
    onSelectCell,
    sarMatchFilter,
    selectGfwFeature,
    selectedDate,
    selectedFeature,
    setMapCursor,
    storeGfwTileStats,
  ])

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
