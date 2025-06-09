import React from 'react'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { PDFDayMap } from './PDFDayMap'

export const PDFPreviewModal = ({ isOpen, onClose, tourData, routes = [] }) => {
  if (!isOpen || !tourData.plannedItinerary) return null

  const exportToPDF = async () => {
    try {
      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const imgWidth = 210 // A4 width in mm
      const pageHeight = 295 // A4 height in mm
      let isFirstPage = true

             // First, capture and add the header/summary page
       const headerElement = document.getElementById('pdf-header-summary')
       if (headerElement) {
         const headerCanvas = await html2canvas(headerElement, {
           scale: 1, // Reduced from 2 to 1 for smaller file size
           useCORS: true,
           allowTaint: true,
           backgroundColor: '#ffffff',
           width: headerElement.scrollWidth,
           height: headerElement.scrollHeight
         })

         const headerImgData = headerCanvas.toDataURL('image/jpeg', 0.8) // Use JPEG with 80% quality
         const headerImgHeight = (headerCanvas.height * imgWidth) / headerCanvas.width

         pdf.addImage(headerImgData, 'JPEG', 0, 0, imgWidth, headerImgHeight)
         isFirstPage = false
       }

      // Then capture and add each day on separate pages
      for (let i = 0; i < itinerary.length; i++) {
        const dayElement = document.getElementById(`pdf-day-${i}`)
        if (!dayElement) {
          console.warn(`Day element ${i} not found`)
          continue
        }

        // Add new page for each day (except if this is the first content)
        if (!isFirstPage) {
          pdf.addPage()
        }
        isFirstPage = false

                 // Capture the day content
         const dayCanvas = await html2canvas(dayElement, {
           scale: 1, // Reduced from 2 to 1 for smaller file size
           useCORS: true,
           allowTaint: true,
           backgroundColor: '#ffffff',
           width: dayElement.scrollWidth,
           height: dayElement.scrollHeight
         })

         const dayImgData = dayCanvas.toDataURL('image/jpeg', 0.8) // Use JPEG with 80% quality
         const dayImgHeight = (dayCanvas.height * imgWidth) / dayCanvas.width

         // If the day content is too tall for one page, we might need to handle it
         if (dayImgHeight > pageHeight) {
           // For very tall content, we'll scale it down to fit the page
           const scaledHeight = pageHeight - 20 // Leave some margin
           const scaledWidth = (dayCanvas.width * scaledHeight) / dayCanvas.height
           pdf.addImage(dayImgData, 'JPEG', (imgWidth - scaledWidth) / 2, 10, scaledWidth, scaledHeight)
         } else {
           // Add the day with some top margin
           pdf.addImage(dayImgData, 'JPEG', 0, 10, imgWidth, dayImgHeight)
         }
      }

      // Save the PDF
      const fileName = `tour-itinerary-${format(new Date(tourData.startDate), 'yyyy-MM-dd')}.pdf`
      pdf.save(fileName)
      
      // Close modal after successful export
      onClose()
      
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
    }
  }

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
      
      // Local travel based on distinct locations only
      const distinctLocations = getDistinctLocations(day.pois)
      const baseLocalTravel = Math.max(0, (distinctLocations - 1) * 30) // 30 min between distinct locations
      breakdown.localTravel = Math.max(0, Math.min(baseLocalTravel, day.estimatedTravelTime - breakdown.activities - baseTravelTime))
      breakdown.travelType = day.title?.toLowerCase().includes('return') ? 'return' : 'departure'
      
    } else {
      // Tour day: local travel between distinct locations only
      const distinctLocations = getDistinctLocations(day.pois)
      const baseLocalTravel = Math.max(30, (distinctLocations - 1) * 45) // 45 min between distinct locations
      breakdown.localTravel = Math.max(0, Math.min(baseLocalTravel, day.estimatedTravelTime - breakdown.activities))
    }
    
    return breakdown
  }

  const itinerary = tourData.plannedItinerary
  const totalTravelTime = itinerary.reduce((total, day) => {
    const timing = getTimingBreakdown(day)
    return total + timing.travel + timing.activities + timing.localTravel
  }, 0)
  const totalPois = itinerary.reduce((total, day) => total + day.pois.length, 0)

  return (
    <div className="pdf-preview-modal-overlay" onClick={onClose}>
      <div className="pdf-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="pdf-preview-header">
          <h2>📄 PDF Preview</h2>
          <div className="pdf-preview-actions">
            <button onClick={exportToPDF} className="export-btn pdf-btn">
              📄 Download PDF
            </button>
            <button onClick={onClose} className="close-btn">
              ✕ Close
            </button>
          </div>
        </div>
        
        <div className="pdf-preview-container">
          <div id="pdf-preview-content" className="pdf-preview-content">
            {/* Header and Summary - Will be first page */}
            <div id="pdf-header-summary" className="pdf-header-summary-page">
              <div className="pdf-header">
                <h1>🗺️ Tour Itinerary</h1>
                <p>Generated on {format(new Date(), 'MMMM dd, yyyy')}</p>
              </div>

              {/* Summary */}
              <div className="pdf-summary">
                <div className="summary-row">
                  <div className="summary-item">
                    <strong>Duration:</strong> {itinerary.length} days
                  </div>
                  <div className="summary-item">
                    <strong>Points of Interest:</strong> {totalPois}
                  </div>
                  <div className="summary-item">
                    <strong>Total Travel Time:</strong> {Math.round(totalTravelTime / 60)}h
                  </div>
                </div>
                <div className="summary-row">
                  <div className="summary-item">
                    <strong>Start Date:</strong> {format(new Date(tourData.startDate), 'MMMM dd, yyyy')}
                  </div>
                  <div className="summary-item">
                    <strong>End Date:</strong> {format(new Date(tourData.endDate), 'MMMM dd, yyyy')}
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Schedule - Each day will be a separate page */}
            <div className="pdf-daily-schedule">
              {itinerary.map((day, index) => (
                <div key={day.date} id={`pdf-day-${index}`} className={`pdf-day-card ${day.type || 'tour'}`}>
                  <div className="pdf-day-header">
                    <h3>Day {index + 1} - {format(new Date(day.date), 'EEEE, MMM dd')}</h3>
                    {day.type && (
                      <span className={`pdf-day-type ${day.type}`}>
                        {day.type === 'travel' ? '🚗' : day.type === 'mixed' ? '🚗🗺️' : '🗺️'} {day.title}
                      </span>
                    )}
                  </div>
                  
                  <div className="pdf-day-content">
                    {day.type === 'travel' ? (
                      <div className="pdf-travel-day">
                        <div className="pdf-travel-route">
                          <div className="pdf-travel-info">
                            <strong>From:</strong> {day.route?.from?.location || day.startLocation?.location || 'Unknown'}
                          </div>
                          <div className="pdf-travel-arrow">🚗 ➡️</div>
                          <div className="pdf-travel-info">
                            <strong>To:</strong> {day.route?.to?.location || day.overnightStay?.location || 'Unknown'}
                          </div>
                        </div>
                        <p className="pdf-description">{day.description}</p>
                      </div>
                    ) : day.type === 'mixed' ? (
                      <>
                        <div className="pdf-travel-day">
                          <div className="pdf-travel-route">
                            <div className="pdf-travel-info">
                              <strong>From:</strong> {day.route?.from?.location || day.startLocation?.location || 'Unknown'}
                            </div>
                            <div className="pdf-travel-arrow">🚗 ➡️</div>
                            <div className="pdf-travel-info">
                              <strong>To:</strong> {day.route?.to?.location || day.overnightStay?.location || 'Unknown'}
                            </div>
                          </div>
                          <p className="pdf-description">{day.description}</p>
                        </div>
                        
                        {day.pois.length > 0 && (
                          <div className="pdf-pois-section">
                            <h4>Places to Visit:</h4>
                            <div className="pdf-pois-list">
                              {day.pois.map(poi => (
                                <div key={poi.id} className={`pdf-poi-item ${poi.type === 'secondary' ? 'pdf-poi-item-secondary' : 'pdf-poi-item-main'}`}>
                                  <span>📍 {poi.name}</span>
                                  {poi.category !== 'General' && (
                                    <span className="pdf-poi-category">({poi.category})</span>
                                  )}
                                  <span className="pdf-poi-duration">
                                    {poi.duration === 'quick' && '⚡ 1-2h'}
                                    {poi.duration === 'half-day' && '🕐 3-4h'}
                                    {poi.duration === 'full-day' && '🕘 6-8h'}
                                    {!poi.duration && '🕐 3-4h'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="pdf-base-info">
                          <strong>🏨 Base:</strong> {day.overnightStay.location}
                        </div>
                        
                        {day.pois.length > 0 && (
                          <div className="pdf-pois-section">
                            <h4>Places to Visit:</h4>
                            <div className="pdf-pois-list">
                              {day.pois.map(poi => (
                                <div key={poi.id} className={`pdf-poi-item ${poi.type === 'secondary' ? 'pdf-poi-item-secondary' : 'pdf-poi-item-main'}`}>
                                  <span>📍 {poi.name}</span>
                                  {poi.category !== 'General' && (
                                    <span className="pdf-poi-category">({poi.category})</span>
                                  )}
                                  <span className="pdf-poi-duration">
                                    {poi.duration === 'quick' && '⚡ 1-2h'}
                                    {poi.duration === 'half-day' && '🕐 3-4h'}
                                    {poi.duration === 'full-day' && '🕘 6-8h'}
                                    {!poi.duration && '🕐 3-4h'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    
                    <div className="pdf-timing">
                      <h5>⏰ Timing Breakdown</h5>
                      {(() => {
                        const timing = getTimingBreakdown(day)
                        return (
                          <div className="pdf-timing-details">
                            {timing.travel > 0 && (
                              <div className="pdf-timing-item">
                                <span>
                                  {timing.travelType === 'departure' && '🚗➡️ Travel to destination'}
                                  {timing.travelType === 'return' && '🏠⬅️ Return travel home'}
                                  {timing.travelType === 'round-trip' && '🚗🔄 Round-trip travel'}
                                </span>
                                <span>{Math.round(timing.travel / 60)}h {timing.travel % 60 > 0 ? `${timing.travel % 60}m` : ''}</span>
                              </div>
                            )}
                            
                            {timing.activities > 0 && (
                              <div className="pdf-timing-item">
                                <span>🎯 Activities & sightseeing</span>
                                <span>{Math.round(timing.activities / 60)}h {timing.activities % 60 > 0 ? `${timing.activities % 60}m` : ''}</span>
                              </div>
                            )}
                            
                            {timing.localTravel > 0 && (
                              <div className="pdf-timing-item">
                                <span>🚶‍♂️ Local travel between sites</span>
                                <span>{Math.round(timing.localTravel / 60)}h {timing.localTravel % 60 > 0 ? `${timing.localTravel % 60}m` : ''}</span>
                              </div>
                            )}
                            
                            <div className="pdf-timing-total">
                              <span><strong>⏱️ Total day duration</strong></span>
                              <span><strong>{Math.round((timing.travel + timing.activities + timing.localTravel) / 60)}h {(timing.travel + timing.activities + timing.localTravel) % 60 > 0 ? `${(timing.travel + timing.activities + timing.localTravel) % 60}m` : ''}</strong></span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                    
                    <PDFDayMap 
                      day={day} 
                      dayIndex={index} 
                      tourData={tourData}
                      routes={routes}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 