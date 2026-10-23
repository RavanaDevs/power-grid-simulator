# Sri Lanka geographic infrastructure reference

Researched **23 October 2026**. The simulator bundles **56 sites** (23 generating stations and 33 substations/switchyards) and **138 mapped 132/220 kV transmission way segments**, retaining **7,190 route vertices**. These are public geographic reference records, separate from the simulation's reduced electrical network. This is a selected subset, not a complete inventory of Sri Lanka's network.

## Sources and precedence

1. [CEB Long Term Generation Expansion Plan 2025–2044, May 2025](https://www.ceb.lk/front_img/img_reports/1748839124LTGEP-2025-2044-FINAL_c.pdf), Table 2.2 (PDF page 61) and Table 2.6 (PDF page 64): generating capacities. Use the publication's nameplate figure, not its derated planning figure. Data in those tables has 2023/2024 reference dates; publication in 2025 does not make it live 2026 operational data.
2. [CEB Statistical Digest 2024](https://www.ceb.lk/front_img/img_reports/1751344341Statistical_Digest_2024.pdf): national transmission map and 132/220 kV voltage classes. Its schematic map is context, not the source of the route vertices or survey coordinates.
3. **OpenStreetMap API**: footprint geometry, powerhouse points, wind-turbine points, substation footprints and transmission ways. Every record in `src/simulator/infrastructure.ts` carries an individual OSM source URL. [Open Infrastructure Map's Sri Lanka index](https://openinframap.org/stats/area/Sri%2520Lanka/plants) helped discover OSM object IDs; the actual geometry was read directly from OSM.
4. [LTL Holdings, conventional generation](https://www.ltl.lk/what-we-do/conventional-energy/): West Coast/Yugadanavi capacity.
5. [Vidullanka Matara plant](https://vidullanka.com/project/kamburupitiya-solar-pv-project/) and [owner announcements](https://vidullanka.com/news-events/): Matara and Madampe solar capacities.
6. [Mahaweli Complex station directory](https://mahawelicomplex.lk/contact-us/) and [Samanalawewa station description](https://www.samanalacomplex.lk/victoria-power-plant/): distinction between powerhouses, dams and reservoirs. The latter URL is misleadingly named by its publisher; its page content describes Samanalawewa. Some operator pages contain copied technical text, so conflicting numbers were resolved against CEB's dated planning tables.

## Geographic extraction

The main Overpass endpoint returned HTTP 406 and two mirrors timed out. The successful fallback used OSM's documented public read API:

```text
https://api.openstreetmap.org/api/0.6/way/{id}/full.json
https://api.openstreetmap.org/api/0.6/node/{id}.json
https://api.openstreetmap.org/api/0.6/relation/{id}/full.json
https://api.openstreetmap.org/api/0.6/map.json?bbox={west},{south},{east},{north}
```

A small Lakvijaya extract exposed the New Chilaw and Anuradhapura line endpoints. Further small extracts around observed endpoints and verified plants supplied additional routes and substations. Full OSM ways include their complete node sequences, so these paths follow mapped towers rather than interpolated straight lines. Only mapped power ways explicitly tagged with `voltage=132000` or `220000` are retained. The original extract excluded short yard links, which left visible gaps. The continuity pass described below removes that length filter and retains real two-node links and mapped busbars. No routes are invented to close coverage gaps.

Coordinates use WGS84 latitude/longitude. Polygon markers use their footprint bounding-box centers; they are not surveyed generator terminals. Upper Kotmale and Kotmale use actual OSM powerhouse points. Thambapavani uses the bounding center of its mapped turbine group, representing an extended wind farm. Kelanitissa CCGT uses its mapped **165 MW building**, rather than the center of the entire complex.

The `mapped` confidence value means **an OSM object with geometry was retrieved**. It does not mean CEB validated the location. Substation voltage is displayed only when explicitly present in its OSM tags. Labels for unnamed Anuradhapura yards and the Mannar yard are geographic descriptions; their official asset names are unverified. Biyagama/Heiyanthuduwa is a geographic alias. Route names are either OSM names or descriptive names derived from nearby mapped sites; they are not official circuit designations.

## Continuity pass: terminal links and missing feeders

A bounded follow-up inspected small OSM extracts at 16 existing plant/yard locations and 27 actual dangling corridor endpoints. It added **79 source-linked way segments** and **11 named substations**, keeping all original 59 route IDs and their coordinates unchanged. Forty-three additions have four or fewer vertices: this is legitimate terminal geometry, not missing detail.

The additions include the West Coast 220 kV feeder, the Ukuwela–Bowatenna area, Canyon and Wimalasurendra feeders, branches through Kurunegala and Polonnaruwa, southern/regional routes, and terminal links at Anuradhapura, Mannar, Nadukuda, New Habarana and Vavuniya. The new substation footprints identify many existing route ends without moving them onto city centers.

| Example                           | Primary geometry source                                        | Continuity evidence                                                                                                                                                |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| West Coast outgoing 220 kV feeder | [Way 422435859](https://www.openstreetmap.org/way/422435859)   | 72 original mapped vertices; plant-side node [8955374804](https://www.openstreetmap.org/node/8955374804)                                                           |
| Ukuwela / Bowatenna 132 kV branch | [Way 702857461](https://www.openstreetmap.org/way/702857461)   | 93 original vertices; terminal nodes [12537845362](https://www.openstreetmap.org/node/12537845362) and [6600675489](https://www.openstreetmap.org/node/6600675489) |
| Anuradhapura terminal link        | [Way 1386955937](https://www.openstreetmap.org/way/1386955937) | Shares OSM node [11179697602](https://www.openstreetmap.org/node/11179697602) with corridor [702202546](https://www.openstreetmap.org/way/702202546)               |
| Nadukuda terminal link            | [Way 1354712326](https://www.openstreetmap.org/way/1354712326) | Shares OSM node [11179697533](https://www.openstreetmap.org/node/11179697533) with corridor [1206495967](https://www.openstreetmap.org/way/1206495967)             |
| Canyon-area feeder                | [Way 704003806](https://www.openstreetmap.org/way/704003806)   | 18 original mapped vertices                                                                                                                                        |
| Wimalasurendra-area feeder        | [Way 1354576136](https://www.openstreetmap.org/way/1354576136) | A valid four-node 132 kV way, retained without a minimum-length cutoff                                                                                             |

`osmNodeIds` records original OSM node identifiers in coordinate order on all 79 new routes and 47 rechecked existing routes. `segmentType` distinguishes overhead ways and explicitly tagged busbars; the schema also supports mapped cables. An OSM shared node establishes a geographic join, not verified utility breaker connectivity. Regression tests ensure terminal links remain, preserve their source IDs and share identical coordinates at the original join nodes.

Coverage is still partial. In particular, the bounded Broadlands and Kukule Ganga extracts contained no transmission feeder ways, so no lines were drawn to those plant markers. Thambapavani's marker is a wind-farm extent center; its collector system cannot be reconstructed by drawing a straight line to Nadukuda. The two solar plants' distribution feeders, underground plant connections, and generator-to-transformer connections remain outside this dataset. A route ending at a switchyard boundary or terminal should not be extended to the site's center just to appear connected.

## Important corrections

- Victoria, Samanalawewa and Upper Kotmale markers now identify powerhouses, not reservoirs/dams. A reservoir marker can be kilometres from the generator it supplies.
- Lakvijaya's **900 MW** nameplate differs from the **810 MW** value used in the CEB planning study. The interface must not call nameplate capacity currently available capacity.
- OSM capacity tags are inconsistent with CEB's planning inventory at several hydro stations. The bundle uses CEB's table for these capacities, including Polpitiya and Kukule Ganga.
- The two real solar facilities are independent reference sites. They do not stand in for the existing model's fictional 150 MW Hambantota or 100 MW rooftop aggregates.
- Seven actual plants have explicit links to existing modeled generators. Other reference sites do not contribute invented generation to the electrical model.

## Generating-site register

Coordinates below are mapped feature centers or points, not survey-certified coordinates. Capacity is nameplate/export capacity, not live availability.

| Plant                        |    MW | Latitude | Longitude | Location source                                               |
| ---------------------------- | ----: | -------: | --------: | ------------------------------------------------------------- |
| Lakvijaya                    |   900 |  8.02139 |  79.72166 | [OSM object](https://www.openstreetmap.org/way/365287494)     |
| Victoria                     |   210 |  7.20013 |  80.80578 | [OSM object](https://www.openstreetmap.org/way/535700636)     |
| Upper Kotmale                |   150 |  7.04235 |  80.65760 | [OSM object](https://www.openstreetmap.org/node/11182186245)  |
| Samanalawewa                 |   120 |  6.58424 |  80.80836 | [OSM object](https://www.openstreetmap.org/way/1206495954)    |
| Kelanitissa Combined Cycle 1 |   165 |  6.95360 |  79.87699 | [OSM object](https://www.openstreetmap.org/way/419487625)     |
| Sapugaskanda A + B           |   160 |  6.96175 |  79.96005 | [OSM object](https://www.openstreetmap.org/way/173553542)     |
| Thambapavani Wind Farm       | 103.5 |  9.03518 |  79.80591 | [OSM object](https://www.openstreetmap.org/relation/16310388) |
| West Coast / Yugadanavi      |   300 |  7.01136 |  79.87439 | [OSM object](https://www.openstreetmap.org/way/424596441)     |
| Kotmale                      |   201 |  7.12159 |  80.58081 | [OSM object](https://www.openstreetmap.org/node/11182186246)  |
| Randenigala                  |   120 |  7.20238 |  80.92619 | [OSM object](https://www.openstreetmap.org/way/535700637)     |
| Rantambe                     |    50 |  7.20037 |  80.94972 | [OSM object](https://www.openstreetmap.org/way/1206745228)    |
| Ukuwela                      |    40 |  7.39885 |  80.65238 | [OSM object](https://www.openstreetmap.org/way/397114498)     |
| Bowatenna                    |    40 |  7.66400 |  80.67740 | [OSM object](https://www.openstreetmap.org/way/1354807915)    |
| Polpitiya / Samanala         |    90 |  6.97791 |  80.45660 | [OSM object](https://www.openstreetmap.org/way/535700633)     |
| New Laxapana                 |   100 |  6.91810 |  80.49206 | [OSM object](https://www.openstreetmap.org/way/535700634)     |
| Old Laxapana                 |    50 |  6.91857 |  80.49165 | [OSM object](https://www.openstreetmap.org/way/535700635)     |
| Canyon                       |    60 |  6.86917 |  80.52793 | [OSM object](https://www.openstreetmap.org/way/535700632)     |
| Wimalasurendra               |    50 |  6.90868 |  80.52512 | [OSM object](https://www.openstreetmap.org/way/1206745230)    |
| Broadlands                   |    35 |  6.98473 |  80.42441 | [OSM object](https://www.openstreetmap.org/way/836493190)     |
| Kukule Ganga                 |    75 |  6.61571 |  80.27979 | [OSM object](https://www.openstreetmap.org/way/822809366)     |
| Uthuru Janani                |  26.7 |  9.74096 |  80.03327 | [OSM object](https://www.openstreetmap.org/way/1206745239)    |
| Vidul Madampe Solar          |     6 |  7.61951 |  79.80833 | [OSM object](https://www.openstreetmap.org/way/1269045638)    |
| Vidul Matara Solar           |     3 |  6.09109 |  80.55648 | [OSM object](https://www.openstreetmap.org/way/1268965037)    |

## Limits of the electrical model

A mapped line is a geographic feature, not necessarily one electrical circuit. OSM segments can split a circuit into several ways; a six-conductor corridor can carry two circuits. A map crossing is not a junction. These route geometries have **no inferred connection to modeled line IDs**, and no MW flow, breaker state or thermal rating is asserted for them.

The dispatch simulation retains a reduced training network, documented separately in `docs/SIMULATOR_MODEL.md`. Its synthetic load profiles, ratings, impedances, hydro working volumes, costs and protection logic must not be presented as measured Sri Lankan operating data. The map's geographic layer and the simulation layer are intentionally distinguishable. Actual load-flow validation would require a complete bus/branch model, transformer data, circuit ratings, impedances, generator capability curves, load composition and validation cases that were not supplied by these geographic sources.

The bundle omits many plants, substations and routes, including portions of the south/east and much distribution infrastructure. It also omits projects whose operating status or location was not established during this research. Nothing is connected to utility telemetry or control systems.

## Attribution and reuse

OSM-derived geometry and names are © OpenStreetMap contributors, available under the [Open Database License 1.0](https://www.openstreetmap.org/copyright). The geographic data in `src/simulator/infrastructure.ts` is a derived OSM database and is distributed under ODbL 1.0. Keep this attribution with exports and retain visible map attribution. CEB/operator links identify independent factual sources; no proprietary CEB map image or report is bundled.

Online basemap tiles are a separate service and require internet access. Follow the tile provider's attribution, caching and usage policy; do not bulk download the standard OSM tile service. This checked-in geometry remains available independently of tile requests.
