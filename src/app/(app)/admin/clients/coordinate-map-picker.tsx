"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useState } from "react";
import { Map, type MapLayerMouseEvent, Marker } from "react-map-gl/maplibre";

// OpenStreetMap raster tiles via a plain style spec — no account or API key
// needed, so this works from a fresh clone (execution plan, Section 2:
// "MapLibre GL via react-map-gl, OpenStreetMap tiles ... local development
// works from a fresh clone").
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

// Falls back to the DRC's rough center when the client has no coordinates
// yet, so the picker still opens on a sensible view rather than the
// (0,0) null-island default.
const DEFAULT_CENTER = { latitude: -4.0383, longitude: 21.7587, zoom: 4.5 };

type CoordinateMapPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onChange: (coords: { latitude: number; longitude: number }) => void;
  disabled?: boolean;
};

export function CoordinateMapPicker({
  latitude,
  longitude,
  onChange,
  disabled,
}: CoordinateMapPickerProps) {
  const hasPoint = latitude !== null && longitude !== null;
  const [viewState, setViewState] = useState(
    hasPoint ? { latitude, longitude, zoom: 12 } : DEFAULT_CENTER,
  );

  function handleClick(event: MapLayerMouseEvent) {
    if (disabled) return;
    const { lat, lng } = event.lngLat;
    onChange({ latitude: lat, longitude: lng });
  }

  return (
    <div className="h-64 w-full overflow-hidden rounded-md border border-border">
      <Map
        {...viewState}
        onMove={(event) => setViewState(event.viewState)}
        onClick={handleClick}
        mapStyle={OSM_STYLE}
        cursor={disabled ? "default" : "crosshair"}
      >
        {hasPoint ? <Marker latitude={latitude} longitude={longitude} /> : null}
      </Map>
    </div>
  );
}
