import React from 'react'
import { format } from 'date-fns'

export const DailyItinerary = ({ itinerary, startDate, mapRoutes = [] }) => {
  
  // Helper function to calculate detailed timing breakdown
  const getTimingBreakdown = (day, dayIndex) => {
    const breakdown = {
      travel: 0,
      activities: 0,
      localTravel: 0,
      travelType: 'one-way'
    }
    
    // Calculate POI activity time
    const getPoiMinutes = (duration) => {
      switch(duration) {
        case 'quick': return 90
        case 'half-day': return 210
        case 'full-day': return 420
        default: return 210
      }
    }
    
    // Only count main POIs for duration (secondary POIs are included in main POI time)
    breakdown.activities = day.pois
      .filter(poi => poi.type !== 'secondary')
      .reduce((total, poi) => total + getPoiMinutes(poi.duration || 'half-day'), 0)
    
    // Calculate distinct locations for local travel
    const getDistinctLocations = (pois) => {
      const distinctLocations = new Set()
      
      pois.forEach(poi => {
        if (poi.type === 'secondary') {
          // Secondary POIs don't add to location count - they're at their main POI
          return
        }
        // Add main POI location
        distinctLocations.add(poi.id)
      })
      
      return distinctLocations.size
    }
    
    // Get real route data for this day if available
    const dayRouteData = mapRoutes.find(r => r.day === dayIndex)
    const routes = dayRouteData?.routes || []
    
    // Calculate actual travel times from route data
    const drivingRoutes = routes.filter(r => r.type === 'driving')
    const walkingRoutes = routes.filter(r => r.type === 'walking')
    
    // Determine if this is the last day (return home)
    const isLastDay = dayIndex === itinerary.length - 1
    const isFirstDay = dayIndex === 0
    
    if (day.type === 'travel') {
      // Pure travel day - use actual route duration if available
      if (drivingRoutes.length > 0 && drivingRoutes[0].duration) {
        breakdown.travel = drivingRoutes[0].duration // Duration is in minutes from OSRM
      } else {
        breakdown.travel = day.estimatedTravelTime || 180 // Fallback to estimated time
      }
      
      breakdown.travelType = isLastDay ? 'return' : 'departure'
      
    } else if (day.type === 'mixed') {
      // Mixed day: travel + activities
      if (drivingRoutes.length > 0 && drivingRoutes[0].duration) {
        breakdown.travel = drivingRoutes[0].duration // Use actual calculated time
      } else {
        breakdown.travel = 180 // Fallback for mixed days
      }
      
      // Local travel from actual walking routes
      if (walkingRoutes.length > 0) {
        breakdown.localTravel = walkingRoutes.reduce((total, route) => {
          return total + (route.duration || 30) // Use actual duration or 30min default
        }, 0)
      } else {
        // Fallback calculation based on distinct locations
        const distinctLocations = getDistinctLocations(day.pois)
        breakdown.localTravel = Math.max(0, (distinctLocations - 1) * 30)
      }
      
      breakdown.travelType = isLastDay ? 'return' : 'departure'
      
    } else {
      // Tour day: only local travel between POIs
      if (walkingRoutes.length > 0) {
        breakdown.localTravel = walkingRoutes.reduce((total, route) => {
          return total + (route.duration || 30) // Use actual duration or 30min default
        }, 0)
      } else {
        // Fallback calculation based on distinct locations
        const distinctLocations = getDistinctLocations(day.pois)
        breakdown.localTravel = Math.max(30, (distinctLocations - 1) * 45)
      }
    }
    
    return breakdown
  }


  const totalTravelTime = itinerary.reduce((total, day, index) => {
    const timing = getTimingBreakdown(day, index)
    return total + timing.travel + timing.activities + timing.localTravel
  }, 0)
  const totalPois = itinerary.reduce((total, day) => total + day.pois.length, 0)

  return (
    <div className="daily-itinerary">
      <div id="itinerary-pdf-content">
        <h2>📋 Your Itinerary</h2>
      
      {/* Summary */}
      <div className="itinerary-summary">
        <div className="summary-stat">
          <span className="stat-number">{itinerary.length}</span>
          <span className="stat-label">Days</span>
        </div>
        <div className="summary-stat">
          <span className="stat-number">{totalPois}</span>
          <span className="stat-label">POIs</span>
        </div>
        <div className="summary-stat">
          <span className="stat-number">{Math.round(totalTravelTime / 60)}h</span>
          <span className="stat-label">Travel Time</span>
        </div>
      </div>

      {/* Daily Schedule */}
      <div className="daily-schedule">
        {itinerary.map((day, index) => (
          <div key={day.date} className={`day-card ${day.type || 'tour'}`}>
            <div className="day-header">
              <h3>Day {index + 1}</h3>
              <span className="day-date">{format(new Date(day.date), 'EEEE, MMM dd')}</span>
              {day.type && (
                <span className={`day-type ${day.type}`}>
                  {day.type === 'travel' ? '🚗' : day.type === 'mixed' ? '🚗🗺️' : '🗺️'} {day.title}
                </span>
              )}
            </div>
            
            <div className="day-content">
              {day.type === 'travel' ? (
                <div className="travel-day">
                  <div className="travel-route">
                    <div className="travel-point start">
                      <span className="location-icon">🏠</span>
                      <div className="location-details">
                        <strong>From:</strong> {day.route?.from?.location || day.startLocation?.location || 'Unknown'}
                      </div>
                    </div>
                    <div className="travel-arrow">
                      <span>🚗 ➡️</span>
                    </div>
                    <div className="travel-point end">
                      <span className="location-icon">{day.route?.to?.location === day.route?.from?.location ? '🏠' : '🏨'}</span>
                      <div className="location-details">
                        <strong>To:</strong> {day.route?.to?.location || day.overnightStay?.location || 'Unknown'}
                      </div>
                    </div>
                  </div>
                  <div className="travel-description">
                    <p>{day.description}</p>
                  </div>
                </div>
              ) : day.type === 'mixed' ? (
                <>
                  <div className="travel-day">
                    <div className="travel-route">
                      <div className="travel-point start">
                        <span className="location-icon">🏠</span>
                        <div className="location-details">
                          <strong>From:</strong> {day.route?.from?.location || day.startLocation?.location || 'Unknown'}
                        </div>
                      </div>
                      <div className="travel-arrow">
                        <span>🚗 ➡️</span>
                      </div>
                      <div className="travel-point end">
                        <span className="location-icon">{day.route?.to?.location === day.route?.from?.location ? '🏠' : '🏨'}</span>
                        <div className="location-details">
                          <strong>To:</strong> {day.route?.to?.location || day.overnightStay?.location || 'Unknown'}
                        </div>
                      </div>
                    </div>
                    <div className="travel-description">
                      <p>{day.description}</p>
                    </div>
                  </div>
                  
                  {day.pois.length > 0 && (
                    <div className="pois-section">
                      <h4>Places to Visit:</h4>
                      <div className="pois-list">
                        {day.pois.map(poi => (
                          <div key={poi.id} className={`poi-item ${poi.type === 'secondary' ? 'secondary-poi' : 'main-poi'}`}>
                            <span className="poi-icon">📍</span>
                            <div className="poi-details">
                              <span className="poi-name">{poi.name}</span>
                              {poi.category !== 'General' && (
                                <span className="poi-category">({poi.category})</span>
                              )}
                              <span className="poi-duration-mini">
                                {poi.duration === 'quick' && '⚡ 1-2h'}
                                {poi.duration === 'half-day' && '🕐 3-4h'}
                                {poi.duration === 'full-day' && '🕘 6-8h'}
                                {!poi.duration && '🕐 3-4h'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="overnight-stay">
                    <span className="location-icon">🏨</span>
                    <div className="location-details">
                      <strong>Base:</strong> {day.overnightStay.location}
                    </div>
                  </div>
                  
                  {day.pois.length > 0 && (
                    <div className="pois-section">
                      <h4>Places to Visit:</h4>
                      <div className="pois-list">
                        {day.pois.map(poi => (
                          <div key={poi.id} className={`poi-item ${poi.type === 'secondary' ? 'secondary-poi' : 'main-poi'}`}>
                            <span className="poi-icon">📍</span>
                            <div className="poi-details">
                              <span className="poi-name">{poi.name}</span>
                              {poi.category !== 'General' && (
                                <span className="poi-category">({poi.category})</span>
                              )}
                              <span className="poi-duration-mini">
                                {poi.duration === 'quick' && '⚡ 1-2h'}
                                {poi.duration === 'half-day' && '🕐 3-4h'}
                                {poi.duration === 'full-day' && '🕘 6-8h'}
                                {!poi.duration && '🕐 3-4h'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              
              <div className="day-stats">
                <div className="timing-breakdown">
                  <h5>⏰ Timing Breakdown</h5>
                  {(() => {
                    const timing = getTimingBreakdown(day, index)
                    return (
                      <div className="timing-details">
                        {timing.travel > 0 && (
                          <div className="timing-item">
                            <span className="timing-icon">
                              {timing.travelType === 'departure' && '🚗➡️'}
                              {timing.travelType === 'return' && '🏠⬅️'} 
                              {timing.travelType === 'round-trip' && '🚗🔄'}
                            </span>
                            <span className="timing-label">
                              {timing.travelType === 'departure' && 'Travel to destination'}
                              {timing.travelType === 'return' && 'Return travel home'}
                              {timing.travelType === 'round-trip' && 'Round-trip travel'}
                            </span>
                            <span className="timing-duration">{Math.round(timing.travel / 60)}h {timing.travel % 60 > 0 ? `${Math.round(timing.travel % 60)}m` : ''}</span>
                          </div>
                        )}
                        
                        {timing.activities > 0 && (
                          <div className="timing-item">
                            <span className="timing-icon">🎯</span>
                            <span className="timing-label">Activities & sightseeing</span>
                            <span className="timing-duration">{Math.round(timing.activities / 60)}h {timing.activities % 60 > 0 ? `${Math.round(timing.activities % 60)}m` : ''}</span>
                          </div>
                        )}
                        
                        {timing.localTravel > 0 && (
                          <div className="timing-item">
                            <span className="timing-icon">🚶‍♂️</span>
                            <span className="timing-label">Local travel between sites</span>
                            <span className="timing-duration">{Math.round(timing.localTravel / 60)}h {timing.localTravel % 60 > 0 ? `${Math.round(timing.localTravel % 60)}m` : ''}</span>
                          </div>
                        )}
                        
                        <div className="timing-total">
                          <span className="timing-icon">⏱️</span>
                          <span className="timing-label"><strong>Total day duration</strong></span>
                          <span className="timing-duration"><strong>{Math.round((timing.travel + timing.activities + timing.localTravel) / 60)}h {(timing.travel + timing.activities + timing.localTravel) % 60 > 0 ? `${Math.round((timing.travel + timing.activities + timing.localTravel) % 60)}m` : ''}</strong></span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  )
} 