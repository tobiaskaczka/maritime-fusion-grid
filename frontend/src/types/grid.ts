import type { Feature, Polygon } from 'geojson'

export type GridSource = 'ais' | 'night-lights' | 'radar'

export type GridCellProperties = {
  id: string
  source: GridSource
  score: number
  detectionCount: number
}

export type GridCell = Feature<Polygon, GridCellProperties>
