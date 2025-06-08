# TODO

- [ ] routes calculation 
  - [ ] should not be straight lines
  - [x] smarter algorithm
  - [ ] loading spinner while routes are calculated

- [ ] import JSON
- [ ] export PDF
  - [x] better pagination
  - [x] map of the route for each day
  - [x] map larger and without zoom controls
  - [x] map exported to PDF has messed overlay
- [x] tour map filtered by day shows only the locations of that date
- [ ] sidebar
  - [ ] start date and end date input fields on the same row
  - [ ] possibility to add sub-POI for each POI
  - [ ] possibility to drag and sort POI manually

## Routes

```
First Day (Mixed):    Home → POI1 → POI2 → Hotel
                      🏠 ──────🗺️────🗺️────🏨

Middle Day (Tour):    Hotel → POI3 → POI4 → Hotel  
                      🏨 ──────🗺️────🗺️────🏨

Last Day (Mixed):     Hotel → POI5 → Home
                      🏨 ──────🗺️────🏠
```