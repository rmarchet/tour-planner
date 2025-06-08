import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { GEOCODING_URL, ROUTING_URL, ROUTING_API_KEY } from '../config/map'

// Fix for default markers in React Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Color palette for different days
const dayColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43'
]

// Custom icons for different location types
const createCustomIcon = (emoji) => {
  return L.divIcon({
    html: `<div style="background: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 2px solid #333; font-size: 16px;">${emoji}</div>`,
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  })
}

const homeIcon = createCustomIcon('🏠')
const hotelIcon = createCustomIcon('🏨')
const poiIcon = createCustomIcon('📍')

// Component to fit map bounds when data changes
const MapController = ({ bounds }) => {
  const map = useMap()
  
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      // Small delay to ensure map is ready
      setTimeout(() => {
        map.fitBounds(bounds, { padding: [20, 20] })
      }, 100)
    }
  }, [map, bounds])
  
  return null
}

export const SimpleMapDisplay = ({ tourData, updateTourData }) => {
  const [geocodingInProgress, setGeocodingInProgress] = useState(false)
  const [routes, setRoutes] = useState([])
  const [selectedDay, setSelectedDay] = useState('all')
  const isGeocodingRef = useRef(false)
  const routingRef = useRef(false)

  // Geocode a single location using Nominatim with fallbacks
  const geocodeLocation = async (query) => {
    console.log(`Attempting to geocode: "${query}"`)
    
    // Try original query first
    try {
      const response = await fetch(
        `${GEOCODING_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`
      )
      const data = await response.json()
      console.log(`Geocoding response for "${query}":`, data)
      
      if (data && data.length > 0) {
        const result = {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        }
        console.log(`✅ Geocoded "${query}" to:`, result)
        return result
      }
    } catch (error) {
      console.warn(`Geocoding failed for "${query}":`, error)
    }
    
    // If original query failed, try extracting city name for fallback
    if (query.includes(',')) {
      const cityPart = query.split(',').pop().trim()
      console.log(`Trying fallback with city name: "${cityPart}"`)
      
      try {
        const response = await fetch(
          `${GEOCODING_URL}?q=${encodeURIComponent(cityPart)}&format=json&limit=1&addressdetails=1`
        )
        const data = await response.json()
        console.log(`Fallback geocoding response for "${cityPart}":`, data)
        
        if (data && data.length > 0) {
          const result = {
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon)
          }
          console.log(`✅ Fallback geocoded "${cityPart}" to:`, result)
          return result
        }
      } catch (error) {
        console.warn(`Fallback geocoding failed for "${cityPart}":`, error)
      }
    }
    
    console.log(`❌ All geocoding attempts failed for: "${query}"`)
    return null
  }

  // Get route between two points
  const getRoute = async (start, end, profile = 'driving-car') => {
    // Due to CORS limitations with demo API key, we'll use direct line routes
    // In production, use a proper API key or implement server-side routing
    
    console.log(`Getting ${profile} route from [${start.latitude}, ${start.longitude}] to [${end.latitude}, ${end.longitude}]`)
    
    // For now, return direct line route
    // This provides visual connection between points on the map
    const directRoute = [[start.latitude, start.longitude], [end.latitude, end.longitude]]
    
    // Optional: Try API call but fallback gracefully
    if (ROUTING_API_KEY && ROUTING_API_KEY !== 'demo') {
      try {
        const response = await fetch(
          `${ROUTING_URL}/${profile}?api_key=${ROUTING_API_KEY}&start=${start.longitude},${start.latitude}&end=${end.longitude},${end.latitude}`
        )
        
        if (response.ok) {
          const data = await response.json()
          if (data.features && data.features[0] && data.features[0].geometry) {
            console.log(`✅ Got detailed ${profile} route from API`)
            return data.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]])
          }
        }
      } catch (error) {
        console.warn(`API routing failed for ${profile}, using direct line:`, error.message)
      }
    }
    
    console.log(`Using direct line route for ${profile}`)
    return directRoute
  }

  // Calculate distance between two points (in km)
  const calculateDistance = (point1, point2, routeType = 'driving') => {
    const R = 6371 // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    const directDistance = R * c
    
    // Apply route type multiplier to estimate real route distance
    // (roads are not straight lines)
    const multiplier = routeType === 'driving' ? 1.3 : 1.2 // 30% longer for driving, 20% for walking
    return directDistance * multiplier
  }

  // Geocode locations when they're added
  useEffect(() => {
    const needsGeocoding = [
      ...(tourData.homeLocation?.location && !tourData.homeLocation?.coordinates ? [tourData.homeLocation] : []),
      ...tourData.overnightStays.filter(stay => !stay.coordinates),
      ...tourData.pois.filter(poi => !poi.coordinates)
    ]

    if (needsGeocoding.length === 0 || isGeocodingRef.current) return

    const geocodeLocations = async () => {
      isGeocodingRef.current = true
      setGeocodingInProgress(true)

      try {
        let needsUpdate = false
        let updatedHome = tourData.homeLocation

        // Geocode home location
        if (tourData.homeLocation?.location && !tourData.homeLocation?.coordinates) {
          const coords = await geocodeLocation(tourData.homeLocation.location)
          if (coords) {
            needsUpdate = true
            updatedHome = { ...tourData.homeLocation, coordinates: coords }
          }
        }

        // Geocode overnight stays
        const updatedStays = await Promise.all(
          tourData.overnightStays.map(async (stay) => {
            if (!stay.coordinates) {
              const coords = await geocodeLocation(stay.location)
              if (coords) {
                needsUpdate = true
                return { ...stay, coordinates: coords }
              }
            }
            return stay
          })
        )

        // Geocode POIs
        const updatedPois = await Promise.all(
          tourData.pois.map(async (poi) => {
            if (!poi.coordinates) {
              const coords = await geocodeLocation(poi.name)
              if (coords) {
                needsUpdate = true
                return { ...poi, coordinates: coords }
              }
            }
            return poi
          })
        )

        if (needsUpdate) {
          updateTourData({
            homeLocation: updatedHome,
            overnightStays: updatedStays,
            pois: updatedPois
          })
        }
      } catch (error) {
        console.error('Geocoding error:', error)
      } finally {
        isGeocodingRef.current = false
        setGeocodingInProgress(false)
      }
    }

    geocodeLocations()
  }, [tourData.overnightStays, tourData.pois, tourData.homeLocation, updateTourData])

  // Calculate routes when itinerary changes
  useEffect(() => {
    if (!tourData.plannedItinerary) return
    
    console.log('useEffect triggered for route calculation')

    const calculateRoutes = async () => {
      if (routingRef.current) {
        console.log('Route calculation already in progress, skipping')
        return
      }
      
      routingRef.current = true
      const allRoutes = []

      console.log('Starting route calculation for', tourData.plannedItinerary.length, 'days')

      try {
        for (let dayIndex = 0; dayIndex < tourData.plannedItinerary.length; dayIndex++) {
          const day = tourData.plannedItinerary[dayIndex]
          const dayRoutes = []
          
          console.log(`Calculating routes for Day ${dayIndex + 1}:`, day)

          if (day.type === 'travel' || day.type === 'mixed') {
            // Travel day - car route between cities
            console.log('Travel day route:', day.route)
            if (day.route) {
              const start = day.route.from.coordinates
              const end = day.route.to.coordinates
              
              console.log('Travel coordinates DEBUG:', { 
               start, 
               end,
               fromLocation: day.route.from.location,
               toLocation: day.route.to.location,
               fromCoords: day.route.from.coordinates,
               toCoords: day.route.to.coordinates,
               fromCoordsType: typeof day.route.from.coordinates,
               toCoordsType: typeof day.route.to.coordinates
             })
              
              if (start && end) {
                const routeCoords = await getRoute(start, end, 'driving-car')
                const distance = calculateDistance(start, end, 'driving')
                
                console.log('Travel route calculated:', { distance, coordsLength: routeCoords.length })
                
                dayRoutes.push({
                  coordinates: routeCoords,
                  color: dayColors[dayIndex % dayColors.length],
                  type: 'driving',
                  distance: distance,
                  from: day.route.from.location,
                  to: day.route.to.location
                })
              } else {
                console.log('Missing coordinates for travel day')
              }
            } else {
              console.log('No route object for travel day')
            }
          } 
          
          if (day.type === 'tour' || day.type === 'mixed') {
            // Tour day - walking routes within city
            const overnightStay = tourData.overnightStays.find(stay => stay.id === day.overnightStayId)
            
            console.log('Tour day DEBUG:', { 
             overnightStayId: day.overnightStayId, 
             overnightStay, 
             poisCount: day.pois.length,
             overnightStayCoords: overnightStay?.coordinates,
             overnightStayLocation: overnightStay?.location,
             poisWithCoords: day.pois.map(poi => ({ name: poi.name, coords: poi.coordinates, hasCoords: !!poi.coordinates }))
           })
            
            if (overnightStay?.coordinates && day.pois.length > 0) {
              console.log('Tour day has overnight stay and POIs, calculating routes...')
              // Route from hotel to first POI
              const firstPoi = day.pois[0]
              if (firstPoi.coordinates) {
                const routeCoords = await getRoute(overnightStay.coordinates, firstPoi.coordinates, 'foot-walking')
                const distance = calculateDistance(overnightStay.coordinates, firstPoi.coordinates, 'walking')
                
                dayRoutes.push({
                  coordinates: routeCoords,
                  color: dayColors[dayIndex % dayColors.length],
                  type: 'walking',
                  distance: distance,
                  from: overnightStay.location,
                  to: firstPoi.name
                })
              }

              // Routes between POIs
              for (let i = 0; i < day.pois.length - 1; i++) {
                const currentPoi = day.pois[i]
                const nextPoi = day.pois[i + 1]
                
                if (currentPoi.coordinates && nextPoi.coordinates) {
                  const routeCoords = await getRoute(currentPoi.coordinates, nextPoi.coordinates, 'foot-walking')
                  const distance = calculateDistance(currentPoi.coordinates, nextPoi.coordinates, 'walking')
                  
                  dayRoutes.push({
                    coordinates: routeCoords,
                    color: dayColors[dayIndex % dayColors.length],
                    type: 'walking',
                    distance: distance,
                    from: currentPoi.name,
                    to: nextPoi.name
                  })
                }
              }

              // Route from last POI back to hotel
              const lastPoi = day.pois[day.pois.length - 1]
              if (lastPoi.coordinates) {
                const routeCoords = await getRoute(lastPoi.coordinates, overnightStay.coordinates, 'foot-walking')
                const distance = calculateDistance(lastPoi.coordinates, overnightStay.coordinates, 'walking')
                
                dayRoutes.push({
                  coordinates: routeCoords,
                  color: dayColors[dayIndex % dayColors.length],
                  type: 'walking',
                  distance: distance,
                  from: lastPoi.name,
                  to: overnightStay.location
                })
              }
            }
          }

          console.log(`Day ${dayIndex + 1} routes:`, dayRoutes)
          
          allRoutes.push({
            day: dayIndex,
            date: day.date,
            type: day.type,
            routes: dayRoutes
          })
        }

        console.log('Final routes array:', allRoutes)
        setRoutes(allRoutes)
      } catch (error) {
        console.error('Route calculation error:', error)
      } finally {
        routingRef.current = false
      }
    }

    calculateRoutes()
  }, [tourData.plannedItinerary, tourData.overnightStays, tourData.pois, tourData.homeLocation])

  // Get locations relevant to a specific day
  const getLocationsForDay = (dayIndex) => {
    if (!tourData.plannedItinerary || dayIndex < 0 || dayIndex >= tourData.plannedItinerary.length) {
      return { homeLocation: null, overnightStays: [], pois: [] }
    }
    
    const day = tourData.plannedItinerary[dayIndex]
    let relevantLocations = { homeLocation: null, overnightStays: [], pois: [] }
    
    // Check if home location is relevant (first or last day travel)
    if (day.type === 'travel' || day.type === 'mixed') {
      if (day.route) {
        // Check if home is part of the travel route
        if (tourData.homeLocation?.coordinates) {
          const homeCoords = [tourData.homeLocation.coordinates.latitude, tourData.homeLocation.coordinates.longitude]
          const fromCoords = day.route.from.coordinates ? [day.route.from.coordinates.latitude, day.route.from.coordinates.longitude] : null
          const toCoords = day.route.to.coordinates ? [day.route.to.coordinates.latitude, day.route.to.coordinates.longitude] : null
          
          // Check if home matches either from or to location (with some tolerance)
          if (fromCoords && Math.abs(homeCoords[0] - fromCoords[0]) < 0.01 && Math.abs(homeCoords[1] - fromCoords[1]) < 0.01) {
            relevantLocations.homeLocation = tourData.homeLocation
          } else if (toCoords && Math.abs(homeCoords[0] - toCoords[0]) < 0.01 && Math.abs(homeCoords[1] - toCoords[1]) < 0.01) {
            relevantLocations.homeLocation = tourData.homeLocation
          }
        }
        
        // Add overnight stays involved in travel
        tourData.overnightStays.forEach(stay => {
          if (stay.coordinates) {
            const stayCoords = [stay.coordinates.latitude, stay.coordinates.longitude]
            const fromCoords = day.route.from.coordinates ? [day.route.from.coordinates.latitude, day.route.from.coordinates.longitude] : null
            const toCoords = day.route.to.coordinates ? [day.route.to.coordinates.latitude, day.route.to.coordinates.longitude] : null
            
            if ((fromCoords && Math.abs(stayCoords[0] - fromCoords[0]) < 0.01 && Math.abs(stayCoords[1] - fromCoords[1]) < 0.01) ||
                (toCoords && Math.abs(stayCoords[0] - toCoords[0]) < 0.01 && Math.abs(stayCoords[1] - toCoords[1]) < 0.01)) {
              relevantLocations.overnightStays.push(stay)
            }
          }
        })
      }
    }
    
    if (day.type === 'tour' || day.type === 'mixed') {
      // Add overnight stay for tour day
      if (day.overnightStayId) {
        const overnightStay = tourData.overnightStays.find(stay => stay.id === day.overnightStayId)
        if (overnightStay && overnightStay.coordinates && !relevantLocations.overnightStays.some(s => s.id === overnightStay.id)) {
          relevantLocations.overnightStays.push(overnightStay)
        }
      }
      
      // Add POIs for this day
      if (day.pois) {
        relevantLocations.pois = day.pois.filter(poi => poi.coordinates)
      }
    }
    
    return relevantLocations
  }

  // Calculate map bounds
  const calculateBounds = () => {
    let locations = []
    
    if (selectedDay === 'all') {
      // Show all locations
      locations = [
        ...(tourData.homeLocation?.coordinates ? [[tourData.homeLocation.coordinates.latitude, tourData.homeLocation.coordinates.longitude]] : []),
        ...tourData.overnightStays.filter(stay => stay.coordinates).map(stay => [stay.coordinates.latitude, stay.coordinates.longitude]),
        ...tourData.pois.filter(poi => poi.coordinates).map(poi => [poi.coordinates.latitude, poi.coordinates.longitude])
      ]
    } else {
      // Show only locations for selected day
      const dayLocations = getLocationsForDay(parseInt(selectedDay))
      locations = [
        ...(dayLocations.homeLocation?.coordinates ? [[dayLocations.homeLocation.coordinates.latitude, dayLocations.homeLocation.coordinates.longitude]] : []),
        ...dayLocations.overnightStays.map(stay => [stay.coordinates.latitude, stay.coordinates.longitude]),
        ...dayLocations.pois.map(poi => [poi.coordinates.latitude, poi.coordinates.longitude])
      ]
    }

    return locations.length > 0 ? locations : null
  }

  // Manual geocoding trigger
  const forceGeocode = async () => {
    console.log('🌍 Starting manual geocoding...')
    
         // Geocode home location if missing
     console.log('Checking home location:', tourData.homeLocation)
     if (tourData.homeLocation?.location && !tourData.homeLocation?.coordinates) {
       console.log('Geocoding home location:', tourData.homeLocation.location)
       const coords = await geocodeLocation(tourData.homeLocation.location)
       console.log('Home geocoding result:', coords)
       if (coords) {
         updateTourData({
           homeLocation: { ...tourData.homeLocation, coordinates: coords }
         })
         console.log('✅ Home location geocoded and updated:', coords)
       } else {
         console.log('❌ Home location geocoding failed')
       }
     } else {
       console.log('Home location already has coordinates or missing location')
     }
    
         // Geocode overnight stays
     console.log('Checking overnight stays:', tourData.overnightStays)
     let needsUpdate = false
     const updatedStays = []
     for (const stay of tourData.overnightStays) {
       console.log('Checking stay:', stay)
       if (!stay.coordinates) {
         console.log('Geocoding overnight stay:', stay.location)
         const coords = await geocodeLocation(stay.location)
         console.log('Overnight stay geocoding result:', coords)
         if (coords) {
           const updatedStay = { ...stay, coordinates: coords }
           updatedStays.push(updatedStay)
           needsUpdate = true
           console.log('✅ Overnight stay geocoded:', stay.location, coords)
           console.log('Updated stay object:', updatedStay)
         } else {
           console.log('❌ Overnight stay geocoding failed for:', stay.location)
           updatedStays.push(stay)
         }
       } else {
         console.log('Stay already has coordinates:', stay.location, stay.coordinates)
         updatedStays.push(stay)
       }
     }
    
    // Geocode POIs
    const updatedPois = []
    for (const poi of tourData.pois) {
      if (!poi.coordinates) {
        console.log('Geocoding POI:', poi.name)
        const coords = await geocodeLocation(poi.name)
        if (coords) {
          updatedPois.push({ ...poi, coordinates: coords })
          needsUpdate = true
          console.log('✅ POI geocoded:', poi.name, coords)
        } else {
          updatedPois.push(poi)
        }
      } else {
        updatedPois.push(poi)
      }
    }
    
         if (needsUpdate) {
       console.log('Updating tour data with:', { updatedStays, updatedPois })
       updateTourData({
         overnightStays: updatedStays,
         pois: updatedPois
       })
       console.log('Tour data update completed')
     } else {
       console.log('No geocoding updates needed')
     }
    
    console.log('🌍 Geocoding complete')
  }

  // Manual route calculation trigger
  const forceCalculateRoutes = async () => {
    console.log('🔄 Force recalculate button clicked')
    
    if (!tourData.plannedItinerary) {
      console.log('❌ No itinerary to calculate routes for')
      return
    }
    
         console.log('📍 Starting manual route calculation...')
     console.log('Itinerary:', tourData.plannedItinerary)
     console.log('🌍 Geocoding status:', {
       homeLocation: tourData.homeLocation,
       overnightStays: tourData.overnightStays.map(stay => ({ location: stay.location, coords: stay.coordinates })),
       pois: tourData.pois.map(poi => ({ name: poi.name, coords: poi.coordinates })),
       geocodingInProgress
     })
    
    const allRoutes = []
    
         try {
      for (let dayIndex = 0; dayIndex < tourData.plannedItinerary.length; dayIndex++) {
        const day = tourData.plannedItinerary[dayIndex]
        const dayRoutes = []
        
        console.log(`Processing Day ${dayIndex + 1}:`, day)
        
        if (day.type === 'travel' || day.type === 'mixed') {
          // Travel day - car route between cities
          console.log('Travel day route:', day.route)
          if (day.route) {
            const start = day.route.from.coordinates
            const end = day.route.to.coordinates
            
            console.log('Travel coordinates:', { start, end })
            
            if (start && end) {
              const routeCoords = await getRoute(start, end, 'driving-car')
              const distance = calculateDistance(start, end, 'driving')
              
              console.log('Travel route calculated:', { distance, coordsLength: routeCoords.length })
              
              dayRoutes.push({
                coordinates: routeCoords,
                color: dayColors[dayIndex % dayColors.length],
                type: 'driving',
                distance: distance,
                from: day.route.from.location,
                to: day.route.to.location
              })
            } else {
              console.log('Missing coordinates for travel day')
            }
          } else {
            console.log('No route object for travel day')
          }
        } 
        
        if (day.type === 'tour' || day.type === 'mixed') {
          // Tour day - walking routes within city
          const overnightStay = tourData.overnightStays.find(stay => stay.id === day.overnightStayId)
          
          console.log('Tour day:', { overnightStayId: day.overnightStayId, overnightStay, poisCount: day.pois.length })
          
          if (overnightStay?.coordinates && day.pois.length > 0) {
            console.log('Tour day has overnight stay and POIs, calculating routes...')
            
            // Route from hotel to first POI
            const firstPoi = day.pois[0]
            if (firstPoi.coordinates) {
              const routeCoords = await getRoute(overnightStay.coordinates, firstPoi.coordinates, 'foot-walking')
              const distance = calculateDistance(overnightStay.coordinates, firstPoi.coordinates, 'walking')
              
              dayRoutes.push({
                coordinates: routeCoords,
                color: dayColors[dayIndex % dayColors.length],
                type: 'walking',
                distance: distance,
                from: overnightStay.location,
                to: firstPoi.name
              })
            }

            // Routes between POIs
            for (let i = 0; i < day.pois.length - 1; i++) {
              const currentPoi = day.pois[i]
              const nextPoi = day.pois[i + 1]
              
              if (currentPoi.coordinates && nextPoi.coordinates) {
                const routeCoords = await getRoute(currentPoi.coordinates, nextPoi.coordinates, 'foot-walking')
                const distance = calculateDistance(currentPoi.coordinates, nextPoi.coordinates, 'walking')
                
                dayRoutes.push({
                  coordinates: routeCoords,
                  color: dayColors[dayIndex % dayColors.length],
                  type: 'walking',
                  distance: distance,
                  from: currentPoi.name,
                  to: nextPoi.name
                })
              }
            }

            // Route from last POI back to hotel
            const lastPoi = day.pois[day.pois.length - 1]
            if (lastPoi.coordinates) {
              const routeCoords = await getRoute(lastPoi.coordinates, overnightStay.coordinates, 'foot-walking')
              const distance = calculateDistance(lastPoi.coordinates, overnightStay.coordinates, 'walking')
              
              dayRoutes.push({
                coordinates: routeCoords,
                color: dayColors[dayIndex % dayColors.length],
                type: 'walking',
                distance: distance,
                from: lastPoi.name,
                to: overnightStay.location
              })
            }
          } else {
            console.log('Tour day missing overnight stay or POIs')
          }
        }
        
        console.log(`Day ${dayIndex + 1} routes:`, dayRoutes)
        
        allRoutes.push({
          day: dayIndex,
          date: day.date,
          type: day.type,
          routes: dayRoutes
        })
      }
      
      console.log('✅ Generated route structure:', allRoutes)
      setRoutes(allRoutes)
      
    } catch (error) {
      console.error('❌ Error in route calculation:', error)
    }
  }

  // Calculate bounds (recalculated when selectedDay changes)
  const bounds = calculateBounds()
  const defaultCenter = bounds ? [bounds[0][0], bounds[0][1]] : [46.2044, 6.1432] // Default to Geneva
  
  // Filter routes based on selected day
  const routesToShow = selectedDay === 'all' 
    ? routes 
    : routes.filter(r => r.day === parseInt(selectedDay))
  
  // Debug route generation
  console.log('=== ROUTE DEBUG ===')
  console.log('Planned itinerary:', tourData.plannedItinerary)
  console.log('Routes calculated:', routes)
  console.log('Selected day:', selectedDay, 'Routes to show:', routesToShow.length)

  if (!bounds) {
    return (
      <div className="map-display">
        <h2>🗺️ Tour Map</h2>
        <div className="map-placeholder">
          <div className="placeholder-content">
            <h3>🗺️ Add locations to see them on the map</h3>
            <p>Start by adding overnight stays and points of interest</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="map-display">
      <h2>🗺️ Tour Map</h2>
      
             {/* Day Selector */}
       {tourData.plannedItinerary && tourData.plannedItinerary.length > 0 && (
         <div className="map-controls">
           <label>Show day: </label>
           <select 
             value={selectedDay} 
             onChange={(e) => setSelectedDay(e.target.value)}
           >
             <option value="all">All Days</option>
             {tourData.plannedItinerary.map((day, index) => (
               <option key={index} value={index.toString()}>
                 Day {index + 1} ({day.type === 'travel' ? '🚗 Travel' : day.type === 'mixed' ? '🚗🚶 Mixed' : '🚶 Tour'})
               </option>
             ))}
           </select>
           
           <button 
             onClick={() => {
               console.log('🔄 BUTTON CLICKED!')
               forceCalculateRoutes()
             }}
             style={{ 
               marginLeft: '1rem', 
               padding: '0.4rem 0.6rem', 
               background: '#667eea', 
               color: 'white', 
               border: 'none', 
               borderRadius: '4px',
               fontSize: '0.8rem'
             }}
           >
             🔄 Recalculate Routes
           </button>
           
           <button 
             onClick={forceGeocode}
             style={{ 
               marginLeft: '0.5rem', 
               padding: '0.4rem 0.6rem', 
               background: '#48bb78', 
               color: 'white', 
               border: 'none', 
               borderRadius: '4px',
               fontSize: '0.8rem'
             }}
           >
             🌍 Fix Geocoding
           </button>
         </div>
       )}

      <div className="leaflet-map-container">
        <MapContainer
          center={defaultCenter}
          zoom={10}
          style={{ height: '500px', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapController bounds={bounds} />

          {/* Filtered Location Markers */}
          {(() => {
            const locationsToShow = selectedDay === 'all' 
              ? {
                  homeLocation: tourData.homeLocation,
                  overnightStays: tourData.overnightStays,
                  pois: tourData.pois
                }
              : getLocationsForDay(parseInt(selectedDay))
            
            return (
              <>
                {/* Home Location Marker */}
                {locationsToShow.homeLocation?.coordinates && (
                  <Marker
                    position={[locationsToShow.homeLocation.coordinates.latitude, locationsToShow.homeLocation.coordinates.longitude]}
                    icon={homeIcon}
                  >
                    <Popup>
                      <strong>🏠 Home</strong><br />
                      {locationsToShow.homeLocation.location}
                    </Popup>
                  </Marker>
                )}

                {/* Overnight Stays Markers */}
                {locationsToShow.overnightStays.map(stay => (
                  stay.coordinates && (
                    <Marker
                      key={stay.id}
                      position={[stay.coordinates.latitude, stay.coordinates.longitude]}
                      icon={hotelIcon}
                    >
                      <Popup>
                        <strong>🏨 Overnight Stay</strong><br />
                        {stay.location}
                      </Popup>
                    </Marker>
                  )
                ))}

                {/* POI Markers */}
                {locationsToShow.pois.map(poi => (
                  poi.coordinates && (
                    <Marker
                      key={poi.id}
                      position={[poi.coordinates.latitude, poi.coordinates.longitude]}
                      icon={poiIcon}
                    >
                      <Popup>
                        <strong>📍 {poi.name}</strong><br />
                        {poi.category && <em>{poi.category}</em>}
                      </Popup>
                    </Marker>
                  )
                ))}
              </>
            )
          })()}

                     {/* Route Lines */}
           {routesToShow.map(dayRoute => 
             dayRoute.routes.map((route, routeIndex) => (
               <Polyline
                 key={`${selectedDay}-${dayRoute.day}-${routeIndex}-${route.from}-${route.to}`}
                 positions={route.coordinates}
                 color={route.color}
                 weight={route.type === 'driving' ? 4 : 3}
                 opacity={route.type === 'driving' ? 0.8 : 0.6}
                 dashArray={route.type === 'walking' ? '5, 10' : null}
               />
             ))
           )}
        </MapContainer>
      </div>

      {/* Route Legend */}
      {routes.length > 0 && (
        <div className="route-legend">
          <h4>🛣️ Route Legend:</h4>
          <div className="legend-items">
            <div className="legend-item">
              <div className="route-line driving"></div>
              <span>🚗 Car travel (between cities)</span>
            </div>
            <div className="legend-item">
              <div className="route-line walking"></div>
              <span>🚶 Walking (within cities)</span>
            </div>
          </div>
          
          {routesToShow.length > 0 && (
            <div className="route-stats">
              {routesToShow.map(dayRoute => (
                <div key={dayRoute.day} className="day-stats">
                  <strong style={{ color: dayColors[dayRoute.day % dayColors.length] }}>
                    Day {dayRoute.day + 1} ({dayRoute.type}):
                  </strong>
                  <span>
                    {dayRoute.routes.reduce((total, route) => total + route.distance, 0).toFixed(1)} km total
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {geocodingInProgress && (
        <div className="geocoding-status">
          📍 Finding locations...
        </div>
      )}

      {/* Attribution */}
      <div className="map-attribution">
        <small>
          Maps by <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
          {ROUTING_API_KEY && ' • Routing by OpenRouteService'}
        </small>
      </div>
    </div>
  )
} 