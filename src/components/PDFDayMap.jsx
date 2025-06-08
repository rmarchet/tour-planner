import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default markers in React Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom icons for different location types
const createCustomIcon = (emoji, size = 24) => {
  return L.divIcon({
    html: `<div style="background: white; border-radius: 50%; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; border: 2px solid #333; font-size: ${size * 0.6}px;">${emoji}</div>`,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  })
}

export const PDFDayMap = ({ day, dayIndex, tourData }) => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Initialize the map
    const map = L.map(mapRef.current, {
      center: [51.505, -0.09], // Default center, will be updated
      zoom: 10,
      scrollWheelZoom: false,
      dragging: false, // Disable dragging for PDF
      zoomControl: false, // Remove zoom controls for PDF
      attributionControl: false, // Remove attribution for cleaner PDF
      preferCanvas: true, // Use canvas renderer for better PDF capture
      tapTolerance: 0, // Disable tap interactions
      keyboard: false, // Disable keyboard interactions
    })

    // Ensure map container is properly sized
    setTimeout(() => {
      map.invalidateSize()
    }, 50)

    mapInstanceRef.current = map

    // Add tile layer
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: false
    }).addTo(map)

    // Add markers and routes for this specific day
    const addDayContent = () => {
      const markers = []
      const routes = []

      // Add home location if this is first or last day
      if (tourData.homeLocation?.coordinates && (dayIndex === 0 || dayIndex === tourData.plannedItinerary.length - 1)) {
        const homeMarker = L.marker(
          [tourData.homeLocation.coordinates.latitude, tourData.homeLocation.coordinates.longitude],
          { icon: createCustomIcon('🏠') }
        ).addTo(map)
        markers.push([tourData.homeLocation.coordinates.latitude, tourData.homeLocation.coordinates.longitude])
      }

      // Add overnight stay location
      if (day.overnightStay?.coordinates) {
        const hotelMarker = L.marker(
          [day.overnightStay.coordinates.latitude, day.overnightStay.coordinates.longitude],
          { icon: createCustomIcon('🏨') }
        ).addTo(map)
        markers.push([day.overnightStay.coordinates.latitude, day.overnightStay.coordinates.longitude])
      }

      // Add POI markers
      day.pois.forEach(poi => {
        if (poi.coordinates) {
          const poiMarker = L.marker(
            [poi.coordinates.latitude, poi.coordinates.longitude],
            { icon: createCustomIcon('📍', 20) }
          ).addTo(map)
          markers.push([poi.coordinates.latitude, poi.coordinates.longitude])
        }
      })

             // Draw the actual daily route flow
       const isFirstDay = dayIndex === 0
       const isLastDay = dayIndex === tourData.plannedItinerary.length - 1
       
       let routePoints = []
       
       // Build the sequential route for this day
       if (day.type === 'travel') {
         // Pure travel day: start → end
         const startCoords = day.route?.from?.coordinates
         const endCoords = day.route?.to?.coordinates || day.overnightStay?.coordinates
         
         if (startCoords && endCoords) {
           routePoints = [
             [startCoords.latitude, startCoords.longitude],
             [endCoords.latitude, endCoords.longitude]
           ]
         }
       } else if (day.type === 'mixed') {
         // Mixed day: start → POIs → overnight stay
         const startCoords = day.route?.from?.coordinates
         const endCoords = day.overnightStay?.coordinates
         
         if (startCoords) {
           routePoints.push([startCoords.latitude, startCoords.longitude])
           
           // Add POIs in sequence
           day.pois.forEach(poi => {
             if (poi.coordinates) {
               routePoints.push([poi.coordinates.latitude, poi.coordinates.longitude])
             }
           })
           
           // End at overnight stay
           if (endCoords) {
             routePoints.push([endCoords.latitude, endCoords.longitude])
           }
         }
       } else {
         // Tour day: overnight stay → POIs → overnight stay
         const baseCoords = day.overnightStay?.coordinates
         
         if (baseCoords && day.pois.length > 0) {
           routePoints.push([baseCoords.latitude, baseCoords.longitude])
           
           // Add POIs in sequence
           day.pois.forEach(poi => {
             if (poi.coordinates) {
               routePoints.push([poi.coordinates.latitude, poi.coordinates.longitude])
             }
           })
           
           // Return to overnight stay
           routePoints.push([baseCoords.latitude, baseCoords.longitude])
         }
       }
       
       // Draw the sequential route
       if (routePoints.length > 1) {
         for (let i = 0; i < routePoints.length - 1; i++) {
           const segment = [routePoints[i], routePoints[i + 1]]
           
           // Different colors for different types of segments
           let color = '#48bb78' // Default green for local routes
           let weight = 2
           let dashArray = '5, 5'
           
           // First and last segments on mixed days (travel segments)
           if (day.type === 'mixed' && (i === 0 || i === routePoints.length - 2)) {
             color = '#667eea' // Blue for travel
             weight = 3
             dashArray = '10, 5'
           }
           // Travel days get solid blue lines
           else if (day.type === 'travel') {
             color = '#667eea'
             weight = 3
             dashArray = null
           }
           
           L.polyline(segment, {
             color,
             weight,
             opacity: 0.8,
             dashArray
           }).addTo(map)
         }
         
         routes.push(...routePoints)
       }

      // Fit map to show all markers and routes
      const allPoints = [...markers, ...routes]
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints)
        map.fitBounds(bounds, { padding: [10, 10] })
        
        // Force map to invalidate size and redraw after bounds are set
        setTimeout(() => {
          map.invalidateSize()
        }, 100)
      }
    }

    // Wait for tiles to load before adding content
    let tilesLoaded = false
    const checkTilesLoaded = () => {
      if (!tilesLoaded) {
        tilesLoaded = true
        // Add a delay to ensure tiles are fully rendered
        setTimeout(() => {
          addDayContent()
        }, 500)
      }
    }

    // Listen for tile load events
    tileLayer.on('load', checkTilesLoaded)
    
    // Fallback in case tile load event doesn't fire
    setTimeout(checkTilesLoaded, 1000)

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [day, dayIndex, tourData])

  // Don't render map if no location data is available
  const hasLocationData = day.overnightStay?.coordinates || day.pois.some(poi => poi.coordinates)
  
  if (!hasLocationData) {
    return (
      <div className="pdf-day-map-placeholder">
        <p>📍 Map not available - location coordinates needed</p>
      </div>
    )
  }

  return (
    <div className="pdf-day-map-container">
      <h5>📍 Day Route Map</h5>
      <div ref={mapRef} className="pdf-day-map"></div>
    </div>
  )
} 