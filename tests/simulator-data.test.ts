import { test } from "node:test";
import assert from "node:assert/strict";
import { createAssets } from "../src/game/network";
import { sites, transmissionRoutes } from "../src/simulator/infrastructure";

function validLocation(lat: number, lon: number, label: string) {
  assert.ok(
    Number.isFinite(lat) && Number.isFinite(lon),
    `${label}: finite coordinates`,
  );
  assert.ok(
    lat >= 5.8 && lat <= 9.9 && lon >= 79.5 && lon <= 81.95,
    `${label}: coordinates must be in Sri Lanka, with latitude first`,
  );
}
function evidenceUrl(value: string, label: string) {
  const url = new URL(value);
  assert.ok(
    ["https:", "http:"].includes(url.protocol),
    `${label}: usable evidence URL`,
  );
  assert.ok(
    url.hostname.includes("."),
    `${label}: evidence must name a public source`,
  );
}

test("infrastructure features have distinct identities and plausible geographic coordinates", () => {
  assert.ok(sites.length > 0, "The reference map must contain infrastructure");
  const ids = [...sites, ...transmissionRoutes].map((feature) => feature.id);
  assert.ok(ids.every((id) => id.trim().length > 0));
  assert.equal(
    new Set(ids).size,
    ids.length,
    "Duplicate IDs would select the wrong feature",
  );
  for (const site of sites) {
    validLocation(site.lat, site.lon, site.id);
    assert.ok(
      site.name.trim() && site.nameSi.trim(),
      `${site.id}: bilingual identity`,
    );
    assert.ok(site.description.trim(), `${site.id}: evidence context`);
    if (site.capacityMW !== undefined)
      assert.ok(
        Number.isFinite(site.capacityMW) &&
          site.capacityMW > 0 &&
          site.capacityMW <= 10000,
        `${site.id}: plausible nameplate MW`,
      );
  }
});

test("locations and capacity claims retain source links and explicit confidence", () => {
  for (const site of sites) {
    evidenceUrl(site.sourceUrl, site.id);
    evidenceUrl(site.locationSourceUrl, `${site.id} location`);
    assert.ok(
      ["mapped", "approximate"].includes(site.confidence),
      `${site.id}: confidence must be explicit`,
    );
  }
  for (const route of transmissionRoutes) {
    evidenceUrl(route.sourceUrl, route.id);
    assert.ok(
      ["mapped", "approximate"].includes(route.confidence),
      `${route.id}: confidence must be explicit`,
    );
  }
});

test("real infrastructure can control only an explicitly matching modeled plant", () => {
  const assets = new Map(createAssets().map((asset) => [asset.id, asset]));
  const modeled = sites.filter((site) => site.simulationId);
  assert.ok(modeled.length > 0, "Dispatch links should be explicit");
  assert.equal(
    new Set(modeled.map((site) => site.simulationId)).size,
    modeled.length,
    "Two separate real plants must not masquerade as one controllable modeled station",
  );
  for (const site of modeled) {
    const asset = assets.get(site.simulationId!);
    assert.ok(asset, `${site.id}: simulation target must exist`);
    assert.equal(
      site.kind,
      asset.kind,
      `${site.id}: source technology must match the model`,
    );
    assert.ok(
      !["G3", "G9", "B1"].includes(asset.id),
      `${site.id}: a real facility cannot be identified with a fictional regional resource`,
    );
  }
});

test("transmission geometry has an interpretable voltage and never invents electrical junctions", () => {
  for (const route of transmissionRoutes) {
    assert.ok(
      Number.isFinite(route.voltageKV) &&
        route.voltageKV > 0 &&
        route.voltageKV <= 1000,
      `${route.id}: voltage is in kV rather than V`,
    );
    assert.ok(
      route.coordinates.length >= 2,
      `${route.id}: a route needs a polyline`,
    );
    for (const [lat, lon] of route.coordinates)
      validLocation(lat, lon, route.id);
    const [firstLat, firstLon] = route.coordinates[0];
    assert.ok(
      route.coordinates.some(
        ([lat, lon]) => lat !== firstLat || lon !== firstLon,
      ),
      `${route.id}: collapsed route`,
    );
    assert.equal(
      "simulationId" in route,
      false,
      `${route.id}: reference geometry cannot claim an unverified solver connection`,
    );
  }
});

test("short mapped terminal links preserve their real shared OSM nodes", () => {
  const routes = new Map(transmissionRoutes.map((route) => [route.id, route]));
  const joins = [
    ["osm-way-702202546", "osm-way-1386955937", 11179697602],
    ["osm-way-702202546", "osm-way-1386955938", 11179697602],
    ["osm-way-1206495967", "osm-way-1354712326", 11179697533],
    ["osm-way-1206495967", "osm-way-1354712327", 11179697533],
  ] as const;
  for (const [corridorId, terminalId, nodeId] of joins) {
    const corridor = routes.get(corridorId);
    const terminal = routes.get(terminalId);
    assert.ok(
      corridor && terminal,
      `${terminalId}: short terminal must not be filtered out`,
    );
    const i = corridor.osmNodeIds?.indexOf(nodeId) ?? -1;
    const k = terminal.osmNodeIds?.indexOf(nodeId) ?? -1;
    assert.ok(
      i >= 0 && k >= 0,
      `${terminalId}: a join needs the original shared OSM node`,
    );
    assert.deepEqual(corridor.coordinates[i], terminal.coordinates[k]);
    assert.equal(
      terminal.sourceUrl,
      `https://www.openstreetmap.org/way/${terminalId.replace("osm-way-", "")}`,
    );
  }
});

test("original node provenance cannot join different coordinate positions", () => {
  const nodeLocations = new Map<number, [number, number]>();
  for (const route of transmissionRoutes) {
    if (!route.osmNodeIds) continue;
    assert.equal(
      route.osmNodeIds.length,
      route.coordinates.length,
      `${route.id}: one original node per coordinate`,
    );
    route.osmNodeIds.forEach((nodeId, index) => {
      assert.ok(Number.isSafeInteger(nodeId) && nodeId > 0);
      const known = nodeLocations.get(nodeId);
      if (known)
        assert.deepEqual(
          route.coordinates[index],
          known,
          `${nodeId}: shared node coordinates must agree`,
        );
      else nodeLocations.set(nodeId, route.coordinates[index]);
    });
    assert.ok(["overhead", "cable", "busbar"].includes(route.segmentType!));
  }
});

test("station feeder coverage retains the researched western and hydro branches", () => {
  for (const id of [
    "osm-way-422435859",
    "osm-way-702191472",
    "osm-way-702857461",
    "osm-way-704003806",
    "osm-way-1354576136",
  ]) {
    const route = transmissionRoutes.find((candidate) => candidate.id === id);
    assert.ok(route, `${id}: researched feeder must remain available`);
    assert.equal(route.confidence, "mapped");
    assert.ok(route.osmNodeIds?.length);
  }
});
