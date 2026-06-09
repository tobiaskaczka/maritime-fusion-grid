import { useState } from 'react'
import './TimelineControl.css'

type TimelineControlProps = {
  activeSources: string[]
  dates: string[]
  selectedDate: string
  onDateChange: (date: string) => void
}

const SOURCE_LABELS: Record<string, string> = {
  ais: 'Fishing effort',
  sar: 'SAR',
}

function formatDisplayDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

export function TimelineControl({
  activeSources,
  dates,
  selectedDate,
  onDateChange,
}: TimelineControlProps) {
  const selectedIndex = Math.max(0, dates.indexOf(selectedDate))
  const [draftSelection, setDraftSelection] = useState({
    index: selectedIndex,
    selectedDate,
  })
  const draftIndex =
    draftSelection.selectedDate === selectedDate
      ? draftSelection.index
      : selectedIndex
  const draftDate = dates[draftIndex] ?? selectedDate
  const firstDate = dates[0]
  const lastDate = dates[dates.length - 1]
  const sourceLabel =
    activeSources.length > 0
      ? activeSources
          .map((source) => SOURCE_LABELS[source] ?? source.toUpperCase())
          .join(' + ')
      : 'active layers'

  function commitDraftDate() {
    if (draftDate !== selectedDate) {
      onDateChange(draftDate)
    }
  }

  return (
    <div className="timeline-control" aria-label="Timeline control">
      <div className="timeline-header">
        <input
          aria-label="Selected date"
          max={lastDate}
          min={firstDate}
          onChange={(event) => onDateChange(event.target.value)}
          type="date"
          value={selectedDate}
        />
        <strong>{formatDisplayDate(draftDate)}</strong>
        <span>Daily {sourceLabel}</span>
      </div>
      <div className="timeline-meta">
        <span>{formatDisplayDate(firstDate)}</span>
        <span>Date timeline</span>
        <span>{formatDisplayDate(lastDate)}</span>
      </div>
      <input
        aria-label="Selected date"
        className="timeline-scrubber"
        max={dates.length - 1}
        min={0}
        onBlur={commitDraftDate}
        onChange={(event) =>
          setDraftSelection({
            index: Number(event.target.value),
            selectedDate,
          })
        }
        onKeyUp={commitDraftDate}
        onPointerUp={commitDraftDate}
        step={1}
        type="range"
        value={draftIndex}
      />
    </div>
  )
}
