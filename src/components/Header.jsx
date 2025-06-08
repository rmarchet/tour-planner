import React from 'react'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export const Header = ({ tourData }) => {
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

  const exportToPDF = async () => {
    try {
      // Create a container for PDF content
      const element = document.getElementById('itinerary-pdf-content')
      if (!element) {
        console.error('PDF content element not found')
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
      
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
    }
  }

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-title">
          <h1>🗺️ Tour Planner</h1>
          <p>Plan your multi-day adventure with ease</p>
        </div>
        
        {hasItinerary && (
          <div className="header-export-buttons">
            <button onClick={generateShareableLink} className="export-btn share-btn">
              🔗 Share
            </button>
            <button onClick={exportToPDF} className="export-btn pdf-btn">
              📄 PDF
            </button>
            <button onClick={exportToJson} className="export-btn json-btn">
              📊 JSON
            </button>
            <button onClick={exportToICS} className="export-btn calendar-btn">
              📅 Calendar
            </button>
          </div>
        )}
      </div>
    </header>
  )
} 