import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadCartGraph, type CartGraph } from "../lib/cart-data";
import { CartRouter, type RouteResult, type MapPoint } from "../lib/cart-core";
import { DESTINATIONS, type Destination } from "../lib/destinations";
import NavMap from "../components/NavMap";

export const Route = createFileRoute("/")({
  component: Index,
});

const fmtMeters = (m: number): string => {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
};

function Index() {
  const [graph, setGraph] = useState<CartGraph | null>(null);
  const [graphError, setGraphError] = useState(false);
  const [ready, setReady] = useState(false);
  const [start, setStart] = useState<MapPoint | null>(null);
  const [end, setEnd] = useState<MapPoint | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [noRoute, setNoRoute] = useState(false);
  const [pickMode, setPickMode] = useState<"start" | "end">("end");
  const [search, setSearch] = useState("");
  const [searchTarget, setSearchTarget] = useState<"start" | "end">("end");
  const [locating, setLocating] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [locPos, setLocPos] = useState<MapPoint | null>(null);
  const [locAcc, setLocAcc] = useState<number | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [driving, setDriving] = useState(false);
  const locWatch = useRef<number | null>(null);
  const trackingRef = useRef(false);
  trackingRef.current = tracking;
  const routerRef = useRef<CartRouter | null>(null);

  useEffect(() => {
    let alive = true;
    loadCartGraph()
      .then((g) => {
        if (!alive) return;
        setGraph(g);
        routerRef.current = new CartRouter(g);
      })
      .catch(() => {
        if (alive) setGraphError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // safety net: never leave the user on a blocking loading screen
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 5000);
    return () => window.clearTimeout(t);
  }, []);

  // stop live tracking when the page unmounts
  useEffect(() => {
    return () => {
      if (locWatch.current != null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(locWatch.current);
        locWatch.current = null;
      }
    };
  }, []);

  // auto-start live location on open: the cart icon appears as soon as the
  // browser grants permission, and follows while tracking/driving.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocError("This browser does not support location.");
      return;
    }
    if (locWatch.current != null) return;
    locWatch.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocError(null);
        const pt: MapPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "My location" };
        setLocPos(pt);
        setLocAcc(pos.coords.accuracy ?? null);
        if (trackingRef.current) {
          setStart(pt);
        }
      },
      () => {
        setLocError("Location is off or blocked. Enable it in your browser settings to see your cart on the map.");
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recompute route whenever start/end change
  useEffect(() => {
    const r = routerRef.current;
    if (!r || !start || !end) {
      setRoute(null);
      setNoRoute(false);
      return;
    }
    const a = r.nearest(start.lat, start.lng);
    const b = r.nearest(end.lat, end.lng);
    const res = r.route(a, b);
    if (!res) {
      setRoute(null);
      setNoRoute(true);
    } else {
      setNoRoute(false);
      setRoute(res);
    }
  }, [start, end, graph]);

  const onMapClick = useCallback(
    (p: MapPoint) => {
      if (driving) return; // route is locked while driving
      if (pickMode === "start") {
        setStart(p);
        setPickMode("end"); // next tap sets the destination
      } else {
        setEnd(p);
        if (!start) setPickMode("start"); // next tap sets the start
      }
    },
    [pickMode, start, driving],
  );

  const locateMe = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLocError(null);
        const pt: MapPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "My location" };
        setStart(pt);
        setPickMode("end");
        setSearch("");
        setLocPos(pt);
        setLocAcc(pos.coords.accuracy ?? null);
      },
      () => {
        setLocating(false);
        setLocError("Could not get your location. Check the permission for this site in your browser settings.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, []);

  const toggleTracking = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setTracking((v) => !v);
    if (locWatch.current == null) {
      locWatch.current = navigator.geolocation.watchPosition(
        (pos) => {
          setLocError(null);
          const pt: MapPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "My location" };
          setLocPos(pt);
          setLocAcc(pos.coords.accuracy ?? null);
          if (trackingRef.current) setStart(pt);
        },
        () => {
          setLocError("Location is off or blocked. Enable it in your browser settings to see your cart on the map.");
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
      );
    }
  }, []);

  const pickDestination = useCallback(
    (d: Destination, target?: "start" | "end") => {
      const t = target ?? pickMode;
      const pt: MapPoint = { lat: d.lat, lng: d.lng, label: d.name };
      if (t === "start") {
        setStart(pt);
        setSearchTarget("end");
        setPickMode("end");
      } else {
        setEnd(pt);
        setSearchTarget("start");
        setPickMode("start");
        if (!start) locateMe();
      }
      setSearch("");
    },
    [pickMode, start, locateMe],
  );

  const clearAll = useCallback(() => {
    setStart(null);
    setEnd(null);
    setRoute(null);
    setNoRoute(false);
    setDriving(false);
    setTracking(false);
    setPickMode("end");
    setSearch("");
    setSearchTarget("end");
  }, []);

  const setActiveInput = useCallback((t: "start" | "end") => {
    setSearchTarget(t);
    setPickMode(t);
  }, []);

  const startDrive = useCallback(() => {
    if (!route) return;
    setDriving(true);
    setTracking(true);
  }, [route]);

  const endDrive = useCallback(() => {
    setDriving(false);
    setTracking(false);
  }, []);

  const filtered = search.trim()
    ? DESTINATIONS.filter((d) => (d.name + " " + d.sub).toLowerCase().includes(search.trim().toLowerCase()))
    : DESTINATIONS;

  const fromValue = searchTarget === "start" ? search : (start?.label ?? "");
  const toValue = searchTarget === "end" ? search : (end?.label ?? "");
  const showResults = search.trim() !== "";

  const crosshairIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
  const layersIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 2 10 5-10 5L2 7l10-5Z" />
      <path d="m2 12 10 5 10-5" />
      <path d="m2 17 10 5 10-5" />
    </svg>
  );
  const locateIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" />
    </svg>
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-cn-sand text-cn-ink font-display">
      <h1 className="sr-only">Nocatee Cart Navigator, golf cart directions for Nocatee Florida</h1>

      {!ready && (
        <div className="absolute inset-0 z-[900] grid place-items-center bg-cn-mist">
          <div className="text-center">
            <p className="font-mono text-[11px] tracking-[0.2em] text-cn-ink-soft uppercase">Loading the neighborhood map</p>
            {graphError && <p className="mt-2 text-[13px] text-cn-clay">Map data failed to load. Please refresh.</p>}
          </div>
        </div>
      )}

      <NavMap
        graph={graph}
        start={start}
        end={end}
        route={route}
        pickMode={pickMode}
        locPos={locPos}
        locAcc={locAcc}
        follow={tracking}
        satellite={satellite}
        onToggleSatellite={() => setSatellite((v) => !v)}
        onMapClick={onMapClick}
        onReady={() => setReady(true)}
      />

      {/* location feedback banner */}
      {locError && (
        <div className="absolute left-1/2 top-24 z-[650] w-[92%] max-w-md -translate-x-1/2 rounded-xl border border-cn-clay/50 bg-cn-paper/95 px-4 py-2.5 text-[12px] leading-snug text-cn-ink shadow-lg backdrop-blur-sm">
          {locError}
        </div>
      )}

      {!driving && (
        <>
          {/* top scrim + Google-style From/To search card */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] bg-gradient-to-b from-cn-ink/30 via-cn-ink/10 to-transparent pb-12 pt-3">
            <div className="pointer-events-auto mx-auto w-full max-w-xl px-3 sm:px-4">
              <div className="rounded-2xl border border-cn-line bg-cn-paper/95 shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3 px-4 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-full bg-cn-teal text-[11px] font-semibold text-white">CN</span>
                    <span className="text-[14px] font-semibold tracking-tight">Nocatee Cart Navigator</span>
                  </div>
                  <span className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-cn-ink-soft sm:block">EV path GPS</span>
                </div>
                <div className="p-3">
                  <div
                    className="flex items-center gap-2 rounded-xl border border-cn-line bg-white px-3 py-2 transition focus-within:border-cn-teal"
                    onClick={() => setActiveInput("start")}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cn-teal text-[11px] font-bold text-white">A</span>
                    <input
                      value={fromValue}
                      onChange={(e) => {
                        setSearchTarget("start");
                        setSearch(e.target.value);
                      }}
                      onFocus={() => setActiveInput("start")}
                      placeholder="From: your street, home..."
                      aria-label="From"
                      className="w-full bg-transparent text-[14px] font-medium outline-none placeholder:text-cn-ink-soft/50"
                    />
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        locateMe();
                      }}
                      disabled={locating}
                      title="Use my location"
                      aria-label="Use my location"
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-cn-mist text-cn-teal-deep transition hover:bg-cn-teal hover:text-white active:scale-95 disabled:opacity-50"
                    >
                      {locateIcon}
                    </button>
                  </div>
                  <div className="mx-[13px] h-4 w-px bg-cn-line" />
                  <div
                    className="flex items-center gap-2 rounded-xl border border-cn-line bg-white px-3 py-2 transition focus-within:border-cn-ink"
                    onClick={() => setActiveInput("end")}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cn-ink text-[11px] font-bold text-white">B</span>
                    <input
                      value={toValue}
                      onChange={(e) => {
                        setSearchTarget("end");
                        setSearch(e.target.value);
                      }}
                      onFocus={() => setActiveInput("end")}
                      placeholder="Destination (Town Center, Splash...)"
                      className="w-full bg-transparent text-[14px] font-medium outline-none placeholder:text-cn-ink-soft/50"
                    />
                    <span className="shrink-0 rounded-full bg-cn-mist px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-cn-ink-soft">
                      {pickMode === "start" ? "tap map = A" : "tap map = B"}
                    </span>
                  </div>

                  {showResults && (
                    <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-cn-line bg-white shadow-sm">
                      {filtered.map((d) => (
                        <li key={d.name}>
                          <button
                            onClick={() => pickDestination(d, searchTarget)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-cn-mist active:scale-[0.99]"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-semibold text-cn-ink">{d.name}</span>
                              <span className="block truncate text-[11px] text-cn-ink-soft">{d.sub}</span>
                            </span>
                            <span className="shrink-0 rounded-full bg-cn-mist px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-cn-ink-soft">
                              {d.zone === "west" ? "west" : d.group}
                            </span>
                          </button>
                        </li>
                      ))}
                      {filtered.length === 0 && <li className="px-3 py-2 text-[12px] text-cn-ink-soft">No destinations match.</li>}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* map controls top right */}
          <div className="absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
            <button
              onClick={toggleTracking}
              title={tracking ? "Stop following my location" : "Follow my location live"}
              aria-label={tracking ? "Stop live tracking" : "Start live tracking"}
              className={
                "grid size-11 place-items-center rounded-full border shadow-md transition active:scale-95 " +
                (tracking ? "border-cn-teal bg-cn-teal text-white" : "border-cn-line bg-white/95 text-cn-ink-soft hover:text-cn-teal-deep")
              }
            >
              {crosshairIcon}
            </button>
            <button
              onClick={() => setSatellite((v) => !v)}
              title={satellite ? "Show street map" : "Show satellite view"}
              aria-label={satellite ? "Show street map" : "Show satellite view"}
              className={
                "grid size-11 place-items-center rounded-full border shadow-md transition active:scale-95 " +
                (satellite ? "border-cn-ink bg-cn-ink text-white" : "border-cn-line bg-white/95 text-cn-ink-soft hover:text-cn-ink")
              }
            >
              {layersIcon}
            </button>
            {tracking && (
              <span className="rounded-full bg-cn-teal px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.14em] text-white shadow">
                LIVE
              </span>
            )}
          </div>

          {/* bottom: trip card + destination chips */}
          <div className="absolute inset-x-0 bottom-0 z-[500] flex flex-col gap-2 bg-gradient-to-t from-cn-ink/35 via-cn-ink/10 to-transparent px-3 pb-3 pt-8 sm:px-4">
            <div className="mx-auto w-full max-w-3xl">
              {route && (
                <div className="cn-fade-in mb-2 max-h-[38dvh] overflow-y-auto rounded-2xl border border-cn-teal/40 bg-cn-paper/95 p-4 shadow-lg backdrop-blur-sm">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xl font-semibold tracking-tight">
                      {fmtMeters(route.meters)}
                      <span className="ml-2 text-[13px] font-normal text-cn-ink-soft">about {route.minutes} min</span>
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={startDrive}
                        className="rounded-full bg-cn-teal px-4 py-2 text-[13px] font-semibold text-white shadow-md transition hover:bg-cn-teal-deep active:scale-95"
                      >
                        Start Drive
                      </button>
                      <button
                        onClick={clearAll}
                        className="text-[12px] font-medium text-cn-ink-soft underline decoration-cn-line underline-offset-4 hover:text-cn-teal-deep"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <ol className="space-y-2">
                    {route.steps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-snug">
                        <span
                          className={
                            "mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] " +
                            (s.kind === "arrive"
                              ? "bg-cn-ink text-white"
                              : s.kind === "turn"
                                ? "bg-cn-mist text-cn-teal-deep"
                                : s.kind === "cross"
                                  ? "bg-cn-sand-deep text-cn-clay"
                                  : "bg-cn-mist text-cn-ink-soft")
                          }
                        >
                          {s.kind === "arrive" ? "OK" : i + 1}
                        </span>
                        <span className="text-[13px] text-cn-ink">
                          {s.text}
                          {s.dist > 0 && <span className="ml-1.5 font-mono text-[11px] text-cn-ink-soft">{fmtMeters(s.dist)}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {noRoute && (
                <div className="mb-2 rounded-2xl border border-cn-clay/60 bg-cn-paper/95 p-4 text-[13px] leading-relaxed text-cn-ink backdrop-blur-sm">
                  No cart path connects those two points. If one side is across I-95, carts cannot cross there. Try a point
                  closer to the destination.
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="hidden shrink-0 items-center gap-1 rounded-full border border-cn-line bg-white/95 p-1 shadow-sm sm:flex">
                  <button
                    onClick={() => setActiveInput("start")}
                    className={
                      "rounded-full px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide transition " +
                      (pickMode === "start" ? "bg-cn-teal text-white" : "text-cn-ink-soft hover:text-cn-teal-deep")
                    }
                  >
                    Set A
                  </button>
                  <button
                    onClick={() => setActiveInput("end")}
                    className={
                      "rounded-full px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide transition " +
                      (pickMode === "end" ? "bg-cn-ink text-white" : "text-cn-ink-soft hover:text-cn-ink")
                    }
                  >
                    Set B
                  </button>
                </div>
                <div className="flex-1">
                  <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/90">
                    Tap a chip to set {pickMode === "start" ? "point A" : "point B"}
                  </p>
                  <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
                    {DESTINATIONS.map((d) => (
                      <button
                        key={d.name}
                        onClick={() => pickDestination(d)}
                        className="flex shrink-0 flex-col items-start rounded-xl border border-white/60 bg-white/95 px-3 py-1.5 text-left shadow-sm transition hover:border-cn-teal hover:shadow-md active:scale-[0.98]"
                      >
                        <span className="text-[12px] font-semibold text-cn-ink">{d.name}</span>
                        <span className="font-mono text-[9px] uppercase tracking-wide text-cn-ink-soft">
                          {d.zone === "west" ? "west side" : d.group}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {driving && route && (
        <>
          {/* drive HUD: top */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] pt-3">
            <div className="pointer-events-auto mx-auto w-[94%] max-w-xl rounded-2xl border border-cn-teal/50 bg-cn-paper/95 p-4 shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cn-teal-deep">Driving</p>
                  <p className="text-xl font-semibold tracking-tight">
                    {fmtMeters(route.meters)}
                    <span className="ml-2 text-[13px] font-normal text-cn-ink-soft">about {route.minutes} min</span>
                  </p>
                </div>
                <button
                  onClick={endDrive}
                  className="rounded-full border border-cn-line bg-white px-4 py-2 text-[13px] font-semibold text-cn-ink-soft transition hover:border-cn-clay hover:text-cn-clay active:scale-95"
                >
                  End Drive
                </button>
              </div>
              {route.steps[0] && (
                <p className="mt-2 flex items-center gap-2 rounded-xl bg-cn-mist px-3 py-2 text-[14px] font-medium text-cn-ink">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cn-teal font-mono text-[10px] text-white">1</span>
                  {route.steps[0].text}
                </p>
              )}
              {!locPos && (
                <p className="mt-2 text-[11px] leading-snug text-cn-clay">
                  No live location yet. Allow location in your browser to follow along as you drive.
                </p>
              )}
            </div>
          </div>

          {/* drive HUD: steps */}
          <div className="absolute inset-x-0 bottom-0 z-[500] max-h-[42dvh] overflow-y-auto px-3 pb-3 sm:px-4">
            <div className="mx-auto w-full max-w-xl rounded-2xl border border-cn-line bg-cn-paper/95 p-4 shadow-lg backdrop-blur-sm">
              <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-cn-ink-soft">Turn by turn</p>
              <ol className="space-y-2">
                {route.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-snug">
                    <span
                      className={
                        "mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] " +
                        (s.kind === "arrive"
                          ? "bg-cn-ink text-white"
                          : s.kind === "turn"
                            ? "bg-cn-mist text-cn-teal-deep"
                            : s.kind === "cross"
                              ? "bg-cn-sand-deep text-cn-clay"
                              : "bg-cn-mist text-cn-ink-soft")
                      }
                    >
                      {s.kind === "arrive" ? "OK" : i + 1}
                    </span>
                    <span className="text-[13px] text-cn-ink">
                      {s.text}
                      {s.dist > 0 && <span className="ml-1.5 font-mono text-[11px] text-cn-ink-soft">{fmtMeters(s.dist)}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      )}

      {/* tiny attribution line */}
      <div className="absolute bottom-1 left-2 z-[300] rounded-md bg-white/70 px-1.5 py-0.5 font-mono text-[9px] text-cn-ink-soft">
        OpenStreetMap & cart-path data · not affiliated with Nocatee
      </div>
    </div>
  );
}