import { test } from "node:test";
import assert from "node:assert/strict";
import { createAssets } from "../src/game/network";
import { sites, transmissionRoutes } from "../src/simulator/infrastructure";
import {
  BUS_COORDS,
  MODEL_COORDS,
  MODEL_SWITCHYARDS,
  buildModelConnections,
} from "../src/simulator/modelTopology";

test("every model plant, load and battery has exactly one connection to its assigned equivalent bus", () => {
  const assets = createAssets();
  const equipment = assets.filter((asset) => asset.kind !== "bus");
  const connections = buildModelConnections(assets, sites);
  assert.equal(connections.length, equipment.length);
  assert.equal(
    new Set(connections.map((connection) => connection.assetId)).size,
    equipment.length,
  );
  for (const asset of equipment) {
    const connection = connections.find((item) => item.assetId === asset.id)!;
    assert.ok(connection, `Missing equipment connection: ${asset.id}`);
    assert.deepEqual(connection.coordinates.at(-1), BUS_COORDS[asset.bus]);
    const plant = sites.find((site) => site.simulationId === asset.id);
    assert.deepEqual(
      connection.coordinates[0],
      plant ? [plant.lat, plant.lon] : MODEL_COORDS[asset.id],
    );
    assert.equal(connection.selectionId, plant?.id ?? `model:${asset.id}`);
  }
});

test("only four explicitly associated plant switchyards appear as intermediate points", () => {
  const connections = buildModelConnections(createAssets(), sites);
  const actual = connections.filter((item) => item.viaSiteId);
  assert.deepEqual(actual.map((item) => item.assetId).sort(), [
    "G2",
    "G4",
    "G5",
    "G6",
  ]);
  for (const connection of actual) {
    const yard = sites.find(
      (site) => site.id === MODEL_SWITCHYARDS[connection.assetId],
    )!;
    assert.equal(yard.kind, "substation");
    assert.equal(connection.viaSiteId, yard.id);
    assert.equal(connection.coordinates.length, 3);
    assert.deepEqual(connection.coordinates[1], [yard.lat, yard.lon]);
  }
  for (const id of ["G1", "G7", "G8"]) {
    const connection = connections.find((item) => item.assetId === id)!;
    assert.equal(
      connection.viaSiteId,
      undefined,
      `${id} must not infer a switchyard from proximity`,
    );
    assert.equal(connection.coordinates.length, 2);
  }
});

test("missing geographic context removes the intermediate yard without disconnecting equipment", () => {
  const assets = createAssets();
  const reducedSites = sites.filter((site) => site.id !== MODEL_SWITCHYARDS.G2);
  const victoria = buildModelConnections(assets, reducedSites).find(
    (item) => item.assetId === "G2",
  )!;
  assert.equal(victoria.viaSiteId, undefined);
  assert.equal(victoria.coordinates.length, 2);
  assert.equal(victoria.selectionId, "victoria");
  const withoutGeography = buildModelConnections(assets, []);
  assert.equal(
    withoutGeography.length,
    assets.filter((asset) => asset.kind !== "bus").length,
  );
  const missingPlant = withoutGeography.find((item) => item.assetId === "G2")!;
  assert.equal(missingPlant.selectionId, "model:G2");
  assert.equal(missingPlant.viaSiteId, undefined);
  assert.deepEqual(missingPlant.coordinates[0], BUS_COORDS[1]);
});

test("display connections cannot be mistaken for mapped transmission routes or change source coordinates", () => {
  const routeSnapshot = JSON.stringify(transmissionRoutes);
  const siteSnapshot = JSON.stringify(sites);
  const busSnapshot = JSON.stringify(BUS_COORDS);
  const aggregateSnapshot = JSON.stringify(MODEL_COORDS);
  const assets = createAssets();
  const assetSnapshot = JSON.stringify(assets);
  const connections = buildModelConnections(assets, sites);
  for (const connection of connections) {
    assert.ok(connection.id.startsWith("model-connection:"));
    assert.ok(!transmissionRoutes.some((route) => route.id === connection.id));
    assert.equal("confidence" in connection, false);
    assert.equal("sourceUrl" in connection, false);
    assert.equal("voltageKV" in connection, false);
    assert.equal("capacity" in connection, false);
    for (const point of connection.coordinates) point[0] = -1;
  }
  assert.equal(JSON.stringify(transmissionRoutes), routeSnapshot);
  assert.equal(JSON.stringify(sites), siteSnapshot);
  assert.equal(JSON.stringify(BUS_COORDS), busSnapshot);
  assert.equal(JSON.stringify(MODEL_COORDS), aggregateSnapshot);
  assert.equal(JSON.stringify(assets), assetSnapshot);
});

test("invalid bus references fail explicitly rather than quietly dropping a piece of equipment", () => {
  const assets = createAssets();
  assets[0].bus = 100;
  assert.throws(
    () => buildModelConnections(assets, sites),
    /Unknown equivalent bus 100 for G1/,
  );
});
