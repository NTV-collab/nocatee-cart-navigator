import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadCartGraph, type CartGraph } from "../lib/cart-data";
import { CartRouter, type RouteResult, type MapPoint } from "../lib/cart-core";
import { DESTINATIONS, type Destination } from "../lib/destinations";
import NavMap from "../components/NavMap";
import { listTrails, saveTrail, upsertTrail } from "../lib/api/trails.functions";

export const Route = createFileRoute("/")({
  component: Index,
});

const toRad = (d: number) => (d * Math.PI) / 180;

function nextTurnAngle(route: RouteResult): number {
  const pts = route?.points;
  if (!pts || pts.length < 2) return 0;
  const brg = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
    const x =
      Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
      Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  };
  const b0 = brg(pts[0], pts[1]);
  if (route.steps[0]?.kind === "turn" && pts.length > 2) {
    const b1 = brg(pts[1], pts[2]);
    return (b1 - b0 + 540) % 360 - 180;
  }
  return b0;
}

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
  const [locBannerDismissed, setLocBannerDismissed] = useState(false);
  useEffect(() => {
    if (!locError) setLocBannerDismissed(false);
  }, [locError]);
  const [satellite, setSatellite] = useState(false);
  const [evOverlay, setEvOverlay] = useState(false);
  const [evOpacity, setEvOpacity] = useState(0.55);
  const [driving, setDriving] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<MapPoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [trails, setTrails] = useState<{ id: number; name: string; geom: [number, number][]; kind: "path" | "road" }[]>([]);
  const [drawKind, setDrawKind] = useState<"path" | "road">("path");
  const [movePin, setMovePin] = useState(false);
  const [pinOverrides, setPinOverrides] = useState<Record<string, [number, number]>>({});
  const [pinNotice, setPinNotice] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [netView, setNetView] = useState(false);
  const exportRef = useRef<(() => void) | null>(null);
  const locWatch = useRef<number | null>(null);
  const trackingRef = useRef(false);
  trackingRef.current = tracking;
  const routerRef = useRef<CartRouter | null>(null);
  const leafletMap = useRef<any>(null);

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

  // load community-drawn trails and make them routable
  useEffect(() => {
    let alive = true;
    listTrails()
      .then(({ trails: rows }) => {
        if (!alive) return;
        const parsed: { id: number; name: string; geom: [number, number][]; kind: "path" | "road" }[] = [];
        for (const r of rows) {
          try {
            const g: unknown = JSON.parse(r.geom);
            if (Array.isArray(g) && g.length > 1 && Array.isArray(g[0])) {
              parsed.push({ id: r.id, name: r.name ?? "", geom: g as [number, number][], kind: r.kind === "road" ? "road" : "path" });
            }
          } catch {}
        }
        setTrails(parsed);
        const ov: Record<string, [number, number]> = {};
        for (const t of parsed) {
          if (t.name && t.geom.length) ov[t.name] = t.geom[0];
          routerRef.current?.addExternalTrail(t.geom, undefined, t.kind === "road");
        }
        setPinOverrides(ov);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
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
      if (movePin) {
        const label = end?.label ?? null;
        setEnd((prev) =>
          prev ? { lat: p.lat, lng: p.lng, label: prev.label } : { lat: p.lat, lng: p.lng },
        );
        setMovePin(false);
        if (label) {
          upsertTrail({ data: { name: label, geom: JSON.stringify([[p.lat, p.lng], [p.lat, p.lng]]) } })
            .then(() => {
              setPinNotice("Pin saved (lat " + p.lat.toFixed(6) + ", lng " + p.lng.toFixed(6) + ")");
              window.setTimeout(() => setPinNotice(null), 6000);
            })
            .catch(() => setPinNotice("Could not save the pin. Try again."));
        } else {
          setPinNotice("Moved (no name to save)");
          window.setTimeout(() => setPinNotice(null), 3000);
        }
        return;
      }
      if (drawing) {
        setDraft((prev) => [...prev, p]);
        return;
      }
      if (driving) return; // route is locked while driving
      if (pickMode === "start") {
        setStart(p);
        setPickMode("end"); // next tap sets the destination
      } else {
        setEnd(p);
        if (!start) setPickMode("start"); // next tap sets the start
      }
    },
    [pickMode, start, driving, drawing, movePin, end],
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
      const ov = pinOverrides[d.name];
      const pt: MapPoint = ov
        ? { lat: ov[0], lng: ov[1], label: d.name }
        : { lat: d.lat, lng: d.lng, label: d.name };
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
    [pickMode, start, locateMe, pinOverrides],
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

  const saveDraft = useCallback(async () => {
    if (draft.length < 2) return;
    setSaving(true);
    try {
      const geo = draft.map((p) => [p.lat, p.lng]) as [number, number][];
      await saveTrail({ data: { geom: JSON.stringify(geo), kind: drawKind } });
      routerRef.current?.addExternalTrail(geo, undefined, drawKind === "road");
      setTrails((prev) => [...prev, { id: Date.now(), name: "", geom: geo, kind: drawKind }]);
      setDraft([]);
      setDrawing(false);
    } finally {
      setSaving(false);
    }
  }, [draft, drawKind]);

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
        evOverlay={evOverlay}
        evOpacity={evOpacity}
        trails={trails}
        draftPoints={draft}
        onToggleSatellite={() => setSatellite((v) => !v)}
        onMapClick={onMapClick}
        onReady={() => setReady(true)}
        onMapReady={(m) => {
          leafletMap.current = m;
        }}
        netView={netView}
        exportRef={exportRef}
      />

      {/* location feedback banner */}
      {pinNotice && (
        <div className="absolute left-1/2 top-40 z-[650] w-[max-content] max-w-md -translate-x-1/2 rounded-lg border border-cn-teal/40 bg-cn-paper/95 px-4 py-2 text-[12px] font-medium text-cn-teal-deep shadow-lg backdrop-blur-sm">
          {pinNotice}
        </div>
      )}
      {locError && !locBannerDismissed && (
        <div className="absolute left-1/2 top-24 z-[650] flex w-[92%] max-w-md -translate-x-1/2 items-start gap-2 rounded-lg border border-cn-clay/40 bg-cn-paper/95 px-3.5 py-2.5 text-[12px] leading-snug text-cn-ink shadow-lg backdrop-blur-sm">
          <span className="flex-1">{locError}</span>
          <button
            onClick={() => setLocBannerDismissed(true)}
            aria-label="Dismiss location notice"
            className="grid size-6 shrink-0 place-items-center rounded-full text-cn-ink-soft transition hover:bg-cn-sand-deep hover:text-cn-ink"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}

      {!driving && (
        <>
          {/* top scrim + Google-style From/To search card */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] bg-gradient-to-b from-cn-ink/30 via-cn-ink/10 to-transparent pb-12 pt-3">
            <div className="pointer-events-auto mx-auto w-full max-w-sm px-2 sm:px-3">
              <div className="rounded-2xl border border-cn-line bg-cn-paper/95 shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3 px-4 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-full bg-cn-teal text-[11px] font-semibold text-white">CN</span>
                    <span className="text-[14px] font-semibold tracking-tight text-cn-ink">Nocatee Cart Navigator</span>
                    
                  </div>
                  <span className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-cn-ink-soft sm:block">EV path GPS</span>
                </div>
                <div className="p-2">
                  <div
                    className="flex items-center gap-1.5 rounded-lg border border-cn-line bg-white px-2 py-1 transition focus-within:border-cn-teal"
                    onClick={() => setSearchTarget("end")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" />
                    </svg>
                    <input
                      value={searchTarget === "end" ? search : end?.label ?? ""}
                      onChange={(e) => {
                        setSearchTarget("end");
                        setSearch(e.target.value);
                      }}
                      onFocus={() => setSearchTarget("end")}
                      placeholder="Where to? (Town Center, Splash...)"
                      aria-label="Where to"
                      className="w-full bg-transparent text-[14px] font-medium outline-none placeholder:text-cn-ink-soft/50"
                    />
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        locateMe();
                      }}
                      disabled={locating}
                      title="Point A = my location"
                      aria-label="Use my location"
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-cn-mist text-cn-teal-deep transition hover:bg-cn-teal hover:text-white active:scale-95 disabled:opacity-50"
                    >
                      {locateIcon}
                    </button>
                  </div>
                  <p className="mt-1.5 px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-cn-ink-soft">
                    Point A is your live location
                  </p>

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
              onClick={() => setNetView((v) => !v)}
              aria-label={netView ? "Show map" : "Network view"}
              title={netView ? "Show map" : "Show only the network"}
              className={
                "grid size-11 place-items-center rounded-full border shadow-md transition active:scale-95 " +
                (netView ? "border-cn-teal bg-cn-teal text-white" : "border-cn-line bg-white/95 text-cn-ink-soft hover:text-cn-teal-deep")
              }
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="6" cy="6" r="2.2" />
                <circle cx="18" cy="6" r="2.2" />
                <circle cx="12" cy="18" r="2.2" />
                <path d="M7.8 7 10.5 16M16.2 7l-3.2 9" />
              </svg>
            </button>
            {netView && (
              <button
                onClick={() => exportRef.current?.()}
                aria-label="Export PNG"
                title="Export current map as PNG"
                className="grid size-11 place-items-center rounded-full border border-cn-teal bg-white/95 text-cn-teal-deep shadow-md transition active:scale-95 hover:bg-cn-teal hover:text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M12 15V3" />
                </svg>
              </button>
            )}
            <div className="flex flex-col gap-1 rounded-full border border-cn-line bg-white/95 p-1 shadow-md">
              <button
                onClick={() => leafletMap.current?.zoomIn()}
                aria-label="Zoom in"
                className="grid size-8 place-items-center rounded-full text-cn-ink-soft transition hover:bg-cn-mist hover:text-cn-teal-deep active:scale-95"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <div className="h-px w-5 bg-cn-line" />
              <button
                onClick={() => leafletMap.current?.zoomOut()}
                aria-label="Zoom out"
                className="grid size-8 place-items-center rounded-full text-cn-ink-soft transition hover:bg-cn-mist hover:text-cn-teal-deep active:scale-95"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h14" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => setDrawing((v) => !v)}
              title={drawing ? "Stop drawing" : "Draw a trail"}
              aria-label={drawing ? "Stop drawing" : "Draw a trail"}
              className={
                "grid size-11 place-items-center rounded-full border shadow-md transition active:scale-95 " +
                (drawing ? "border-cn-ink bg-cn-ink text-white" : "border-cn-line bg-white/95 text-cn-ink-soft hover:text-cn-teal-deep")
              }
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 17l10.5-10.5a2.1 2.1 0 0 1 3 3L6 20H3v-3Z" />
                <path d="m13.5 6.5 3 3" />
              </svg>
            </button>
            {drawing && (
              <div className="flex flex-col items-end gap-1.5 rounded-xl border border-cn-line bg-white/95 p-2 shadow-md">
                <span className="font-mono text-[9px] uppercase tracking-wide text-cn-ink-soft">
                  Drawing {drawKind === "road" ? "street" : "trail"} ({draft.length} pts)
                </span>
                <div className="flex items-center gap-1 rounded-full bg-cn-sand-deep p-0.5">
                  <button
                    onClick={() => setDrawKind("path")}
                    className={
                      "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition " +
                      (drawKind === "path" ? "bg-cn-teal text-white" : "text-cn-ink-soft")
                    }
                  >
                    Path
                  </button>
                  <button
                    onClick={() => setDrawKind("road")}
                    className={
                      "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition " +
                      (drawKind === "road" ? "bg-[#43618c] text-white" : "text-cn-ink-soft")
                    }
                  >
                    Road
                  </button>
                </div>
                <button
                  onClick={() => saveDraft()}
                  disabled={draft.length < 2 || saving}
                  className="rounded-full bg-cn-teal px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setDraft((prev) => prev.slice(0, -1))}
                  disabled={!draft.length}
                  className="text-[11px] font-medium text-cn-ink-soft underline underline-offset-2 disabled:opacity-40"
                >
                  Undo point
                </button>
                <button
                  onClick={() => { setDraft([]); setDrawing(false); }}
                  className="text-[11px] font-medium text-cn-clay underline underline-offset-2"
                >
                  Cancel
                </button>
              </div>
            )}
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
                        onClick={() => setMovePin((v) => !v)}
                        className={
                          "text-[12px] font-medium underline decoration-cn-line underline-offset-4 transition " +
                          (movePin ? "text-cn-teal-deep" : "text-cn-ink-soft hover:text-cn-teal-deep")
                        }
                      >
                        {movePin ? "Tap map to move pin..." : "Move pin"}
                      </button>
                      <button
                        onClick={() => setShowSteps(true)}
                        className="text-[12px] font-medium text-cn-ink-soft underline decoration-cn-line underline-offset-4 hover:text-cn-teal-deep"
                      >
                        Turns
                      </button>
                      <button
                        onClick={clearAll}
                        className="text-[12px] font-medium text-cn-ink-soft underline decoration-cn-line underline-offset-4 hover:text-cn-teal-deep"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <ol className="space-y-1.5">{route.steps.slice(0, 1).map((n) => (<li key={0} className="flex items-center gap-2 px-1"><span className="grid size-7 shrink-0 place-items-center rounded-full border border-cn-line bg-white text-cn-ink shadow-sm"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ transform: `rotate(${nextTurnAngle(route)}deg)` }} aria-hidden="true"><path d="M12 3l6.5 7.5h-4.2V21h-4.6V10.5H5.5L12 3z" /></svg></span><span className="min-w-0 flex-1 truncate text-[13px] font-medium text-cn-ink">{n ? n.text : "Arrive at destination"}</span>{route.steps.length > 1 && (<span className="shrink-0 rounded-full bg-cn-mist px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-cn-ink-soft">+{route.steps.length - 1} turns</span>)}</li>))}</ol>
                </div>
              )}
              {noRoute && (
                <div className="mb-2 rounded-2xl border border-cn-clay/60 bg-cn-paper/95 p-4 text-[13px] leading-relaxed text-cn-ink backdrop-blur-sm">
                  No cart path connects those two points. If one side is across I-95, carts cannot cross there. Try a point
                  closer to the destination.
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/90">
                    Pick a destination
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSteps(true)}
                    className="rounded-full border border-cn-line bg-white px-4 py-2 text-[13px] font-semibold text-cn-ink transition hover:text-cn-teal-deep active:scale-95"
                  >
                    Turns
                  </button>
                  <button
                    onClick={endDrive}
                    className="rounded-full border border-cn-line bg-white px-4 py-2 text-[13px] font-semibold text-cn-ink-soft transition hover:border-cn-clay hover:text-cn-clay active:scale-95"
                  >
                    End Drive
                  </button>
                </div>
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
              <ol className="space-y-1.5">{route.steps.slice(0, 1).map((n) => (<li key={0} className="flex items-center gap-2 px-1"><span className="grid size-7 shrink-0 place-items-center rounded-full border border-cn-line bg-white text-cn-ink shadow-sm"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ transform: `rotate(${nextTurnAngle(route)}deg)` }} aria-hidden="true"><path d="M12 3l6.5 7.5h-4.2V21h-4.6V10.5H5.5L12 3z" /></svg></span><span className="min-w-0 flex-1 truncate text-[13px] font-medium text-cn-ink">{n ? n.text : "Arrive at destination"}</span>{route.steps.length > 1 && (<span className="shrink-0 rounded-full bg-cn-mist px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-cn-ink-soft">+{route.steps.length - 1} turns</span>)}</li>))}</ol>
            </div>
          </div>
        </>
      )}

      {showSteps && route && (
        <div className="absolute inset-0 z-[800] flex items-end justify-center bg-cn-ink/40 backdrop-blur-[1px] sm:items-center sm:pb-0">
          <div className="flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-cn-paper shadow-2xl">
            <div className="flex items-center justify-between border-b border-cn-line px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cn-ink-soft">
                Turn by turn · {route.steps.length} steps
              </p>
              <button
                onClick={() => setShowSteps(false)}
                aria-label="Close turn-by-turn"
                className="grid size-8 place-items-center rounded-full text-cn-ink-soft transition hover:bg-cn-sand-deep hover:text-cn-ink"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <ol className="space-y-3 overflow-y-auto px-4 py-4">
              {route.steps.map((st, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className={
                      "mt-0.5 shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] " +
                      (st.kind === "arrive"
                        ? "bg-cn-ink text-white"
                        : st.kind === "turn"
                          ? "bg-cn-mist text-cn-teal-deep"
                          : st.kind === "cross"
                            ? "bg-cn-sand-deep text-cn-clay"
                            : "bg-cn-mist text-cn-ink-soft")
                    }
                  >
                    {st.kind === "arrive" ? "OK" : i + 1}
                  </span>
                  <span className="text-[13px] leading-snug text-cn-ink">
                    {st.text}
                    {st.dist > 0 && (
                      <span className="ml-2 font-mono text-[11px] text-cn-ink-soft">{fmtMeters(st.dist)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between border-t border-cn-line px-4 py-3 text-[12px] text-cn-ink-soft">
              <span>
                {fmtMeters(route.meters)} · about {route.minutes} min
              </span>
              <button
                onClick={() => {
                  setShowSteps(false);
                  clearAll();
                }}
                className="font-medium text-cn-ink-soft underline decoration-cn-line underline-offset-4 hover:text-cn-teal-deep"
              >
                Clear route
              </button>
            </div>
          </div>
        </div>
      )}

      {/* tiny attribution line */}
      <div className="absolute bottom-1 left-2 z-[300] rounded-md bg-white/70 px-1.5 py-0.5 font-mono text-[9px] text-cn-ink-soft">
        OpenStreetMap & cart-path data · blue = saved streets \u00b7 green = saved trails \u00b7 red = not permitted · not affiliated with Nocatee
      </div>
    </div>
  );
}