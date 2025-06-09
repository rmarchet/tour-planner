import React, { useState } from 'react'
import { format, addDays, differenceInDays } from 'date-fns'
import { POIDiscovery } from './POIDiscovery'

export const TourInputPanel = ({ tourData, updateTourData, onTourGenerated }) => {
  const [newOvernightStay, setNewOvernightStay] = useState('')
  const [newPoi, setNewPoi] = useState({ name: '', category: '', duration: 'half-day', type: 'main', nearMainPOI: '' })
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
      // Validation for secondary POIs
      if (newPoi.type === 'secondary' && !newPoi.nearMainPOI) {
        alert('Please select which main POI this secondary POI is related to.')
        return
      }

      const newPoiData = {
        id: Date.now(),
        name: newPoi.name.trim(),
        category: newPoi.category.trim() || 'General',
        duration: newPoi.duration,
        coordinates: null, // Will be set when geocoded
        type: newPoi.type
      }

      // Add nearMainPOI field only for secondary POIs
      if (newPoi.type === 'secondary') {
        newPoiData.nearMainPOI = newPoi.nearMainPOI
        newPoiData.source = 'Manual'
      }

      const updatedPois = [...tourData.pois, newPoiData]
      updateTourData({ pois: updatedPois })
      setNewPoi({ name: '', category: '', duration: 'half-day', type: 'main', nearMainPOI: '' })
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

  const updatePoiPreferredDay = (id, preferredDay) => {
    const updatedPois = tourData.pois.map(poi => 
      poi.id === id ? { ...poi, preferredDay: preferredDay || null } : poi
    )
    updateTourData({ pois: updatedPois })
  }

  const getDayOptions = () => {
    if (!tourData.startDate || !tourData.endDate) return []
    
    const start = new Date(tourData.startDate)
    const end = new Date(tourData.endDate)
    const diffTime = Math.abs(end - start)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    
    const options = []
    for (let i = 1; i <= diffDays; i++) {
      const dayDate = new Date(start)
      dayDate.setDate(dayDate.getDate() + i - 1)
      options.push({
        value: i.toString(),
        label: `Day ${i} (${dayDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })})`
      })
    }
    return options
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
    
    // Optimized POI distribution with main/secondary POI hierarchy, preferred days, and geographic clustering
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
      
      // Step 0: Separate POIs with preferred days from those without
      const poisWithPreferredDays = pois.filter(poi => poi.preferredDay && poi.type !== 'secondary')
      const poisWithoutPreferredDays = pois.filter(poi => !poi.preferredDay && poi.type !== 'secondary')
      const allSecondaryPOIs = pois.filter(poi => poi.type === 'secondary')
      
      console.log(`POIs with preferred days: ${poisWithPreferredDays.length}, without: ${poisWithoutPreferredDays.length}, secondary: ${allSecondaryPOIs.length}`)
      
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
      
      // Initialize daily POI arrays
      const dailyPOIs = Array(availableDays).fill(null).map(() => [])
      
      // Step 1: Assign POIs with preferred days first
      const assignPreferredDayPOIs = () => {
        poisWithPreferredDays.forEach(poi => {
          const dayIndex = parseInt(poi.preferredDay) - 1 // Convert 1-based to 0-based
          if (dayIndex >= 0 && dayIndex < availableDays) {
            dailyPOIs[dayIndex].push(poi)
            
            // Also add related secondary POIs
            const relatedSecondaryPOIs = allSecondaryPOIs.filter(sPoi => sPoi.nearMainPOI === poi.name)
            dailyPOIs[dayIndex].push(...relatedSecondaryPOIs)
            
            console.log(`Assigned ${poi.name} to Day ${poi.preferredDay} with ${relatedSecondaryPOIs.length} secondary POIs`)
          }
        })
      }
      
      assignPreferredDayPOIs()
      
             // Step 2: Create POI groups for remaining POIs (those without preferred days)
       const createRemainingPOIGroups = () => {
         const groups = []
         
         // Get secondary POIs that aren't already assigned to preferred day POIs
         const assignedSecondaryPOIs = new Set()
         poisWithPreferredDays.forEach(poi => {
           allSecondaryPOIs.forEach(sPoi => {
             if (sPoi.nearMainPOI === poi.name) {
               assignedSecondaryPOIs.add(sPoi.id)
             }
           })
         })
         
         const remainingSecondaryPOIs = allSecondaryPOIs.filter(sPoi => !assignedSecondaryPOIs.has(sPoi.id))
         
         // Create groups for remaining main POIs
         poisWithoutPreferredDays.forEach(mainPOI => {
           const group = {
             mainPOI: mainPOI,
             secondaryPOIs: [],
             totalHours: getHours(mainPOI.duration || 'half-day')
           }
           
           // Find secondary POIs that belong to this main POI and aren't already assigned
           remainingSecondaryPOIs.forEach(secondaryPOI => {
             if (secondaryPOI.nearMainPOI === mainPOI.name) {
               group.secondaryPOIs.push(secondaryPOI)
               group.totalHours += getHours(secondaryPOI.duration || 'half-day')
             }
           })
           
           groups.push(group)
         })
         
         // Handle orphaned secondary POIs (secondary POIs without a matching main POI)
         const orphanedSecondaryPOIs = remainingSecondaryPOIs.filter(secondaryPOI => 
           !poisWithoutPreferredDays.some(mainPOI => mainPOI.name === secondaryPOI.nearMainPOI)
         )
        
        if (orphanedSecondaryPOIs.length > 0) {
          console.warn(`Found ${orphanedSecondaryPOIs.length} orphaned secondary POIs`)
          // Treat orphaned secondary POIs as individual groups
          orphanedSecondaryPOIs.forEach(orphanedPOI => {
            groups.push({
              mainPOI: orphanedPOI,
              secondaryPOIs: [],
              totalHours: getHours(orphanedPOI.duration || 'half-day')
            })
          })
        }
        
                 return groups
       }
       
       const remainingPoiGroups = createRemainingPOIGroups()
       console.log('Created remaining POI groups:', remainingPoiGroups.map(g => 
         `${g.mainPOI.name} + ${g.secondaryPOIs.length} secondary (${g.totalHours.toFixed(1)}h)`
       ))
       
       // Step 3: Distribute remaining POI groups to available days
       const hoursPerDay = 8
       
       // Calculate available capacity for each day (accounting for preferred day assignments)
       const getDayCapacity = (dayIndex) => {
         const currentPOIs = dailyPOIs[dayIndex]
         const currentHours = currentPOIs.reduce((sum, poi) => sum + getHours(poi.duration || 'half-day'), 0)
         return hoursPerDay - currentHours
       }
       
       // Separate full-day groups and others from remaining groups
       const fullDayGroups = remainingPoiGroups.filter(group => group.totalHours >= 6)
       const otherGroups = remainingPoiGroups.filter(group => group.totalHours < 6)
       
       console.log(`${fullDayGroups.length} remaining full-day groups, ${otherGroups.length} other groups`)
       
       // Step 4: Assign full-day groups to days with sufficient capacity
       fullDayGroups.forEach(group => {
         let assigned = false
         for (let dayIndex = 0; dayIndex < availableDays; dayIndex++) {
           if (getDayCapacity(dayIndex) >= group.totalHours) {
             dailyPOIs[dayIndex].push(group.mainPOI, ...group.secondaryPOIs)
             assigned = true
             console.log(`Assigned full-day group ${group.mainPOI.name} to Day ${dayIndex + 1}`)
             break
           }
         }
         if (!assigned) {
           // Find day with most capacity
           let bestDayIndex = 0
           let maxCapacity = getDayCapacity(0)
           for (let dayIndex = 1; dayIndex < availableDays; dayIndex++) {
             const capacity = getDayCapacity(dayIndex)
             if (capacity > maxCapacity) {
               maxCapacity = capacity
               bestDayIndex = dayIndex
             }
           }
           dailyPOIs[bestDayIndex].push(group.mainPOI, ...group.secondaryPOIs)
           console.log(`Force-assigned full-day group ${group.mainPOI.name} to Day ${bestDayIndex + 1}`)
         }
       })
      
             // Step 5: Distribute remaining smaller groups to days with capacity
       otherGroups.forEach(group => {
         let assigned = false
         
         // Try to find a day with enough capacity
         for (let dayIndex = 0; dayIndex < availableDays; dayIndex++) {
           if (getDayCapacity(dayIndex) >= group.totalHours) {
             dailyPOIs[dayIndex].push(group.mainPOI, ...group.secondaryPOIs)
             assigned = true
             console.log(`Assigned group ${group.mainPOI.name} to Day ${dayIndex + 1}`)
             break
           }
         }
         
         if (!assigned) {
           // Find day with most capacity
           let bestDayIndex = 0
           let maxCapacity = getDayCapacity(0)
           for (let dayIndex = 1; dayIndex < availableDays; dayIndex++) {
             const capacity = getDayCapacity(dayIndex)
             if (capacity > maxCapacity) {
               maxCapacity = capacity
               bestDayIndex = dayIndex
             }
           }
           dailyPOIs[bestDayIndex].push(group.mainPOI, ...group.secondaryPOIs)
           console.log(`Force-assigned group ${group.mainPOI.name} to Day ${bestDayIndex + 1}`)
         }
       })
      
      // Step 7: Optimize POI order within each day (keeping main POI + secondaries together)
      dailyPOIs.forEach(dayPOIs => {
        if (dayPOIs.length <= 1) return
        
        // Group POIs by their main POI relationship
        const dayGroups = []
        const processedPOIs = new Set()
        
        dayPOIs.forEach(poi => {
          if (processedPOIs.has(poi.id)) return
          
          if (poi.type !== 'secondary') {
            // This is a main POI, find its secondary POIs
            const group = [poi]
            processedPOIs.add(poi.id)
            
            dayPOIs.forEach(otherPOI => {
              if (otherPOI.type === 'secondary' && otherPOI.nearMainPOI === poi.name) {
                group.push(otherPOI)
                processedPOIs.add(otherPOI.id)
              }
            })
            
            dayGroups.push(group)
          } else if (!processedPOIs.has(poi.id)) {
            // Orphaned secondary POI
            dayGroups.push([poi])
            processedPOIs.add(poi.id)
          }
        })
        
        // Optimize order of groups, keeping main+secondary POIs together
        if (dayGroups.length > 1) {
          const optimizedGroupOrder = [dayGroups[0]]
          const remainingGroups = dayGroups.slice(1)
          
          while (remainingGroups.length > 0) {
            const currentGroup = optimizedGroupOrder[optimizedGroupOrder.length - 1]
            const currentMainPOI = currentGroup[0] // First POI in group is always main POI
            let nearestIndex = 0
            let nearestDistance = Infinity
            
            remainingGroups.forEach((group, index) => {
              const groupMainPOI = group[0]
              const distance = calculateDistance(currentMainPOI.coordinates, groupMainPOI.coordinates)
              if (distance < nearestDistance) {
                nearestDistance = distance
                nearestIndex = index
              }
            })
            
            optimizedGroupOrder.push(remainingGroups[nearestIndex])
            remainingGroups.splice(nearestIndex, 1)
          }
          
          // Flatten the optimized groups back into a single array
          const optimizedDayPOIs = []
          optimizedGroupOrder.forEach(group => {
            optimizedDayPOIs.push(...group)
          })
          
          // Replace the day's POIs with the optimized order
          dayPOIs.splice(0, dayPOIs.length, ...optimizedDayPOIs)
        }
      })
      
      console.log('Optimized daily distribution:', dailyPOIs.map((day, i) => {
        const mainCount = day.filter(poi => poi.type !== 'secondary').length
        const secondaryCount = day.filter(poi => poi.type === 'secondary').length
        const totalHours = day.reduce((sum, poi) => sum + getHours(poi.duration || 'half-day'), 0)
        return `Day ${i + 1}: ${mainCount} main + ${secondaryCount} secondary POIs, ${totalHours.toFixed(1)}h`
      }))
      
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
    
    // Trigger route calculation after itinerary is generated
    if (onTourGenerated) {
      // Use setTimeout to ensure the state update is completed first
      setTimeout(() => {
        onTourGenerated()
      }, 100)
    }
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
        <div className="poi-hierarchy-info">
          <small>
            <strong>Main POIs:</strong> {tourData.pois.filter(poi => poi.type !== 'secondary').length} 
            {tourData.pois.filter(poi => poi.type === 'secondary').length > 0 && (
              <span> | <strong>Secondary POIs:</strong> {tourData.pois.filter(poi => poi.type === 'secondary').length}</span>
            )}
          </small>
        </div>
        {tourData.pois.length > 1 && (
          <div className="optimization-notice">
            <small>💡 POIs will be optimized by location and duration when generating the itinerary</small>
          </div>
        )}
        <div className="add-item poi-add">
          <div className="poi-form-row">
            <input
              type="text"
              placeholder="POI name (e.g., Eiffel Tower)"
              value={newPoi.name}
              onChange={(e) => setNewPoi(prev => ({ ...prev, name: e.target.value }))}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && addPoi()}
              className="poi-name-input"
            />
            <input
              type="text"
              placeholder="Category (e.g., Monument)"
              value={newPoi.category}
              onChange={(e) => setNewPoi(prev => ({ ...prev, category: e.target.value }))}
              onKeyPress={(e) => e.key === 'Enter' && addPoi()}
              className="poi-category-input"
            />
          </div>
          
          <div className="poi-form-row">
            <select
              value={newPoi.type}
              onChange={(e) => setNewPoi(prev => ({ ...prev, type: e.target.value, nearMainPOI: e.target.value === 'main' ? '' : prev.nearMainPOI }))}
              title="POI type"
              className="poi-type-select"
            >
              <option value="main">📍 Main POI</option>
              <option value="secondary">↳ Secondary POI</option>
            </select>
            
            {newPoi.type === 'secondary' && (
              <select
                value={newPoi.nearMainPOI}
                onChange={(e) => setNewPoi(prev => ({ ...prev, nearMainPOI: e.target.value }))}
                title="Which main POI is this related to?"
                className="poi-main-select"
              >
                <option value="">Select main POI...</option>
                {tourData.pois.filter(poi => poi.type !== 'secondary').map(mainPoi => (
                  <option key={mainPoi.id} value={mainPoi.name}>
                    {mainPoi.name} ({mainPoi.category})
                  </option>
                ))}
              </select>
            )}
            
            <select
              value={newPoi.duration}
              onChange={(e) => setNewPoi(prev => ({ ...prev, duration: e.target.value }))}
              title="How long to spend at this POI"
              className="poi-duration-select"
            >
              <option value="quick">⚡ Quick Visit (1-2h)</option>
              <option value="half-day">🕐 Half Day (3-4h)</option>
              <option value="full-day">🕘 Full Day (6-8h)</option>
            </select>
          </div>
          
          <button 
            onClick={addPoi} 
            className="add-btn poi-add-btn" 
            disabled={!newPoi.name.trim() || (newPoi.type === 'secondary' && !newPoi.nearMainPOI)}
          >
            Add {newPoi.type === 'secondary' ? 'Secondary' : 'Main'} POI
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
              <div key={poi.id} className={`item poi-item-detailed ${poi.type === 'secondary' ? 'secondary-poi' : 'main-poi'}`}>
                <div className="poi-main-info">
                  <span className="poi-type-indicator">
                    {poi.type === 'secondary' ? '↳' : '📍'}
                  </span>
                  <span className="poi-name">{poi.name}</span>
                  {poi.category && <span className="poi-category">({poi.category})</span>}
                  {poi.type === 'secondary' && poi.nearMainPOI && (
                    <span className="poi-relation">near {poi.nearMainPOI}</span>
                  )}
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
                  {poi.type !== 'secondary' && tourData.startDate && tourData.endDate && (
                    <select
                      value={poi.preferredDay || ''}
                      onChange={(e) => updatePoiPreferredDay(poi.id, e.target.value)}
                      className="poi-day-select"
                      title="Choose specific day to visit"
                    >
                      <option value="">Auto assign day</option>
                      {getDayOptions().map(dayOption => (
                        <option key={dayOption.value} value={dayOption.value}>
                          {dayOption.label}
                        </option>
                      ))}
                    </select>
                  )}
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

      {/* POI Discovery */}
      <POIDiscovery tourData={tourData} updateTourData={updateTourData} />

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