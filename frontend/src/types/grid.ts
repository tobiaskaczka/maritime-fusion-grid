import type { Feature, Polygon } from 'geojson'

export type GridCellProperties = {
  id: string
  source: 'ais' | 'night-lights' | 'radar'
  score: number
  detectionCount: number
}

export type GridCell = Feature<Polygon, GridCellProperties>
