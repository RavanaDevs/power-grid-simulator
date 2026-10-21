"use client";
import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";
import { type State } from "@/game/engine";
import {
  coastline,
  mapBusPositions as busPositions,
  mapPosition,
  project,
} from "@/game/geography";
type Props = {
  state: State;
  selected: string;
  onSelect: (id: string) => void;
  zoom: number;
  reset: number;
  layer: string;
  language: "en" | "si";
  focus: number;
  onZoom: (zoom: number) => void;
  controlsEnabled: boolean;
};
export default function GridMap(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, w: 1500, h: 1200 });
  const navigate = useRef<(x: number, y: number) => void>(() => {});
  useEffect(() => {
    let disposed = false;
    const app = new Application();
    let observer: ResizeObserver | undefined;
    let cleanup = () => {};
    void (async () => {
      try {
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          resizeTo: host.current!,
          resolution: Math.min(window.devicePixelRatio, 2),
          autoDensity: true,
        });
        if (disposed) {
          app.destroy(true);
          return;
        }
        await document.fonts.ready;
        if (disposed) {
          app.destroy(true);
          return;
        }
        host.current!.appendChild(app.canvas);
        app.canvas.tabIndex = 0;
        const world = new Container();
        app.stage.addChild(world);
        const terrain = new Graphics(),
          graphics = new Graphics(),
          labels = new Container();
        world.addChild(terrain, graphics, labels);
        const cache = new Map<string, Text>();
        let hitLabels: {
          id: string;
          x: number;
          y: number;
          w: number;
          h: number;
        }[] = [];
        const coast = [...coastline].sort((a, b) => b.length - a.length)[0];
        for (const ring of coastline) {
          terrain
            .poly(ring)
            .fill(0x31565a)
            .stroke({ color: 0x529294, width: 22, alpha: 0.17 });
          terrain.poly(ring.map((v, i) => (i % 2 ? v + 8 : v))).fill(0x31514a);
          terrain
            .poly(ring)
            .fill(0x78947b)
            .stroke({ color: 0xc5c6a0, width: 3 });
        }
        const hills = project(80.77, 7.02);
        terrain
          .ellipse(hills.x, hills.y, 65, 110)
          .fill({ color: 0x55765b, alpha: 0.45 });
        const river = (coords: number[][]) => {
          const ps = coords.map(([lon, lat]) => project(lon, lat));
          terrain.moveTo(ps[0].x, ps[0].y);
          for (const p of ps.slice(1)) terrain.lineTo(p.x, p.y);
          terrain.stroke({ color: 0x6fb6b9, width: 3, alpha: 0.8 });
        };
        river([
          [80.79, 7.24],
          [80.97, 7.36],
          [81.02, 7.75],
          [81.13, 8.1],
          [81.23, 8.45],
        ]);
        river([
          [80.65, 6.94],
          [80.42, 7.02],
          [80.2, 6.92],
          [79.91, 6.96],
        ]);
        function mountain(x: number, y: number, z: number) {
          terrain
            .poly([
              x - z * 0.6,
              y + z * 0.3,
              x,
              y - z,
              x + z * 0.7,
              y + z * 0.3,
            ])
            .fill(0x90a18b);
          terrain
            .poly([x, y - z, x + z * 0.7, y + z * 0.3, x, y + z * 0.2])
            .fill(0x4d6d58);
          terrain
            .poly([
              x,
              y - z,
              x - z * 0.2,
              y - z * 0.6,
              x,
              y - z * 0.48,
              x + z * 0.2,
              y - z * 0.55,
            ])
            .fill(0xbdc9af);
        }
        for (const [lon, lat, z] of [
          [80.78, 7.0, 28],
          [80.82, 6.82, 35],
          [80.65, 6.8, 23],
        ]) {
          const q = project(lon, lat);
          mountain(q.x, q.y, z);
        }
        let seed = 712;
        const random = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };
        const inside = (x: number, y: number) => {
          let result = false;
          for (
            let i = 0, j = coast.length - 2;
            i < coast.length;
            j = i, i += 2
          ) {
            const xi = coast[i],
              yi = coast[i + 1],
              xj = coast[j],
              yj = coast[j + 1];
            if (
              yi > y !== yj > y &&
              x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
            )
              result = !result;
          }
          return result;
        };
        for (let i = 0; i < 650; i++) {
          const x = 400 + random() * 650,
            y = 70 + random() * 1050;
          if (
            !inside(x, y) ||
            latest.current.state.assets.some(
              (a) =>
                Math.hypot(mapPosition(a).x - x, mapPosition(a).y - y) < 32,
            )
          )
            continue;
          const r = 4 + random() * 5;
          terrain
            .ellipse(x + 3, y + 5, r * 1.4, r * 0.4)
            .fill({ color: 0x294a3b, alpha: 0.2 });
          terrain.rect(x - 1, y, 2, 7).fill(0x695f45);
          terrain
            .ellipse(x, y - r * 0.5, r, r * 0.8)
            .fill(i % 3 ? 0x426b50 : 0x71814f);
        }
        let textResolution = 2,
          overlayScale = 1;
        function label(
          id: string,
          text: string,
          x: number,
          y: number,
          color: number,
          size = 11,
        ) {
          let t = cache.get(id);
          if (!t) {
            t = new Text({
              text,
              style: {
                fontFamily: "Noto Sans Sinhala, Arial, sans-serif",
                fontSize: size,
                fill: color,
                fontWeight: "600",
                letterSpacing: 0.2,
              },
            });
            t.anchor.set(0.5);
            cache.set(id, t);
            labels.addChild(t);
          }
          if (t.resolution !== textResolution) t.resolution = textResolution;
          t.visible = true;
          t.scale.set(overlayScale);
          t.text = text;
          t.position.set(x, y);
          t.style.fill = color;
          t.style.fontSize = size;
        }
        let pan = { x: 0, y: 0 },
          drag: { x: number; y: number; px: number; py: number } | null = null,
          moved = false,
          lastReset = 0,
          phase = 0,
          lastFocus = 0,
          collapseStart = -1,
          targetPan = { x: 0, y: 0 },
          pointer: { x: number; y: number } | null = null,
          frames = 0;
        const keys = new Set<string>();
        const keydown = (e: KeyboardEvent) => {
          if (
            !latest.current.controlsEnabled ||
            (e.target as HTMLElement).closest("input,select,textarea")
          )
            return;
          if (
            [
              "KeyW",
              "KeyA",
              "KeyS",
              "KeyD",
              "ArrowUp",
              "ArrowDown",
              "ArrowLeft",
              "ArrowRight",
            ].includes(e.code)
          ) {
            e.preventDefault();
            keys.add(e.code);
          }
          if (e.code === "Home") {
            targetPan = { x: 0, y: 0 };
            latest.current.onZoom(1);
          }
        };
        const keyup = (e: KeyboardEvent) => keys.delete(e.code);
        const blur = () => {
          keys.clear();
          pointer = null;
          drag = null;
        };
        window.addEventListener("keydown", keydown);
        window.addEventListener("keyup", keyup);
        window.addEventListener("blur", blur);
        cleanup = () => {
          window.removeEventListener("keydown", keydown);
          window.removeEventListener("keyup", keyup);
          window.removeEventListener("blur", blur);
        };
        navigate.current = (x, y) => {
          targetPan = {
            x: (750 - x) * world.scale.x,
            y: (600 - y) * world.scale.y,
          };
        };
        app.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
        app.canvas.addEventListener("pointerleave", () => {
          pointer = null;
        });
        app.canvas.addEventListener(
          "wheel",
          (e: WheelEvent) => {
            if (!latest.current.controlsEnabled) return;
            e.preventDefault();
            const r = app.canvas.getBoundingClientRect(),
              mx = e.clientX - r.left,
              my = e.clientY - r.top;
            const old = world.scale.x;
            const z = Math.max(
              0.8,
              Math.min(8, latest.current.zoom * Math.exp(-e.deltaY * 0.0015)),
            );
            const next =
              Math.min(app.screen.width / 1050, app.screen.height / 1320) * z;
            const wx = (mx - world.x) / old,
              wy = (my - world.y) / old;
            targetPan = {
              x: mx - wx * next - (app.screen.width - 1500 * next) / 2,
              y: my - wy * next - (app.screen.height - 1200 * next) / 2 + 12,
            };
            pan = { ...targetPan };
            latest.current.onZoom(z);
          },
          { passive: false },
        );
        app.canvas.addEventListener("pointerdown", (e: PointerEvent) => {
          if (!latest.current.controlsEnabled) return;
          app.canvas.focus();
          drag = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          moved = false;
          app.canvas.setPointerCapture(e.pointerId);
        });
        app.canvas.addEventListener("pointermove", (e: PointerEvent) => {
          const r = app.canvas.getBoundingClientRect();
          pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
          if (!drag) return;
          if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4)
            moved = true;
          pan = {
            x: drag.px + e.clientX - drag.x,
            y: drag.py + e.clientY - drag.y,
          };
          targetPan = { ...pan };
        });
        app.canvas.addEventListener("pointerup", (e: PointerEvent) => {
          if (!drag) return;
          if (!moved && e.button === 0) {
            const rect = app.canvas.getBoundingClientRect(),
              x = (e.clientX - rect.left - world.x) / world.scale.x,
              y = (e.clientY - rect.top - world.y) / world.scale.y;
            const a = latest.current.state.assets
              .map((a) => ({ ...a, ...mapPosition(a) }))
              .sort(
                (a, b) =>
                  Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
              )
              .find((a) => Math.hypot(a.x - x, a.y - y) < 18 / world.scale.x);
            const hit = hitLabels.find(
              (r) => Math.abs(x - r.x) < r.w / 2 && Math.abs(y - r.y) < r.h / 2,
            );
            if (a || hit) latest.current.onSelect(hit?.id ?? a!.id);
            else {
              let best = "",
                distance = 8 / world.scale.x;
              for (const l of latest.current.state.lines) {
                const p = busPositions[l.from],
                  q = busPositions[l.to],
                  t = Math.max(
                    0,
                    Math.min(
                      1,
                      ((x - p.x) * (q.x - p.x) + (y - p.y) * (q.y - p.y)) /
                        ((q.x - p.x) ** 2 + (q.y - p.y) ** 2),
                    ),
                  ),
                  d = Math.hypot(
                    x - p.x - t * (q.x - p.x),
                    y - p.y - t * (q.y - p.y),
                  );
                if (d < distance) {
                  distance = d;
                  best = l.id;
                }
              }
              latest.current.onSelect(best);
            }
          }
          drag = null;
        });
        app.canvas.addEventListener("pointercancel", () => {
          drag = null;
        });
        // Small isometric buildings, with windows that go dark when supply is lost.
        function building(
          x: number,
          y: number,
          w: number,
          h: number,
          color: number,
          lit = true,
        ) {
          const d = w * 0.42;
          graphics
            .poly([x - w / 2, y, x, y + d, x + w / 2, y, x, y - d])
            .fill(0x415c4a);
          graphics
            .poly([x - w / 2, y, x - w / 2, y - h, x, y - h + d, x, y + d])
            .fill(color);
          graphics
            .poly([x, y + d, x, y - h + d, x + w / 2, y - h, x + w / 2, y])
            .fill(0x4b665b);
          graphics
            .poly([
              x - w / 2,
              y - h,
              x,
              y - h - d,
              x + w / 2,
              y - h,
              x,
              y - h + d,
            ])
            .fill(0xc3c7b3);
          for (let row = 0; row < Math.floor(h / 9); row++) {
            graphics
              .rect(x - w * 0.32, y - h + 5 + row * 8, 3, 3)
              .fill(lit ? 0xffe5a5 : 0x526964);
            graphics
              .rect(x + 3, y - h + 6 + row * 8, 3, 3)
              .fill(lit ? 0xf3cb7b : 0x41584f);
          }
        }
        app.ticker.add((ticker) => {
          phase += ticker.deltaTime * 0.01;
          const {
            state: s,
            selected,
            zoom,
            reset,
            layer,
            language,
            focus,
          } = latest.current;
          if (s.outcome === "blackout" && collapseStart < 0)
            collapseStart = phase;
          if (s.outcome !== "blackout") collapseStart = -1;
          const collapse =
            collapseStart < 0 ? -1 : (phase - collapseStart) / 0.6;
          if (reset !== lastReset) {
            targetPan = { x: 0, y: 0 };
            lastReset = reset;
          }
          const width = app.screen.width,
            height = app.screen.height;
          const scale = Math.min(width / 1050, height / 1320) * zoom;
          // Overlay dimensions are screen pixels, independent of geographic zoom.
          overlayScale = 1 / scale;
          textResolution = Math.max(2, Math.ceil(window.devicePixelRatio));
          for (const text of cache.values()) text.visible = false;
          if (focus !== lastFocus) {
            const raw = s.assets.find((a) => a.id === selected);
            const a = raw ? { ...raw, ...mapPosition(raw) } : undefined;
            const l = s.lines.find((l) => l.id === selected);
            const point =
              a ??
              (l
                ? {
                    x: (busPositions[l.from].x + busPositions[l.to].x) / 2,
                    y: (busPositions[l.from].y + busPositions[l.to].y) / 2,
                  }
                : null);
            if (point) {
              const desired = l
                ? Math.max(
                    1.6,
                    Math.min(
                      2.4,
                      650 /
                        Math.max(
                          100,
                          Math.hypot(
                            busPositions[l.from].x - busPositions[l.to].x,
                            busPositions[l.from].y - busPositions[l.to].y,
                          ),
                        ),
                    ),
                  )
                : Math.max(zoom, 2.3);
              latest.current.onZoom(desired);
              const focusScale =
                Math.min(width / 1050, height / 1320) * desired;
              targetPan = {
                x: (750 - point.x) * focusScale,
                y: (600 - point.y) * focusScale,
              };
            }
            lastFocus = focus;
          }
          if (latest.current.controlsEnabled && !drag) {
            const speed = 7 * ticker.deltaTime;
            const edge =
              pointer &&
              pointer.x > 3 &&
              pointer.x < width - 3 &&
              pointer.y > 3 &&
              pointer.y < height - 3
                ? pointer
                : null;
            if (
              keys.has("KeyA") ||
              keys.has("ArrowLeft") ||
              (edge && edge.x < 22)
            )
              targetPan.x += speed;
            if (
              keys.has("KeyD") ||
              keys.has("ArrowRight") ||
              (edge && edge.x > width - 22)
            )
              targetPan.x -= speed;
            if (
              keys.has("KeyW") ||
              keys.has("ArrowUp") ||
              (edge && edge.y < 22)
            )
              targetPan.y += speed;
            if (
              keys.has("KeyS") ||
              keys.has("ArrowDown") ||
              (edge && edge.y > height - 22)
            )
              targetPan.y -= speed;
          }
          targetPan.x = Math.max(
            -600 * scale,
            Math.min(800 * scale, targetPan.x),
          );
          targetPan.y = Math.max(
            -600 * scale,
            Math.min(600 * scale, targetPan.y),
          );
          pan.x += (targetPan.x - pan.x) * Math.min(1, 0.18 * ticker.deltaTime);
          pan.y += (targetPan.y - pan.y) * Math.min(1, 0.18 * ticker.deltaTime);
          world.scale.set(scale);
          world.position.set(
            (width - 1500 * scale) / 2 + pan.x,
            (height - 1200 * scale) / 2 + pan.y - 12,
          );
          if (++frames % 10 === 0)
            setView({
              x: -world.x / scale,
              y: -world.y / scale,
              w: width / scale,
              h: height / scale,
            });
          graphics.clear();
          const hour = (s.time / 3600) % 24;
          terrain.tint =
            hour >= 19 || hour < 6
              ? 0x8594ad
              : s.weather === "Storm front"
                ? 0xa4b1b4
                : 0xffffff;
          if (s.restoration && s.unserved > s.demand * 0.1)
            terrain.tint = s.generation > 0 ? 0x7b8d94 : 0x4d6479;
          if (collapse >= 0) terrain.tint = collapse > 3 ? 0x364956 : 0x687768;
          label(
            "region1",
            language === "si" ? "උතුරු කලාපය" : "NORTHERN PROVINCE",
            650,
            220,
            0x36523c,
            12,
          );
          label(
            "region2",
            language === "si" ? "මධ්‍යම කඳුකරය" : "CENTRAL HIGHLANDS",
            940,
            820,
            0xb8caaa,
            11,
          );
          label(
            "region3",
            language === "si" ? "ඉන්දියන් සාගරය" : "INDIAN OCEAN",
            240,
            1050,
            0x75a3a0,
            13,
          );
          for (const a of s.assets
            .filter((a) => a.kind !== "bus")
            .map((a) => ({ ...a, ...mapPosition(a) }))) {
            const p = busPositions[a.bus];
            graphics
              .moveTo(a.x, a.y)
              .lineTo(p.x, p.y)
              .stroke({ color: 0x203e35, width: 4 * overlayScale, alpha: 0.2 });
            graphics
              .moveTo(a.x, a.y - 3 * overlayScale)
              .lineTo(p.x, p.y - 3 * overlayScale)
              .stroke({
                color:
                  a.online && s.outcome !== "blackout" ? 0xcbdca7 : 0x536668,
                width: 1.8 * overlayScale,
                alpha: 0.85,
              });
          }
          const projected = s.assets.map((a) => ({ ...a, ...mapPosition(a) }));
          const boxes: {
            id: string;
            x: number;
            y: number;
            w: number;
            h: number;
          }[] = [];
          const anchors = new Map<
            string,
            { x: number; y: number; w: number }
          >();
          const overlaps = (x: number, y: number, w: number, h: number) =>
            boxes.some(
              (b) =>
                Math.abs(x - b.x) < (w + b.w) / 2 + 4 * overlayScale &&
                Math.abs(y - b.y) < (h + b.h) / 2 + 4 * overlayScale,
            );
          for (const a of [...projected].sort(
            (a, b) => Number(b.id === selected) - Number(a.id === selected),
          )) {
            const name =
              a.kind === "bus" ? a.id : language === "si" ? a.nameSi : a.name;
            const w =
              overlayScale *
              (a.kind === "bus"
                ? 30
                : Math.max(100, name.length * (language === "si" ? 5.8 : 6.7)));
            const h = (a.kind === "bus" ? 19 : 34) * overlayScale;
            const preferred = a.y + (a.kind === "bus" ? 16 : 26) * overlayScale;
            const candidates = [
              { x: a.x, y: preferred },
              { x: a.x, y: a.y - 32 * overlayScale },
              ...[0, 40, -40, 80, -80, 120, -120].flatMap((dy) => [
                {
                  x: a.x + w / 2 + 22 * overlayScale,
                  y: a.y + dy * overlayScale,
                },
                { x: a.x - w / 2 - 22 * overlayScale, y: a.y + dy * overlayScale },
              ]),
            ];
            const point =
              candidates.find(
                (p) =>
                  !overlaps(p.x, p.y + 7 * overlayScale, w, h) &&
                  projected.every(
                    (b) =>
                      b.id === a.id ||
                      Math.abs(p.x - b.x) > w / 2 + 12 * overlayScale ||
                      Math.abs(p.y + 7 * overlayScale - b.y) >
                        h / 2 + 12 * overlayScale,
                  ),
              ) ?? (a.id === selected ? candidates[0] : undefined);
            if (!point) continue;
            anchors.set(a.id, { ...point, w });
            boxes.push({
              id: a.id,
              x: point.x,
              y: point.y + 7 * overlayScale,
              w,
              h,
            });
          }
          hitLabels = [...boxes];
          for (const [lineIndex, l] of s.lines.entries()) {
            const p = busPositions[l.from],
              q = busPositions[l.to],
              ratio = Math.abs(l.flow) / l.capacity,
              color = !(
                l.online ||
                (collapse >= 0 && collapse < lineIndex * 0.16)
              )
                ? l.tripReason
                  ? 0xe77b70
                  : 0x51665b
                : ratio > 1
                  ? 0xff7769
                  : ratio > 0.8
                    ? 0xffce7b
                    : 0xe2f4ab;
            graphics
              .moveTo(p.x, p.y + 4 * overlayScale)
              .lineTo(q.x, q.y + 4 * overlayScale)
              .stroke({
                color: 0x263c31,
                width: 5 * overlayScale,
                alpha: 0.18,
              });
            graphics
              .moveTo(p.x, p.y - 3 * overlayScale)
              .lineTo(q.x, q.y - 3 * overlayScale)
              .stroke({
                color,
                width: (selected === l.id ? 4 : 2.3) * overlayScale,
                alpha:
                  l.online || (collapse >= 0 && collapse < lineIndex * 0.16)
                    ? 1
                    : l.tripReason
                      ? 0.8
                      : 0.3,
              });
            if (selected === l.id) {
              for (const point of [p, q])
                graphics
                  .circle(
                    point.x,
                    point.y,
                    (20 + Math.sin(phase * 6) * 4) * overlayScale,
                  )
                  .stroke({
                    color: 0xffd78c,
                    width: 3 * overlayScale,
                    alpha: 0.9,
                  });
              graphics
                .moveTo(p.x, p.y - 3 * overlayScale)
                .lineTo(q.x, q.y - 3 * overlayScale)
                .stroke({
                  color: 0xffed9c,
                  width: 14 * overlayScale,
                  alpha: 0.35,
                });
              graphics
                .moveTo(p.x, p.y - 3 * overlayScale)
                .lineTo(q.x, q.y - 3 * overlayScale)
                .stroke({ color: 0xffed9c, width: 4 * overlayScale });
            }
            if (!l.online && l.tripReason) {
              const mx = (p.x + q.x) / 2,
                my = (p.y + q.y) / 2;
              graphics
                .circle(mx, my, (14 + Math.sin(phase * 5) * 3) * overlayScale)
                .stroke({
                  color: 0xff796c,
                  width: 2 * overlayScale,
                  alpha: 0.8,
                });
              graphics
                .moveTo(mx - 5 * overlayScale, my - 5 * overlayScale)
                .lineTo(mx + 5 * overlayScale, my + 5 * overlayScale)
                .moveTo(mx + 5 * overlayScale, my - 5 * overlayScale)
                .lineTo(mx - 5 * overlayScale, my + 5 * overlayScale)
                .stroke({ color: 0xffb49f, width: 3 * overlayScale });
            }
            // Pylons visibly carry the transmission routes.
            for (const t of [0.28, 0.72]) {
              const x = p.x + (q.x - p.x) * t,
                y = p.y + (q.y - p.y) * t;
              graphics
                .save()
                .setTransform(
                  overlayScale,
                  0,
                  0,
                  overlayScale,
                  x * (1 - overlayScale),
                  y * (1 - overlayScale),
                );
              graphics
                .moveTo(x - 4, y + 4)
                .lineTo(x, y - 12)
                .lineTo(x + 4, y + 4)
                .moveTo(x - 6, y - 7)
                .lineTo(x + 6, y - 7)
                .moveTo(x - 3, y - 1)
                .lineTo(x + 3, y - 1)
                .stroke({ color: 0x475a4b, width: 1.3 });
              graphics.restore();
            }
            if (l.online && !s.paused) {
              for (let j = 0; j < 5; j++) {
                let t = (phase * (0.4 + Math.abs(l.flow) / 250) + j / 5) % 1;
                if (l.flow < 0) t = 1 - t;
                const x = p.x + (q.x - p.x) * t,
                  y = p.y + (q.y - p.y) * t - 3 * overlayScale;
                graphics
                  .circle(x, y, 5 * overlayScale)
                  .fill({ color, alpha: 0.13 })
                  .circle(x, y, 2 * overlayScale)
                  .fill(color);
              }
            }
            const candidates = [0.5, 0.3, 0.7, 0.18, 0.82].flatMap((t) =>
              [-14, 14, -35, 35].map((offset) => ({
                x: p.x + (q.x - p.x) * t,
                y: p.y + (q.y - p.y) * t + offset * overlayScale,
              })),
            );
            const spot = candidates.find(
              (p) =>
                !overlaps(p.x, p.y, 86 * overlayScale, 20 * overlayScale) &&
                projected.every(
                  (a) =>
                    Math.abs(p.x - a.x) > 24 * overlayScale ||
                    Math.abs(p.y - (a.y - 12 * overlayScale)) >
                      24 * overlayScale,
                ),
            );
            if (!spot) {
              if (cache.has(l.id)) cache.get(l.id)!.text = "";
              continue;
            }
            const mx = spot.x,
              my = spot.y;
            boxes.push({
              id: l.id,
              x: mx,
              y: my,
              w: 86 * overlayScale,
              h: 20 * overlayScale,
            });
            hitLabels.push({
              id: l.id,
              x: mx,
              y: my,
              w: 86 * overlayScale,
              h: 20 * overlayScale,
            });
            graphics
              .roundRect(
                mx - 43 * overlayScale,
                my - 10 * overlayScale,
                86 * overlayScale,
                20 * overlayScale,
                6 * overlayScale,
              )
              .fill({ color: 0x203b31, alpha: 0.9 });
            label(
              l.id,
              !l.online
                ? language === "si"
                  ? `${l.id} · විසන්ධි`
                  : `${l.id} · ${l.tripReason ? "TRIPPED" : "OPEN"}`
                : layer === "loading"
                  ? `${l.id} · ${Math.round(ratio * 100)}%`
                  : `${l.id} · ${Math.round(Math.abs(l.flow))} MW`,
              mx,
              my,
              color,
              10,
            );
          }
          for (const [assetIndex, a] of s.assets
            .map((a) => ({ ...a, ...mapPosition(a) }))
            .entries()) {
            const { x, y } = a,
              active = a.id === selected,
              lit =
                (collapse >= 0 ? collapse < assetIndex * 0.08 : a.online) &&
                (a.kind !== "load" ||
                  (collapse >= 0 && collapse < assetIndex * 0.08) ||
                  (a.output > 0 &&
                    (a.served ?? a.output) >= a.output * 0.85)) &&
                !a.shed;
            if (s.restoration && a.kind === "load" && (a.served ?? 0) > 1)
              graphics.circle(x, y, 23 * overlayScale).fill({
                color: 0xffdd83,
                alpha: 0.08 + 0.15 * (a.pickup ?? 0),
              });
            const iconScale = 0.4 * overlayScale;
            graphics
              .save()
              .setTransform(
                iconScale,
                0,
                0,
                iconScale,
                x * (1 - iconScale),
                y * (1 - iconScale),
              );
            graphics
              .ellipse(
                x + 7,
                y + 10,
                a.kind === "bus" ? 17 : 36,
                a.kind === "bus" ? 7 : 15,
              )
              .fill({ color: 0x2c4639, alpha: 0.25 });
            if (active) {
              graphics
                .circle(x, y, 44 + Math.sin(phase * 6) * 5)
                .stroke({ color: 0xffe5a1, width: 3, alpha: 0.7 });
              graphics
                .moveTo(x - 58, y)
                .lineTo(x - 40, y)
                .moveTo(x + 40, y)
                .lineTo(x + 58, y)
                .moveTo(x, y - 58)
                .lineTo(x, y - 40)
                .stroke({ color: 0xffe5a1, width: 2 });
              graphics
                .ellipse(x, y + 6, 43, 24)
                .stroke({ color: 0xf8edb5, width: 2 });
              graphics
                .ellipse(x, y + 6, 49 + Math.sin(phase * 3) * 2, 28)
                .stroke({ color: 0xf8edb5, width: 1, alpha: 0.3 });
            }
            if (a.kind === "coal" || a.kind === "oil") {
              building(x - 10, y, 34, 23, 0xa8aca1, lit);
              building(x + 15, y + 4, 24, 16, 0x8f9890, lit);
              for (let j = 0; j < 2; j++) {
                graphics
                  .rect(x - 20 + j * 17, y - 43, 8, 24)
                  .fill(0xb9b8a8)
                  .rect(x - 20 + j * 17, y - 43, 8, 5)
                  .fill(0xa47562);
                if (a.online)
                  for (let k = 0; k < 3; k++) {
                    const t = (phase * 0.7 + k / 3) % 1;
                    graphics
                      .circle(
                        x - 16 + j * 17 + t * 10,
                        y - 47 - t * 28,
                        4 + t * 7,
                      )
                      .fill({ color: 0xe2e3d4, alpha: (1 - t) * 0.32 });
                  }
              }
            } else if (a.kind === "hydro") {
              graphics
                .poly([
                  x - 29,
                  y - 8,
                  x + 19,
                  y - 16,
                  x + 30,
                  y + 10,
                  x - 18,
                  y + 20,
                ])
                .fill(0xb9c6b6);
              for (let j = 0; j < 4; j++)
                graphics
                  .moveTo(x - 17 + j * 10, y - 8)
                  .lineTo(x - 10 + j * 10, y + 13)
                  .stroke({ color: 0x779b98, width: 5 });
              building(x - 18, y - 8, 20, 16, 0xd6d5bc, lit);
            } else if (a.kind === "wind") {
              for (let j = 0; j < 3; j++) {
                const wx = x - 25 + j * 24,
                  wy = y + (j % 2) * 12;
                graphics
                  .moveTo(wx, wy)
                  .lineTo(wx, wy - 37)
                  .stroke({ color: 0xe2e4ce, width: 3 });
                for (let k = 0; k < 3; k++) {
                  const angle =
                    (a.online && !s.paused ? phase * 2 : 0) +
                    (k * Math.PI * 2) / 3;
                  graphics
                    .moveTo(wx, wy - 37)
                    .lineTo(
                      wx + Math.cos(angle) * 19,
                      wy - 37 + Math.sin(angle) * 19,
                    )
                    .stroke({ color: 0xf1edcf, width: 2.5 });
                }
              }
            } else if (a.kind === "solar") {
              for (let row = 0; row < 3; row++)
                for (let col = 0; col < 3; col++) {
                  const sx = x - 28 + col * 20 + row * 6,
                    sy = y - 17 + row * 13;
                  graphics
                    .poly([
                      sx,
                      sy,
                      sx + 15,
                      sy - 5,
                      sx + 21,
                      sy + 4,
                      sx + 5,
                      sy + 9,
                    ])
                    .fill(0x42677b)
                    .stroke({ color: 0x8cadb0, width: 1 });
                  graphics
                    .moveTo(sx + 8, sy - 2)
                    .lineTo(sx + 13, sy + 6)
                    .stroke({ color: 0xa3c1ba, width: 0.6 });
                }
            } else if (a.kind === "battery") {
              for (let j = 0; j < 3; j++) {
                building(
                  x - 22 + j * 21,
                  y + (j % 2) * 5,
                  19,
                  19,
                  0xd2cfb0,
                  lit,
                );
                graphics
                  .rect(x - 28 + j * 21, y - 12 + (j % 2) * 5, 3, 9)
                  .fill(s.battery > 0 ? 0xb9e998 : 0x796e5a);
              }
            } else if (a.kind === "bus") {
              graphics
                .poly([x - 15, y + 3, x, y - 5, x + 16, y + 3, x, y + 12])
                .fill(0xadb9a4);
              graphics
                .rect(x - 9, y - 12, 5, 15)
                .fill(0x677a6d)
                .rect(x + 5, y - 12, 5, 15)
                .fill(0x677a6d);
              graphics
                .moveTo(x - 14, y - 10)
                .lineTo(x + 15, y - 10)
                .stroke({ color: 0xd4dcba, width: 3 });
            } else {
              const industrial = a.id === "D3";
              building(x - 23, y + 3, 22, industrial ? 14 : 25, 0xcac4a6, lit);
              building(x + 19, y + 3, 24, industrial ? 18 : 36, 0xa3b3a3, lit);
              building(x - 3, y + 13, 27, industrial ? 18 : 43, 0xd5ceb1, lit);
              if (industrial) {
                graphics.rect(x + 20, y - 37, 5, 21).fill(0xa79378);
              }
              if (!lit) {
                graphics.circle(x + 32, y - 28, 9).fill(0xc56b50);
                label(
                  a.id + "out",
                  "!",
                  x + 32 * iconScale,
                  y - 28 * iconScale,
                  0xffeac1,
                  9,
                );
              } else if (cache.has(a.id + "out"))
                cache.get(a.id + "out")!.text = "";
            }
            if (a.kind === "hydro") {
              graphics.ellipse(x + 28, y + 9, 24, 12).fill(0x405f54);
              graphics
                .ellipse(
                  x + 28,
                  y + 9,
                  24 * Math.max(0.15, a.water! / a.waterMax!),
                  12 * Math.max(0.2, a.water! / a.waterMax!),
                )
                .fill(0x74b4bc);
            }
            if (a.protectionTimer && a.protectionTimer > 0) {
              graphics.circle(x, y - 25, 32).stroke({
                color: 0xff9e69,
                width: 2,
                alpha: 0.5 + 0.4 * Math.sin(phase * 6),
              });
            }
            graphics.restore();
            if (!anchors.has(a.id)) continue;
            const labelY = anchors.get(a.id)!.y,
              labelX = anchors.get(a.id)!.x,
              name =
                a.kind === "bus" ? a.id : language === "si" ? a.nameSi : a.name;
            const labelWidth =
              overlayScale *
              (a.kind === "bus"
                ? 30
                : Math.max(100, name.length * (language === "si" ? 5.8 : 6.7)));
            if (Math.hypot(labelX - x, labelY - y) > 25 * overlayScale)
              graphics
                .moveTo(x, y)
                .lineTo(labelX, labelY)
                .stroke({
                  color: active ? 0xffe5a1 : 0xb9c8a4,
                  width: overlayScale,
                  alpha: active ? 0.8 : 0.5,
                });
            graphics
              .roundRect(
                labelX - labelWidth / 2,
                labelY - 10 * overlayScale,
                labelWidth,
                (a.kind === "bus" ? 19 : 34) * overlayScale,
                5 * overlayScale,
              )
              .fill({ color: 0x213c31, alpha: active ? 0.97 : 0.83 });
            label(
              a.id + "name",
              name,
              labelX,
              labelY,
              active ? 0xf8edb5 : 0xe5ead5,
              a.kind === "bus" ? 10 : 11,
            );
            label(
              a.id + "value",
              a.kind === "bus"
                ? ""
                : a.kind === "battery"
                  ? `${Math.round(s.battery)} MWh`
                  : `${Math.round(a.kind === "load" ? (a.served ?? a.output) : a.output)} MW${a.shed ? " ↓" : ""}`,
              labelX,
              labelY + 14 * overlayScale,
              a.online ? 0xb8d39f : 0xdbaa87,
              9,
            );
          }
          if (s.weather === "Storm front") {
            for (let i = 0; i < 34; i++) {
              const x = 300 + ((i * 97 + phase * 95) % 950),
                y = (i * 71 + phase * 140) % 1130;
              graphics
                .moveTo(x, y)
                .lineTo(x - 5, y + 12)
                .stroke({ color: 0xd4e2df, width: 1, alpha: 0.25 });
            }
          }
        });
        observer = new ResizeObserver(() => app.resize());
        observer.observe(host.current!);
      } catch (error) {
        console.error(error);
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      observer?.disconnect();
      cleanup();
      if (app.renderer) app.destroy(true, { children: true });
    };
  }, []);
  return (
    <div
      ref={host}
      className="pixi-map"
      aria-label={
        props.language === "si"
          ? "ශ්‍රී ලංකා විදුලි ජාල සිතියම. බලාගාරයක් තෝරන්න; සිතියම ඇද ගෙන යන්න."
          : "Sri Lanka power grid map. Select an asset; drag to explore."
      }
    >
      <div className="rts-minimap" data-camera-ui>
        <span>
          {props.language === "si" ? "උපායික සිතියම" : "TACTICAL MAP"}{" "}
          <b>N ↑</b>
        </span>
        <svg
          viewBox="320 0 800 1240"
          role="img"
          aria-label={
            props.language === "si"
              ? "කුඩා සිතියම මත ඔබා කැමරාව ගෙනයන්න"
              : "Click minimap to move camera"
          }
          onPointerDown={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            const unit = Math.min(r.width / 800, r.height / 1240);
            navigate.current(
              320 + (e.clientX - r.left - (r.width - 800 * unit) / 2) / unit,
              (e.clientY - r.top - (r.height - 1240 * unit) / 2) / unit,
            );
          }}
        >
          {coastline.map((ring, i) => (
            <polygon
              key={i}
              points={ring
                .reduce<string[]>((v, n, j) => {
                  if (j % 2 === 0) v.push(`${n},${ring[j + 1]}`);
                  return v;
                }, [])
                .join(" ")}
              fill="#708e78"
            />
          ))}
          {props.state.lines.map((l) => (
            <line
              key={l.id}
              x1={busPositions[l.from].x}
              y1={busPositions[l.from].y}
              x2={busPositions[l.to].x}
              y2={busPositions[l.to].y}
              stroke={
                l.id === props.selected
                  ? "#fff5bb"
                  : !l.online
                    ? "#ed7a6d"
                    : "#b3cb9c"
              }
              strokeWidth={l.id === props.selected ? 10 : 4}
            />
          ))}
          {props.state.assets
            .filter((a) => a.kind !== "bus")
            .map((a) => {
              const q = mapPosition(a);
              return (
                <circle
                  key={a.id}
                  cx={q.x}
                  cy={q.y}
                  r={a.id === props.selected ? 13 : 6}
                  fill={
                    a.id === props.selected
                      ? "#ffe3a0"
                      : a.online
                        ? "#dcebb9"
                        : "#ed7a6d"
                  }
                />
              );
            })}
          <rect
            x={view.x}
            y={view.y}
            width={view.w}
            height={view.h}
            fill="#ecedbd10"
            stroke="#ffe3a0"
            strokeWidth="6"
          />
          <path
            d="M 355 1170 V 1184 H 472 V 1170"
            fill="none"
            stroke="#bfd2b2"
            strokeWidth="5"
          />
          <text x="355" y="1145" fontSize="48" fill="#bfd2b2">
            50 km
          </text>
        </svg>
      </div>
      {failed && (
        <div className="map-error">
          Your browser could not render the island. Try a browser with WebGL
          enabled.
        </div>
      )}
    </div>
  );
}
