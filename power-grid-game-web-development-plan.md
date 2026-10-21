# Power Grid Management Game — Web Version Development Plan

## 1. Product Vision

The game should feel like a **modern power-system control room** rather than a traditional city builder.

The visual identity should be:

- Minimal
- Dark or neutral
- Highly readable
- Smoothly animated
- Technical without looking like engineering software
- Realistic underneath, simple on the surface

The core fantasy for the player is:

> **“I am operating an electrical grid and keeping an entire region alive.”**

The player should constantly feel that the network is dynamic.

Power should visibly flow. Demand should rise and fall. Frequency should move. Lines should become stressed. Generators should ramp. Weather should affect renewables. Failures should propagate through the network.

The game should look calm most of the time, but become tense very quickly when the grid becomes unstable.

---

## 2. Recommended Technology Stack

```text
Frontend
Next.js
React
TypeScript
Tailwind CSS

Rendering
PixiJS

Animation
GSAP or custom PixiJS animation system

Simulation
TypeScript
Web Worker

Math
Custom power-flow implementation initially

State
Zustand

Charts
Recharts or custom lightweight SVG charts

Backend
Next.js APIs initially

Database
PostgreSQL

ORM
Prisma

Authentication
Auth.js or Clerk

Later performance upgrade
Rust + WebAssembly
```

Keep the first version in **one repository**.

```text
power-grid-game/
```

Avoid microservices initially.

---

## 3. High-Level Architecture

Keep rendering, simulation, gameplay, and application logic separated.

```text
                    USER
                      │
                      ▼
                React Interface
                      │
             player commands
                      │
                      ▼
              Game Controller
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
   Simulation Worker          Game Systems
         │                         │
         ▼                         ▼
Electrical Simulation       Economy / Events
         │                         │
         └────────────┬────────────┘
                      │
                      ▼
                  Game State
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
       PixiJS                   React
   Grid Rendering           UI / Panels
```

The simulation should be able to run without React or PixiJS.

For example:

```ts
simulation.step();
```

---

## 4. Recommended Project Structure

```text
src/

  app/
    page.tsx
    game/
    scenarios/
    settings/
    profile/

  components/
    ui/
    dashboard/
    panels/
    dialogs/
    charts/

  game/

    core/
      GameEngine.ts
      GameClock.ts
      GameLoop.ts

    simulation/
      grid/
      powerflow/
      frequency/
      generation/
      demand/
      storage/
      weather/
      protection/

    entities/
      Generator.ts
      Bus.ts
      TransmissionLine.ts
      Transformer.ts
      Load.ts
      Battery.ts
      Substation.ts

    systems/
      EconomySystem.ts
      WeatherSystem.ts
      EventSystem.ts
      FailureSystem.ts
      AchievementSystem.ts

    renderer/
      GridRenderer.ts
      Camera.ts
      LineRenderer.ts
      NodeRenderer.ts
      EffectsRenderer.ts
      LabelRenderer.ts

    controls/
      SelectionController.ts
      CameraController.ts
      InputController.ts

    scenarios/
      ScenarioLoader.ts
      ScenarioManager.ts

    state/
      gameStore.ts
      uiStore.ts

    workers/
      simulation.worker.ts

  lib/
    math/
    utils/
    constants/

  types/

  services/
    save/
    auth/
    leaderboard/
```

---

## 5. Coding Principles

Avoid repeating type checks everywhere.

Bad:

```ts
if (generator.type === "coal") {
  // ...
}

if (generator.type === "solar") {
  // ...
}
```

Prefer clean domain models and data-driven configuration.

```ts
interface Generator {
  id: string;
  capacityMW: number;
  currentOutputMW: number;
  rampRateMWPerSecond: number;
  startupTime: number;
  shutdownTime: number;
  minimumOutputMW: number;
  operatingCost: number;
  availability: number;
}
```

Configuration:

```ts
const coalConfig = {
  rampRateMWPerSecond: 0.5,
  startupTime: 14400,
  operatingCost: 45,
};
```

