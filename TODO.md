# TODO
- [ ] General
  - [x] add favicon
  - [x] add github action
  - [ ] split CSS

- [x] routes calculation 
  - [x] should not be straight lines
  - [x] smarter algorithm
  - [x] loading spinner while routes are calculated
  - [ ] cache route in localStorage
  - [x] first day route consider the travel from Home → POI → Hotel
  - [x] last day route consider the travel from Hotel → POI → Home
  - [x] travel times computed on real routes
  - [x] travel times minutes trim

- [x] import JSON
- [ ] export PDF
  - [x] better pagination
  - [x] map of the route for each day
  - [x] map larger and without zoom controls
  - [x] map exported to PDF has messed overlay
  - [x] differentiate secondary POI with recognizable style
  - [ ] better cover for PDF with table of contents
- [x] tour map filtered by day shows only the locations of that date
- [ ] Main map
  - [x] only update routes when manually click "Generate Tour Plan"
  - [ ] view names of main POIs directly on the map
- [ ] sidebar
  - [x] start date and end date input fields on the same row
  - [x] possibility to add sub-POI for each POI
  - [x] possibility manually assign a POI to a particular day
  - [ ] collapsible sections

## Routes

```
First Day (Mixed):    Home → POI1 → POI2 → Hotel
                      🏠 ──────🗺️────🗺️────🏨

Middle Day (Tour):    Hotel → POI3 → POI4 → Hotel  
                      🏨 ──────🗺️────🗺️────🏨

Last Day (Mixed):     Hotel → POI5 → Home
                      🏨 ──────🗺️────🏠
```