import React, { useState, useEffect } from 'react'
import { TourInputPanel } from './TourInputPanel'
import { SimpleMapDisplay } from './SimpleMapDisplay'
import { DailyItinerary } from './DailyItinerary'
import { Header } from './Header'
import { PDFPreviewModal } from './PDFPreviewModal'

export const App = () => {
  const [tourData, setTourData] = useState(() => {
    // Load from localStorage
    const saved = localStorage.getItem('tourPlannerData')
    return saved ? JSON.parse(saved) : {
      startDate: null,
      endDate: null,
      homeLocation: { location: '', coordinates: null },
      overnightStays: [],
      pois: [],
      plannedItinerary: null
    }
  })
  
  const [isPDFPreviewOpen, setIsPDFPreviewOpen] = useState(false)

  // Save to localStorage whenever tourData changes
  useEffect(() => {
    localStorage.setItem('tourPlannerData', JSON.stringify(tourData))
  }, [tourData])

  const updateTourData = (updates) => {
    setTourData(prev => ({ ...prev, ...updates }))
  }

  const openPDFPreview = () => {
    setIsPDFPreviewOpen(true)
  }

  const closePDFPreview = () => {
    setIsPDFPreviewOpen(false)
  }

  return (
    <div className="tour-planner">
      <Header tourData={tourData} openPDFPreview={openPDFPreview} />
      
      <div className="main-content">
        <div className="left-panel">
          <TourInputPanel 
            tourData={tourData} 
            updateTourData={updateTourData} 
          />
          
          {tourData.plannedItinerary && (
            <DailyItinerary 
              itinerary={tourData.plannedItinerary}
              startDate={tourData.startDate}
            />
          )}
        </div>
        
        <div className="right-panel">
          <SimpleMapDisplay 
            tourData={tourData}
            updateTourData={updateTourData}
          />
        </div>
      </div>
      
      <PDFPreviewModal 
        isOpen={isPDFPreviewOpen}
        onClose={closePDFPreview}
        tourData={tourData}
      />
    </div>
  )
}
