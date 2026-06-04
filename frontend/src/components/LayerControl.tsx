import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PaintBucket } from 'lucide-react'
import './LayerControl.css'

const COLOR_OPTIONS = [
  '#f5df00',
  '#38bdf8',
  '#2dd4bf',
  '#c084fc',
  '#fb923c',
  '#ef4444',
]

type LayerControlProps = {
  name: string
  unit: string
  enabled: boolean
  color: string
  values: string[]
  onToggle: () => void
  onColorChange: (color: string) => void
}

export function LayerControl({
  name,
  unit,
  enabled,
  color,
  values,
  onToggle,
  onColorChange,
}: LayerControlProps) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const colorMenuRef = useRef<HTMLDivElement | null>(null)
  const colorStyle = { '--layer-color': color } as CSSProperties

  useEffect(() => {
    if (!colorPickerOpen) {
      return
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        colorMenuRef.current &&
        !colorMenuRef.current.contains(event.target as Node)
      ) {
        setColorPickerOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
    }
  }, [colorPickerOpen])

  return (
    <section className="layer-control" style={colorStyle}>
      <div className="layer-control__header">
        <label className="layer-control__title">
          <input
            className="layer-control__toggle"
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
          />
          {name}
        </label>

        <div className="layer-control__color-menu" ref={colorMenuRef}>
          <button
            className="layer-control__color-button"
            aria-expanded={colorPickerOpen}
            aria-label={`Change ${name} color`}
            onClick={() => setColorPickerOpen((open) => !open)}
            title="Change layer color"
            type="button"
          >
            <PaintBucket aria-hidden="true" size={15} strokeWidth={1.8} />
          </button>

          {colorPickerOpen && (
            <div className="layer-control__color-popover">
              <p>Layer color</p>
              <div className="layer-control__color-options">
                {COLOR_OPTIONS.map((option) => (
                  <button
                    key={option}
                    aria-label={`Use ${option}`}
                    aria-pressed={color === option}
                    className="layer-control__color-option"
                    onClick={() => {
                      onColorChange(option)
                      setColorPickerOpen(false)
                    }}
                    style={{ backgroundColor: option }}
                    type="button"
                  />
                ))}
              </div>
              <label className="layer-control__custom-color">
                Custom
                <input
                  aria-label={`Custom ${name} color`}
                  type="color"
                  value={color}
                  onChange={(event) => onColorChange(event.target.value)}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      <p className="layer-control__unit">{unit}</p>
      <div className="layer-control__scale" />

      <div className="layer-control__values">
        {values.map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
    </section>
  )
}
