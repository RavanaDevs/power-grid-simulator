import type { Asset, Line } from "./engine";
export const WORLD = { width: 1500, height: 1200 };
export const busPositions = [
  { x: 490, y: 470 },
  { x: 790, y: 640 },
  { x: 690, y: 860 },
  { x: 470, y: 770 },
  { x: 730, y: 140 },
  { x: 550, y: 295 },
  { x: 770, y: 395 },
  { x: 1040, y: 470 },
  { x: 1120, y: 710 },
  { x: 850, y: 1020 },
];
const busNames = [
  ["Puttalam", "පුත්තලම"],
  ["Kandy", "මහනුවර"],
  ["Ratnapura", "රත්නපුර"],
  ["Colombo", "කොළඹ"],
  ["Jaffna", "යාපනය"],
  ["Mannar", "මන්නාරම"],
  ["Anuradhapura", "අනුරාධපුරය"],
  ["Trincomalee", "ත්‍රිකුණාමලය"],
  ["Batticaloa", "මඩකලපුව"],
  ["Southern grid", "දකුණු ජාලය"],
];
export const TECH = {
  coal: { cost: 18000, emissions: 0.9, ramp: 12, inertia: 5 },
  oil: { cost: 47000, emissions: 0.7, ramp: 20, inertia: 4 },
  hydro: { cost: 2500, emissions: 0, ramp: 25, inertia: 3 },
  solar: { cost: 1200, emissions: 0, ramp: 45, inertia: 0 },
  wind: { cost: 1400, emissions: 0, ramp: 30, inertia: 0 },
  battery: { cost: 800, emissions: 0, ramp: 150, inertia: 0 },
  load: { cost: 0, emissions: 0, ramp: 0, inertia: 0 },
  bus: { cost: 0, emissions: 0, ramp: 0, inertia: 0 },
};
export const ECONOMY = {
  initialFunds: 450e6,
  revenuePerMWh: 32000,
  unservedPenaltyPerMWh: 85000,
  carbonPrice: 2000,
  waterImpactPerMm3: 250000,
  lineUpgrade: 25e6,
  batteryCapacity: 600,
  batteryEfficiency: 0.94,
};
export function createAssets(): Asset[] {
  const raw: [
    string,
    string,
    string,
    Asset["kind"],
    number,
    number,
    number,
    number,
    number,
  ][] = [
    ["G1", "Lakvijaya", "ලක්විජය", "coal", 365, 445, 0, 900, 650],
    ["G2", "Victoria", "වික්ටෝරියා", "hydro", 895, 610, 1, 210, 115],
    [
      "G3",
      "Hambantota solar cluster",
      "හම්බන්තොට සූර්යබල එකතුව",
      "solar",
      1060,
      960,
      9,
      150,
      75,
    ],
    ["G4", "Upper Kotmale", "ඉහළ කොත්මලේ", "hydro", 740, 740, 1, 150, 85],
    ["G5", "Samanalawewa", "සමනලවැව", "hydro", 805, 870, 2, 120, 60],
    [
      "G6",
      "Kelanitissa CCGT",
      "කැළණිතිස්ස සංයුක්ත චක්‍ර",
      "oil",
      365,
      705,
      3,
      165,
      110,
    ],
    ["G7", "Sapugaskanda", "සපුගස්කන්ද", "oil", 530, 655, 3, 160, 80],
    [
      "G8",
      "Thambapavani wind",
      "තම්බපවනී සුළං",
      "wind",
      445,
      275,
      5,
      103.5,
      60,
    ],
    [
      "G9",
      "Western rooftop solar",
      "බස්නාහිර පියසි සූර්යබල",
      "solar",
      360,
      850,
      3,
      100,
      50,
    ],
    [
      "B1",
      "National storage reserve",
      "ජාතික බැටරි සංචිතය",
      "battery",
      630,
      520,
      0,
      150,
      0,
    ],
  ];
  const assets = raw.map(
    ([id, name, nameSi, kind, x, y, bus, capacity, output]) =>
      ({
        id,
        name,
        nameSi,
        kind,
        x,
        y,
        bus,
        capacity,
        output,
        target: kind === "solar" || kind === "wind" ? capacity : output,
        online: true,
      }) as Asset,
  );
  for (const [id, water, waterMax, head] of [
    ["G2", 5, 12, 170],
    ["G4", 2.5, 6, 120],
    ["G5", 2, 5, 150],
  ] as [string, number, number, number][]) {
    Object.assign(
      assets.find((a) => a.id === id)!,
      { water, waterMax, head, inflow: 0.05 },
    );
  }
  assets.push(
    ...busPositions.map((p, i) => ({
      id: `S${i + 1}`,
      name: busNames[i][0],
      nameSi: busNames[i][1],
      kind: "bus" as const,
      ...p,
      bus: i,
      capacity: 0,
      output: 0,
      target: 0,
      online: true,
    })),
  );
  const loads: [string, string, number, number, number, number][] = [
    ["Colombo homes", "කොළඹ නිවාස", 410, 790, 3, 290],
    ["Kandy services", "මහනුවර සේවා", 700, 615, 1, 190],
    ["Ratnapura communities", "රත්නපුර ජනාවාස", 610, 900, 2, 120],
    ["Jaffna city", "යාපනය නගරය", 805, 90, 4, 100],
    ["Mannar fisheries", "මන්නාරම ධීවර කර්මාන්තය", 600, 220, 5, 65],
    ["Anuradhapura irrigation", "අනුරාධපුර වාරිමාර්ග", 855, 330, 6, 105],
    ["Trincomalee port", "ත්‍රිකුණාමල වරාය", 1160, 425, 7, 110],
    ["Batticaloa coast", "මඩකලපුව වෙරළබඩ", 1220, 690, 8, 110],
    ["Southern towns", "දකුණු නගර", 775, 1070, 9, 160],
    ["Western industry", "බස්නාහිර කර්මාන්ත", 540, 850, 3, 170],
  ];
  assets.push(
    ...loads.map(([name, nameSi, x, y, bus, base], i) => ({
      id: `D${i + 1}`,
      name,
      nameSi,
      kind: "load" as const,
      x,
      y,
      bus,
      base,
      capacity: 0,
      output: base,
      target: 0,
      online: true,
    })),
  );
  return assets;
}
export function createLines(difficulty: string): Line[] {
  return [
    [0, 1, 520],
    [0, 2, 470],
    [1, 2, 360],
    [1, 3, 390],
    [2, 3, 420],
    [0, 3, 550],
    [5, 4, 150],
    [5, 6, 220],
    [0, 5, 240],
    [0, 6, 350],
    [6, 1, 350],
    [6, 7, 270],
    [7, 8, 230],
    [1, 8, 300],
    [2, 8, 280],
    [2, 9, 310],
    [8, 9, 280],
    [3, 9, 370],
  ].map(([from, to, capacity], i) => ({
    id: `L${i + 1}`,
    from,
    to,
    capacity:
      capacity *
      (difficulty === "easy" ? 1.4 : difficulty === "expert" ? 0.8 : 1),
    reactance:
      1 +
      Math.hypot(
        busPositions[from].x - busPositions[to].x,
        busPositions[from].y - busPositions[to].y,
      ) /
        500,
    flow: 0,
    online: true,
    heat: 0,
    lockout: 0,
  }));
}
