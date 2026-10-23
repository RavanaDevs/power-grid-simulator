# Lanka Grid — Sri Lanka Power System Simulator

A modern OpenStreetMap-based infrastructure atlas and educational power-system simulator. Built on branch `simulator/sri-lanka-osm`; the original Gridkeeper game remains available at `/classic` and in `main`.

## Run locally

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. Production: `npm run build` then `npm start`.

## Explore and operate

- **Atlas** shows 56 researched locations (23 generating sites and 33 substations) and 138 actual OSM 132/220 kV line segments. Purple denotes 220 kV; teal denotes 132 kV. Coverage is selected, not a complete national network.
- Search **Asset explorer**, select a map symbol or transmission route, and inspect coordinates, reference capacities and original sources. OSM footprint centers are mapped positions, not survey-grade generator terminals. Some route labels describe nearby assets instead of official circuit names.
- **Simulation** shows the explicitly separate 10-bus, 18-corridor electrical training model with dashed connections. Seven sourced sites link to its controllable generating assets. Other researched plants are reference-only and contribute no simulated MW.
- At country scale, only major plant symbols are shown. Zoom in to reveal smaller plants (zoom 8), substations (9), and model demand/buses (10). Selected and alarmed equipment stays visible. Symbols and labels remain crisp at a fixed screen size.
- Moving dashes show modeled power-flow direction while running. Protection trips leave red line/equipment badges; curtailed demand shows its percentage. Recent events pulse and produce clickable map cards for nine real seconds, independent of simulation speed.
- Every simulated plant, load and battery has a dotted equipment connection to its equivalent bus. Four plant connections pass through explicitly associated mapped switchyards; these connectors are illustrative, not surveyed conductor routes. Reference-only plants remain in Atlas.
- Select a dispatch-linked plant to change its target, connect/disconnect it, and inspect modeled reservoir levels. Press **Run**; pause whenever you need time. Normal speed is 12 grid seconds per real second, with 2×/5×/10×/30× acceleration.
- Use **Network** to inspect and switch model breakers. Event-log entries focus affected equipment. Actual mapped OSM routes do not receive fabricated loading measurements or switching controls.
- Expand **Supply & demand** at the bottom to compare actual **simulated** supply/demand with the saved forecast baseline. It starts collapsed to give the map more room. Update the dispatch plan explicitly. **Analytics** tracks illustrative fuel, water, emissions and outage costs.
- Choose **Scenario → Bring back the lights** to practice auxiliary power, hydro startup, energization and staged demand restoration. Instructions are available in English and Sinhala.
- **Save** stores the current simulation locally on this device. **Scenario → Load saved session** restores it paused. Original-game saves are separate.
- Switch English/Sinhala in the header. The quick guide explains the main workflow. Sidebars and charts can be closed to make more map space. Optional sound cues announce dispatch, breaker operations and alarms; enable them in the header.

The basemap requests normal viewport tiles from `tile.openstreetmap.org`, with visible OpenStreetMap attribution and standard browser caching. Internet access is required for tiles; a bundled coastline and researched vector features remain usable when tiles fail. No bulk tile download or offline tile scraping is performed.

## Accuracy and provenance

- [Sri Lanka infrastructure research and coordinate register](docs/SRI_LANKA_INFRASTRUCTURE.md)
- [Electrical model, assumptions and limitations](docs/SIMULATOR_MODEL.md)
- [Earlier game research and implementation history](docs/RESEARCH.md)

Geography is sourced; the retained electrical solver is a reduced educational model, not an AC utility planning model. OSM crossings do not establish electrical connectivity. Do not interpret illustrative ratings, operating costs, relay delays or forecasts as CEB operational data. The interface separates reference-only infrastructure from dispatch-linked assets and provides original source links.

OSM-derived data © OpenStreetMap contributors, licensed under ODbL 1.0. The local Natural Earth coastline is public domain. The research snapshot is dated 2026-10-23.

## Validation

```sh
npm test
npm run typecheck
npm run build
```

Tests cover DC-flow conservation, protection/cascades, finite storage and water, economics, blackout restoration, dead-island telemetry, geographic/source integrity, exact shared OSM terminal nodes, equipment connections, zoom visibility and wall-clock event expiry.
