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
- **Category filters** — Castles, Religious sites, Houses, Roman, Prehistoric, Gardens, Parks, Nature & Coast, Industrial, Military & Forts, Monuments, Other
- **Admission & Highlight** — Free Entry and Star Site filters (English Heritage, National Trust, Cadw, Heritage Ireland)
- **Historical Period** — Prehistoric, Roman, Early Medieval, Medieval, Tudor, Stuart, Georgian, Victorian, Industrial, 20th Century, Natural / Landscape
- **Colour-by toggle** — colour markers by Organisation or by Category
- **Search autocomplete** — real-time search across all 1,304 site names
- **Slide-out property sidebar** — image, description, category/period badges, historical context details, status (Ireland), and direct website link
- **Draggable filter panel** — drag to any screen position on desktop
- **Mobile responsive** — bottom-sheet filter panel and full-width sidebar on small screens
- **Fullscreen mode** — MapLibre fullscreen control

## Tech Stack

- [MapLibre GL JS](https://maplibre.org/) v4.7.1
- [Bootstrap](https://getbootstrap.com/) 5.3.2 + Bootstrap Icons 1.11.2
- [OpenFreeMap](https://openfreemap.org/) tile style (`liberty`)
- [DuckDB-Wasm](https://duckdb.org/docs/api/wasm/overview) in-browser spatial SQL engine
- Vanilla JavaScript (ES2020 class)
- Self-contained — no build step, no server required

## Data Source

| File | Source | Description |
|---|---|---|
| `heritage_unified.geojson` | Unified DuckDB Pipeline | Consolidated, enriched dataset of all 1,304 sites with standardized schema, verified coordinates, historical periods, and thematic categories |

## Running Locally

```bash
# Any static file server works, e.g.:
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080/heritage-combined/`.
