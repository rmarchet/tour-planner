# 🗺️ Tour Planner
A React-based web application for planning multi-day tours with OpenStreetMap integration

## Features
- **Interactive Tour Planning**: Set dates, add overnight stays and points of interest
- **OpenStreetMap Integration**: Visual map with markers and color-coded driving routes
- **Auto Route Planning**: Intelligent distribution of POIs across tour days
- **Export Options**: Share links, download JSON, export to calendar (ICS)
- **Local Storage**: Automatically saves your tour data
- **Responsive Design**: Works beautifully on tablets and desktops
- **Modern UI**: Beautiful gradients and touch-friendly interface
- **Free & Open Source**: No API keys required for basic functionality!

## Getting Started

### Prerequisites
- Node.js and npm/yarn installed on your machine
- Optional: OpenRouteService API key for enhanced routing (free tier available)

### Installation
1. Clone the repository:
```
git clone https://github.com/rmarchet/tour-planner.git
cd tour-planner
```

2. Install dependencies:
```
npm install
# or
yarn install
```

3. **Optional - Set up Enhanced Routing**:
   For better route optimization, you can get a free OpenRouteService API key:
   - Go to [OpenRouteService](https://openrouteservice.org/dev/)
   - Sign up for a free account
   - Get your API key
   - Update `src/config/map.js`:
   ```javascript
   export const ROUTING_API_KEY = 'your-openrouteservice-api-key'
   ```
   
   **Note**: The app works without any API keys using fallback routing!

## Available Scripts
In the project directory, you can run:

`npm start` or `yarn start`  
Runs the app in development mode with live reloading.<br> Open http://localhost:3000 to view it in the browser.

`npm run build` or `yarn build`  
Builds the app for production to the `dist` folder.  
The build is minified and optimized for best performance.

## How to Use
1. **Set Tour Dates**: Choose your start and end dates
2. **Add Overnight Stays**: Enter hotels or places where you'll sleep
3. **Add Points of Interest**: List all the places you want to visit
4. **Generate Tour Plan**: Click the generate button to create your itinerary
5. **View on Map**: See your route with color-coded days
6. **Export**: Share your itinerary or add it to your calendar

## Project Structure
```
tour-planner/
├── dist/                   # Build output
├── public/                 # Static assets
│   ├── favicon.ico
│   ├── favicon.png
│   └── index.html          # HTML template
├── src/                    # Source code
│   ├── components/         # React components
│   │   ├── App.jsx         # Main application
│   │   ├── TourInputPanel.jsx
│   │   ├── MapDisplay.jsx
│   │   └── DailyItinerary.jsx
│   ├── config/             # Configuration
│   │   └── map.js          # Map and routing configuration
│   ├── styles/             # CSS styles
│   │   └── main.css
│   └── index.jsx           # Application entry point
├── .babelrc                # Babel configuration
├── .gitignore
├── LICENSE                 # MIT License
├── package.json            # Dependencies and scripts
├── PROMPT.md               # Original project specification
├── README.md
└── rollup.config.mjs       # Rollup configuration
```

## Technologies Used
- **React 19** - Frontend framework
- **Rollup** - Module bundler
- **OpenStreetMap** - Free and open map data
- **MapLibre GL JS** - Open-source map rendering
- **react-map-gl** - React MapLibre components
- **Nominatim** - Free geocoding service
- **OpenRouteService** - Free routing service
- **date-fns** - Date manipulation
- **PostCSS** - CSS processing

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Author
Roberto Marchetti - rmarchet@gmail.com