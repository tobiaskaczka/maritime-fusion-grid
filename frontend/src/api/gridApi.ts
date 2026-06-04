import type { GridCell } from '../types/grid'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(
  /\/$/,
  '',
)

export async function getGridCells(source: 'ais'): Promise<GridCell[]> {
  const response = await fetch(`${API_BASE_URL}/grid?source=${source}`)

  if (!response.ok) {
    throw new Error(`Grid request failed: ${response.status}`)
  }

  return response.json()
}