---

## 6. Data-Driven Design

Keep balancing data outside core logic.

```text
data/
  generators.json
  weather.json
  events.json
  scenarios.json
  difficulty.json
```

Example:

```json
{
  "coal": {
    "startupTimeSeconds": 14400,
    "rampRateMWPerMinute": 10,
    "fuelCostPerMWh": 45,
    "emissions": 0.9
  }
}
```

This allows game balancing without rewriting simulation code.

---

## 7. Electrical Simulation Architecture

Start with:

```text
Grid topology
↓
Power flow
↓
Line loading
↓
Generation balance
↓
Frequency
↓
Protection
↓
Failures
```

For version one:

- Use **DC power flow**
- Simulate active power
- Add simplified frequency dynamics
- Add thermal line limits
- Add generator ramp constraints
- Add basic protection rules

Do not start with full AC power-flow simulation.

---

## 8. Simulation Tick

Run the simulation at a fixed rate.

Example:

```text
20 ticks per second
```

Each simulation step:

1. Update game time
2. Update weather
3. Update renewable generation
4. Update consumer demand
5. Apply player generator targets
6. Apply generator ramp rates
7. Calculate grid power flow
8. Calculate line loading
9. Calculate frequency
10. Run protection systems
11. Process failures
12. Update economy
13. Generate events

Example:

```ts
function simulationStep(deltaTime: number) {
  updateWeather(deltaTime);
  updateDemand(deltaTime);
  updateGenerators(deltaTime);
  solvePowerFlow();
  updateFrequency(deltaTime);
  evaluateProtection();
  updateEconomy(deltaTime);
}
```

---

## 9. Web Worker Architecture

Run simulation logic inside:

```text
simulation.worker.ts
```

Main thread command:

```ts
worker.postMessage({
  type: "SET_GENERATOR_OUTPUT",
  generatorId: "G3",
  targetMW: 350,
});
```

Worker response:

```ts
{
  type: "STATE_UPDATE",
  state: {
    // ...
  }
}
```

For the MVP, full state snapshots are acceptable.

Later optimize with:

- State diffs
- Typed arrays
- Transferable objects
- Lower-frequency UI updates

---

## 10. Main Screen Layout

The grid map should occupy roughly **70–80% of the screen**.

```text
┌─────────────────────────────────────────────────────┐
│ GRID STATUS                                         │
│ 49.98 Hz | 2,480 MW | Reserve 14% | Cost $42/MWh │
├──────────────────────────────────────┬──────────────┤
│                                      │              │
│                                      │ Selected     │
│             GRID MAP                 │ Asset        │
│                                      │              │
│                                      │ Generator 02 │
│                                      │ 420 MW       │
│                                      │ Ramp 62%     │
│                                      │              │
├──────────────────────────────────────┴──────────────┤
│ Events | Alerts | Timeline                          │
└─────────────────────────────────────────────────────┘
```

---

## 11. Grid Visual Design

Transmission lines should feel alive.

```text
Generator
    ●
    │
    ▼ ▼ ▼ ▼ ▼
━━━━━━━━━━━━━━━━━━━━━━
       285 MW
━━━━━━━━━━━━━━━━━━━━━━
                │
                ■
            Substation
```

Use animated particles or dashes to show flow direction.

Possible visual rules:

```text
66 kV     ─────
132 kV    ━━━━━
220 kV    ━━━━━━━
400 kV    ███████
```

Line thickness can represent voltage level.

Animation speed can represent flow magnitude.

---

## 12. Line Stress Visualization

Do not rely only on color.

Normal:

```text
──────────────
```

Heavy:

```text
━━━━━━━━━━━━━━
```

Overloaded:

```text
━━━━ ⚠ ━━━━━
```

Severely overloaded:

```text
━━━━━━ pulse ━━━━━━
```

This keeps the game readable and improves accessibility.

---

## 13. Substations

Default:

```text
■
```

Expanded:

