import { MVTLayer } from '@deck.gl/geo-layers'
import type { Feature, Polygon } from 'geojson'
import { getGfwTileTemplate } from '../api/gridApi'
import type { GfwProperties, GfwSource, SarMatchFilter } from '../types/grid'
import {
  getCellId,
  getFeatureBounds,
  getOutlineFeature,
  type GfwFeatureLike,
  type OutlineFeatureProperties,
} from './gfwFeatureUtils'
import { getGfwColor } from './mapColors'

export type LoadedTile<TData> = {
  content: TData | null
  index: {
    z: number
    x: number
    y: number
  }
}

export type LoadedGfwTile = LoadedTile<GfwFeatureLike[]>

type CreateGfwLayerArgs = {
  color: string
  maxCacheSize: number
  maxZoom: number
  onHoverFeatureChange: (
    feature: Feature<Polygon, OutlineFeatureProperties> | null,
  ) => void
  onSelectFeature: (source: GfwSource, feature: GfwFeatureLike) => void
  onTileLoad: (source: GfwSource, tile: LoadedGfwTile) => void
  selectedDate: string
  sarMatchFilter: SarMatchFilter
  setMapCursor: (cursor: string) => void
  source: GfwSource
}

export function createGfwLayer({
  color,
  maxCacheSize,
  maxZoom,
  onHoverFeatureChange,
  onSelectFeature,
  onTileLoad,
  selectedDate,
  sarMatchFilter,
  setMapCursor,
  source,
}: CreateGfwLayerArgs) {
  return new MVTLayer<GfwProperties>({
    id: `gfw-${source}-tiles`,
    data: getGfwTileTemplate(source, selectedDate, {
      sarMatchFilter,
    }),
    minZoom: 0,
    maxZoom,
    maxCacheSize,
    binary: false,
    filled: true,
    stroked: false,
    pickable: true,
    getFillColor: (feature) => getGfwColor(feature.properties ?? {}, color),
    onClick: ({ object }) => {
      if (object) {
        onSelectFeature(source, object as GfwFeatureLike)
      }
    },
    onHover: ({ object }) => {
      if (!object) {
        onHoverFeatureChange(null)
        setMapCursor('')
        return
      }

      const feature = object as GfwFeatureLike
      const bounds = getFeatureBounds(feature)
      const cellId = feature.properties ? getCellId(feature.properties) : null

      if (bounds && cellId) {
        onHoverFeatureChange(getOutlineFeature(cellId, bounds))
        setMapCursor('pointer')
      } else {
        onHoverFeatureChange(null)
        setMapCursor('')
      }
    },
    onTileLoad: (tile) => onTileLoad(source, tile as LoadedGfwTile),
    updateTriggers: {
      getFillColor: [color],
    },
  })
}
