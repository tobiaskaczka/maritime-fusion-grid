import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GeoJsonLayer } from '@deck.gl/layers'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Feature, Polygon } from 'geojson'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getFusionCell, getGfwBins } from '../api/gridApi'
import type {
  FusionReviewArea,
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
import {
  createFusionLayer,
  type FusionFeature,
  type LoadedFusionTile,
} from './fusionLayer'
import { createGfwLayer, type LoadedGfwTile } from './gfwLayer'
import './MaritimeMap.css'

type MaritimeMapProps = {
  aisEnabled: boolean
  aisColor: string
  sarEnabled: boolean
  sarColor: string
  sarMatchFilter: SarMatchFilter
  fusionEnabled: boolean
  fusionColor: string
  fusionRefreshKey: number
  selectedFusionArea: FusionReviewArea | null
  selectedDate: string
  onSelectCell: (cell: SelectedMapCell) => void
  onFusionAreasChange: (areas: FusionReviewArea[]) => void
  onGfwBinsChange: (
    source: GfwSource,
    bins: number[],
    tileZoom: number,
  ) => void
}

const GFW_MAX_TILE_ZOOM = 4
const GFW_MAX_CACHED_TILES = 64
const MAP_MIN_ZOOM = 1.05

export function MaritimeMap({
  aisEnabled,
  aisColor,
  sarEnabled,
  sarColor,
  sarMatchFilter,
  fusionEnabled,
  fusionColor,
  fusionRefreshKey,
  selectedFusionArea,
  selectedDate,
  onSelectCell,
  onFusionAreasChange,
  onGfwBinsChange,
}: MaritimeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const fusionTileAreasRef = useRef<Map<string, FusionReviewArea[]>>(new Map())
  const activeDataLayerRef = useRef(false)
  const renderingIdleTimeoutRef = useRef<number | null>(null)

  // Fusion tile requests can overlap while scrubbing the timeline. Keep a small
  // request key so late responses from old dates do not repopulate the queue.
  const fusionRequestKeyRef = useRef(`${selectedDate}:${fusionRefreshKey}`)
  const latestSelectionRequestId = useRef(0)
  const selectionAbortController = useRef<AbortController | null>(null)
  const [cursorCoordinates, setCursorCoordinates] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [isMapRendering, setIsMapRendering] = useState(false)
  const [gfwTileZooms, setGfwTileZooms] = useState<
    Partial<Record<GfwSource, number>>
  >({})
  const [hoverFeature, setHoverFeature] =
    useState<Feature<Polygon, OutlineFeatureProperties> | null>(null)
  const [selectedFeature, setSelectedFeature] =
    useState<Feature<Polygon, OutlineFeatureProperties> | null>(null)
  const selectedFusionOutlineFeature = useMemo(() => {
    if (!selectedFusionArea || !fusionEnabled) {
      return null
    }

    const bounds = getFeatureBounds({
      geometry: selectedFusionArea.geometry,
      properties: selectedFusionArea.properties,
    })

    return bounds ? getOutlineFeature(selectedFusionArea.cellId, bounds) : null
  }, [fusionEnabled, selectedFusionArea])
  const selectedOutlineFeature = selectedFusionOutlineFeature ?? selectedFeature

  const clearRenderingIdleTimeout = useCallback(() => {
    if (renderingIdleTimeoutRef.current !== null) {
      window.clearTimeout(renderingIdleTimeoutRef.current)
      renderingIdleTimeoutRef.current = null
    }
  }, [])

  const showMapRendering = useCallback(() => {
    clearRenderingIdleTimeout()
    setIsMapRendering(true)
  }, [clearRenderingIdleTimeout])

  const scheduleMapRenderingIdle = useCallback(
    (delay = 650) => {
      clearRenderingIdleTimeout()
      renderingIdleTimeoutRef.current = window.setTimeout(() => {
        setIsMapRendering(false)
        renderingIdleTimeoutRef.current = null
      }, delay)
    },
    [clearRenderingIdleTimeout],
  )

  useEffect(() => {
    fusionRequestKeyRef.current = `${selectedDate}:${fusionRefreshKey}`
  }, [fusionRefreshKey, selectedDate])

  const storeGfwTileStats = useCallback(
    (source: GfwSource, tile: LoadedGfwTile) => {
      const { z } = tile.index
      setGfwTileZooms((tileZooms) => ({ ...tileZooms, [source]: z }))
      scheduleMapRenderingIdle()
    },
    [scheduleMapRenderingIdle],
  )

  const reportFusionAreas = useCallback(() => {
    // The queue is built from currently loaded tiles, not from every global cell.
    // This keeps the sidebar tied to what the analyst is actually viewing.
    const sortedAreas = [...fusionTileAreasRef.current.values()]
      .flat()
      .sort(
        (firstArea, secondArea) =>
          secondArea.properties.priorityScore -
          firstArea.properties.priorityScore,
      )
    const uniqueAreas = new Map<string, FusionReviewArea>()

    sortedAreas.forEach((area) => {
      if (!uniqueAreas.has(area.cellId)) {
        uniqueAreas.set(area.cellId, area)
      }
    })

    onFusionAreasChange([...uniqueAreas.values()].slice(0, 8))
  }, [onFusionAreasChange])

  const storeFusionTileAreas = useCallback(
    (tile: LoadedFusionTile, requestKey: string) => {
      if (requestKey !== fusionRequestKeyRef.current) {
        return
      }

      const tileKey = `${tile.index.z}/${tile.index.x}/${tile.index.y}`
      const features = tile.content?.features ?? []
      const areas = features.map((feature) => ({
        cellId: feature.properties.cellId,
        geometry: feature.geometry,
        properties: feature.properties,
      }))

      fusionTileAreasRef.current.set(tileKey, areas)
      reportFusionAreas()
      scheduleMapRenderingIdle()
    },
    [reportFusionAreas, scheduleMapRenderingIdle],
  )

  const handleTileError = useCallback(() => {
    scheduleMapRenderingIdle(300)
  }, [scheduleMapRenderingIdle])

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

      // A fast second click should cancel the first details request. Without
      // this, an older response can overwrite the panel after a newer click.
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

  const selectFusionFeature = useCallback(
    (feature: FusionFeature) => {
      const bounds = getFeatureBounds(feature)

      if (bounds) {
        setSelectedFeature(getOutlineFeature(feature.properties.cellId, bounds))
      }

      onSelectCell({
        cellId: feature.properties.cellId,
        kind: 'fusion',
        fusion: feature.properties,
      })
    },
    [onSelectCell],
  )

  useEffect(() => {
    fusionTileAreasRef.current.clear()
    onFusionAreasChange([])
  }, [fusionEnabled, fusionRefreshKey, selectedDate, onFusionAreasChange])

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
    activeDataLayerRef.current = aisEnabled || sarEnabled || fusionEnabled

    if (activeDataLayerRef.current) {
      showMapRendering()
      scheduleMapRenderingIdle(1800)
    } else {
      setIsMapRendering(false)
      clearRenderingIdleTimeout()
    }
  }, [
    aisEnabled,
    clearRenderingIdleTimeout,
    fusionEnabled,
    fusionRefreshKey,
    sarEnabled,
    sarMatchFilter,
    scheduleMapRenderingIdle,
    selectedDate,
    showMapRendering,
  ])

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: '/styles/maritime-dark.json',
      center: [0, 20],
      minZoom: MAP_MIN_ZOOM,
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

    const handleMapInteractionStart = () => {
      if (activeDataLayerRef.current) {
        showMapRendering()
        scheduleMapRenderingIdle(1400)
      }
    }

    const handleMapInteractionEnd = () => {
      if (activeDataLayerRef.current) {
        scheduleMapRenderingIdle()
      }
    }

    map.on('movestart', handleMapInteractionStart)
    map.on('zoomstart', handleMapInteractionStart)
    map.on('moveend', handleMapInteractionEnd)
    map.on('zoomend', handleMapInteractionEnd)

    map.getCanvas().addEventListener('mouseleave', () => {
      setCursorCoordinates(null)
      setHoverFeature(null)
      map.getCanvas().style.cursor = ''
    })

    return () => {
      mapRef.current = null
      overlayRef.current = null
      clearRenderingIdleTimeout()
      map.remove()
    }
  }, [clearRenderingIdleTimeout, scheduleMapRenderingIdle, showMapRendering])

  useEffect(() => {
    const overlay = overlayRef.current

    if (!overlay) {
      return
    }

    const layers = [
      // Raw source layers stay separate from the derived Fusion layer so the
      // user can inspect each source or turn on only the review product.
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
              onTileError: handleTileError,
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
              onTileError: handleTileError,
              onTileLoad: storeGfwTileStats,
              selectedDate,
              sarMatchFilter,
              setMapCursor,
              source: 'sar',
            }),
          ]
        : []),
      ...(fusionEnabled
        ? [
            createFusionLayer({
              color: fusionColor,
              maxCacheSize: GFW_MAX_CACHED_TILES,
              maxZoom: GFW_MAX_TILE_ZOOM,
              onHoverFeatureChange: setHoverFeature,
              onSelectFeature: selectFusionFeature,
              onTileError: handleTileError,
              onTileLoad: storeFusionTileAreas,
              refreshKey: fusionRefreshKey,
              selectedDate,
              setMapCursor,
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
      ...(selectedOutlineFeature && (aisEnabled || sarEnabled || fusionEnabled)
        ? [
            new GeoJsonLayer<OutlineFeatureProperties>({
              id: 'gfw-selected-outline',
              data: selectedOutlineFeature,
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
    fusionColor,
    fusionEnabled,
    fusionRefreshKey,
    sarColor,
    sarEnabled,
    hoverFeature,
    handleTileError,
    onGfwBinsChange,
    onSelectCell,
    sarMatchFilter,
    selectFusionFeature,
    selectGfwFeature,
    selectedDate,
    selectedFusionArea,
    selectedOutlineFeature,
    setMapCursor,
    storeFusionTileAreas,
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
      {isMapRendering && (
        <div className="map-rendering-indicator" aria-live="polite">
          <span className="map-rendering-indicator__spinner" />
          <span>Loading map data</span>
        </div>
      )}
    </div>
  )
}