```text
┌───────────────┐
│ SUBSTATION A  │
│               │
│ 132 kV        │
│ 438 MW        │
│               │
│ T1   72%      │
│ T2   59%      │
└───────────────┘
```

The player should understand grid state without opening large menus.

---

## 14. Generator Visual Language

Example icon system:

```text
● Thermal
▲ Solar
◆ Hydro
✦ Wind
▣ Nuclear
▱ Battery
```

Keep icons clean and technical rather than cartoon-like.

---

## 15. Camera System

Implement:

- Pan
- Zoom
- Smooth zoom
- Focus selected asset
- Smooth transitions
- Alert targeting

When the user clicks an alert such as:

```text
LINE 24 OVERLOAD
```

the camera should smoothly move to that line.

Target transition:

```text
300–500 ms
```

---

## 16. UX Information Hierarchy

Do not show every engineering value all the time.

```text
Default
↓
Clean map

Hover
↓
Important information

Select
↓
Detailed technical information

Advanced mode
↓
Engineering values
```

---

## 17. Generator Control Panel

```text
GENERATOR G-04

Type
Combined Cycle Gas

Output
438 MW

Target
500 MW

Capacity
600 MW

Ramp
+18 MW/min

Efficiency
58%

Fuel Cost
$71/MWh

Status
RUNNING

[ Decrease ]

────────●────────

[ Increase ]

[ Shutdown ]
```

Controls should feel precise and responsive.

---

## 18. Core Gameplay Loop

```text
Forecast
    ↓
Schedule generation
    ↓
Operate network
    ↓
React to disturbances
    ↓
Keep system stable
    ↓
Earn money / reputation
    ↓
Upgrade infrastructure
    ↓
Handle larger grid
```

---

## 19. Forecasting

Forecasting should be a major gameplay mechanic.

Display:

- Demand forecast
- Solar forecast
- Wind forecast
- Temperature
- Rainfall
- Reserve margin

Example:

```text
NEXT 6 HOURS

Demand

1000MW                       ╭───
900MW                ╭──────╯
800MW          ╭─────╯
700MW ─────────╯

      12  13  14  15  16  17  18
```

---

## 20. Generator Scheduling

The player must plan ahead.

Possible decisions:

- Start a generator
- Keep a generator offline
- Import energy
- Charge storage
- Discharge storage
- Reduce optional loads

Example:

```text
Peak demand forecast

18:30

Expected demand
3,300 MW

Available generation
3,050 MW

Expected deficit
250 MW
```

---

## 21. Emergencies

Events should emerge naturally from simulation.

Example:

```text
14:32

Thunderstorm crosses western region.

Line L12 outage.
```

Power then redistributes:

```text
L18

67%
↓
94%
↓
111%
```

The player can respond by:

- Redispatching generation
- Starting reserve generation
- Reducing transfers
- Load shedding
- Rerouting through available infrastructure

---

## 22. Cascading Failures

Cascading failures should become one of the game's signature systems.

```text
L12 fails
↓
L18 overloaded
↓
L18 trips
↓
North-south transfer collapses
↓
South generation deficit
↓
Frequency falls
↓
Generator protection triggers
↓
South grid blackout
```

The player should have opportunities to stop the cascade before system collapse.

---

## 23. Failure Analysis

Do not simply show:

```text
GAME OVER
```

Instead show a timeline.

```text
CASCADE ANALYSIS

14:32:05
Line L12 tripped

14:32:08
Power shifted to L18

14:32:14
L18 reached 117%

14:32:31
L18 tripped

14:32:39
South system lost 480 MW

14:32:46
Frequency fell to 48.9 Hz

14:32:51
Generator G7 disconnected
```

This turns failure into learning.

---

## 24. Difficulty Design

Difficulty should change system margins rather than simply increase random failures.

### Easy

- Large reserves
- Slow demand changes
- Generous line capacities
- Accurate forecasts

### Normal

- Moderate reserve margins
- Variable weather
- Forecast uncertainty

### Expert

- Tight reserve margins
- Generator failures
- Transmission congestion
- Stronger forecast uncertainty
- Advanced physics later

