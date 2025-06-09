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

export const PDFDayMap = ({ day, dayIndex, tourData, routes = [] }) => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  // No longer need routing progress state since we use existing routes

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

                   // Use existing route data instead of recalculating
      const drawExistingRoutes = () => {
        console.log('PDFDayMap - Drawing routes for day', dayIndex)
        console.log('PDFDayMap - Available routes:', routes)
        
        const dayRoutes = routes.find(r => r.day === dayIndex)
        console.log('PDFDayMap - Found day routes:', dayRoutes)
        
        const routeCoordinates = []
        
        if (dayRoutes && dayRoutes.routes) {
          console.log('PDFDayMap - Processing', dayRoutes.routes.length, 'routes')
          dayRoutes.routes.forEach(route => {
            // Add white outline for better visibility
            L.polyline(route.coordinates, {
              color: '#FFFFFF',
              weight: route.type === 'driving' ? 8 : 6,
              opacity: 0.9,
              dashArray: route.type === 'walking' ? '8, 12' : null
            }).addTo(map)
            
            // Add main route line with proper color and style
            L.polyline(route.coordinates, {
              color: route.type === 'driving' ? '#3498DB' : '#2ECC71',
              weight: route.type === 'driving' ? 6 : 4,
              opacity: 1.0,
              dashArray: route.type === 'walking' ? '6, 10' : null
            }).addTo(map)
            
            // Collect coordinates for bounds calculation
            routeCoordinates.push(...route.coordinates)
          })
        } else {
          console.log('PDFDayMap - No routes found for day', dayIndex, 'drawing fallback direct lines')
          // Fallback: draw direct lines between locations
          drawFallbackRoutes(routeCoordinates)
        }
        
        console.log('PDFDayMap - Total route coordinates:', routeCoordinates.length)
        return routeCoordinates
      }

      // Fallback function to draw direct lines when routes aren't available
      const drawFallbackRoutes = (routeCoordinates) => {
        if (day.type === 'travel' && day.route?.from?.coordinates && day.route?.to?.coordinates) {
          // Travel day: direct line from start to end
          const startCoords = [day.route.from.coordinates.latitude, day.route.from.coordinates.longitude]
          const endCoords = [day.route.to.coordinates.latitude, day.route.to.coordinates.longitude]
          const directRoute = [startCoords, endCoords]
          
          L.polyline(directRoute, {
            color: '#3498DB',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 10'
          }).addTo(map)
          
          routeCoordinates.push(...directRoute)
        } else if ((day.type === 'tour' || day.type === 'mixed') && day.overnightStay?.coordinates && day.pois.length > 0) {
          // Tour day: lines from hotel to POIs and between POIs
          const baseCoords = [day.overnightStay.coordinates.latitude, day.overnightStay.coordinates.longitude]
          
          day.pois.forEach((poi, index) => {
            if (poi.coordinates) {
              const poiCoords = [poi.coordinates.latitude, poi.coordinates.longitude]
              let startCoords = baseCoords
              
              if (index > 0 && day.pois[index - 1].coordinates) {
                startCoords = [day.pois[index - 1].coordinates.latitude, day.pois[index - 1].coordinates.longitude]
              }
              
              const directRoute = [startCoords, poiCoords]
              
              L.polyline(directRoute, {
                color: '#2ECC71',
                weight: 3,
                opacity: 0.7,
                dashArray: '5, 5'
              }).addTo(map)
              
              routeCoordinates.push(...directRoute)
            }
          })
          
          // Return to hotel
          if (day.pois.length > 0 && day.pois[day.pois.length - 1].coordinates) {
            const lastPoiCoords = [day.pois[day.pois.length - 1].coordinates.latitude, day.pois[day.pois.length - 1].coordinates.longitude]
            const returnRoute = [lastPoiCoords, baseCoords]
            
            L.polyline(returnRoute, {
              color: '#2ECC71',
              weight: 3,
              opacity: 0.7,
              dashArray: '5, 5'
            }).addTo(map)
            
            routeCoordinates.push(...returnRoute)
          }
        }
      }
        
        // Use existing route data (no async needed)
        const routeCoordinates = drawExistingRoutes()

      // Fit map to show all markers and routes
      const allPoints = [...markers, ...routeCoordinates]
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
  }, [day, dayIndex, tourData, routes])

  // Don't render map if no location data is available
  const hasLocationData = day.overnightStay?.coordinates || day.pois.some(poi => poi.coordinates)
  
  if (!hasLocationData) {
    return (
      <div className="pdf-day-map-placeholder">
        <p>📍 Map not available - location coordinates needed</p>
      </div>
    )
  }

  // Check if routes are available for this day
  const dayRoutes = routes.find(r => r.day === dayIndex)
  const hasRoutes = dayRoutes && dayRoutes.routes && dayRoutes.routes.length > 0

  // Debug info for console
  console.log('PDFDayMap render:', {
    dayIndex,
    totalRoutes: routes.length,
    dayRoutes,
    hasRoutes,
    routesArray: routes
  })

  return (
    <div className="pdf-day-map-container">
      <h5>📍 Day Route Map</h5>
      {!hasRoutes && routes.length === 0 && (
        <div className="pdf-route-warning">
          <p>⚠️ Routes not calculated yet. Click "Generate tour plan" first to see route paths.</p>
        </div>
      )}
      {!hasRoutes && routes.length > 0 && (
        <div className="pdf-route-warning">
          <p>⚠️ No routes available for Day {dayIndex + 1}.</p>
        </div>
      )}
      <div className="pdf-day-map-wrapper">
        <div ref={mapRef} className="pdf-day-map"></div>
      </div>
    </div>
  )
} 