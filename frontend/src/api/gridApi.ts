import type { GridCell } from '../types/grid'

export async function getGridCells(source: 'ais'): Promise<GridCell[]> {
  const response = await fetch(`/api/grid?source=${source}`)

  if (!response.ok) {
    throw new Error(`Grid request failed: ${response.status}`)
  }

  return response.json()
}
