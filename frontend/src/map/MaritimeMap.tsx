import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './MaritimeMap.css'

export function MaritimeMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      //style: 'https://demotiles.maplibre.org/style.json',
      style: '/styles/maritime-dark.json',
      center: [0, 20],
      zoom: 1.4,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    return () => {
      map.remove()
    }
  }, [])

  return <div className="map-shell" ref={mapContainerRef} />
}