---

## 25. Tutorial Scenarios

Avoid excessive tutorial popups.

Teach mechanics through small scenarios.

### Scenario 1 — Balance

```text
1 Generator
1 Town
```

Goal:

> Maintain 50 Hz.

### Scenario 2 — Dispatch

Add a second generator.

Teach generation dispatch.

### Scenario 3 — Transmission

Add multiple transmission paths.

Teach power-flow behavior.

### Scenario 4 — Outage

Introduce a line failure.

Teach contingency response.

### Scenario 5 — Renewables

Introduce solar.

Teach forecasting and reserve planning.

---

## 26. Progression

Suggested progression:

```text
Small isolated grid
↓
Town grid
↓
Regional grid
↓
National grid
↓
International interconnection
```

Possible technology unlocks:

- Hydro
- Coal
- Gas
- Solar
- Wind
- Battery
- Pumped hydro
- HVDC
- Smart demand
- Automation
- Advanced protection

---

## 27. Infrastructure Upgrades

Players should invest in:

- New transmission lines
- Higher-voltage transmission
- New substations
- Transformers
- Battery storage
- New generation
- Grid automation
- Protection systems

Example:

```text
Line 03

Capacity
400 MW

Upgrade

220 kV → 400 kV

New Capacity
950 MW

Cost
$180M
```

---

## 28. Economy

Keep economics understandable initially.

Track:

- Energy production cost
- Revenue
- Fuel cost
- Maintenance
- Import cost
- Upgrade cost
- Blackout penalties

Advanced markets can come later.

Possible future mechanics:

- Spot market
- Generator bidding
- Ancillary services
- Capacity markets

---

## 29. Scoring

Do not score only by money.

Track:

- Reliability
- Cost
- Emissions
- Renewable penetration
- Customer satisfaction
- Grid stability

Example:

```text
DAILY GRID REPORT

Reliability       99.98%

Average Frequency 49.99 Hz

Renewables        41%

Grid Losses       4.2%

Energy Cost       $58/MWh

Outages           2

Customers Lost    12,430
```

---

## 30. Alerts

Alert levels:

```text
INFO
WARNING
CRITICAL
```

Example:

```text
INFO
Solar production dropping.

WARNING
Line L08 at 92%.

CRITICAL
Frequency below 49.5 Hz.
```

Critical alerts should automatically move to the top.

---

## 31. Time Controls

Recommended:

```text
Pause
1×
2×
5×
10×
30×
```

Critical events can trigger automatic slowdown.

```text
30×
↓
LINE TRIP
↓
1×
```

---

## 32. Scenario Format

Make scenarios data-driven.

```json
{
  "name": "First Grid",
  "startingMoney": 5000000,
  "targetReliability": 0.995,
  "duration": 86400,
  "weather": "mild",
  "grid": "scenario-01-grid.json"
}
```

---

## 33. Save-Game Architecture

Use versioned state snapshots.

```ts
interface SaveGame {
  version: number;
  timestamp: number;
  scenarioId: string;
  gameTime: number;
  simulationState: SimulationState;
  economyState: EconomyState;
}
```

Always include a save schema version.

```text
version: 1
```

---

# Development Phases

## Phase 1 — Core Prototype

Build only:

- PixiJS grid map
- Generators
- Loads
- Transmission lines
- DC power flow
- Frequency model
- Simple controls

Do **not** build yet:

- Authentication
- Backend
- Economy
- Achievements
- Complex menus

### Goal

> Determine whether operating the grid is enjoyable.

---

## Phase 2 — Gameplay Prototype

Add:

- Demand curves
- Generator ramp rates
- Startup delays
- Line overloads
- Generator failures
- Load shedding
- Solar
- Wind
- Battery storage
- Weather

At this point the project should become genuinely playable.

---

## Phase 3 — Visual Polish

Improve:

- Power-flow animation
- Camera movement
- Particle effects
- Line stress visualization
- UI transitions
- Alert animations
- Sound design
- Charts
- Tooltips

