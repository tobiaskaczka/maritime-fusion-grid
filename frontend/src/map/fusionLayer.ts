import { TileLayer } from '@deck.gl/geo-layers'
import { GeoJsonLayer } from '@deck.gl/layers'
import type { Feature, FeatureCollection, Geometry, Polygon } from 'geojson'
import { getFusionTileTemplate } from '../api/gridApi'
import type { FusionReviewAreaProperties } from '../types/grid'
import {
  getFeatureBounds,
  getOutlineFeature,
  type OutlineFeatureProperties,
} from './gfwFeatureUtils'

export type FusionFeature = Feature<Geometry, FusionReviewAreaProperties>

export type FusionFeatureCollection = FeatureCollection<
  Geometry,
  FusionReviewAreaProperties
>

const EMPTY_FUSION_COLLECTION: FusionFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function mixRgb(
  start: [number, number, number],
  end: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    Math.round(start[0] + (end[0] - start[0]) * amount),
    Math.round(start[1] + (end[1] - start[1]) * amount),
    Math.round(start[2] + (end[2] - start[2]) * amount),
  ]
}

export type LoadedFusionTile = {
  content: FusionFeatureCollection | null
  index: {
    z: number
    x: number
    y: number
  }
}

type CreateFusionLayerArgs = {
  color: string
  maxCacheSize: number
  maxZoom: number
  onHoverFeatureChange: (
    feature: Feature<Polygon, OutlineFeatureProperties> | null,
  ) => void
  onSelectFeature: (feature: FusionFeature) => void
  onTileError: () => void
  onTileLoad: (tile: LoadedFusionTile, requestKey: string) => void
  refreshKey: number
  selectedDate: string
  setMapCursor: (cursor: string) => void
}

function getFusionFillColor(
  properties: FusionReviewAreaProperties,
  color: string,
): [number, number, number, number] {
  const normalizedScore = Math.min(
    Math.max(properties.priorityScore / 100, 0),
    1,
  )
  const baseColor = hexToRgb(color)

  // The Fusion ramp should remain readable against the dark basemap while still
  // leaving room for the white hover/selected outlines.
  if (properties.priority === 'high') {
    return [
      ...mixRgb(baseColor, [255, 255, 255], 0.52),
      Math.round(210 + normalizedScore * 45),
    ]
  }

  if (properties.priority === 'medium') {
    return [
      ...mixRgb(baseColor, [255, 255, 255], 0.18),
      Math.round(185 + normalizedScore * 55),
    ]
  }

  return [
    ...mixRgb(baseColor, [8, 15, 22], 0.42),
    Math.round(140 + normalizedScore * 60),
  ]
}

function featureToOutline(feature: FusionFeature) {
  const cellId = feature.properties.cellId
  const bounds = getFeatureBounds({
    geometry: feature.geometry,
    properties: feature.properties,
  })

  if (!bounds) {
    return null
  }

  return getOutlineFeature(cellId, bounds)
}

function isFusionFeature(value: unknown): value is FusionFeature {
  if (!value || typeof value !== 'object') {
    return false
  }

  const maybeFeature = value as Partial<FusionFeature>

  return (
    maybeFeature.type === 'Feature' &&
    !!maybeFeature.geometry &&
    !!maybeFeature.properties &&
    typeof maybeFeature.properties.cellId === 'string'
  )
}

export function createFusionLayer({
  color,
  maxCacheSize,
  maxZoom,
  onHoverFeatureChange,
  onSelectFeature,
  onTileError,
  onTileLoad,
  refreshKey,
  selectedDate,
  setMapCursor,
}: CreateFusionLayerArgs) {
  const colorKey = color.replace('#', '')
  const requestKey = `${selectedDate}:${refreshKey}`

  // Include visual/request state in the layer id so deck.gl rebuilds cached
  // tile sublayers when the date, color, or manual refresh changes.
  const layerKey = `${colorKey}-${requestKey}`
  const handleClick = (object: unknown) => {
    if (isFusionFeature(object)) {
      onSelectFeature(object)
    }
  }
  const handleHover = (object: unknown) => {
    if (!isFusionFeature(object)) {
      onHoverFeatureChange(null)
      setMapCursor('')
      return
    }

    const outlineFeature = featureToOutline(object)

    if (outlineFeature) {
      onHoverFeatureChange(outlineFeature)
      setMapCursor('pointer')
    } else {
      onHoverFeatureChange(null)
      setMapCursor('')
    }
  }

  return new TileLayer<FusionFeatureCollection>({
    id: `gfw-fusion-review-tiles-${layerKey}`,
    data: getFusionTileTemplate(selectedDate),
    minZoom: 0,
    maxZoom,
    maxCacheSize,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 80],
    getTileData: async (tileProps) => {
      const { url, signal } = tileProps as {
        signal?: AbortSignal
        url?: string
      }

      if (!url) {
        return EMPTY_FUSION_COLLECTION
      }

      // Deck provides an AbortSignal when a tile is no longer needed. Passing it
      // through keeps timeline scrubbing from piling up stale Fusion requests.
      const response = await fetch(url, { signal })

      if (!response.ok) {
        throw new Error(`Fusion tile request failed: ${response.status}`)
      }

      return (await response.json()) as FusionFeatureCollection
    },
    renderSubLayers: (props) => {
      const data = props.data

      if (!data) {
        return null
      }

      return new GeoJsonLayer<FusionReviewAreaProperties>({
        id: `${props.id}-geojson-${layerKey}`,
        data,
        filled: true,
        stroked: false,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 80],
        pickable: true,
        getFillColor: (feature) =>
          getFusionFillColor(
            feature.properties as FusionReviewAreaProperties,
            color,
          ),
        onClick: ({ object }) => {
          handleClick(object)
        },
        onHover: ({ object }) => {
          handleHover(object)
        },
        updateTriggers: {
          getFillColor: [color],
        },
      })
    },
    onClick: ({ object }) => handleClick(object),
    onHover: ({ object }) => handleHover(object),
    onTileLoad: (tile) => onTileLoad(tile as LoadedFusionTile, requestKey),
    onTileError,
  })
}
