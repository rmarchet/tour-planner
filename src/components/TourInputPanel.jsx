import React, { useState } from 'react'
import { format, addDays, differenceInDays } from 'date-fns'

export const TourInputPanel = ({ tourData, updateTourData }) => {
  const [newOvernightStay, setNewOvernightStay] = useState('')
  const [newPoi, setNewPoi] = useState({ name: '', category: '', duration: 'half-day' })
  const [homeLocationInput, setHomeLocationInput] = useState(tourData.homeLocation?.location || '')

  const handleDateChange = (field, value) => {
    updateTourData({ [field]: value })
  }

  const updateHomeLocation = (location) => {
    setHomeLocationInput(location)
    updateTourData({ 
      homeLocation: { 
        location: location.trim(), 
        coordinates: null // Will be geocoded
      } 
    })
  }

  const addOvernightStay = () => {
    if (newOvernightStay.trim()) {
      const updatedStays = [...tourData.overnightStays, {
        id: Date.now(),
        location: newOvernightStay.trim(),
        coordinates: null // Will be set when geocoded
      }]
      updateTourData({ overnightStays: updatedStays })
      setNewOvernightStay('')
    }
  }

  const removeOvernightStay = (id) => {
    const updatedStays = tourData.overnightStays.filter(stay => stay.id !== id)
    updateTourData({ overnightStays: updatedStays })
  }

  const addPoi = () => {
    if (newPoi.name.trim()) {
      const updatedPois = [...tourData.pois, {
        id: Date.now(),
        name: newPoi.name.trim(),
        category: newPoi.category.trim() || 'General',
        duration: newPoi.duration,
        coordinates: null // Will be set when geocoded
      }]
      updateTourData({ pois: updatedPois })
      setNewPoi({ name: '', category: '', duration: 'half-day' })
    }
  }

  const removePoi = (id) => {
    const updatedPois = tourData.pois.filter(poi => poi.id !== id)
    updateTourData({ pois: updatedPois })
  }

  const updatePoiDuration = (id, newDuration) => {
    const updatedPois = tourData.pois.map(poi => 
      poi.id === id ? { ...poi, duration: newDuration } : poi
    )
    updateTourData({ pois: updatedPois })
  }

  const clearData = () => {
    if (confirm('Clear all data and start fresh?')) {
      localStorage.removeItem('tourPlannerData')
      window.location.reload()
    }
  }

  // Helper function to calculate total time for POIs
  const calculatePOITime = (pois) => {
    const getMinutes = (duration) => {
      switch(duration) {
        case 'quick': return 90 // 1.5 hours
        case 'half-day': return 210 // 3.5 hours
        case 'full-day': return 420 // 7 hours
        default: return 210 // Default to half-day
      }
    }
    
    return pois.reduce((total, poi) => total + getMinutes(poi.duration || 'half-day'), 0)
  }

  const generateItinerary = () => {
    if (!tourData.startDate || !tourData.endDate || tourData.overnightStays.length === 0) {
      alert('Please fill in start date, end date, and at least one overnight stay.')
      return
    }

    if (!tourData.homeLocation?.location) {
      alert('Please add your home location to plan travel from/to home.')
      return
    }

    // Calculate trip duration
    const totalDays = differenceInDays(new Date(tourData.endDate), new Date(tourData.startDate)) + 1
    
    // Determine if first/last days can include POIs (if travel time is reasonable)
    const MAX_TRAVEL_TIME_FOR_ACTIVITIES = 240 // 4 hours max travel to still include POI activities
    
    // Estimate travel times (in practice, these would be calculated from actual routes)
    const firstDayTravelTime = 180 // Default 3 hours - could be calculated from actual distance
    const lastDayTravelTime = 180 // Default 3 hours - could be calculated from actual distance
    
    const canIncludeActivitiesOnFirstDay = firstDayTravelTime <= MAX_TRAVEL_TIME_FOR_ACTIVITIES
    const canIncludeActivitiesOnLastDay = lastDayTravelTime <= MAX_TRAVEL_TIME_FOR_ACTIVITIES
    
    // Calculate available days for POI distribution
    let tourDays = totalDays - 2 // Middle days
    if (canIncludeActivitiesOnFirstDay) tourDays += 1
    if (canIncludeActivitiesOnLastDay) tourDays += 1
    
    // Optimized POI distribution with geographic clustering and duration balancing
    const distributePOIsByDuration = (pois, availableDays) => {
      if (pois.length === 0) return []
      
      // Convert durations to hours for calculation
      const getHours = (duration) => {
        switch(duration) {
          case 'quick': return 1.5
          case 'half-day': return 3.5
          case 'full-day': return 7
          default: return 3.5 // Default to half-day
        }
      }
      
      // Calculate distance between two coordinates (Haversine formula)
      const calculateDistance = (coord1, coord2) => {
        if (!coord1 || !coord2) return Infinity
        const R = 6371 // Earth's radius in km
        const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180
        const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
        return R * c
      }
      
      // Step 1: Separate full-day POIs (they need their own day)
      const fullDayPOIs = pois.filter(poi => (poi.duration || 'half-day') === 'full-day')
      const otherPOIs = pois.filter(poi => (poi.duration || 'half-day') !== 'full-day')
      
      console.log(`Optimizing ${pois.length} POIs: ${fullDayPOIs.length} full-day, ${otherPOIs.length} others`)
      
      // Step 2: Group other POIs by geographic proximity using simple clustering
      const clusterPOIs = (poisToCluster) => {
        if (poisToCluster.length === 0) return []
        if (poisToCluster.length === 1) return [poisToCluster]
        
        const clusters = []
        const used = new Set()
        
        for (const poi of poisToCluster) {
          if (used.has(poi.id)) continue
          
          const cluster = [poi]
          used.add(poi.id)
          
          // Find nearby POIs (within reasonable distance)
          for (const otherPoi of poisToCluster) {
            if (used.has(otherPoi.id)) continue
            
            const distance = calculateDistance(poi.coordinates, otherPoi.coordinates)
            if (distance < 20) { // Within 20km - adjust as needed
              cluster.push(otherPoi)
              used.add(otherPoi.id)
            }
          }
          
          clusters.push(cluster)
        }
        
        return clusters
      }
      
      // Step 3: Create optimal day combinations
      const dailyPOIs = []
      const hoursPerDay = 8
      
      // Add full-day POIs first (each gets its own day)
      fullDayPOIs.forEach(poi => {
        dailyPOIs.push([poi])
      })
      
      // Cluster remaining POIs by geography
      const clusters = clusterPOIs(otherPOIs)
      console.log(`Created ${clusters.length} geographic clusters`)
      
      // Step 4: Combine clusters into daily schedules
      let remainingDays = availableDays - fullDayPOIs.length
      
      if (remainingDays <= 0) {
        console.warn('Not enough days for all POIs - some full-day POIs may be truncated')
        return dailyPOIs.slice(0, availableDays)
      }
      
      // Sort clusters by total duration and geographic spread
      clusters.sort((a, b) => {
        const aHours = a.reduce((sum, poi) => sum + getHours(poi.duration || 'half-day'), 0)
        const bHours = b.reduce((sum, poi) => sum + getHours(poi.duration || 'half-day'), 0)
        return bHours - aHours // Prioritize clusters with more content
      })
      
      // Distribute clusters across remaining days
      for (const cluster of clusters) {
        const clusterHours = cluster.reduce((sum, poi) => sum + getHours(poi.duration || 'half-day'), 0)
        
        // Try to find a day with compatible remaining capacity
        let assignedToExistingDay = false
        for (let i = fullDayPOIs.length; i < dailyPOIs.length; i++) {
          const dayHours = dailyPOIs[i].reduce((sum, poi) => sum + getHours(poi.duration || 'half-day'), 0)
          if (dayHours + clusterHours <= hoursPerDay) {
            dailyPOIs[i].push(...cluster)
            assignedToExistingDay = true
            break
          }
        }
        
        // If no existing day can fit it, create a new day
        if (!assignedToExistingDay) {
          if (dailyPOIs.length < availableDays) {
            dailyPOIs.push([...cluster])
          } else {
            // No more days available, add to the least full day
            let leastFullIndex = fullDayPOIs.length
            let minHours = Infinity
            for (let i = fullDayPOIs.length; i < dailyPOIs.length; i++) {
              const dayHours = dailyPOIs[i].reduce((sum, poi) => sum + getHours(poi.duration || 'half-day'), 0)
              if (dayHours < minHours) {
                minHours = dayHours
                leastFullIndex = i
              }
            }
            if (leastFullIndex < dailyPOIs.length) {
              dailyPOIs[leastFullIndex].push(...cluster)
            }
          }
        }
      }
      
      // Step 5: Optimize POI order within each day to minimize travel time
      dailyPOIs.forEach(dayPOIs => {
        if (dayPOIs.length <= 1) return
        
        // Simple nearest-neighbor optimization
        const optimizedOrder = [dayPOIs[0]]
        const remaining = dayPOIs.slice(1)
        
        while (remaining.length > 0) {
          const current = optimizedOrder[optimizedOrder.length - 1]
          let nearestIndex = 0
          let nearestDistance = Infinity
          
          remaining.forEach((poi, index) => {
            const distance = calculateDistance(current.coordinates, poi.coordinates)
            if (distance < nearestDistance) {
              nearestDistance = distance
              nearestIndex = index
            }
          })
          
          optimizedOrder.push(remaining[nearestIndex])
          remaining.splice(nearestIndex, 1)
        }
        
        // Replace the day's POIs with the optimized order
        dayPOIs.splice(0, dayPOIs.length, ...optimizedOrder)
      })
      
      console.log('Optimized daily distribution:', dailyPOIs.map((day, i) => 
        `Day ${i + 1}: ${day.length} POIs, ${day.reduce((sum, poi) => sum + getHours(poi.duration || 'half-day'), 0).toFixed(1)}h`
      ))
      
      return dailyPOIs
    }
    
    const dailyPOIDistribution = distributePOIsByDuration(tourData.pois, tourDays)
    
    const itinerary = []
    let distributionIndex = 0

    for (let i = 0; i < totalDays; i++) {
      const currentDate = addDays(new Date(tourData.startDate), i)
      const isFirstDay = i === 0
      const isLastDay = i === totalDays - 1

      if (isFirstDay) {
        // First day: Travel from home to first overnight stay
        const firstDayPois = canIncludeActivitiesOnFirstDay && dailyPOIDistribution[distributionIndex]
          ? dailyPOIDistribution[distributionIndex]
          : []
        
        if (canIncludeActivitiesOnFirstDay && dailyPOIDistribution[distributionIndex]) {
          distributionIndex++
        }
        
        itinerary.push({
          date: format(currentDate, 'yyyy-MM-dd'),
          type: canIncludeActivitiesOnFirstDay ? 'mixed' : 'travel',
          title: canIncludeActivitiesOnFirstDay 
            ? 'Departure & First Activities' 
            : 'Travel Day - Departure',
          description: canIncludeActivitiesOnFirstDay
            ? 'Travel to destination and explore local attractions'
            : 'Travel from home to first destination',
          startLocation: tourData.homeLocation,
          overnightStay: tourData.overnightStays[0],
          overnightStayId: tourData.overnightStays[0].id,
          route: {
            from: tourData.homeLocation,
            to: tourData.overnightStays[0]
          },
          pois: firstDayPois,
          estimatedTravelTime: firstDayTravelTime + calculatePOITime(firstDayPois)
        })
      } else if (isLastDay) {
        // Last day: Travel from last overnight stay back home
        const lastOvernightStay = tourData.overnightStays[(totalDays - 2) % tourData.overnightStays.length]
        const lastDayPois = canIncludeActivitiesOnLastDay && dailyPOIDistribution[distributionIndex]
          ? dailyPOIDistribution[distributionIndex]
          : []
        
        if (canIncludeActivitiesOnLastDay && dailyPOIDistribution[distributionIndex]) {
          distributionIndex++
        }
        
        itinerary.push({
          date: format(currentDate, 'yyyy-MM-dd'),
          type: canIncludeActivitiesOnLastDay ? 'mixed' : 'travel',
          title: canIncludeActivitiesOnLastDay
            ? 'Final Activities & Return'
            : 'Travel Day - Return',
          description: canIncludeActivitiesOnLastDay
            ? 'Final sightseeing and travel back home'
            : 'Travel back home',
          startLocation: lastOvernightStay,
          overnightStay: tourData.homeLocation,
          route: {
            from: lastOvernightStay,
            to: tourData.homeLocation
          },
          pois: lastDayPois,
          estimatedTravelTime: lastDayTravelTime + calculatePOITime(lastDayPois)
        })
      } else {
        // Regular tour days
        const dayPois = dailyPOIDistribution[distributionIndex] || []
        distributionIndex++

        // Assign overnight stay (cycle through if multiple)
        const overnightStay = tourData.overnightStays[(i - 1) % tourData.overnightStays.length]

        itinerary.push({
          date: format(currentDate, 'yyyy-MM-dd'),
          type: 'tour',
          title: `Tour Day ${i}`,
          description: `Explore local attractions`,
          overnightStay,
          overnightStayId: overnightStay.id,
          pois: dayPois,
          estimatedTravelTime: calculatePOITime(dayPois) + (dayPois.length > 0 ? 60 : 0) // POI time + local travel
        })
      }
    }

    console.log('Generated itinerary:', itinerary)
    updateTourData({ plannedItinerary: itinerary })
  }

  return (
    <div className="tour-input-panel">
      <h2>Plan Your Tour</h2>
      
      {/* Home Location */}
      <div className="section">
        <h3>🏠 Home Location</h3>
        <div className="input-group">
          <label>Starting point (where you'll drive from and return to):</label>
          <input
            type="text"
            placeholder="Enter your home address (e.g., New York, NY)"
            value={homeLocationInput}
            onChange={(e) => setHomeLocationInput(e.target.value)}
            onBlur={(e) => updateHomeLocation(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && updateHomeLocation(e.target.value)}
          />
          {tourData.homeLocation?.coordinates && (
            <small className="location-confirmed">
              ✅ Location found: {tourData.homeLocation.coordinates.latitude.toFixed(4)}, {tourData.homeLocation.coordinates.longitude.toFixed(4)}
            </small>
          )}
        </div>
      </div>
      
      {/* Date Selection */}
      <div className="section">
        <h3>📅 Tour Dates</h3>
        <div className="date-inputs">
          <div className="input-group">
            <label>Start Date:</label>
            <input
              type="date"
              value={tourData.startDate || ''}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>End Date:</label>
            <input
              type="date"
              value={tourData.endDate || ''}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
              min={tourData.startDate}
            />
          </div>
        </div>
      </div>

      {/* Overnight Stays */}
      <div className="section">
        <h3>🏨 Overnight Stays</h3>
        <div className="add-item">
          <input
            type="text"
            placeholder="Enter location (e.g., Hotel in Paris)"
            value={newOvernightStay}
            onChange={(e) => setNewOvernightStay(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addOvernightStay()}
          />
          <button onClick={addOvernightStay} className="add-btn">Add</button>
        </div>
        <div className="items-list">
          {tourData.overnightStays.map(stay => (
            <div key={stay.id} className="item">
              <span>{stay.location}</span>
              <button onClick={() => removeOvernightStay(stay.id)} className="remove-btn">×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Points of Interest */}
      <div className="section">
        <h3>📍 Points of Interest ({tourData.pois.length})</h3>
        {tourData.pois.length > 1 && (
          <div className="optimization-notice">
            <small>💡 POIs will be optimized by location and duration when generating the itinerary</small>
          </div>
        )}
        <div className="add-item poi-add">
          <input
            type="text"
            placeholder="POI name (e.g., Eiffel Tower)"
            value={newPoi.name}
            onChange={(e) => setNewPoi(prev => ({ ...prev, name: e.target.value }))}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && addPoi()}
          />
          <input
            type="text"
            placeholder="Category (e.g., Monument)"
            value={newPoi.category}
            onChange={(e) => setNewPoi(prev => ({ ...prev, category: e.target.value }))}
            onKeyPress={(e) => e.key === 'Enter' && addPoi()}
          />
          <select
            value={newPoi.duration}
            onChange={(e) => setNewPoi(prev => ({ ...prev, duration: e.target.value }))}
            title="How long to spend at this POI"
          >
            <option value="quick">⚡ Quick Visit (1-2h)</option>
            <option value="half-day">🕐 Half Day (3-4h)</option>
            <option value="full-day">🕘 Full Day (6-8h)</option>
          </select>
          <button onClick={addPoi} className="add-btn poi-add-btn" disabled={!newPoi.name.trim()}>
            + Add POI
          </button>
        </div>
        
        {/* POI List */}
        <div className="items-list">
          {tourData.pois.length === 0 ? (
            <div className="empty-state">
              <p>No POIs added yet. Add places you want to visit!</p>
            </div>
          ) : (
            tourData.pois.map(poi => (
              <div key={poi.id} className="item poi-item-detailed">
                <div className="poi-main-info">
                  <span className="poi-name">{poi.name}</span>
                  {poi.category && <span className="poi-category">({poi.category})</span>}
                </div>
                <div className="poi-meta">
                  <select
                    value={poi.duration || 'half-day'}
                    onChange={(e) => updatePoiDuration(poi.id, e.target.value)}
                    className="poi-duration-select"
                    title="Change visit duration"
                  >
                    <option value="quick">⚡ Quick (1-2h)</option>
                    <option value="half-day">🕐 Half Day (3-4h)</option>
                    <option value="full-day">🕘 Full Day (6-8h)</option>
                  </select>
                  <button onClick={() => removePoi(poi.id)} className="remove-btn" title="Remove POI">×</button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Quick Add Suggestions */}
        {tourData.pois.length === 0 && (
          <div className="quick-suggestions">
            <p><strong>💡 Suggestions:</strong></p>
            <div className="suggestion-buttons">
              <button 
                className="suggestion-btn" 
                onClick={() => setNewPoi({ name: 'Museum', category: 'Culture', duration: 'half-day' })}
              >
                🏛️ Museum
              </button>
              <button 
                className="suggestion-btn" 
                onClick={() => setNewPoi({ name: 'Restaurant', category: 'Food', duration: 'quick' })}
              >
                🍽️ Restaurant
              </button>
              <button 
                className="suggestion-btn" 
                onClick={() => setNewPoi({ name: 'Park', category: 'Nature', duration: 'half-day' })}
              >
                🌳 Park
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <div className="section">
        <button 
          onClick={generateItinerary} 
          className="generate-btn"
          disabled={!tourData.startDate || !tourData.endDate || tourData.overnightStays.length === 0}
        >
          🚀 Generate Tour Plan
        </button>
        
        {tourData.plannedItinerary && (
          <button 
            onClick={clearData} 
            className="generate-btn"
            style={{ marginTop: '0.5rem', background: '#e53e3e' }}
          >
            🗑️ Clear All Data
          </button>
        )}
      </div>
    </div>
  )
} 