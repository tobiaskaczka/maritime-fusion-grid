import type { GridCell } from '../types/grid'

function createCell(
  id: string,
  west: number,
  south: number,
  east: number,
  north: number,
  score: number,
  detectionCount: number,
): GridCell {
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
    properties: {
      id,
      source: 'ais',
      score,
      detectionCount,
    },
  }
}

export const aisGridCells: GridCell[] = [
  createCell('ais-north-atlantic-1', -46, 38, -36, 46, 0.25, 18),
  createCell('ais-north-atlantic-2', -36, 38, -26, 46, 0.48, 41),
  createCell('ais-north-atlantic-3', -26, 38, -16, 46, 0.78, 82),
  createCell('ais-mediterranean-1', 4, 32, 14, 40, 0.92, 127),
  createCell('ais-indian-ocean-1', 66, -4, 76, 4, 0.36, 29),
  createCell('ais-south-china-sea-1', 108, 8, 118, 16, 0.69, 73),
  createCell('ais-east-china-sea-1', 122, 24, 132, 32, 1, 156),
  createCell('ais-north-pacific-1', -176, 34, -166, 42, 0.56, 52),
]
