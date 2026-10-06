"use client";

import { useCallback, useState } from "react";

export type GeolocationFix = {
  lat: number;
  lng: number;
  accuracy: number;
  deviceTimestamp: string;
};

// Each failure mode needs its own user-facing message (denied: a permission
// problem the user can fix in browser settings; unavailable: the device
// itself can't get a fix, e.g. location services off; timeout: a fix might
// still work, just try again) — lumping them into one generic error loses
// exactly the information a delegate needs to act on.
export type GeolocationState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "success"; fix: GeolocationFix }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "timeout" };

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({ status: "idle" });

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "unavailable" });
      return;
    }

    setState({ status: "requesting" });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: "success",
          fix: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            deviceTimestamp: new Date(position.timestamp).toISOString(),
          },
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setState({ status: "denied" });
        } else if (error.code === error.TIMEOUT) {
          setState({ status: "timeout" });
        } else {
          setState({ status: "unavailable" });
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, request, reset };
}
