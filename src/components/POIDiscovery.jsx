import React, { useState } from 'react'
import { discoverPOIsNearLocation, getPOICategories } from '../services/poiDiscovery'

export const POIDiscovery = ({ tourData, updateTourData }) => {
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoveredPois, setDiscoveredPois] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedCategories, setSelectedCategories] = useState(['tourist_attraction', 'restaurants', 'culture'])
  const [searchRadius, setSearchRadius] = useState(5)
  const [error, setError] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const availableCategories = getPOICategories()
  
  // Get available locations for search (overnight stays + home location + main POIs)
  const getAvailableLocations = () => {
    const locations = []
    
    if (tourData.homeLocation?.location) {
      locations.push({
        id: 'home',
        name: tourData.homeLocation.location,
        coordinates: tourData.homeLocation.coordinates,
        type: 'home'
      })
    }
    
    tourData.overnightStays.forEach(stay => {
      locations.push({
        id: stay.id,
        name: stay.location,
        coordinates: stay.coordinates,
        type: 'overnight'
      })
    })
    
    // Add main POIs as searchable locations
    const mainPOIs = tourData.pois.filter(poi => poi.type !== 'secondary')
    mainPOIs.forEach(poi => {
      if (poi.coordinates) {
        locations.push({
          id: `poi_${poi.id}`,
          name: poi.name,
          coordinates: poi.coordinates,
          type: 'main_poi',
          category: poi.category
        })
      }
    })
    
    return locations
  }

  const handleDiscoverPOIs = async () => {
    if (!selectedLocation) {
      setError('Please select a location to search near')
      return
    }

    if (selectedCategories.length === 0) {
      setError('Please select at least one category')
      return
    }

    setIsDiscovering(true)
    setError('')
    setDiscoveredPois([])

    try {
      const location = getAvailableLocations().find(loc => loc.id === selectedLocation)
      if (!location) {
        throw new Error('Selected location not found')
      }

      console.log('Discovering POIs near:', location.name)
      
      const pois = await discoverPOIsNearLocation(location, {
        categories: selectedCategories,
        radiusKm: searchRadius,
        maxResults: 30
      })

      setDiscoveredPois(pois)
      
      if (pois.length === 0) {
        setError('No POIs found in the selected area. Try expanding the search radius or changing categories.')
      }

    } catch (err) {
      setError(`Error discovering POIs: ${err.message}`)
      console.error('POI discovery error:', err)
    } finally {
      setIsDiscovering(false)
    }
  }

  const handleDiscoverAllMainPOIs = async () => {
    setIsDiscovering(true)
    setError('')
    
    const mainPOIsWithCoords = tourData.pois.filter(poi => poi.type !== 'secondary' && poi.coordinates)
    const allDiscoveredPOIs = []
    
    try {
      for (const mainPOI of mainPOIsWithCoords) {
        console.log(`Discovering POIs near main POI: ${mainPOI.name}`)
        
        const pois = await discoverPOIsNearLocation(mainPOI, {
          categories: selectedCategories,
          radiusKm: Math.min(searchRadius, 2), // Smaller radius for main POI searches
          maxResults: 10 // Fewer results per main POI
        })
        
        // Mark these POIs with the main POI they're near
        const markedPOIs = pois.map(poi => ({
          ...poi,
          nearMainPOI: mainPOI.name
        }))
        
        allDiscoveredPOIs.push(...markedPOIs)
      }
      
      // Remove duplicates
      const uniquePOIs = allDiscoveredPOIs.filter((poi, index, self) => 
        index === self.findIndex(p => p.name === poi.name)
      )
      
      setDiscoveredPois(uniquePOIs)
      
      if (uniquePOIs.length === 0) {
        setError('No secondary POIs found near your main POIs. Try expanding the search radius or changing categories.')
      }

    } catch (err) {
      setError(`Error discovering POIs: ${err.message}`)
      console.error('POI discovery error:', err)
    } finally {
      setIsDiscovering(false)
    }
  }

  const addPOIToTour = (poi) => {
    console.log('Trying to add POI:', poi.name)
    console.log('Existing POIs:', tourData.pois.map(p => ({ name: p.name, coords: p.coordinates })))
    
    // Improved duplicate detection logic
    const duplicateInfo = tourData.pois.find(existingPoi => {
      // Check for exact name match (case insensitive, trimmed)
      const nameMatch = existingPoi.name.toLowerCase().trim() === poi.name.toLowerCase().trim()
      
      // Check for very close coordinates (within ~50 meters = 0.0005 degrees)
      const veryCloseCoords = existingPoi.coordinates && poi.coordinates &&
        Math.abs(existingPoi.coordinates.latitude - poi.coordinates.latitude) < 0.0005 &&
        Math.abs(existingPoi.coordinates.longitude - poi.coordinates.longitude) < 0.0005
      
      if (nameMatch) {
        console.log(`Name match found: "${existingPoi.name}" === "${poi.name}"`)
        return true
      }
      
      if (veryCloseCoords) {
        console.log(`Very close coordinates found: ${existingPoi.name} vs ${poi.name}`)
        return true
      }
      
      return false
    })

    if (duplicateInfo) {
      console.log(`Duplicate POI detected: ${poi.name} (matches ${duplicateInfo.name})`)
      const userChoice = confirm(
        `"${poi.name}" seems very similar to "${duplicateInfo.name}" already in your tour.\n\n` +
        `Do you want to add it anyway as a separate POI?`
      )
      if (!userChoice) {
        return
      }
      console.log('User chose to add duplicate POI anyway')
    }

    // Add POI to tour as secondary POI
    const newPoi = {
      id: Date.now(),
      name: poi.name,
      category: poi.category,
      duration: poi.duration,
      coordinates: poi.coordinates,
      source: poi.source,
      type: 'secondary',
      nearMainPOI: getLocationName(selectedLocation)
    }

    const updatedPois = [...tourData.pois, newPoi]
    updateTourData({ pois: updatedPois })

    // Remove from discovered list
    setDiscoveredPois(prev => prev.filter(p => p.id !== poi.id))
  }

  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const getLocationName = (locationId) => {
    const location = getAvailableLocations().find(loc => loc.id === locationId)
    return location ? location.name : 'Unknown location'
  }

  const getLocationIcon = (locationType) => {
    switch(locationType) {
      case 'home': return '🏠'
      case 'overnight': return '🏨'
      case 'main_poi': return '📍'
      default: return '📍'
    }
  }

  const availableLocations = getAvailableLocations()

  if (availableLocations.length === 0) {
    return (
      <div className="poi-discovery">
        <div className="poi-discovery-header">
          <h4>🔍 Discover Secondary POIs</h4>
          <p className="text-muted">Add your home location, overnight stays, and main POIs first to discover nearby attractions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="poi-discovery">
      <div className="poi-discovery-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h4>🔍 Discover Secondary POIs</h4>
        <button className="expand-btn" title={isExpanded ? 'Collapse' : 'Expand'}>
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="poi-discovery-content">
          <div className="discovery-controls">
            {/* Location Selection */}
            <div className="control-group">
              <label>Search near:</label>
              <select 
                value={selectedLocation} 
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="location-select"
              >
                <option value="">Select a location...</option>
                {availableLocations.map(location => (
                  <option key={location.id} value={location.id}>
                    {getLocationIcon(location.type)} {location.name}
                    {location.type === 'main_poi' && location.category ? ` (${location.category})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Selection */}
            <div className="control-group">
              <label>Categories:</label>
              <div className="category-checkboxes">
                {availableCategories.map(category => (
                  <label key={category.id} className="category-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                    />
                    <span>{category.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Search Radius */}
            <div className="control-group">
              <label>Search radius: {searchRadius} km</label>
              <input
                type="range"
                min="1"
                max="20"
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseInt(e.target.value))}
                className="radius-slider"
              />
            </div>

            {/* Search Button */}
            <button 
              onClick={handleDiscoverPOIs}
              disabled={isDiscovering || !selectedLocation || selectedCategories.length === 0}
              className="discover-btn"
            >
              {isDiscovering ? '🔍 Searching...' : '🔍 Discover Secondary POIs'}
            </button>
            
            {/* Auto-discover button for all main POIs */}
            {tourData.pois.filter(poi => poi.type !== 'secondary' && poi.coordinates).length > 0 && (
              <button 
                onClick={handleDiscoverAllMainPOIs}
                disabled={isDiscovering}
                className="discover-all-btn"
              >
                {isDiscovering ? '🔍 Searching...' : '🚀 Auto-discover near all main POIs'}
              </button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="discovery-error">
              ⚠️ {error}
            </div>
          )}

          {/* Results */}
          {discoveredPois.length > 0 && (
            <div className="discovery-results">
              <h5>Found {discoveredPois.length} POIs:</h5>
              <div className="discovered-pois-list">
                {discoveredPois.map(poi => (
                  <div key={poi.id} className="discovered-poi-item">
                    <div className="poi-info">
                      <div className="poi-name">{poi.name}</div>
                      <div className="poi-meta">
                        <span className="poi-category">{poi.category}</span>
                        <span className="poi-distance">{poi.distance?.toFixed(1)} km away</span>
                        {poi.nearMainPOI && (
                          <span className="poi-near-main">near {poi.nearMainPOI}</span>
                        )}
                        <span className="poi-duration">
                          {poi.duration === 'quick' && '⚡ Quick'}
                          {poi.duration === 'half-day' && '🕐 Half Day'}
                          {poi.duration === 'full-day' && '🕘 Full Day'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => addPOIToTour(poi)}
                      className="add-poi-btn"
                      title="Add to tour"
                    >
                      ➕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isDiscovering && (
            <div className="discovery-loading">
              <div className="loading-spinner"></div>
              <span>Searching for POIs...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 