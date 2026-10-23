# Sri Lanka simulator: what the map and calculations represent

Reviewed against the implementation on 23 October 2026.

This branch adds a geographic infrastructure reference layer to the existing educational dispatch model. A marker on the map is not automatically a bus in the solver. The reference register and simulated equipment have separate identifiers; only explicitly linked facilities share controls. Reference-only facilities do not contribute generation to the simulated totals.

## Geographic evidence

The infrastructure register records a name, coordinates, equipment type, evidence links, and location confidence. A generating station is placed near its powerhouse or switchyard rather than assumed to be at its dam. An approximate location is an approximate location even when the national nameplate capacity is well documented. OpenStreetMap is a collaboratively maintained map, not a record of present operating status.

Use the source and confidence fields shown in the interface when interpreting a location. Source-backed nameplate capacity is not available dispatch, and neither a mapped corridor nor a line crossing proves an electrical connection. A route with approximate geometry must not be presented as a surveyed tower alignment. The map's infrastructure reference layer and the model's operating links have different meanings.

## Electrical model

The retained solver has **ten regional buses, eighteen modeled branches, seven named plant aggregates, two fictional solar aggregates, and one fictional battery**. This is a reduced training network, not a reconstructed national bus-branch model. In particular, the regional bus names are not verified identities of particular CEB grid substations.

| Regional model bus | Model identifier |
| ------------------ | ---------------- |
| Puttalam           | S1               |
| Kandy              | S2               |
| Ratnapura          | S3               |
| Colombo            | S4               |
| Jaffna             | S5               |
| Mannar             | S6               |
| Anuradhapura       | S7               |
| Trincomalee        | S8               |
| Batticaloa         | S9               |
| Southern grid      | S10              |

All eighteen model branch endpoints, ratings and reactances are illustrative. Reactances are derived from the previous schematic's distances, not physical conductor parameters or geographic length. The model ratings are in MW; they are not sourced thermal ampacities, MVA ratings, or measured loading. Difficulty and scenario settings can change the ratings. A simulated branch must never inherit a real circuit's identity merely because it lies near the same corridor.

For each connected island, the solver constructs a susceptance matrix and solves a linear DC active-power approximation with an angle reference. Opening a branch changes connectivity and reroutes flows; sequential thermal trips can split the network into islands. Load delivery is reduced when generation is inadequate. The network is lossless. Source injections are scaled to served demand for the steady-state flow calculation, while imbalance separately drives the frequency approximation.

The model does not solve voltage magnitude, reactive power, transformer taps, short-circuit current, phase imbalance, line charging, losses, dynamic machine excitation, inverter controls, transient stability, or protection coordination. Frequency is one value per connected island, based on a reduced swing equation with load damping and bounded rate of change. Synchronous units can maintain an energized island at zero active dispatch; a dead island or idle/charging battery alone cannot. Dead buses read 0 Hz as a display convention for no energized waveform. The headline frequency summarizes energized islands, while dead regions remain visibly unserved.

The summed inertia constants and rate limits are illustrative. Power-producing inverter resources are treated as capable of sustaining a modeled island; grid-following versus grid-forming capabilities have not been verified per plant.

## Generation and demand

| Simulated asset          |         Capacity | Treatment                            |
| ------------------------ | ---------------: | ------------------------------------ |
| Lakvijaya                |           900 MW | One aggregate of the station's units |
| Victoria                 |           210 MW | Hydro aggregate                      |
| Upper Kotmale            |           150 MW | Hydro aggregate                      |
| Samanalawewa             |           120 MW | Hydro aggregate                      |
| Kelanitissa CCGT         |           165 MW | Liquid-fuel thermal aggregate        |
| Sapugaskanda             |           160 MW | Thermal aggregate                    |
| Thambapavani             |         103.5 MW | Wind aggregate                       |
| Hambantota solar cluster |           150 MW | Fictional regional aggregate         |
| Western rooftop solar    |           100 MW | Fictional regional aggregate         |
| National storage reserve | 150 MW / 600 MWh | Fictional dispatch resource          |

Reference plant capacities were taken from historical CEB publications cited in `RESEARCH.md`. The model's aggregate trip of Lakvijaya, for example, is a loss of all 900 MW of modeled capacity rather than a faithful simulation of a single 300 MW unit outage. Thermal minimum stable loads, individual unit commitment, boiler conditions and verified startup curves are not represented.

