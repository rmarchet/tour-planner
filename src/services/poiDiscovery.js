// POI Discovery Service using OpenStreetMap Overpass API
// This service finds nearby points of interest given a location

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter'

// POI categories mapping to OSM tags
const POI_CATEGORIES = {
  'tourist_attraction': {
    name: '🏛️ Tourist Attractions',
    tags: ['tourism=attraction', 'tourism=museum', 'tourism=gallery', 'tourism=viewpoint', 'historic=castle', 'historic=monument']
  },
  'restaurants': {
    name: '🍽️ Restaurants & Food',
    tags: ['amenity=restaurant', 'amenity=cafe', 'amenity=bar', 'amenity=pub', 'amenity=fast_food']
  },
  'culture': {
    name: '🎭 Culture & Arts',
    tags: ['tourism=museum', 'tourism=gallery', 'tourism=theatre', 'amenity=theatre', 'amenity=cinema']
  },
  'nature': {
    name: '🌳 Parks & Nature',
    tags: ['leisure=park', 'tourism=national_park', 'natural=beach', 'leisure=garden', 'landuse=forest']
  },
  'shopping': {
    name: '🛍️ Shopping',
    tags: ['shop=mall', 'amenity=marketplace', 'shop=department_store', 'tourism=shop']
  },
  'religious': {
    name: '⛪ Religious Sites',
    tags: ['amenity=place_of_worship', 'tourism=place_of_worship', 'historic=church', 'historic=monastery']
  },
  'entertainment': {
    name: '🎢 Entertainment',
    tags: ['tourism=theme_park', 'tourism=zoo', 'leisure=amusement_arcade', 'amenity=casino']
  }
}

// Build Overpass query for a specific location and categories
const buildOverpassQuery = (latitude, longitude, radiusKm = 5, categories = ['tourist_attraction']) => {
  const radiusMeters = radiusKm * 1000
  
  // Collect all relevant tags for the selected categories
  const allTags = []
  categories.forEach(category => {
    if (POI_CATEGORIES[category]) {
      allTags.push(...POI_CATEGORIES[category].tags)
    }
  })
  
  // Build the Overpass QL query
  const tagQueries = allTags.map(tag => {
    const [key, value] = tag.split('=')
    if (value) {
      return `node["${key}"="${value}"](around:${radiusMeters},${latitude},${longitude});
              way["${key}"="${value}"](around:${radiusMeters},${latitude},${longitude});`
    } else {
      return `node["${key}"](around:${radiusMeters},${latitude},${longitude});
              way["${key}"](around:${radiusMeters},${latitude},${longitude});`
    }
  }).join('\n')
  
  return `
    [out:json][timeout:25];
    (
      ${tagQueries}
    );
    out center meta;
  `
}

// Parse Overpass API response and extract POI data
const parseOverpassResponse = (data) => {
  const pois = []
  
  data.elements.forEach(element => {
    // Get coordinates (use center for ways, direct coords for nodes)
    const lat = element.lat || (element.center && element.center.lat)
    const lon = element.lon || (element.center && element.center.lon)
    
    if (!lat || !lon) return
    
    // Extract name and other useful tags
    const tags = element.tags || {}
    const name = tags.name || tags.brand || tags.operator || 'Unnamed POI'
    
    // Skip if no proper name
    if (name === 'Unnamed POI' && !tags.tourism && !tags.amenity) return
    
    // Determine category based on tags
    let category = 'General'
    let duration = 'half-day'
    
    if (tags.tourism) {
      switch (tags.tourism) {
        case 'museum':
        case 'gallery':
          category = 'Culture'
          duration = 'half-day'
          break
        case 'attraction':
        case 'viewpoint':
          category = 'Tourist Attraction'
          duration = 'half-day'
          break
        case 'theme_park':
        case 'zoo':
          category = 'Entertainment'
          duration = 'full-day'
          break
        default:
          category = 'Tourist Attraction'
      }
    } else if (tags.amenity) {
      switch (tags.amenity) {
        case 'restaurant':
        case 'cafe':
        case 'bar':
        case 'pub':
          category = 'Food & Drink'
          duration = 'quick'
          break
        case 'theatre':
        case 'cinema':
          category = 'Entertainment'
          duration = 'quick'
          break
        case 'place_of_worship':
          category = 'Religious'
          duration = 'quick'
          break
        default:
          category = 'General'
      }
    } else if (tags.historic) {
      category = 'Historic'
      duration = 'half-day'
    } else if (tags.leisure === 'park' || tags.natural) {
      category = 'Nature'
      duration = 'half-day'
    }
    
    pois.push({
      id: `osm_${element.type}_${element.id}`,
      name: name,
      category: category,
      duration: duration,
      coordinates: {
        latitude: lat,
        longitude: lon
      },
      tags: tags,
      source: 'OpenStreetMap'
    })
  })
  
  // Remove duplicates and limit results
  const uniquePois = pois.filter((poi, index, self) => 
    index === self.findIndex(p => p.name === poi.name && 
      Math.abs(p.coordinates.latitude - poi.coordinates.latitude) < 0.001)
  )
  
  return uniquePois.slice(0, 50) // Limit to 50 results
}

// Main function to discover POIs near a location
export const discoverPOIsNearLocation = async (location, options = {}) => {
  const {
    categories = ['tourist_attraction', 'restaurants', 'culture'],
    radiusKm = 5,
    maxResults = 20
  } = options
  
  try {
    // First, we need to geocode the location if it's a string
    let coordinates
    if (typeof location === 'string') {
      coordinates = await geocodeLocation(location)
    } else if (location.coordinates) {
      coordinates = location.coordinates
    } else {
      coordinates = location
    }
    
    if (!coordinates) {
      throw new Error('Could not determine coordinates for location')
    }
    
    // Build and execute Overpass query
    const query = buildOverpassQuery(
      coordinates.latitude, 
      coordinates.longitude, 
      radiusKm, 
      categories
    )
    
    console.log('Querying Overpass API for POIs near:', coordinates)
    
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`
    })
    
    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`)
    }
    
    const data = await response.json()
    const pois = parseOverpassResponse(data)
    
    console.log(`Found ${pois.length} POIs near ${location}`)
    
    // Sort by distance from center point and limit results
    const poisWithDistance = pois.map(poi => ({
      ...poi,
      distance: calculateDistance(coordinates, poi.coordinates)
    })).sort((a, b) => a.distance - b.distance)
    
    return poisWithDistance.slice(0, maxResults)
    
  } catch (error) {
    console.error('Error discovering POIs:', error)
    throw error
  }
}

// Helper function to geocode a location string using Nominatim (OSM's geocoding service)
const geocodeLocation = async (locationString) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(locationString)}`
    )
    const data = await response.json()
    
    if (data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      }
    }
    
    return null
  } catch (error) {
    console.error('Geocoding error:', error)
    return null
  }
}

// Helper function to calculate distance between two coordinates
const calculateDistance = (coord1, coord2) => {
  const R = 6371 // Earth's radius in km
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Get available POI categories
export const getPOICategories = () => {
  return Object.entries(POI_CATEGORIES).map(([key, value]) => ({
    id: key,
    name: value.name,
    tags: value.tags
  }))
} 