Do this after the simulation is working well.

---

## Phase 4 — Progression

Add:

- Scenarios
- Tutorials
- Upgrades
- Economy
- Achievements
- Score system
- Technology unlocks

Now the product becomes a full game rather than only a simulator.

---

## Phase 5 — Backend

Add:

- Accounts
- Cloud saves
- Profiles
- Leaderboards
- Achievements
- Scenario sharing

---

## Phase 6 — Advanced Physics

Consider:

- AC power flow
- Voltage
- Reactive power
- Transformer taps
- Power factor
- Synchronization
- Grid islands
- Advanced protection

Do not start development here.

---

## Phase 7 — Performance Optimization

Only optimize after profiling.

Potential candidates for Rust + WebAssembly:

- Matrix solving
- Power flow
- Contingency analysis
- Large-network calculations

---

# First Playable Version

Keep the first proper scenario intentionally small.

## Grid

```text
3 generators

Coal
Hydro
Solar

4 substations

6 transmission lines

3 loads

City
Industrial area
Small town

1 battery
```

## Simulation

Simulate roughly:

```text
24 hours
```

## Player Objectives

- Maintain electricity supply
- Keep frequency within limits
- Avoid transmission overloads
- Minimize cost
- Avoid blackouts

This is enough to validate the core concept.

---

# Example Main Screen

```text
┌─────────────────────────────────────────────────────────────┐
│ GRID CONTROL                                                │
│                                                             │
│ 49.98 Hz    2,480 MW    Reserve 16%    $54/MWh    RE 38% │
├──────────────────────────────────────────────┬──────────────┤
│                                              │              │
│       G1 ●━━━━━━■━━━━━━━■                    │ GENERATOR G1 │
│                  \       \                   │              │
│                   \       ■━━━━━━ CITY       │ Output       │
│       G2 ●━━━━━━━━■                          │ 420 MW       │
│                       \                      │              │
│                        \                     │ Capacity      │
│                         ■━━━ INDUSTRIAL      │ 500 MW       │
│                                              │              │
│              ▲ SOLAR                         │ Cost         │
│              │                               │ $42/MWh      │
│              ■━━━━━━■                        │              │
│                                              │ [CONTROL]    │
├──────────────────────────────────────────────┴──────────────┤
│ 18:34                                                       │
│ ⚠ Line L7 loading 94%                                      │
│ Solar production falling faster than forecast               │
└─────────────────────────────────────────────────────────────┘
```

---

# Architecture Rule

Every feature should belong to one of four layers:

```text
SIMULATION
physics

GAMEPLAY
rules and objectives

PRESENTATION
visuals and audio

APPLICATION
accounts, database, saves
```

Avoid mixing these layers.

Bad:

```ts
if (frequency < 49.5) {
  document.querySelector("#alert").style.color = "red";
}
```

Better:

```text
Simulation
↓
frequency = 49.42

Gameplay
↓
createAlert("LOW_FREQUENCY")

Presentation
↓
renderAlert()
```

This separation will make the project much easier to maintain and extend.

---

# Immediate Development Milestone

Build this first:

```text
Next.js shell

+

PixiJS interactive grid

+

5–10 connected nodes

+

DC power-flow engine

+

frequency model

+

generator control panel

+

animated transmission flows
```

Then create one scenario lasting roughly **10 playable minutes** where demand changes and the player must keep the grid stable.

If those ten minutes are enjoyable, the project has a strong foundation.

---

# Final Product Direction

The game should feel like a combination of:

> **Strategy game + network simulator + modern control-room interface**

The electrical physics should create the gameplay rather than being decorative.

The web version should prioritize:

1. **Clear visuals**
2. **Realistic but understandable physics**
3. **Clean modular code**
4. **Strong moment-to-moment decision making**
5. **Emergent failures and recovery**
6. **Good progression**
7. **Smooth browser performance**

That foundation will allow the game to grow from a small regional-grid simulator into a much deeper national-grid management game without requiring a complete rewrite.
