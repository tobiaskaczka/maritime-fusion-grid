export type GfwProperties = Record<string, unknown>

export type GfwSource = 'ais' | 'sar'

export type SarMatchFilter = 'all' | 'matched' | 'unmatched'

export type SelectedMapCell = {
  cellId: string
  kind: 'gfw'
  primarySource: GfwSource
  sources: Partial<Record<GfwSource, GfwProperties>>
}

export type FusionCell = {
  cellId: string
  cell: number
  x: number
  y: number
  z: number
  sources: Partial<Record<GfwSource, GfwProperties>>
}
