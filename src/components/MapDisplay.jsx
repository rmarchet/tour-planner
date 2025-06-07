import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { MAP_STYLE, GEOCODING_URL, ROUTING_URL, ROUTING_API_KEY, DEFAULT_CENTER } from '../config/map'

// Import MapLibre components differently to avoid bundling issues
import { Map, Marker, Source, Layer } from 'react-map-gl/maplibre'

// Color palette for different days
const dayColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43'
]

export const MapDisplay = ({ tourData, updateTourData }) => {
  const [viewport, setViewport] = useState(DEFAULT_CENTER)
  const [routeData, setRouteData] = useState([])
  const [geocodingInProgress, setGeocodingInProgress] = useState(false)

  // Geocode a single location using Nominatim
  const geocodeLocation = async (query) => {
    try {
      const response = await fetch(
        `${GEOCODING_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`
      )
      const data = await response.json()
      
      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        }
      }
      return null
    } catch (error) {
      console.warn(`Could not geocode: ${query}`, error)
      return null
    }
  }

  // Geocode locations when they're added
  useEffect(() => {
    if (geocodingInProgress) return

    const geocodeLocations = async () => {
      let needsUpdate = false
      setGeocodingInProgress(true)

      try {
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
            overnightStays: updatedStays,
            pois: updatedPois
          })
        }
      } catch (error) {
        console.error('Geocoding error:', error)
      } finally {
        setGeocodingInProgress(false)
      }
    }

    const hasUngeocoded = [
      ...tourData.overnightStays.filter(stay => !stay.coordinates),
      ...tourData.pois.filter(poi => !poi.coordinates)
    ].length > 0

    if (hasUngeocoded) {
      geocodeLocations()
    }
  }, [tourData.overnightStays, tourData.pois, geocodingInProgress, updateTourData])

  // Calculate routes for planned itinerary
  useEffect(() => {
    if (!tourData.plannedItinerary) {
      setRouteData([])
      return
    }

    const calculateRoutes = async () => {
      const routes = []

      for (let dayIndex = 0; dayIndex < tourData.plannedItinerary.length; dayIndex++) {
        const day = tourData.plannedItinerary[dayIndex]
        
        if (day.pois.length === 0 || !day.overnightStay.coordinates) continue

        // Create waypoints: start from overnight stay, visit POIs, return to overnight stay
        const validPois = day.pois.filter(poi => poi.coordinates)
        if (validPois.length === 0) continue

        const waypoints = [
          day.overnightStay.coordinates,
          ...validPois.map(poi => poi.coordinates),
          day.overnightStay.coordinates
        ]

        try {
          // Create coordinates string for OpenRouteService
          const coordinates = waypoints.map(wp => [wp.longitude, wp.latitude])
          
          const response = await fetch(ROUTING_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': ROUTING_API_KEY
            },
            body: JSON.stringify({
              coordinates: coordinates,
              format: 'geojson',
              options: {
                avoid_features: ['highways'] // Optional: avoid highways for scenic routes
              }
            })
          })

          if (response.ok) {
            const routeData = await response.json()
            
            if (routeData.features && routeData.features.length > 0) {
              routes.push({
                dayIndex,
                geometry: routeData.features[0].geometry,
                color: dayColors[dayIndex % dayColors.length],
                distance: routeData.features[0].properties.summary.distance,
                duration: routeData.features[0].properties.summary.duration
              })
            }
          } else {
            // Fallback: create simple straight lines between points
            console.warn(`Routing failed for day ${dayIndex + 1}, using straight lines`)
            routes.push({
              dayIndex,
              geometry: {
                type: 'LineString',
                coordinates: coordinates
              },
              color: dayColors[dayIndex % dayColors.length],
              distance: null,
              duration: null
            })
          }
        } catch (error) {
          console.warn(`Could not calculate route for day ${dayIndex + 1}:`, error)
          
          // Fallback: create simple straight lines
          const coordinates = waypoints.map(wp => [wp.longitude, wp.latitude])
          routes.push({
            dayIndex,
            geometry: {
              type: 'LineString',
              coordinates: coordinates
            },
            color: dayColors[dayIndex % dayColors.length],
            distance: null,
            duration: null
          })
        }
      }

      setRouteData(routes)
    }

    calculateRoutes()
  }, [tourData.plannedItinerary])

  // Fit map bounds to show all locations
  const bounds = useMemo(() => {
    const allLocations = [
      ...tourData.overnightStays.filter(stay => stay.coordinates).map(stay => stay.coordinates),
      ...tourData.pois.filter(poi => poi.coordinates).map(poi => poi.coordinates)
    ]

    if (allLocations.length === 0) return null

    const longitudes = allLocations.map(loc => loc.longitude)
    const latitudes = allLocations.map(loc => loc.latitude)

    return {
      west: Math.min(...longitudes),
      east: Math.max(...longitudes),
      south: Math.min(...latitudes),
      north: Math.max(...latitudes)
    }
  }, [tourData.overnightStays, tourData.pois])

  // Update viewport when bounds change
  useEffect(() => {
    if (bounds) {
      const padding = 0.01 // Add some padding around the bounds
      setViewport(prev => ({
        ...prev,
        longitude: (bounds.west + bounds.east) / 2,
        latitude: (bounds.south + bounds.north) / 2,
        zoom: Math.min(12, Math.max(8, 
          Math.log2(360 / Math.max(bounds.east - bounds.west, bounds.north - bounds.south)) - 1
        ))
      }))
    }
  }, [bounds])

  const onMove = useCallback((evt) => {
    setViewport(evt.viewState)
  }, [])

  return (
    <div className="map-display">
      <h2>🗺️ Tour Map</h2>
      
      <div style={{ height: '600px', width: '100%', position: 'relative' }}>
        <Map
          {...viewport}
          onMove={onMove}
          mapStyle={MAP_STYLE}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Route Lines */}
          {routeData.map((route) => (
            <Source
              key={`route-${route.dayIndex}`}
              id={`route-${route.dayIndex}`}
              type="geojson"
              data={{
                type: 'Feature',
                geometry: route.geometry
              }}
            >
              <Layer
                id={`route-line-${route.dayIndex}`}
                type="line"
                paint={{
                  'line-color': route.color,
                  'line-width': 4,
                  'line-opacity': 0.8
                }}
              />
            </Source>
          ))}

          {/* Overnight Stay Markers */}
          {tourData.overnightStays.map((stay) => (
            stay.coordinates && (
              <Marker
                key={`stay-${stay.id}`}
                longitude={stay.coordinates.longitude}
                latitude={stay.coordinates.latitude}
                anchor="center"
              >
                <div
                  style={{
                    backgroundColor: '#FF6B6B',
                    border: '2px solid white',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    cursor: 'pointer'
                  }}
                  title={stay.location}
                >
                  🏨
                </div>
              </Marker>
            )
          ))}

          {/* POI Markers */}
          {tourData.pois.map((poi) => (
            poi.coordinates && (
              <Marker
                key={`poi-${poi.id}`}
                longitude={poi.coordinates.longitude}
                latitude={poi.coordinates.latitude}
                anchor="center"
              >
                <div
                  style={{
                    backgroundColor: '#4ECDC4',
                    border: '2px solid white',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    cursor: 'pointer'
                  }}
                  title={`${poi.name} (${poi.category})`}
                >
                  📍
                </div>
              </Marker>
            )
          ))}
        </Map>

        {geocodingInProgress && (
          <div className="geocoding-status">
            📍 Finding locations on map...
          </div>
        )}
      </div>

      {/* Map Legend */}
      {routeData.length > 0 && (
        <div className="map-legend">
          <h4>Route Legend</h4>
          {routeData.map((route) => (
            <div key={route.dayIndex} className="legend-item">
              <div 
                className="color-indicator" 
                style={{ backgroundColor: route.color }}
              ></div>
              <span>
                Day {route.dayIndex + 1}
                {route.distance && (
                  <span className="route-stats">
                    {' '}({(route.distance / 1000).toFixed(1)}km, {Math.round(route.duration / 60)}min)
                  </span>
                )}
              </span>
            </div>
          ))}
          <div className="map-attribution">
            <small>
              Powered by <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
              {' '}& <a href="https://openrouteservice.org/" target="_blank" rel="noopener noreferrer">OpenRouteService</a>
            </small>
          </div>
        </div>
      )}
    </div>
  )
} 