Ten regional demand groups total 1,420 MW before the time-of-day multiplier. Their demands, morning/evening shape, periodic variations and scenario shocks are synthetic. They are not measured Sri Lankan demand or feeder telemetry. Solar uses an illustrative daylight curve and wind an illustrative daily variation. The weather script is not a weather feed.

## Time and protection

At normal speed, one real second advances twelve grid-clock seconds. The 24-hour exercise takes two real hours at 1×; the speed controls accelerate both the physics loop and grid clock. The integration loop subdivides physics into steps no larger than 50 ms. Costs, energy and water use integrate accelerated grid hours, whereas frequency, ramps, startup delays and relay timers use physics seconds. This deliberate mixed time scale supports interactive exercises and must not be interpreted as a single real-time dynamic simulation.

The 50 Hz nominal value, normal 49.5–50.5 Hz band and wider 47.5–52.5 Hz envelope were informed by the [PUCSL March 2014 Grid Code](https://www.pucsl.gov.lk/wp-content/uploads/2018/09/Grid-Code-March-2014-Final1.pdf). The implemented trip thresholds, three-second generator trip delay, four-second shedding delay, thermal-exposure formula, cooling, lockouts and blackout timers are exercise rules rather than actual relay settings.

Thermal exposure accumulates with squared loading above the model rating. Underfrequency shedding acts in 20-percentage-point stages to a maximum of 40%. Manual curtailment uses 30%. A supplied region losing its sources has no waveform; it is represented as de-energized, with supply-loss accounting continuing independently of frequency alarms.

## Water, economics and forecasts

Hydro water-to-energy conversion uses `E = ρ g h V η`, with efficiency 0.9 and finite water. Effective heads, usable reservoir volumes, inflows and starting levels are illustrative. These are not actual reservoir levels or storage curves. Multipurpose releases, irrigation constraints, cascading reservoir hydraulics and evaporation are omitted.

Operating costs, revenue, outage penalties, carbon charges and water-impact charges are configurable exercise assumptions in `src/game/network.ts`, not utility tariffs, market prices or audited plant economics. Emissions are direct operational estimates, excluding lifecycle effects. The ecology score is an exercise indicator. Storage applies 94% charge efficiency and 94% discharge efficiency (approximately 88.4% round-trip), with finite state of charge.

Recorded curves are simulation output. The demand forecast is an assumed profile; the generation forecast is a saved dispatch plan under assumed availability. Updating the plan changes future projections rather than rewriting recorded history. It is not an optimization or measured day-ahead forecast, and does not anticipate faults, reservoir depletion or all weather changes.

## Black-start exercise

The general sequence follows the concepts of auxiliary power, starting a designated source, energizing routes, and staged load restoration described in the [PUCSL Grid Code](https://www.pucsl.gov.lk/wp-content/uploads/2018/09/Grid-Code-March-2014-Final1.pdf). The fictional exercise designates Upper Kotmale as its seed source after spending 2 MWh on auxiliaries. This is not a claim that the plant currently has that operational designation or that the modeled switching sequence is a CEB procedure.

Other starts need an energized stable bus. Starts take eight physics seconds for nonthermal resources and thirty for thermal resources, with simplified 5 MW cranking demand for each starting non-seed asset. Frequency-only interlocks allow live-island closure when frequencies are within 0.2 Hz and the normal band; voltage and phase-angle checks are not modeled. Governors allocate island demand within dispatch ceilings during this exercise. Pickup is limited to ten percentage points, 35 MW, and 80% of dispatch headroom per command. Success requires full commanded pickup, at least 95% supplied demand and twenty physics seconds of stable frequency.

## Validation scope

Automated tests cover conservation of active-power injections, island separation, absence of supply and frequency on dead buses, resource bounds, save validation, dispatch limits, relay behavior, accounting, scenario outcomes and the restoration workflow. Dataset tests check coordinate plausibility, provenance and mapping integrity. These establish internal behavior and consistency; they do not validate the reduced model against Sri Lankan SCADA measurements, load-flow studies or utility operating procedures.

A later electrically faithful version would need a licensed, verified bus-branch dataset, transformer and circuit parameters, generator dynamics, protection settings, load allocation, and comparison with trusted load-flow and dynamic-study results. Geographic research alone does not provide those parameters.
