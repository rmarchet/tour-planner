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
  const [mapRoutes, setMapRoutes] = useState(() => {
    // Load routes from localStorage on app initialization
    try {
      const savedRoutes = localStorage.getItem('tourPlannerRoutes')
      if (savedRoutes) {
        const routes = JSON.parse(savedRoutes)
        console.log('🗂️ Loaded', routes.length, 'route(s) from localStorage cache')
        return routes
      }
      return []
    } catch (error) {
      console.warn('Failed to load routes from localStorage:', error)
      return []
    }
  })
  const mapRef = React.useRef()

  // Save to localStorage whenever tourData changes
  useEffect(() => {
    localStorage.setItem('tourPlannerData', JSON.stringify(tourData))
  }, [tourData])

  // Validate stored routes on app startup
  useEffect(() => {
    if (mapRoutes.length > 0 && !areStoredRoutesValid()) {
      console.log('Stored routes are outdated, clearing them')
      setMapRoutes([])
      clearRoutesFromStorage()
    }
  }, []) // Only run on mount

  // Save routes to localStorage
  const saveRoutesToStorage = (routes) => {
    try {
      localStorage.setItem('tourPlannerRoutes', JSON.stringify(routes))
      localStorage.setItem('tourPlannerRoutesTimestamp', Date.now().toString())
    } catch (error) {
      console.warn('Failed to save routes to localStorage:', error)
    }
  }

  // Clear routes from localStorage  
  const clearRoutesFromStorage = () => {
    try {
      localStorage.removeItem('tourPlannerRoutes')
      localStorage.removeItem('tourPlannerRoutesTimestamp')
    } catch (error) {
      console.warn('Failed to clear routes from localStorage:', error)
    }
  }

  // Check if stored routes are still valid for current tour data
  const areStoredRoutesValid = () => {
    try {
      const routesTimestamp = localStorage.getItem('tourPlannerRoutesTimestamp')
      const dataTimestamp = localStorage.getItem('tourPlannerDataTimestamp')
      
      // If we have both timestamps and routes were calculated after data was last updated
      if (routesTimestamp && dataTimestamp) {
        return parseInt(routesTimestamp) > parseInt(dataTimestamp)
      }
      
      return false
    } catch (error) {
      return false
    }
  }

  const updateTourData = (updates) => {
    setTourData(prev => ({ ...prev, ...updates }))
    
    // Clear routes if significant tour data changes
    const significantChanges = [
      'plannedItinerary', 'pois', 'overnightStays', 'homeLocation', 'startDate', 'endDate'
    ]
    
    if (significantChanges.some(key => updates.hasOwnProperty(key))) {
      setMapRoutes([])
      clearRoutesFromStorage()
    }
    
    // Update data timestamp
    try {
      localStorage.setItem('tourPlannerDataTimestamp', Date.now().toString())
    } catch (error) {
      console.warn('Failed to save data timestamp:', error)
    }
  }

  const openPDFPreview = () => {
    setIsPDFPreviewOpen(true)
  }

  const closePDFPreview = () => {
    setIsPDFPreviewOpen(false)
  }

  const handleTourGenerated = () => {
    // Check if we already have valid cached routes
    if (mapRoutes.length > 0 && areStoredRoutesValid()) {
      console.log('✅ Using cached routes, skipping calculation')
      return
    }
    
    // Trigger route calculation in the map component
    if (mapRef.current?.calculateRoutes) {
      console.log('🔄 Calculating fresh routes...')
      mapRef.current.calculateRoutes()
    }
  }

  return (
    <div className="tour-planner">
      <Header tourData={tourData} openPDFPreview={openPDFPreview} updateTourData={updateTourData} />
      
      <div className="main-content">
        <div className="left-panel">
          <TourInputPanel 
            tourData={tourData} 
            updateTourData={updateTourData} 
            onTourGenerated={handleTourGenerated}
          />
          
          {tourData.plannedItinerary && (
            <DailyItinerary 
              itinerary={tourData.plannedItinerary}
              startDate={tourData.startDate}
              mapRoutes={mapRoutes}
            />
          )}
        </div>
        
        <div className="right-panel">
          <SimpleMapDisplay 
            ref={mapRef}
            tourData={tourData}
            updateTourData={updateTourData}
            onRoutesCalculated={(routes) => {
              console.log('💾 Saving', routes.length, 'route(s) to localStorage cache')
              setMapRoutes(routes)
              saveRoutesToStorage(routes)
            }}
          />
        </div>
      </div>
      
      <PDFPreviewModal 
        isOpen={isPDFPreviewOpen}
        onClose={closePDFPreview}
        tourData={tourData}
        routes={mapRoutes}
      />
    </div>
  )
}
