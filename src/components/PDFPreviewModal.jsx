import React from 'react'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export const PDFPreviewModal = ({ isOpen, onClose, tourData }) => {
  if (!isOpen || !tourData.plannedItinerary) return null

  const exportToPDF = async () => {
    try {
      // Create a container for PDF content
      const element = document.getElementById('pdf-preview-content')
      if (!element) {
        console.error('PDF preview content element not found')
        return
      }

      // Configure html2canvas options for better quality
      const canvas = await html2canvas(element, {
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight
      })

      const imgData = canvas.toDataURL('image/png')
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Calculate dimensions
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 295 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight

      let position = 0

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Add additional pages if content is longer than one page
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
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

  const itinerary = tourData.plannedItinerary
  const totalTravelTime = itinerary.reduce((total, day) => total + day.estimatedTravelTime, 0)
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

            {/* Daily Schedule */}
            <div className="pdf-daily-schedule">
              {itinerary.map((day, index) => (
                <div key={day.date} className={`pdf-day-card ${day.type || 'tour'}`}>
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
                                <div key={poi.id} className="pdf-poi-item">
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
                                <div key={poi.id} className="pdf-poi-item">
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
                              <span><strong>{Math.round(day.estimatedTravelTime / 60)}h {day.estimatedTravelTime % 60 > 0 ? `${day.estimatedTravelTime % 60}m` : ''}</strong></span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
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