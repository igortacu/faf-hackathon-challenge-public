import { useState } from "react";

import goatsArt from "@/assets/zones/goats.png";
import { MAP_H, MAP_W } from "@/features/map/constants";
import { GoatFarmPopup } from "@/features/goat-farm/components/goat-farm-popup";

interface GoatFarmMarkerProps {
  mapW: number;
  mapH: number;
}

const GOAT_FARM_POSITION = { x: 2480, y: 700 };

export function GoatFarmMarker({ mapW, mapH }: GoatFarmMarkerProps) {
  const [open, setOpen] = useState(false);
  const scaleX = mapW / MAP_W;
  const scaleY = mapH / MAP_H;
  const scale = Math.min(scaleX, scaleY);
  const x = GOAT_FARM_POSITION.x * scaleX;
  const y = GOAT_FARM_POSITION.y * scaleY;

  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
    >
      <button
        type="button"
        className="pointer-events-auto block rounded-md outline-none transition hover:scale-105 focus-visible:ring-4 focus-visible:ring-emerald-300/80"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open goat farm shop"
      >
        <img
          src={goatsArt}
          alt="Goat farm"
          draggable={false}
          className="select-none drop-shadow-xl"
          style={{ width: Math.max(150, 310 * scale) }}
        />
      </button>

      <GoatFarmPopup open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
