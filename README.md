# Heritage Combined Explorer — UK & Ireland

An interactive map combining **four** heritage organisations across the UK and Ireland into a single unified interface.

## Organisations

| Organisation | Sites | Region | Colour |
|---|---|---|---|
| English Heritage | 388 | England | Blue |
| National Trust | 619 | UK-wide | Green |
| Cadw Wales | 124 | Wales | Red |
| Heritage Ireland | 173 | Ireland | Gold |

**Total: ~1,304 heritage sites**

## Features

- **Unified map** — all four datasets on a single MapLibre GL JS map, centred to show both the UK and Ireland
- **Region toggle** — quickly show/hide UK & Wales or Ireland with one click
- **Organisation filters** — toggle each of the four organisations independently
- **Category filters** — Castles, Religious sites, Houses, Roman, Prehistoric, Gardens, Parks, Other
- **Admission & Highlight** — Free Entry and Star Site filters (English Heritage data)
- **Historical Period** — Prehistoric, Roman, Medieval, Tudor, Industrial
- **Colour-by toggle** — colour markers by Organisation or by Category
- **Search autocomplete** — real-time search across all 1,304 site names
- **Slide-out property sidebar** — image, description, category/period badges, status (Ireland), and direct website link
- **Draggable filter panel** — drag to any screen position on desktop
- **Mobile responsive** — bottom-sheet filter panel and full-width sidebar on small screens
- **Fullscreen mode** — MapLibre fullscreen control

## Tech Stack

- [MapLibre GL JS](https://maplibre.org/) v4.7.1
- [Bootstrap](https://getbootstrap.com/) 5.3.2 + Bootstrap Icons 1.11.2
- [OpenFreeMap](https://openfreemap.org/) tile style (`liberty`)
- Vanilla JavaScript (ES2020 class)
- Self-contained — no build step, no server required

## Data Sources

| File | Source |
|---|---|
| `english-heritage.geojson` | English Heritage website scrape |
| `NationalTrust.geojson` | National Trust API |
| `cadw.geojson` | Cadw Welsh Heritage |
| `heritage_ireland.geojson` | Heritage Ireland website |

## Running Locally

```bash
# Any static file server works, e.g.:
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080/heritage-combined/`.
