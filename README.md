# Gridkeeper — Sri Lanka

A full-screen power-grid strategy game with an illustrated, pannable Sri Lanka map, English/Sinhala switching, sounds and interactive first-player training.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. Production: `npm run build` then `npm start`.

## Play

Keep nine generators, a battery, ten demand areas and eighteen transmission routes working through a 24-hour shift. Choose Monsoon shift, Lost generation, Cascade watch, Sudden demand loss, Dry season, or Bring back the lights (black-start restoration). Normal speed advances 12 grid seconds per real second (a two-hour day at 1×); 2×, 5×, 10× and 30× are available. Severe events slow accelerated playback.

- Select plants on the map, in the scrolling dock, or through the location picker. Dispatch follows targets with finite ramp rates.
- Aim for 50 Hz. Increase generation for low frequency; reduce it or charge storage for high frequency. Shedding load during overfrequency makes matters worse.
- Hydro consumes limited water. Oil and coal consume more money and emit CO₂. Open **Resources & economy** for the ledger, water levels and environmental impact.
- Open **Supply & demand** for measured and forecast curves. Updating the plan saves current targets as the forecast baseline. Dashed predictions remain conditional on water, storage and equipment availability.
- Inspect routes for loading and thermal relay heat. Buy upgrades, open breakers, and reconnect after lockouts. Every trip redistributes power and can cause a cascade.
- Use negative battery targets to charge and positive targets to discharge. Storage holds 600 MWh.
- Space pauses; drag pans; zoom and fit controls explore the larger map. Settings includes save/load, training replay and research notes.
- Switch **සිංහල / English** at any time. Language, audio and training preferences persist locally.
- Blackout progressively darkens the map without a blocking failure dialog. Inspect the failure timeline or start another shift.

The simulation solves ten-bus DC active-power flow and per-island simplified frequency response. It includes generator frequency trips, thermal line trips, automatic underfrequency shedding, finite water and storage, operating costs and environmental levies. It does not solve AC voltage/reactive power or replicate national-grid operations.

Plant references, Sinhala names, sources, equations and explicit game assumptions are documented in [docs/RESEARCH.md](docs/RESEARCH.md). Reference capacities are from CEB's 2023 publication; economics, water reserves, demand and network topology are game parameters.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

Independent engine tests cover conservation, disconnected islands, ramping, energy bounds, both frequency protections, cascades, water exhaustion, accounting, forecasts, save validation, and shift outcomes. The worker simulates at 20 Hz and publishes UI snapshots at 5 Hz. PixiJS renders the island; React provides contextual game controls.

Saves use version 2 and stay in the browser. Earlier small-map saves cannot be loaded into the expanded network. Loading a compatible save pauses time. No backend or credentials are required. Online fonts have system fallbacks.

## RTS camera and windows

- The island now follows a locally bundled Natural Earth coastline with geographic proportions. Equipment locations remain schematic and are offset for selection/readability.
- **WASD / arrows:** pan; **drag:** pan; **mouse wheel:** zoom around the cursor; **Home / Fit island:** overview. The minimap jumps to an area, and exposed screen edges pan the map.
- **Fleet** opens a searchable plant roster. Select a unit to fly to it and open the inspector.
- Drag a window by its title bar. Collapse or close it using its title-bar buttons. **Windows** reopens any panel, focuses collapsed windows, or resets the layout.
- **Log** shows notifications and severity filters. Selecting a notification folds the log and highlights its asset or affected grid area. Failed routes have pulsing fault markers and selected routes light up at both endpoints.
- Sinhala translations cover the new controls and panels. On small screens the mission and fleet start collapsed to preserve map space.

Black-start mission: use the automatically opened procedures window to establish station auxiliaries, start Upper Kotmale, energize routes from live buses, restart generators, and reconnect each community in 10% steps. Raise dispatch limits to keep reserve; hold full restoration at stable frequency for 20 simulation seconds to win. The Windows menu reopens the checklist. Startup sequences and governors are simplified for gameplay.
