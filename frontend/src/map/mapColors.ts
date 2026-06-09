import type { GfwProperties } from '../types/grid'

type RgbaColor = [number, number, number, number]

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getGfwValue(properties: GfwProperties) {
  // Source tiles use different value field names. Color by the first numeric
  // field we recognize so the layer code does not need per-dataset branches.
  const candidateKeys = [
    'count',
    'detections',
    'hours',
    'value',
    'activityHours',
    'presence',
  ]

  for (const key of candidateKeys) {
    const value = properties[key]

    if (typeof value === 'number') {
      return value
    }

    if (typeof value === 'string') {
      const parsed = Number(value)

      if (!Number.isNaN(parsed)) {
        return parsed
      }
    }
  }

  return 1
}

export function getGfwColor(
  properties: GfwProperties,
  color: string,
): RgbaColor {
  const value = getGfwValue(properties)

  // Log scaling keeps dense global cells from washing out the whole layer.
  const normalized = clamp(Math.log10(value + 1) / 5.35, 0, 1)
  const baseColor = hexToRgb(color)
  const lowColor = mixRgb(baseColor, [8, 15, 22], 0.66)
  const highColor = [255, 255, 255] as [number, number, number]
  const [red, green, blue] = mixRgb(lowColor, highColor, normalized)

  return [red, green, blue, Math.round(180 + normalized * 75)]
}
