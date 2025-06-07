You are helping me build a web application in React (with Rollup as the bundler). The goal is to create a **Tour Planner** app using **Google Maps**.

## Core Concept
The user wants to plan a multi-day tour by:
- Setting a **start and end date**
- Specifying **overnight locations** (one or more)
- Adding **points of interest (POIs)** they'd like to visit

The app will then organize the tour by:
- Distributing POIs across the days
- Assigning daily routes that start and end at the overnight stay
- Showing everything on a map, with visual routes and color-coded days

---

## Features (MVP)

### 1. Tour Input Panel
- Date picker: start and end date
- List input: overnight location(s) (as Google Maps search fields)
- List input: POIs (each with name and optional category)

### 2. Google Maps Integration
- Display overnight stays and POIs as markers
- Draw directions (there-and-back) between overnight stay and POIs for each day
- Color-code routes by day
- Show routes on the map using Directions API

### 3. Auto Planning Algorithm
- Cluster POIs based on proximity to overnight stays and total duration
- Distribute them across days
- Optimize to reduce backtracking
- Provide a per-day summary of locations and estimated travel time

### 4. Daily Itinerary View
- Display each day with:
  - Date
  - List of visits with order
  - Travel time
- Include buttons to export as:
  - Shareable link
  - PDF
  - ICS calendar

---

## Optional (AI / advanced)
- Recommend POIs by city and category (using Google Places or OpenAI)
- Automatically suggest which POIs to prioritize
- Auto-generate a "travel blog" style itinerary text

---

## Tech Stack
- React
- Rollup (already set up)
- OpenStreetMap + MapLibre GL JS (Places + Directions)
- maplibre-gl
- react-map-gl
- `date-fns` or similar for date handling
- Data persistency in localStorage

---

## Style (optional)
- UI should work well on tablet (touch-friendly)
- Optional: retro 80s or CRT, TUI style
