import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { PaintBucket } from 'lucide-react'
import './LayerControl.css'

const COLOR_OPTIONS = [
  '#f45bc4',
  '#f5df00',
  '#ff5544',
  '#2dd4bf',
  '#c084fc',
  '#fb923c',
]

type LayerControlProps = {
  name: string
  unit: string
  enabled: boolean
  disabled?: boolean
  color: string
  values: string[]
  onToggle: () => void
  onColorChange: (color: string) => void
  children?: ReactNode
}

export function LayerControl({
  name,
  unit,
  enabled,
  disabled = false,
  color,
  values,
  onToggle,
  onColorChange,
  children,
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

    // Keep the color picker feeling like a small popover, not a persistent menu.
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
            disabled={disabled}
            onChange={onToggle}
          />
          {name}
        </label>

        <div className="layer-control__color-menu" ref={colorMenuRef}>
          <button
            className="layer-control__color-button"
            aria-expanded={colorPickerOpen}
            aria-label={`Change ${name} color`}
            disabled={disabled}
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

      {enabled && (
        <>
          <p className="layer-control__unit">{unit}</p>
          <div className="layer-control__scale" />

          <div className="layer-control__values">
            {values.map((value, index) => (
              <span key={index}>{value}</span>
            ))}
          </div>
          {children}
        </>
      )}
    </section>
  )
}
