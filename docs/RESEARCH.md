# Gridkeeper: research and modelling notes

Research checked 9 October 2026. Historical publications are reference material, not live system data. All changes remain in this project folder.

## Sri Lankan reference plants

The [CEB Sales and Generation Data Book 2023](https://www.ceb.lk/front_img/img_reports/1727249440Sales_and_Generation_Data_Book_2023.pdf) provides reference capacities. These do not assert present availability or current operating output.

| Game plant | Sinhala | Reference capacity |
|---|---|---:|
| Lakvijaya coal | ලක්විජය | 900 MW |
| Victoria hydro | වික්ටෝරියා | 210 MW |
| Upper Kotmale hydro | ඉහළ කොත්මලේ | 150 MW |
| Samanalawewa hydro | සමනලවැව | 120 MW |
| Kelanitissa combined cycle, represented as liquid-fuel thermal | කැළණිතිස්ස සංයුක්ත චක්‍ර | 165 MW (110 + 55) |
| Sapugaskanda thermal | සපුගස්කන්ද | 160 MW (80 + 40 + 40) |
| Thambapavani wind | තම්බපවනී සුළං | 103.5 MW |

Names follow the [CEB Sinhala plant gallery](https://www.ceb.lk/media-gallery/our-power-plants/si). Thambapavani's Sinhala spelling is also supported by [Sri Lanka Parliament's project question](https://www.parliament.lk/si/business-of-parliament/parliamentary-questions/details/30644/0182). Other interface text is an original Sinhala translation.

Hambantota solar cluster (150 MW), western rooftop solar (100 MW), and the national battery (150 MW / 600 MWh) are fictional gameplay aggregates, not claims about particular commissioned facilities. The ten demand areas, ten substations, eighteen routes, map positions, line ratings and reactances are schematic. This is not a replica of CEB transmission topology.

## Frequency, protection, and cascades

The [PUCSL Grid Code page](https://www.pucsl.gov.lk/legal_documents/grid-code/) and its [March 2014 document](https://www.pucsl.gov.lk/wp-content/uploads/2018/09/Grid-Code-March-2014-Final1.pdf), particularly sections 3.4.2, 3.9.1 and 7.5, inform the 50 Hz nominal frequency, normal ±1% band and 47.5–52.5 Hz emergency envelope. The game does **not** reproduce utility relay settings: its three-second generator delay, staged shedding, lockouts, and collapse timers are shortened game rules.

[NREL's grid inertia guide](https://research-hub.nlr.gov/en/publications/inertia-and-the-power-grid-a-guide-without-the-spin/) informs the reduced swing-equation approach. Each connected island has independent inertia and frequency. A power surplus raises frequency; a deficit lowers it. Load damping limits deviations; player dispatch remains necessary. This fixes the old behaviour in which installed capacity diluted the surplus response.

The network uses a DC active-power approximation with reactance-weighted flows. Thermal exposure increases with squared loading above the rating and cools below it. Trips immediately redistribute flow, allowing further trips and islanding. Voltage, reactive power, governor dynamics, full inverter controls, transient stability and protection coordination are not solved.

An overfrequency trip can subsequently cause underfrequency after generation is lost; the timeline preserves these events. Both directions can end the shift. Blackouts extinguish the island in stages and show a nonmodal result banner, retaining map inspection and a failure timeline.

## Water, money, and environmental impact

[SLSEA's hydropower overview](https://www.energy.gov.lk/en/renewable-energy/technologies/hydroelectric-energy) explains the role of stored water and multipurpose reservoirs. The game converts water to energy using `E = ρ g h V η`, with η = 0.9. Usable volumes, effective heads, rainfall inflows and starting levels are illustrative game parameters, not measured reservoir values. Empty reservoirs physically constrain output. Dry-season scenarios reduce initial usable water and inflow.

Fuel/operation costs in LKR/MWh: coal 18,000; oil 47,000; hydro 2,500; solar 1,200; wind 1,400; battery 800. Income is 32,000 per supplied MWh; unserved demand costs 85,000 per MWh. Opening funds are LKR 450 million; a +200 MW route upgrade costs LKR 25 million. **These are game prices, not CEB tariffs or actual plant costs.**

Direct operational emissions use illustrative coefficients of 0.9 t CO₂/MWh for coal and 0.7 for oil, with zero direct combustion emissions for hydro/wind/solar/storage. This is not a lifecycle assessment: construction, reservoir methane and upstream fuel emissions are omitted. A fictional carbon levy of LKR 2,000/t and water-impact levy of LKR 250,000/Mm³ make environmental tradeoffs affect the budget. Water impact increases fourfold below 20% reservoir level. Ecology score is a gameplay indicator, not a scientific environmental index.

Battery energy accounts for 94% efficiency in each direction, cannot charge from a dead island, and cannot create energy beyond its stored charge. Cash tracks supplied-energy sales minus generation costs, environmental levies, unserved-energy penalties and upgrades.

## Forecast and measured curves

The panel shows actual net supply and requested demand, sampled every three accelerated grid minutes, alongside separately retained forecast readings. Future demand uses a morning/evening profile; future solar follows daylight and wind follows an illustrative profile. The supply forecast uses a saved dispatch plan. Changing a target does not silently rewrite the old baseline; the player explicitly updates the plan.

Dashed supply is conditional on resources and equipment remaining available. It is not a resource-constrained day-ahead optimization: depletion, faults, storm clouds and sudden demand rejection produce deviations. [NREL's FESTIV overview](https://www.nlr.gov/grid/festiv-model) provides context for the distinction between scheduling and real-time operation; the game does not implement FESTIV.

One real second at 1× now represents 12 grid seconds. Physics and relay checks use bounded 50 ms simulation steps. Energy and costs integrate accelerated grid hours. A full day takes two real hours at 1×, twelve minutes at 10×, or four minutes at 30×. Protection still uses simulation seconds; economy and reservoir withdrawal use the slower grid clock.

## Geographic map and RTS workspace update

The coastline now uses the Sri Lanka feature from [Natural Earth's 1:50m Admin 0 countries](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/), downloaded from the [Natural Earth vector repository](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson). Natural Earth data is public domain. Only the Sri Lanka geometry is bundled locally in `src/game/data/sri-lanka.json`; the game does not fetch map tiles or require a mapping service/API key.

Coordinates use a local equirectangular projection with longitude corrected at 7.8°N and 260 world units per latitude degree. The coastline retains its approximate geographic proportions. The minimap includes a 50 km scale. Generators and demand areas use approximate regional locations without the former large display offsets. Smaller symbolic buildings and leader lines keep labels separate from their actual anchors; this is not a survey of substations. Network connections and electrical reactances remain the same gameplay model, independent of the new rendering coordinates. No saved dispatch or economic state is changed by map projection.

Camera controls: mouse wheel zooms about the cursor; dragging pans; WASD or arrows pan; screen-edge motion pans while the pointer is over the exposed map; Home/fit returns to the overview. Clicking the minimap moves the camera. Selecting an event or asset focuses the camera and shows a persistent selection marker. Open failed routes use red fault markers; selected routes also illuminate both endpoints.

The workspace uses draggable, collapsible, closable windows. The command tray and Windows menu reopen panels, with a reset-layout action. Fleet search replaces the former bottom plant strip. The notification log lists the latest 100 simulation events, newest first, with severity filters; it folds away when an event is selected so the target remains visible.


## Black-start mission and geographic review

The [PUCSL 2014 Grid Code, sections 3.9.12 and 4.18.1](https://www.pucsl.gov.lk/wp-content/uploads/2018/09/Grid-Code-March-2014-Final1.pdf) provides the restoration context: designated black-start capability, system energization, synchronization and coordinated restoration. [CEB's response on the December 2021 failure (2022)](https://ceb.lk/front_img/img_reports/1648463205CEB_Response_to_Committee_Report_Final_2022-03-252.pdf) discusses the role of hydro stations in restoring supplies for thermal auxiliaries, and charging/reactive-power constraints.

The game design uses those general principles, not real switching instructions: all lines start open, demand pickup is zero, and dead buses read 0 Hz. A fictional 2 MWh auxiliary reserve unlocks Upper Kotmale as the mission's designated seed unit. This is NOT a verified claim about its current operational black-start designation. Other units require a live stable bus. Startup takes 8 simulation seconds for nonthermal units or 30 for thermal units, with a simplified 5 MW auxiliary demand per starting unit. Starting units abort if supply disappears or exits 47.5–52.5 Hz. Closing live islands requires a frequency difference no greater than 0.2 Hz; voltage magnitude, phase-angle synchronization, reactive charging, transformer inrush, minimum thermal loading and plant-specific boiler procedures are not simulated.

Restoration governors follow connected demand within player dispatch ceilings and physical ramp limits. Load pickup is limited to 10 percentage points, 35 MW, and 80% of remaining target headroom per command. All communities must reach full pickup with at least 95% served and stable frequency for 20 simulation seconds. The expected initial blackout does not trigger the normal supply-collapse timer; subsequent energized frequency failures and equipment protection remain active. English and Sinhala procedures explain this sequence.

The [Ministry of Energy's Upper Kotmale description](https://energymin.gov.lk/index.php/portfolio/upper-kotmale/) distinguishes the Talawakelle dam from the underground powerhouse at Niyamgamdora. The map now anchors the station near its powerhouse area instead of offsetting a dam marker. Other plants and cities use approximate geographic anchors; solar clusters, storage and regional buses remain fictional aggregates. The bundled Natural Earth coastline and metric projection remain unchanged. These coordinates are illustrative, not a survey-quality plant or transmission atlas.

Zoom extends to 8×. Map symbols, labels, line widths, flow particles and selection markers use inverse camera scaling to keep a consistent screen size as geography zooms underneath. Label collision boxes and click targets use the same screen-pixel sizing; crowded labels yield to the selected asset. Pixi text uses device-pixel-ratio resolution, and initialization waits for fonts, avoiding enlarged low-resolution text textures. Trees use broadleaf silhouettes; symbols are reduced to avoid false offshore placement. Open breakers and relay-tripped circuits now have distinct labels.
