import React from 'react'
import { format } from 'date-fns'

export const DailyItinerary = ({ itinerary, startDate }) => {
  
  // Helper function to calculate detailed timing breakdown
  const getTimingBreakdown = (day) => {
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
    
    breakdown.activities = day.pois.reduce((total, poi) => 
      total + getPoiMinutes(poi.duration || 'half-day'), 0
    )
    
    if (day.type === 'travel') {
      // Pure travel day
      breakdown.travel = day.estimatedTravelTime
      breakdown.travelType = day.route?.to?.location === day.route?.from?.location ? 'round-trip' : 'one-way'
      
      // Determine if it's return travel (to home)
      const isReturnTravel = day.route?.to?.location && 
        (day.route.to.location.toLowerCase().includes('home') || 
         day.title?.toLowerCase().includes('return'))
      breakdown.travelType = isReturnTravel ? 'return' : 'departure'
      
    } else if (day.type === 'mixed') {
      // Mixed day: travel + activities
      const baseTravelTime = 180 // Base travel time for mixed days
      breakdown.travel = baseTravelTime
      breakdown.localTravel = Math.max(0, day.estimatedTravelTime - breakdown.activities - baseTravelTime)
      breakdown.travelType = day.title?.toLowerCase().includes('return') ? 'return' : 'departure'
      
    } else {
      // Tour day: just local travel between POIs
      breakdown.localTravel = Math.max(60, day.estimatedTravelTime - breakdown.activities)
    }
    
    return breakdown
  }
  const exportToJson = () => {
    const dataStr = JSON.stringify(itinerary, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `tour-itinerary-${format(new Date(startDate), 'yyyy-MM-dd')}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const generateShareableLink = () => {
    const params = new URLSearchParams()
    params.set('itinerary', JSON.stringify(itinerary))
    params.set('startDate', startDate)
    
    const shareableUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    
    navigator.clipboard.writeText(shareableUrl).then(() => {
      alert('Shareable link copied to clipboard!')
    }).catch(() => {
      prompt('Copy this shareable link:', shareableUrl)
    })
  }

  const exportToICS = () => {
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tour Planner//Tour Planner//EN'
    ]

    itinerary.forEach((day, index) => {
      const date = new Date(day.date)
      const dateStr = date.toISOString().replace(/[-:]/g, '').split('T')[0]
      
      icsContent.push(
        'BEGIN:VEVENT',
        `UID:tour-day-${index}@tourplanner.local`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `DTEND;VALUE=DATE:${dateStr}`,
        `SUMMARY:Tour Day ${index + 1} - ${day.overnightStay?.location || day.title}`,
        `DESCRIPTION:${day.type === 'travel' ? day.description : `Overnight: ${day.overnightStay?.location}`}\\n` +
        `POIs: ${day.pois?.map(poi => poi.name).join(', ') || 'None'}\\n` +
        `Estimated travel time: ${day.estimatedTravelTime} minutes`,
        `LOCATION:${day.overnightStay?.location || day.route?.to?.location || 'TBD'}`,
        'END:VEVENT'
      )
    })

    icsContent.push('END:VCALENDAR')
    
    const icsBlob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar' })
    const icsUrl = URL.createObjectURL(icsBlob)
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', icsUrl)
    linkElement.setAttribute('download', `tour-calendar-${format(new Date(startDate), 'yyyy-MM-dd')}.ics`)
    linkElement.click()
    
    URL.revokeObjectURL(icsUrl)
  }

  const totalTravelTime = itinerary.reduce((total, day) => total + day.estimatedTravelTime, 0)
  const totalPois = itinerary.reduce((total, day) => total + day.pois.length, 0)

  return (
    <div className="daily-itinerary">
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
                          <div key={poi.id} className="poi-item">
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
                          <div key={poi.id} className="poi-item">
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
                    const timing = getTimingBreakdown(day)
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
                            <span className="timing-duration">{Math.round(timing.travel / 60)}h {timing.travel % 60 > 0 ? `${timing.travel % 60}m` : ''}</span>
                          </div>
                        )}
                        
                        {timing.activities > 0 && (
                          <div className="timing-item">
                            <span className="timing-icon">🎯</span>
                            <span className="timing-label">Activities & sightseeing</span>
                            <span className="timing-duration">{Math.round(timing.activities / 60)}h {timing.activities % 60 > 0 ? `${timing.activities % 60}m` : ''}</span>
                          </div>
                        )}
                        
                        {timing.localTravel > 0 && (
                          <div className="timing-item">
                            <span className="timing-icon">🚶‍♂️</span>
                            <span className="timing-label">Local travel between sites</span>
                            <span className="timing-duration">{Math.round(timing.localTravel / 60)}h {timing.localTravel % 60 > 0 ? `${timing.localTravel % 60}m` : ''}</span>
                          </div>
                        )}
                        
                        <div className="timing-total">
                          <span className="timing-icon">⏱️</span>
                          <span className="timing-label"><strong>Total day duration</strong></span>
                          <span className="timing-duration"><strong>{Math.round(day.estimatedTravelTime / 60)}h {day.estimatedTravelTime % 60 > 0 ? `${day.estimatedTravelTime % 60}m` : ''}</strong></span>
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

      {/* Export Options */}
      <div className="export-options">
        <h3>Export Your Itinerary</h3>
        <div className="export-buttons">
          <button onClick={generateShareableLink} className="export-btn share-btn">
            🔗 Share Link
          </button>
          <button onClick={exportToJson} className="export-btn json-btn">
            📄 Download JSON
          </button>
          <button onClick={exportToICS} className="export-btn calendar-btn">
            📅 Add to Calendar
          </button>
        </div>
      </div>
    </div>
  )
} 