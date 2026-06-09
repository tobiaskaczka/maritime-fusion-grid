import type { Geometry } from 'geojson'

export type GfwProperties = Record<string, unknown>

export type GfwSource = 'ais' | 'sar'

export type SarMatchFilter = 'all' | 'matched' | 'unmatched'

export type FusionPriority = 'none' | 'low' | 'medium' | 'high'

export type FusionAssessment =
  | 'no-assessment'
  | 'corroborated-activity'
  | 'unmatched-sar-area'
  | 'isolated-dark-cue'
  | 'fleet-shadow-cue'
  | 'persistent-review-area'

// Derived backend output for the Fusion Review Areas layer. Raw source
// properties are optional evidence, while the top fields drive the UI.
export type FusionReviewAreaProperties = {
  cellId: string
  z: number
  x: number
  y: number
  cell: number
  priorityScore: number
  priority: FusionPriority
  assessment: FusionAssessment
  fishingAisHours: number
  sarMatchedDetections: number
  sarUnmatchedDetections: number
  sarTotalDetections: number
  unmatchedRatio: number
  analysisStartDate: string
  analysisEndDate: string
  confidence: 'low' | 'medium' | 'high'
  reasons: string[]
  caveats: string[]
  ais?: GfwProperties
  sarMatched?: GfwProperties
  sarUnmatched?: GfwProperties
}

// Queue entries keep geometry so selecting an item in the sidebar can draw the
// same map outline as clicking the cell directly.
export type FusionReviewArea = {
  cellId: string
  geometry: Geometry
  properties: FusionReviewAreaProperties
}

// Source-cell selection and Fusion selection use different panel renderers.
export type SelectedGfwCell = {
  cellId: string
  kind: 'gfw'
  primarySource: GfwSource
  sources: Partial<Record<GfwSource, GfwProperties>>
}

export type SelectedFusionCell = {
  cellId: string
  kind: 'fusion'
  fusion: FusionReviewAreaProperties
}

export type SelectedMapCell = SelectedGfwCell | SelectedFusionCell

export type FusionCell = {
  cellId: string
  cell: number
  x: number
  y: number
  z: number
  sources: Partial<Record<GfwSource, GfwProperties>>
}
