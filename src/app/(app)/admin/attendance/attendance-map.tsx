"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useMemo, useState } from "react";
import { Layer, Map as MapGL, Marker, Source } from "react-map-gl/maplibre";

// Same tile source as coordinate-map-picker.tsx — no account/API key
// needed, so local development works from a fresh clone.
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

const DEFAULT_CENTER = { latitude: -4.0383, longitude: 21.7587, zoom: 4.5 };

export type AttendanceMapPoint = {
  id: string;
  kind: "check-in" | "check-out";
  latitude: number;
  longitude: number;
  label: string;
};

// Read-only — unlike coordinate-map-picker.tsx, there's no click-to-set
// handler here; this just plots the already-recorded check-in (one marker
// style) and check-out (another) points for the filtered report.
function centerFor(points: AttendanceMapPoint[]) {
  const first = points[0];
  return first
    ? { latitude: first.latitude, longitude: first.longitude, zoom: 10 }
    : DEFAULT_CENTER;
}

export function AttendanceMap({ points }: { points: AttendanceMapPoint[] }) {
  const [viewState, setViewState] = useState(() => centerFor(points));

  // Recenters whenever the underlying data actually changes (a new
  // `points` array arrives after a filter change navigates to a new URL
  // and the Server Component re-fetches) — adjusted synchronously during
  // render (React's documented "adjusting state when a prop changes"
  // pattern, same as territory-picker.tsx's prevValue/query resync) rather
  // than in a useEffect, which would cause an extra render pass. Without
  // this, the map would keep whatever pan/zoom position it last had even
  // after filtering to a completely different employee's records.
  const [prevPoints, setPrevPoints] = useState(points);
  if (points !== prevPoints) {
    setPrevPoints(points);
    setViewState(centerFor(points));
  }

  // Pairs a check-in and check-out sharing the same session id (set by
  // the caller — see page.tsx) into a connecting line, so it's visually
  // obvious which red dot belongs to which green dot when a delegate
  // checked in and out from different spots.
  const sessionLines = useMemo(() => {
    const bySession = new Map<
      string,
      Partial<Record<AttendanceMapPoint["kind"], AttendanceMapPoint>>
    >();
    for (const point of points) {
      const entry = bySession.get(point.id) ?? {};
      entry[point.kind] = point;
      bySession.set(point.id, entry);
    }

    const features = [...bySession.values()]
      .filter((entry) => entry["check-in"] && entry["check-out"])
      .map((entry) => ({
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [entry["check-in"]!.longitude, entry["check-in"]!.latitude],
            [entry["check-out"]!.longitude, entry["check-out"]!.latitude],
          ],
        },
      }));

    return { type: "FeatureCollection" as const, features };
  }, [points]);

  return (
    <div className="h-80 w-full overflow-hidden rounded-md border border-border">
      <MapGL {...viewState} onMove={(event) => setViewState(event.viewState)} mapStyle={OSM_STYLE}>
        {sessionLines.features.length > 0 ? (
          <Source id="attendance-session-lines" type="geojson" data={sessionLines}>
            <Layer
              id="attendance-session-lines-layer"
              type="line"
              paint={{ "line-color": "#6b7280", "line-width": 2, "line-dasharray": [2, 1.5] }}
            />
          </Source>
        ) : null}

        {points.map((point) => (
          <Marker
            key={`${point.id}-${point.kind}`}
            latitude={point.latitude}
            longitude={point.longitude}
          >
            <div
              title={point.label}
              className={
                point.kind === "check-in"
                  ? "h-3 w-3 rounded-full border-2 border-white bg-green-600"
                  : "h-3 w-3 rounded-full border-2 border-white bg-red-600"
              }
            />
          </Marker>
        ))}
      </MapGL>
    </div>
  );
}
