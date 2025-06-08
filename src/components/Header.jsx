import React from 'react'
import { format } from 'date-fns'

export const Header = ({ tourData, openPDFPreview, updateTourData }) => {
  const hasItinerary = tourData.plannedItinerary && tourData.plannedItinerary.length > 0

  const generateShareableLink = () => {
    const shareData = {
      startDate: tourData.startDate,
      endDate: tourData.endDate,
      homeLocation: tourData.homeLocation,
      overnightStays: tourData.overnightStays,
      pois: tourData.pois,
      plannedItinerary: tourData.plannedItinerary
    }
    
    const encoded = btoa(JSON.stringify(shareData))
    const shareableUrl = `${window.location.origin}${window.location.pathname}?data=${encoded}`
    
    navigator.clipboard.writeText(shareableUrl).then(() => {
      alert('Shareable link copied to clipboard!')
    }).catch(() => {
      alert(`Shareable link: ${shareableUrl}`)
    })
  }

  const exportToJson = () => {
    const dataStr = JSON.stringify(tourData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tour-plan-${format(new Date(tourData.startDate), 'yyyy-MM-dd')}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportToICS = () => {
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tour Planner//Tour Planner//EN',
      'CALSCALE:GREGORIAN'
    ]

    tourData.plannedItinerary.forEach((day, index) => {
      const dayDate = new Date(tourData.startDate)
      dayDate.setDate(dayDate.getDate() + index)
      const dateStr = format(dayDate, 'yyyyMMdd')
      
      let summary = ''
      let description = ''
      
      if (day.type === 'travel') {
        summary = `Travel Day: ${day.travelRoute.from} → ${day.travelRoute.to}`
        description = `Travel from ${day.travelRoute.from} to ${day.travelRoute.to}\\nEstimated travel time: ${Math.round(day.estimatedTravelTime)} minutes`
      } else if (day.type === 'tour') {
        summary = `Tour Day in ${day.overnightStay.location}`
        const poiNames = day.pois.map(poi => poi.name).join(', ')
        description = `Visit: ${poiNames}\\nOvernight: ${day.overnightStay.location}`
      } else if (day.type === 'mixed') {
        summary = `Travel & Tour: ${day.travelRoute?.from || 'Start'} → ${day.overnightStay.location}`
        const poiNames = day.pois.map(poi => poi.name).join(', ')
        description = `Travel to ${day.overnightStay.location}\\nVisit: ${poiNames}\\nOvernight: ${day.overnightStay.location}`
      }
      
      icsContent.push(
        'BEGIN:VEVENT',
        `DTSTART:${dateStr}T090000Z`,
        `DTEND:${dateStr}T180000Z`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `UID:${Date.now()}-${index}@tourplanner.app`,
        'END:VEVENT'
      )
    })

    icsContent.push('END:VCALENDAR')
    
    const icsBlob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar' })
    const icsUrl = URL.createObjectURL(icsBlob)
    const link = document.createElement('a')
    link.href = icsUrl
    link.download = `tour-calendar-${format(new Date(tourData.startDate), 'yyyy-MM-dd')}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(icsUrl)
  }

  const importFromJson = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (event) => {
      const file = event.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result)
          
          // Validate the imported data structure
          if (!validateTourData(importedData)) {
            alert('Invalid tour data format. Please select a valid tour JSON file.')
            return
          }

          // Confirm with user before replacing current data
          const hasCurrentData = tourData.startDate || tourData.overnightStays.length > 0 || tourData.pois.length > 0
          if (hasCurrentData) {
            const confirmImport = confirm(
              'Importing will replace your current tour data. Are you sure you want to continue?'
            )
            if (!confirmImport) return
          }

          // Update the tour data
          updateTourData(importedData)
          alert('Tour data imported successfully!')
          
        } catch (error) {
          console.error('Import error:', error)
          alert('Error reading file. Please ensure it\'s a valid JSON file.')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // Validate imported tour data structure
  const validateTourData = (data) => {
    try {
      // Check for required top-level properties
      if (typeof data !== 'object' || data === null) return false
      
      // Check arrays exist and are arrays
      if (!Array.isArray(data.overnightStays)) return false
      if (!Array.isArray(data.pois)) return false
      
      // Check home location structure (if present)
      if (data.homeLocation && typeof data.homeLocation !== 'object') return false
      
      // Check overnight stays structure
      for (const stay of data.overnightStays) {
        if (!stay.id || !stay.location) return false
      }
      
      // Check POIs structure
      for (const poi of data.pois) {
        if (!poi.id || !poi.name) return false
        // Validate POI type hierarchy
        if (poi.type === 'secondary' && !poi.nearMainPOI) return false
      }
      
      // Check dates are valid (if present)
      if (data.startDate && isNaN(new Date(data.startDate))) return false
      if (data.endDate && isNaN(new Date(data.endDate))) return false
      
      return true
    } catch (error) {
      return false
    }
  }



  return (
    <header className="header">
      <div className="header-content">
        <div className="header-title">
          <h1>🗺️ Tour Planner</h1>
          <p>Plan your multi-day adventure with ease</p>
        </div>
        
        <div className="header-export-buttons">
          <button onClick={importFromJson} className="export-btn import-btn">
            📥 Import
          </button>
          {hasItinerary && (
            <>
              <button onClick={generateShareableLink} className="export-btn share-btn">
                🔗 Share
              </button>
              <button onClick={openPDFPreview} className="export-btn pdf-btn">
                📄 PDF
              </button>
              <button onClick={exportToJson} className="export-btn json-btn">
                📊 Export
              </button>
              <button onClick={exportToICS} className="export-btn calendar-btn">
                📅 Calendar
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
} 