"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { State } from "@/game/engine";
import type {
  InfrastructureSite,
  TransmissionRoute,
} from "@/simulator/infrastructure";
import boundary from "@/game/data/sri-lanka.json";

type Props = {
  state: State;
  sites: InfrastructureSite[];
  routes: TransmissionRoute[];
  selectedId: string;
  onSelect: (id: string) => void;
  focusId: string | null;
  focusRequest: number;
  layer: "operations" | "infrastructure";
  showLabels: boolean;
  language: "en" | "si";
};
type MarkerRecord = {
  marker: Leaflet.Marker;
  name: string;
  kind: InfrastructureSite["kind"] | "load" | "bus" | "battery";
  simulationId?: string;
  signature?: string;
};
type LineRecord = {
  line: Leaflet.Polyline;
  hit: Leaflet.Polyline;
  modelId?: string;
  voltage: number;
  approximate: boolean;
};
type MapRuntime = {
  L: typeof Leaflet;
  map: Leaflet.Map;
  tiles: Leaflet.TileLayer;
  features: Leaflet.LayerGroup;
  markers: Map<string, MarkerRecord>;
  lines: Map<string, LineRecord>;
};
const BUS_COORDS: [number, number][] = [
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
const MODEL_COORDS: Record<string, [number, number]> = {
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
const SRI_LANKA_BOUNDS: [[number, number], [number, number]] = [
  [5.8, 79.45],
  [9.9, 81.95],
];
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const KIND_COLOR: Record<MarkerRecord["kind"], string> = {
  coal: "#475569",
  oil: "#b77922",
  hydro: "#1682bf",
  wind: "#147b62",
  solar: "#b98917",
  substation: "#9255bb",
  bus: "#607d8b",
  load: "#506b89",
  battery: "#3e8b70",
};
const GLYPHS: Record<MarkerRecord["kind"], string> = {
  coal: '<path d="M9 22v-8h4v8m2 0V10h4v12m2 0V6h3v16M7 24h18"/>',
  oil: '<path d="M16 7c-1 5-7 7-7 12a7 7 0 0014 0c0-4-3-7-4-9-1 3-3 4-3 4z"/>',
  hydro:
    '<path d="M16 6c-3 5-8 10-8 14a8 8 0 0016 0c0-4-5-9-8-14zM11 21c2 3 5 4 8 2"/>',
  wind: '<path d="M16 16v11m0-13V5m-2 11-8 5m12-5 8 5"/><circle cx="16" cy="15" r="2"/>',
  solar:
    '<path d="M8 12h16l3 12H5zM10 18h14M12 12l-1 12m9-12 1 12M16 5v3m-7-2 2 2m12-2-2 2"/>',
  substation:
    '<circle cx="13" cy="16" r="6"/><circle cx="20" cy="16" r="6"/><path d="M4 16h3m19 0h3"/>',
  bus: '<path d="M7 16h18M11 10v12m10-12v12"/>',
  load: '<path d="M7 14 16 7l9 7v11H7zM13 25v-8h6v8"/>',
  battery: '<path d="M7 11h18v14H7zM12 7h8v4M11 18h4m6-2v4m-2-2h4"/>',
};
function iconHTML(
  record: MarkerRecord,
  color: string,
  selected: boolean,
  contextual: boolean,
) {
  return `<svg class="sim-map-symbol" viewBox="0 0 32 32" width="24" height="24" aria-hidden="true"><rect x="1.5" y="1.5" width="29" height="29" rx="${record.kind === "substation" || record.kind === "bus" ? 5 : 15}" fill="${selected ? "#e4f4ff" : "#ffffff"}" stroke="${selected ? "#087ab5" : color}" stroke-width="${selected ? 3 : 1.8}" ${contextual ? 'stroke-dasharray="3 2"' : ""}/><g fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(3.2 3.2) scale(.8)">${GLYPHS[record.kind]}</g></svg><span class="sim-map-label${selected ? " sim-map-label--selected" : ""}">${escape(record.name)}</span>`;
}
function declutter(
  runtime: MapRuntime,
  showLabels: boolean,
  selectedId: string,
) {
  const bounds = runtime.map.getContainer().getBoundingClientRect();
  const occupied: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }[] = [];
  const markers = [...runtime.markers.entries()].sort(([a, x], [b, y]) =>
    a === selectedId
      ? -1
      : b === selectedId
        ? 1
        : Number(!!y.simulationId) - Number(!!x.simulationId),
  );
  // Protect every symbol from being covered by a label, even when its own label is hidden.
  for (const [, record] of markers) {
    const p = runtime.map.latLngToContainerPoint(record.marker.getLatLng());
    occupied.push({
      left: bounds.left + p.x - 12,
      right: bounds.left + p.x + 12,
      top: bounds.top + p.y - 12,
      bottom: bounds.top + p.y + 12,
    });
  }
  for (const [id, record] of markers) {
    const label = record.marker
      .getElement()
      ?.querySelector<HTMLElement>(".sim-map-label");
    if (!label) continue;
    label.style.visibility = "visible";
    const box = label.getBoundingClientRect();
    const overlaps = occupied.some(
      (a) =>
        box.left < a.right + 4 &&
        box.right > a.left - 4 &&
        box.top < a.bottom + 3 &&
        box.bottom > a.top - 3,
    );
    const outside =
      box.left > bounds.right ||
      box.right < bounds.left ||
      box.top > bounds.bottom ||
      box.bottom < bounds.top;
    const visible =
      !outside && (id === selectedId || (showLabels && !overlaps));
    label.style.visibility = visible ? "visible" : "hidden";
    if (visible) occupied.push(box);
  }
}

export default function SimulatorMap(props: Props) {
  const element = useRef<HTMLDivElement>(null);
  const runtime = useRef<MapRuntime | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const si = props.language === "si";

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (disposed || !element.current) return;
        const map = L.map(element.current, {
          center: [7.85, 80.7],
          zoom: 7,
          zoomSnap: 0.25,
          zoomDelta: 0.5,
          minZoom: 5,
          maxZoom: 18,
          zoomControl: false,
          preferCanvas: false,
          attributionControl: true,
          scrollWheelZoom: true,
        });
        map.createPane("coastline").style.zIndex = "199";
        L.geoJSON(
          {
            type: "Feature",
            properties: {},
            geometry: boundary.geometry,
          } as GeoJSON.Feature,
          {
            pane: "coastline",
            style: {
              color: "#8da9a2",
              weight: 1,
              fillColor: "#e5eee7",
              fillOpacity: 1,
            },
            interactive: false,
          },
        ).addTo(map);
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
            maxZoom: 19,
            keepBuffer: 1,
            updateWhenIdle: true,
          },
        ).addTo(map);
        tiles.on("tileerror", () => {
          if (!disposed) setOffline(true);
        });
        map.attributionControl.setPrefix(false);
        L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
        const features = L.layerGroup().addTo(map);
        const value = {
          L,
          map,
          tiles,
          features,
          markers: new Map<string, MarkerRecord>(),
          lines: new Map<string, LineRecord>(),
        };
        runtime.current = value;
        map.fitBounds(SRI_LANKA_BOUNDS, { padding: [18, 18] });
        map.on("zoomend moveend", () =>
          declutter(
            value,
            latest.current.showLabels,
            latest.current.selectedId,
          ),
        );
        observer = new ResizeObserver(() => {
          map.invalidateSize({ pan: false });
          declutter(
            value,
            latest.current.showLabels,
            latest.current.selectedId,
          );
        });
        observer.observe(element.current);
        setReady(true);
      })
      .catch(() => {
        if (!disposed) setLoadError(true);
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      runtime.current?.map.remove();
      runtime.current = null;
    };
  }, []);

  useEffect(() => {
    const r = runtime.current;
    if (!ready || !r) return;
    r.features.clearLayers();
    r.markers.clear();
    r.lines.clear();
    const addMarker = (
      id: string,
      coord: [number, number],
      name: string,
      kind: MarkerRecord["kind"],
      simulationId?: string,
    ) => {
      const record: MarkerRecord = {
        marker: r.L.marker(coord, { title: name, alt: name, keyboard: true }),
        name,
        kind,
        simulationId,
      };
      record.marker.setIcon(
        r.L.divIcon({
          className: "sim-map-marker",
          html: iconHTML(record, KIND_COLOR[kind], false, !simulationId),
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      );
      record.marker
        .on("click", () => latest.current.onSelect(id))
        .addTo(r.features);
      record.marker.getElement()?.setAttribute("aria-label", name);
      r.markers.set(id, record);
    };
    const addLine = (
      id: string,
      coordinates: [number, number][],
      name: string,
      voltage: number,
      approximate: boolean,
      modelId?: string,
    ) => {
      const line = r.L.polyline(coordinates, {
        color: voltage >= 220 ? "#7c3aed" : "#0d9488",
        weight: voltage >= 220 ? 3 : 2.5,
        opacity: 0.85,
        dashArray: approximate ? "7 6" : undefined,
        interactive: false,
      }).addTo(r.features);
      const hit = r.L.polyline(coordinates, {
        color: "transparent",
        weight: 16,
        opacity: 0,
        interactive: true,
      }).addTo(r.features);
      hit.bindTooltip(escape(name), { sticky: true, direction: "top" });
      hit.on("click", () => latest.current.onSelect(id));
      const path = hit.getElement();
      path?.setAttribute("tabindex", "0");
      path?.setAttribute("role", "button");
      path?.setAttribute("aria-label", name);
      path?.addEventListener("keydown", (event) => {
        const key = (event as KeyboardEvent).key;
        if (key === "Enter" || key === " ") {
          event.preventDefault();
          latest.current.onSelect(id);
        }
      });
      r.lines.set(id, { line, hit, modelId, voltage, approximate });
    };
    if (props.layer === "infrastructure") {
      for (const route of props.routes)
        addLine(
          `route:${route.id}`,
          route.coordinates,
          `${route.name} · ${route.voltageKV} kV${route.confidence === "approximate" ? (si ? " · ආසන්න මාර්ගය" : " · indicative route") : ""}`,
          route.voltageKV,
          route.confidence === "approximate",
        );
    } else {
      for (const line of latest.current.state.lines)
        addLine(
          `model:${line.id}`,
          [BUS_COORDS[line.from], BUS_COORDS[line.to]],
          `${line.id} · ${si ? "සරල කළ ආදර්ශ සම්බන්ධතාව" : "simplified model connection"}`,
          0,
          true,
          line.id,
        );
      for (const asset of latest.current.state.assets) {
        if (asset.kind === "bus")
          addMarker(
            `model:${asset.id}`,
            BUS_COORDS[asset.bus],
            si ? asset.nameSi : asset.name,
            "bus",
            asset.id,
          );
        else if (
          asset.kind === "load" ||
          asset.kind === "battery" ||
          ((asset.id === "G3" || asset.id === "G9") &&
            !props.sites.some((site) => site.simulationId === asset.id))
        ) {
          const coord = MODEL_COORDS[asset.id] ?? BUS_COORDS[asset.bus];
          addMarker(
            `model:${asset.id}`,
            coord,
            `${si ? asset.nameSi : asset.name} · ${si ? "ආදර්ශය" : "model"}`,
            asset.kind,
            asset.id,
          );
        }
      }
    }
    for (const site of props.sites)
      addMarker(
        site.id,
        [site.lat, site.lon],
        si ? site.nameSi : site.name,
        site.kind,
        site.simulationId,
      );
    declutter(r, props.showLabels, props.selectedId);
  }, [ready, props.sites, props.routes, props.layer, props.language]); // State is updated below without recreating the map.

  useEffect(() => {
    const r = runtime.current;
    if (!ready || !r) return;
    for (const [id, record] of r.markers) {
      const asset = record.simulationId
        ? props.state.assets.find((a) => a.id === record.simulationId)
        : undefined;
      const selected = id === props.selectedId;
      const isOperations = props.layer === "operations";
      const dead =
        asset &&
        (asset.kind === "bus"
          ? props.state.busFrequency[asset.bus] < 1
          : asset.kind === "load"
            ? (asset.served ?? 0) < 0.1
            : !asset.online);
      const warning =
        asset &&
        (asset.starting ||
          (asset.kind === "load" &&
            (asset.served ?? 0) < asset.output * 0.95) ||
          (props.state.busFrequency[asset.bus] > 1 &&
            Math.abs(props.state.busFrequency[asset.bus] - 50) > 0.5));
      const color =
        isOperations && asset
          ? dead
            ? "#87929b"
            : warning
              ? "#d58b17"
              : "#058b76"
          : KIND_COLOR[record.kind];
      const signature = `${selected}:${color}:${record.name}:${props.layer}`;
      if (record.signature !== signature) {
        record.marker.setIcon(
          r.L.divIcon({
            className: `sim-map-marker${selected ? " sim-map-marker--selected" : ""}`,
            html: iconHTML(record, color, selected, !asset),
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        );
        record.marker.setZIndexOffset(selected ? 1000 : asset ? 200 : 0);
        record.signature = signature;
      }
    }
    for (const [id, record] of r.lines) {
      const selected = id === props.selectedId;
      const line = record.modelId
        ? props.state.lines.find((item) => item.id === record.modelId)
        : undefined;
      const utilization = line ? Math.abs(line.flow) / line.capacity : 0;
      const color = selected
        ? "#008bd2"
        : line
          ? !line.online
            ? "#d83d53"
            : utilization > 1
              ? "#d83d53"
              : utilization > 0.8
                ? "#cd8c22"
                : "#168d7d"
          : record.voltage >= 220
            ? "#7c3aed"
            : "#0d9488";
      record.line.setStyle({
        color,
        weight: selected ? 5 : 2.5,
        opacity: selected ? 1 : line && !line.online ? 0.65 : 0.85,
        dashArray: record.approximate
          ? line && !line.online
            ? "2 7"
            : "7 6"
          : undefined,
      });
      if (selected) record.line.bringToFront();
    }
    declutter(r, props.showLabels, props.selectedId);
  }, [
    ready,
    props.state,
    props.selectedId,
    props.showLabels,
    props.layer,
    props.sites,
    props.routes,
    props.language,
  ]);

  useEffect(() => {
    const r = runtime.current;
    if (!ready || !r || !props.focusId) return;
    r.map.invalidateSize({ pan: false });
    if (props.focusId === "country") {
      r.map.fitBounds(SRI_LANKA_BOUNDS, { padding: [18, 18] });
      return;
    }
    const marker = r.markers.get(props.focusId);
    const line = r.lines.get(props.focusId);
    if (marker)
      r.map.flyTo(marker.marker.getLatLng(), Math.max(11, r.map.getZoom()), {
        duration: 0.55,
      });
    else if (line)
      r.map.flyToBounds(line.line.getBounds(), {
        padding: [60, 60],
        maxZoom: 11,
        duration: 0.55,
      });
  }, [ready, props.focusId, props.focusRequest, props.layer]);

  return (
    <div className="sim-map">
      <div
        className="sim-map-canvas"
        ref={element}
        role="region"
        aria-label={
          si
            ? "ශ්‍රී ලංකා විදුලිබල සිතියම"
            : "Sri Lanka electricity network map"
        }
      />
      {!ready && (
        <div className="sim-map-loading" role="status">
          {loadError
            ? si
              ? "සිතියම විවෘත කළ නොහැක. පිටුව නැවත පූරණය කරන්න."
              : "Map could not load. Refresh to retry."
            : si
              ? "සිතියම පූරණය වෙමින්…"
              : "Loading geographic map…"}
        </div>
      )}
      <div
        className="sim-map-tools"
        role="group"
        aria-label={si ? "සිතියම් පාලනය" : "Map controls"}
      >
        <button
          type="button"
          title={si ? "විශාල කරන්න" : "Zoom in"}
          aria-label={si ? "විශාල කරන්න" : "Zoom in"}
          onClick={() => runtime.current?.map.zoomIn()}
        >
          +
        </button>
        <button
          type="button"
          title={si ? "කුඩා කරන්න" : "Zoom out"}
          aria-label={si ? "කුඩා කරන්න" : "Zoom out"}
          onClick={() => runtime.current?.map.zoomOut()}
        >
          −
        </button>
        <button
          type="button"
          title={si ? "මුළු රටම පෙන්වන්න" : "Fit Sri Lanka"}
          aria-label={si ? "මුළු රටම පෙන්වන්න" : "Fit Sri Lanka"}
          onClick={() =>
            runtime.current?.map.fitBounds(SRI_LANKA_BOUNDS, {
              padding: [18, 18],
            })
          }
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4" />
            <circle cx="10" cy="10" r="3" />
          </svg>
        </button>
      </div>
      {offline && (
        <div className="sim-map-offline" role="status">
          <span>
            {si
              ? "සිතියම් පසුබිම ලබාගත නොහැක · දේශීය දත්ත පෙන්වයි"
              : "Some map tiles unavailable · local network data remains visible"}
          </span>
          <button
            type="button"
            onClick={() => {
              setOffline(false);
              runtime.current?.tiles.redraw();
            }}
          >
            {si ? "නැවත උත්සාහ කරන්න" : "Retry"}
          </button>
        </div>
      )}
      <style>{`
      .sim-map { position: relative; width: 100%; height: 100%; min-height: 360px; isolation: isolate; }
      .sim-map-canvas { position: absolute; inset: 0; background: #dce9ed; font: inherit; }
      .sim-map-marker { background: none; border: none; }
      .sim-map-symbol { display: block; filter: drop-shadow(0 1px 2px #19384930); }
      .sim-map-label { position: absolute; left: 29px; top: 2px; padding: 3px 6px; color: #243c4a; border: 1px solid #ffffffc0; background: #fffffff0; border-radius: 4px; white-space: nowrap; pointer-events: none; font: 600 10px/1.35 Arial, 'Noto Sans Sinhala', sans-serif; box-shadow: 0 1px 3px #15314112; }
      .sim-map-label--selected { color: #056998; border-color: #64bae0; background: white; }
      .sim-map-marker--selected::before { content: ""; position: absolute; inset: -6px; border: 1.5px solid #118dbd; border-radius: 50%; pointer-events: none; animation: sim-map-locate 2.5s ease-out infinite; }
      @keyframes sim-map-locate { 0% { opacity: .75; transform: scale(.9); } 100% { opacity: 0; transform: scale(1.5); } }
      @media (prefers-reduced-motion: reduce) { .sim-map-marker--selected::before { animation: none; opacity: .6; } }
      .sim-map-marker--selected .sim-map-symbol { filter: drop-shadow(0 0 5px #0e91c6a0); }
      .sim-map-marker:focus-visible { outline: 3px solid #0899d1; outline-offset: 4px; border-radius: 50%; }
      .sim-map-tools { position: absolute; z-index: 500; right: 16px; top: 16px; display: flex; flex-direction: column; background: #fff; border: 1px solid #cad6df; border-radius: 8px; overflow: hidden; box-shadow: 0 3px 14px #15334818; }
      .sim-map-tools button { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-bottom: 1px solid #e4eaed; color: #345064; background: white; font: 22px/1 Arial; cursor: pointer; }
      .sim-map-tools button:last-child { border: 0; }
      .sim-map-tools button:hover { background: #edf6fa; }
      .sim-map-offline { position: absolute; z-index: 500; bottom: 33px; left: 50%; transform: translateX(-50%); width: max-content; max-width: calc(100% - 32px); display: flex; align-items: center; gap: 12px; border: 1px solid #d8bb7e; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #765619; background: #fffae9; box-shadow: 0 2px 12px #0001; }
      .sim-map-offline button { color: inherit; border: 1px solid #d8bb7e; border-radius: 4px; padding: 4px 8px; background: white; cursor: pointer; }
      .sim-map-loading { position: absolute; z-index: 500; left: 50%; top: 45%; transform: translate(-50%,-50%); background: white; color: #345064; border-radius: 8px; padding: 16px 22px; font-size: 13px; }
      .sim-map .leaflet-control-attribution { font: 10px/1.5 Arial, sans-serif; padding: 3px 7px; color: #43576a; background: #fffffff0; }
      .sim-map .leaflet-control-scale { margin-bottom: 10px; margin-left: 14px; }
      .sim-map .leaflet-control-scale-line { border-color: #5c6d76; color: #294351; background: #ffffffcf; }
      .sim-map .leaflet-tooltip { font: 11px/1.4 Arial, 'Noto Sans Sinhala', sans-serif; border-radius: 5px; padding: 6px 9px; }
      .sim-map path[role=button]:focus-visible { stroke: #00a3df; stroke-opacity: .4; outline: none; }
    `}</style>
    </div>
  );
}
