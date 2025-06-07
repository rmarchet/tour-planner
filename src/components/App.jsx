import React, { useState, useEffect } from 'react'
import { TourInputPanel } from './TourInputPanel'
import { SimpleMapDisplay } from './SimpleMapDisplay'
import { DailyItinerary } from './DailyItinerary'

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

  // Save to localStorage whenever tourData changes
  useEffect(() => {
    localStorage.setItem('tourPlannerData', JSON.stringify(tourData))
  }, [tourData])

  const updateTourData = (updates) => {
    setTourData(prev => ({ ...prev, ...updates }))
  }

  return (
    <div className="tour-planner">
      <header className="header">
        <h1>🗺️ Tour Planner</h1>
        <p>Plan your multi-day adventure with ease</p>
      </header>
      
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
    </div>
  )
}
