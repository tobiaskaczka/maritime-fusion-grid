import type { Feature, Polygon } from 'geojson'
import type { GfwProperties } from '../types/grid'

export type GfwFeatureLike = {
  geometry?: unknown
  properties?: GfwProperties
}

export type FeatureBounds = {
  east: number
  north: number
  south: number
  west: number
}

export type OutlineFeatureProperties = {
  id: string
}

function collectPositions(value: unknown, positions: number[][]) {
  if (value && typeof value === 'object' && 'coordinates' in value) {
    collectPositions(
      (value as { coordinates: unknown }).coordinates,
      positions,
    )
    return
  }

  if (!Array.isArray(value)) {
    return
  }

  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    positions.push([value[0], value[1]])
    return
  }

  value.forEach((item) => collectPositions(item, positions))
}

export function getFeatureBounds(feature: GfwFeatureLike) {
  const positions: number[][] = []
  collectPositions(feature.geometry, positions)

  if (positions.length === 0) {
    return null
  }

  return positions.reduce<FeatureBounds>(
    (bounds, [longitude, latitude]) => ({
      east: Math.max(bounds.east, longitude),
      north: Math.max(bounds.north, latitude),
      south: Math.min(bounds.south, latitude),
      west: Math.min(bounds.west, longitude),
    }),
    {
      east: -Infinity,
      north: -Infinity,
      south: Infinity,
      west: Infinity,
    },
  )
}

export function getCellId(properties: GfwProperties) {
  const id = properties.id

  if (typeof id === 'string' && id.split('/').length === 4) {
    return id
  }

  return null
}

function getExpandedBounds(bounds: FeatureBounds) {
  const width = bounds.east - bounds.west
  const height = bounds.north - bounds.south
  const longitudePadding = Math.max(width * 0.035, 0.00001)
  const latitudePadding = Math.max(height * 0.035, 0.00001)

  return {
    east: bounds.east + longitudePadding,
    north: bounds.north + latitudePadding,
    south: bounds.south - latitudePadding,
    west: bounds.west - longitudePadding,
  }
}

export function getOutlineFeature(
  id: string,
  bounds: FeatureBounds,
): Feature<Polygon, OutlineFeatureProperties> {
  const expandedBounds = getExpandedBounds(bounds)

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [expandedBounds.west, expandedBounds.south],
          [expandedBounds.east, expandedBounds.south],
          [expandedBounds.east, expandedBounds.north],
          [expandedBounds.west, expandedBounds.north],
          [expandedBounds.west, expandedBounds.south],
        ],
      ],
    },
    properties: { id },
  }
}
