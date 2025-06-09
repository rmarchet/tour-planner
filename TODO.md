# TODO

- [x] routes calculation 
  - [x] should not be straight lines
  - [x] smarter algorithm
  - [x] loading spinner while routes are calculated

- [x] import JSON
- [ ] export PDF
  - [x] better pagination
  - [x] map of the route for each day
  - [x] map larger and without zoom controls
  - [x] map exported to PDF has messed overlay
- [x] tour map filtered by day shows only the locations of that date
- [ ] Main map
  - [ ] only update routes when manually click "Generate Tour Plan"
  - [ ] view names of main POIs directly on the map
- [ ] sidebar
  - [x] start date and end date input fields on the same row
  - [x] possibility to add sub-POI for each POI
  - [x] possibility manually assign a POI to a particular day

## Routes

```
First Day (Mixed):    Home → POI1 → POI2 → Hotel
                      🏠 ──────🗺️────🗺️────🏨

Middle Day (Tour):    Hotel → POI3 → POI4 → Hotel  
                      🏨 ──────🗺️────🗺️────🏨

Last Day (Mixed):     Hotel → POI5 → Home
                      🏨 ──────🗺️────🏠
```