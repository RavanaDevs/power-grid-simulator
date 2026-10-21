"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, GripHorizontal, X } from "lucide-react";
import { translate, type Language } from "@/game/i18n";
let front = 20;
export default function GameWindow({
  id,
  title,
  children,
  onClose,
  language,
  openToken = 0,
  layout = 0,
  foldToken = 0,
}: {
  id: string;
  title: string;
  children: ReactNode;
  onClose: () => void;
  language: Language;
  openToken?: number;
  layout?: number;
  foldToken?: number;
}) {
  const [collapsed, setCollapsed] = useState(false),
    [position, setPosition] = useState<{ x: number; y: number } | null>(null),
    [z, setZ] = useState(20);
  const host = useRef<HTMLElement>(null),
    drag = useRef<{ x: number; y: number; left: number; top: number } | null>(
      null,
    );
  const t = translate(language);
  useEffect(() => {
    setCollapsed(false);
    setZ(++front);
  }, [openToken]);
  useEffect(() => {
    if (
      openToken === 0 &&
      (id === "mission" || (innerWidth <= 650 && id === "fleet"))
    )
      setCollapsed(true);
  }, [id]);
  useEffect(() => {
    setPosition(null);
    setCollapsed(
      openToken === 0 &&
        (id === "mission" || (innerWidth <= 650 && id === "fleet")),
    );
  }, [layout]);
  useEffect(() => {
    if (foldToken > 0) setCollapsed(true);
  }, [foldToken]);
  useEffect(() => {
    const fit = () => {
      const r = host.current?.getBoundingClientRect();
      if (r)
        setPosition((p) =>
          p
            ? {
                x: Math.max(8, Math.min(innerWidth - r.width - 8, p.x)),
                y: Math.max(70, Math.min(innerHeight - r.height - 105, p.y)),
              }
            : p,
        );
    };
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <section
      ref={host}
      className={`game-window window-${id} ${collapsed ? "is-collapsed" : ""}`}
      style={{
        zIndex: z,
        ...(position
          ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
          : {}),
      }}
      aria-label={title}
      onPointerDownCapture={() => setZ(++front)}
    >
      <header
        className="window-titlebar"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          const r = host.current!.getBoundingClientRect();
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            left: r.left,
            top: r.top,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const w = host.current!.offsetWidth;
          setPosition({
            x: Math.max(
              8,
              Math.min(innerWidth - w - 8, d.left + e.clientX - d.x),
            ),
            y: Math.max(
              70,
              Math.min(
                innerHeight - host.current!.offsetHeight - 105,
                d.top + e.clientY - d.y,
              ),
            ),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <GripHorizontal size={13} />
        <span>{title}</span>
        <button
          aria-label={`${collapsed ? t("Expand", "විහිදුවන්න") : t("Collapse", "හකුළන්න")} ${title}`}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button
          aria-label={`${t("Close", "වසන්න")} ${title}`}
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </header>
      <div className="window-body" hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}
