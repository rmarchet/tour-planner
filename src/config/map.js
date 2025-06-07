// OpenStreetMap Configuration
// Using free and open-source services - no API keys required!

// Map style from MapTiler (free tier available)
export const MAP_STYLE = 'https://api.maptiler.com/maps/streets-v2/style.json?key=demo'

// Alternative free styles:
// export const MAP_STYLE = 'https://tiles.stadiamaps.com/styles/osm_bright.json' // Requires free API key
// export const MAP_STYLE = 'https://api.mapbox.com/styles/v1/mapbox/streets-v12' // Requires Mapbox token

// Geocoding service (Nominatim - free OpenStreetMap service)
export const GEOCODING_URL = 'https://nominatim.openstreetmap.org/search'

// Routing service (OpenRouteService - free with registration)
// You can get a free API key at: https://openrouteservice.org/dev/
export const ROUTING_API_KEY = 'demo' // Replace with your ORS key for production use
export const ROUTING_URL = 'https://api.openrouteservice.org/v2/directions'

// Alternative routing services:
// OSRM (completely free, no key needed): http://router.project-osrm.org/route/v1/driving/
// GraphHopper (free tier): https://graphhopper.com/api/1/route

export const DEFAULT_CENTER = {
  latitude: 40.7128,
  longitude: -74.0060, // NYC
  zoom: 10
} 