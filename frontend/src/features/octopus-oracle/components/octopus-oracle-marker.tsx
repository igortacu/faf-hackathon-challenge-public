import { useState } from "react";

import octopusArt from "@/assets/zones/octopus.png";
import { MAP_H, MAP_W } from "@/features/map/constants";
import { OctopusOraclePanel } from "@/features/octopus-oracle/components/octopus-oracle-panel";

interface OctopusOracleMarkerProps {
  mapW: number;
  mapH: number;
}

const OCTOPUS_POSITION = { x: 2850, y: 185 };

export function OctopusOracleMarker({ mapW, mapH }: OctopusOracleMarkerProps) {
  const [open, setOpen] = useState(false);
  const scaleX = mapW / MAP_W;
  const scaleY = mapH / MAP_H;
  const scale = Math.min(scaleX, scaleY);
  const x = OCTOPUS_POSITION.x * scaleX;
  const y = OCTOPUS_POSITION.y * scaleY;

  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
    >
      <button
        type="button"
        className="pointer-events-auto grid place-items-center rounded-full outline-none transition hover:scale-105 focus-visible:ring-4 focus-visible:ring-cyan-200/80"
        style={{ width: Math.max(230, 480 * scale) }}
        onClick={() => setOpen(true)}
        aria-label="Open Kiki's Octopus Oracle"
      >
        <img
          src={octopusArt}
          alt="Kiki's Octopus Oracle"
          draggable={false}
          className="w-full select-none drop-shadow-xl"
        />
      </button>

      <OctopusOraclePanel open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
