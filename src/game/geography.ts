import boundary from "./data/sri-lanka.json";
import type { Asset } from "./engine";
// Local equirectangular projection: uniform 260 world units per latitude degree.
// Longitude is corrected at 7.8°N. Geographic coastline and approximate geographic anchors; icons are symbolic.
export const project = (lon: number, lat: number) => ({
  x: 440 + (lon - 79.5) * 260 * Math.cos((7.8 * Math.PI) / 180),
  y: 65 + (9.95 - lat) * 260,
});
export const coastline = boundary.geometry.coordinates.map((p) =>
  p[0].flatMap(([lon, lat]) => {
    const q = project(lon, lat);
    return [q.x, q.y];
  }),
);
export const mapBusPositions = [
  [79.83, 8.03],
  [80.64, 7.29],
  [80.4, 6.68],
  [79.86, 6.93],
  [80.02, 9.66],
  [79.92, 8.98],
  [80.4, 8.31],
  [81.23, 8.57],
  [81.7, 7.72],
  [80.75, 6.05],
].map(([lon, lat]) => project(lon, lat));
// Approximate plant/area anchors, not survey coordinates or actual grid routes.
const plants: Record<string, [number, number]> = {
  G1: [79.722, 8.019],
  G2: [80.788, 7.242],
  G3: [81.12, 6.2],
  G4: [80.654, 7.021],
  G5: [80.797, 6.677],
  G6: [79.877, 6.959],
  G7: [79.958, 6.976],
  G8: [79.797, 8.997],
  G9: [79.95, 6.82],
  B1: [79.88, 8.02],
};
const communities: Record<string, [number, number]> = {
  D1: [79.861, 6.927],
  D2: [80.633, 7.291],
  D3: [80.399, 6.682],
  D4: [80.025, 9.661],
  D5: [79.916, 8.981],
  D6: [80.403, 8.312],
  D7: [81.233, 8.571],
  D8: [81.693, 7.717],
  D9: [80.546, 5.949],
  D10: [79.89, 7.167],
};
export function mapPosition(a: Asset) {
  const p = plants[a.id] ?? communities[a.id];
  return p ? project(...p) : mapBusPositions[a.bus];
}
export const MAP_BOUNDS = { left: 340, top: 25, right: 1190, bottom: 1210 };
