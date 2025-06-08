import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ROUTING_URL } from '../config/map'

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
  const [routingInProgress, setRoutingInProgress] = useState(false)

  // Get route between two points using OSRM (same as main map)
  const getRoute = async (start, end, profile = 'driving-car') => {
    // Direct line route as fallback
    const directRoute = [[start.latitude, start.longitude], [end.latitude, end.longitude]]
    
    try {
      // Convert profile to OSRM format
      const osrmProfile = profile === 'foot-walking' ? 'walking' : 'driving'
      
      // OSRM API format: {service}/{version}/{profile}/{coordinates}?options
      const coordinates = `${start.longitude},${start.latitude};${end.longitude},${end.latitude}`
      const osrmUrl = `${ROUTING_URL}/${osrmProfile}/${coordinates}?overview=full&geometries=geojson`
      
      const response = await fetch(osrmUrl)
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.routes && data.routes[0] && data.routes[0].geometry && data.routes[0].geometry.coordinates) {
          const routeCoordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]])
          
          return {
            coordinates: routeCoordinates,
            distance: data.routes[0].distance / 1000, // Convert meters to km
            duration: data.routes[0].duration / 60 // Convert seconds to minutes
          }
        }
      }
    } catch (error) {
      console.warn(`OSRM routing failed for ${profile} in PDF map, using direct line:`, error.message)
    }
    
    return {
      coordinates: directRoute,
      distance: null,
      duration: null
    }
  }

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
    const addDayContent = async () => {
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

             // Draw real road-based routes using OSRM
       const drawRealRoutes = async () => {
         setRoutingInProgress(true)
         if (day.type === 'travel') {
           // Pure travel day: start → end
           const startCoords = day.route?.from?.coordinates
           const endCoords = day.route?.to?.coordinates || day.overnightStay?.coordinates
           
           if (startCoords && endCoords) {
             const routeResult = await getRoute(startCoords, endCoords, 'driving-car')
             
             // Add white outline
             L.polyline(routeResult.coordinates, {
               color: '#FFFFFF',
               weight: 8,
               opacity: 0.9
             }).addTo(map)
             
             // Add main route line
             L.polyline(routeResult.coordinates, {
               color: '#3498DB',
               weight: 6,
               opacity: 1.0
             }).addTo(map)
             
             routes.push(...routeResult.coordinates)
           }
         } else if (day.type === 'mixed') {
           // Mixed day: start → POIs → overnight stay
           const startCoords = day.route?.from?.coordinates
           const endCoords = day.overnightStay?.coordinates
           
           if (startCoords) {
             let currentCoords = startCoords
             let segmentIndex = 0
             
             // Travel to first POI
             if (day.pois.length > 0 && day.pois[0].coordinates) {
               const routeResult = await getRoute(currentCoords, day.pois[0].coordinates, 'driving-car')
               
               // White outline
               L.polyline(routeResult.coordinates, {
                 color: '#FFFFFF',
                 weight: 8,
                 opacity: 0.9
               }).addTo(map)
               
               // Blue travel line
               L.polyline(routeResult.coordinates, {
                 color: '#3498DB',
                 weight: 6,
                 opacity: 1.0
               }).addTo(map)
               
               routes.push(...routeResult.coordinates)
               currentCoords = day.pois[0].coordinates
             }
             
             // Routes between POIs (walking)
             for (let i = 0; i < day.pois.length - 1; i++) {
               const currentPoi = day.pois[i]
               const nextPoi = day.pois[i + 1]
               
               if (currentPoi.coordinates && nextPoi.coordinates) {
                 const routeResult = await getRoute(currentPoi.coordinates, nextPoi.coordinates, 'foot-walking')
                 
                 // White outline
                 L.polyline(routeResult.coordinates, {
                   color: '#FFFFFF',
                   weight: 6,
                   opacity: 0.9,
                   dashArray: '8, 12'
                 }).addTo(map)
                 
                 // Green walking line
                 L.polyline(routeResult.coordinates, {
                   color: '#2ECC71',
                   weight: 4,
                   opacity: 1.0,
                   dashArray: '6, 10'
                 }).addTo(map)
                 
                 routes.push(...routeResult.coordinates)
               }
             }
             
             // Return to overnight stay
             if (day.pois.length > 0 && endCoords) {
               const lastPoi = day.pois[day.pois.length - 1]
               if (lastPoi.coordinates) {
                 const routeResult = await getRoute(lastPoi.coordinates, endCoords, 'foot-walking')
                 
                 // White outline
                 L.polyline(routeResult.coordinates, {
                   color: '#FFFFFF',
                   weight: 6,
                   opacity: 0.9,
                   dashArray: '8, 12'
                 }).addTo(map)
                 
                 // Green walking line
                 L.polyline(routeResult.coordinates, {
                   color: '#2ECC71',
                   weight: 4,
                   opacity: 1.0,
                   dashArray: '6, 10'
                 }).addTo(map)
                 
                 routes.push(...routeResult.coordinates)
               }
             }
           }
         } else {
           // Tour day: overnight stay → POIs → overnight stay
           const baseCoords = day.overnightStay?.coordinates
           
           if (baseCoords && day.pois.length > 0) {
             // Route from hotel to first POI
             const firstPoi = day.pois[0]
             if (firstPoi.coordinates) {
               const routeResult = await getRoute(baseCoords, firstPoi.coordinates, 'foot-walking')
               
               // White outline
               L.polyline(routeResult.coordinates, {
                 color: '#FFFFFF',
                 weight: 6,
                 opacity: 0.9,
                 dashArray: '8, 12'
               }).addTo(map)
               
               // Green walking line
               L.polyline(routeResult.coordinates, {
                 color: '#2ECC71',
                 weight: 4,
                 opacity: 1.0,
                 dashArray: '6, 10'
               }).addTo(map)
               
               routes.push(...routeResult.coordinates)
             }
             
             // Routes between POIs
             for (let i = 0; i < day.pois.length - 1; i++) {
               const currentPoi = day.pois[i]
               const nextPoi = day.pois[i + 1]
               
               if (currentPoi.coordinates && nextPoi.coordinates) {
                 const routeResult = await getRoute(currentPoi.coordinates, nextPoi.coordinates, 'foot-walking')
                 
                 // White outline
                 L.polyline(routeResult.coordinates, {
                   color: '#FFFFFF',
                   weight: 6,
                   opacity: 0.9,
                   dashArray: '8, 12'
                 }).addTo(map)
                 
                 // Green walking line
                 L.polyline(routeResult.coordinates, {
                   color: '#2ECC71',
                   weight: 4,
                   opacity: 1.0,
                   dashArray: '6, 10'
                 }).addTo(map)
                 
                 routes.push(...routeResult.coordinates)
               }
             }
             
             // Route from last POI back to hotel
             const lastPoi = day.pois[day.pois.length - 1]
             if (lastPoi.coordinates) {
               const routeResult = await getRoute(lastPoi.coordinates, baseCoords, 'foot-walking')
               
               // White outline
               L.polyline(routeResult.coordinates, {
                 color: '#FFFFFF',
                 weight: 6,
                 opacity: 0.9,
                 dashArray: '8, 12'
               }).addTo(map)
               
               // Green walking line
               L.polyline(routeResult.coordinates, {
                 color: '#2ECC71',
                 weight: 4,
                 opacity: 1.0,
                 dashArray: '6, 10'
               }).addTo(map)
               
               routes.push(...routeResult.coordinates)
             }
           }
         }
               }
        
        // Execute the route drawing
        try {
          await drawRealRoutes()
        } finally {
          setRoutingInProgress(false)
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
        setTimeout(async () => {
          await addDayContent()
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
      <div className="pdf-day-map-wrapper">
        <div ref={mapRef} className="pdf-day-map"></div>
        {routingInProgress && (
          <div className="pdf-map-loading">
            <div className="pdf-map-loading-spinner"></div>
            <span>Calculating routes...</span>
          </div>
        )}
      </div>
    </div>
  )
} 