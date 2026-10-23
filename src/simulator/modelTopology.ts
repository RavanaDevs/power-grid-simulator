import type { Asset } from "../game/engine";
import type { InfrastructureSite } from "./infrastructure";

export type MapCoordinate = [latitude: number, longitude: number];

/** Display anchors for the ten equivalent model buses, not real substations. */
export const BUS_COORDS: MapCoordinate[] = [
  [8.03, 79.83],
  [7.29, 80.64],
  [6.68, 80.4],
  [6.93, 79.86],
  [9.66, 80.02],
  [8.98, 79.92],
  [8.31, 80.4],
  [8.57, 81.23],
  [7.72, 81.7],
  [6.05, 80.75],
];

/** Approximate area anchors for aggregate demand, solar and fictional storage. */
export const MODEL_COORDS: Record<string, MapCoordinate> = {
  D1: [6.927, 79.861],
  D2: [7.291, 80.633],
  D3: [6.682, 80.399],
  D4: [9.661, 80.025],
  D5: [8.981, 79.916],
  D6: [8.312, 80.403],
  D7: [8.571, 81.233],
  D8: [7.717, 81.693],
  D9: [5.949, 80.546],
  D10: [7.167, 79.89],
  B1: [8.02, 79.88],
  G3: [6.2, 81.12],
  G9: [6.82, 79.95],
};

/**
 * Explicitly associated powerhouse switchyards in the geographic reference data.
 * These associations do not establish a surveyed conductor route or switching state.
 * Do not infer further associations from proximity (notably Mannar/Sapugaskanda).
 */
export const MODEL_SWITCHYARDS: Readonly<Record<string, string>> = {
  G2: "sub-442071672", // Victoria
  G4: "sub-442071668", // Upper Kotmale
  G5: "sub-1206495955", // Samanalawewa / Kapugala
  G6: "sub-285134121", // Kelanitissa
};

export type ModelConnection = {
  id: string;
  assetId: string;
  selectionId: string;
  coordinates: MapCoordinate[];
  viaSiteId?: string;
};

/**
 * Visual injection/withdrawal connections for the reduced electrical model.
 * These straight links must be drawn as model connections, never as mapped routes.
 * They carry no voltage, impedance, circuit rating or independent breaker state.
 * Electrical connectivity remains Asset.bus; this function does not change it.
 */
export function buildModelConnections(
  assets: readonly Asset[],
  sites: readonly InfrastructureSite[],
): ModelConnection[] {
  const plantsByAsset = new Map(
    sites
      .filter((site) => site.simulationId && site.kind !== "substation")
      .map((site) => [site.simulationId!, site]),
  );
  const sitesById = new Map(sites.map((site) => [site.id, site]));
  return assets
    .filter((asset) => asset.kind !== "bus")
    .map((asset) => {
      const bus = BUS_COORDS[asset.bus];
      if (!bus)
        throw new Error(`Unknown equivalent bus ${asset.bus} for ${asset.id}`);
      const plant = plantsByAsset.get(asset.id);
      // If a future asset has no geographic/aggregate anchor, keep it at its
      // equivalent bus instead of inventing a geographic position.
      const start: MapCoordinate = plant
        ? [plant.lat, plant.lon]
        : [...(MODEL_COORDS[asset.id] ?? bus)];
      const candidateYard = plant
        ? sitesById.get(MODEL_SWITCHYARDS[asset.id])
        : undefined;
      const yard =
        candidateYard?.kind === "substation" ? candidateYard : undefined;
      const coordinates: MapCoordinate[] = [start];
      if (yard) coordinates.push([yard.lat, yard.lon]);
      coordinates.push([...bus]);
      return {
        id: `model-connection:${asset.id}`,
        assetId: asset.id,
        selectionId: plant?.id ?? `model:${asset.id}`,
        coordinates,
        ...(yard ? { viaSiteId: yard.id } : {}),
      };
    });
}
