import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [locating, setLocating] = useState(false);
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

  const onMapClick = useCallback((p: MapPoint) => {
    if (pickMode === "start") setStart(p);
    else setEnd(p);
  }, [pickMode]);

  const locateMe = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "My location" });
        setPickMode("end");
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, []);

  const pickDestination = useCallback(
    (d: Destination) => {
      const pt: MapPoint = { lat: d.lat, lng: d.lng, label: d.name };
      if (pickMode === "start") {
        setStart(pt);
        setPickMode("end");
      } else {
        setEnd(pt);
        if (!start) setPickMode("start");
      }
      setSearch("");
    },
    [pickMode, start],
  );

  const clearAll = useCallback(() => {
    setStart(null);
    setEnd(null);
    setRoute(null);
    setNoRoute(false);
    setPickMode("end");
  }, []);

  const filtered = search.trim()
    ? DESTINATIONS.filter((d) => (d.name + " " + d.sub).toLowerCase().includes(search.trim().toLowerCase()))
    : DESTINATIONS;

    return (
    <div className="min-h-dvh bg-cn-sand text-cn-ink font-display">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-cn-teal text-[13px] font-semibold text-white tracking-tight">
            CN
          </span>
          <div className="leading-tight">
            <p className="text-[17px] font-semibold tracking-tight">Nocatee Cart Navigator</p>
            <p className="font-mono text-[10px] tracking-[0.18em] text-cn-ink-soft uppercase">EV path directions</p>
          </div>
        </div>
        <a
          href="#rules"
          className="rounded-full border border-cn-line bg-cn-paper px-4 py-2 text-sm font-medium text-cn-ink-soft transition hover:border-cn-teal hover:text-cn-teal-deep active:scale-[0.98]"
        >
          Cart rules
        </a>
      </header>

      <main>
        {/* ============ THE NAVIGATOR ============ */}
        <section className="mx-auto max-w-7xl px-5 pb-16 md:px-8">
          <div className="mb-6 max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-tighter leading-none md:text-5xl">
              Find your way around Nocatee by cart.
            </h1>
            <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-cn-ink-soft">
              Tap a destination, tap your starting point, and the navigator draws a route on the paths and 25 mph
              streets carts are allowed to use.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
            {/* control rail */}
            <aside className="flex flex-col gap-4">
              <div className="rounded-2xl border border-cn-line bg-cn-paper p-4 shadow-[0_1px_2px_rgb(20_43_43/0.06)]">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] tracking-[0.18em] text-cn-ink-soft uppercase">Trip</p>
                  {(start || end) && (
                    <button
                      onClick={clearAll}
                      className="text-[13px] font-medium text-cn-ink-soft underline decoration-cn-line underline-offset-4 transition hover:text-cn-teal-deep"
                    >
                      Clear route
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <button
                    onClick={() => setPickMode("start")}
                    className={
                      pickMode === "start"
                        ? "rounded-xl bg-cn-teal px-3 py-2.5 text-left text-sm font-medium text-white transition active:scale-[0.98]"
                        : "rounded-xl border border-cn-line bg-cn-sand px-3 py-2.5 text-left text-sm font-medium text-cn-ink-soft transition hover:border-cn-teal hover:text-cn-teal-deep active:scale-[0.98]"
                    }
                  >
                    <span className="block font-mono text-[9px] tracking-[0.16em] uppercase opacity-80">Point A</span>
                    {start ? start.label || "Picked on map" : "Set start"}
                  </button>
                  <button
                    onClick={() => setPickMode("end")}
                    className={
                      pickMode === "end"
                        ? "rounded-xl bg-cn-ink px-3 py-2.5 text-left text-sm font-semibold text-white transition active:scale-[0.98]"
                        : "rounded-xl border border-cn-line bg-cn-sand px-3 py-2.5 text-left text-sm font-medium text-cn-ink-soft transition hover:border-cn-ink hover:text-cn-ink active:scale-[0.98]"
                    }
                  >
                    <span className="block font-mono text-[9px] tracking-[0.16em] uppercase opacity-80">Point B</span>
                    {end ? end.label || "Picked on map" : "Set destination"}
                  </button>
                  <button
                    onClick={locateMe}
                    disabled={locating}
                    className="rounded-xl bg-cn-lagoon px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-cn-teal active:scale-[0.98] disabled:opacity-60"
                    title="Use my location"
                  >
                    {locating ? "…" : "Locate"}
                  </button>
                </div>
                <p className="mt-2 text-[12px] leading-snug text-cn-ink-soft">
                  {pickMode === "start"
                    ? "Point A is active: tap the map or pick a destination to set your start."
                    : start
                      ? "Point B is active: tap the map or pick a destination."
                      : "Pick a destination, then tap the map or press Locate to set your start."}
                </p>
              </div>

              <div className="rounded-2xl border border-cn-line bg-cn-paper p-4">
                <label htmlFor="dest-search" className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-cn-ink-soft uppercase">
                  Find a destination
                </label>
                <input
                  id="dest-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search parks, schools, shops..."
                  className="h-10 w-full rounded-xl border border-cn-line bg-white px-3 text-[14px] text-cn-ink placeholder:text-cn-ink-soft/60 focus:border-cn-teal focus:outline-none"
                />
                {search.trim() !== "" && (
                  <ul className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-cn-line bg-white">
                    {filtered.map((d) => (
                      <li key={d.name}>
                        <button
                          onClick={() => pickDestination(d)}
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
                    {filtered.length === 0 && (
                      <li className="px-3 py-2 text-[12px] text-cn-ink-soft">No destinations match.</li>
                    )}
                  </ul>
                )}
              </div>

              {/* route summary + steps */}
              {route && (
                <div className="cn-fade-in rounded-2xl border border-cn-teal/40 bg-cn-paper p-4 shadow-[0_1px_6px_rgba(30,124,102,0.12)]">
                  <div className="mb-3 flex items-baseline gap-4">
                    <p className="text-2xl font-semibold tracking-tight">
                      {fmtMeters(route.meters)}
                      <span className="ml-2 text-sm font-normal text-cn-ink-soft">about {route.minutes} min</span>
                    </p>
                  </div>
                  <ol className="space-y-2.5">
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
                <div className="cn-fade-in rounded-2xl border border-cn-clay/50 bg-cn-paper p-4 text-[13px] leading-relaxed text-cn-ink">
                  No cart path connects those two points from here. If one side of I-95 is involved, the route may not be rideable by cart. Try a point closer to the destination.
                </div>
              )}
            </aside>

            {/* map well */}
            <div className="relative h-[70dvh] overflow-hidden rounded-2xl border border-cn-line bg-cn-mist shadow-[0_2px_14px_rgba(20,43,43,0.08)] lg:h-[calc(70dvh+20px)] lg:min-h-[540px]">
              {!ready && (
                <div className="absolute inset-0 z-[500] grid place-items-center bg-cn-mist">
                  <div className="text-center">
                    <p className="font-mono text-[11px] tracking-[0.2em] text-cn-ink-soft uppercase">Loading the neighborhood map</p>
                    {graphError && (
                      <p className="mt-2 text-[13px] text-cn-clay">Map data failed to load. Please refresh.</p>
                    )}
                  </div>
                </div>
              )}
              <NavMap
                graph={graph}
                start={start}
                end={end}
                route={route}
                pickMode={pickMode}
                onMapClick={onMapClick}
                onReady={() => setReady(true)}
              />

              {/* destination chips */}
              <div className="absolute inset-x-0 bottom-0 z-[400] bg-gradient-to-t from-cn-paper via-cn-paper/95 to-transparent px-4 pt-10 pb-4">
                <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-cn-ink-soft uppercase">
                  Tap a chip to set {pickMode === "start" ? "point A" : "point B"}
                </p>
                <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
                  {DESTINATIONS.map((d) => (
                    <button
                      key={d.name}
                      onClick={() => pickDestination(d)}
                      className="flex shrink-0 flex-col items-start rounded-xl border border-cn-line bg-white/95 px-3 py-1.5 text-left shadow-sm transition hover:border-cn-teal hover:shadow-md active:scale-[0.98]"
                    >
                      <span className="text-[12px] font-semibold text-cn-ink">{d.name}</span>
                      <span className="font-mono text-[9px] tracking-wide text-cn-ink-soft uppercase">
                        {d.zone === "west" ? "west side" : d.group}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-cn-ink-soft font-mono">
            <span>Paths shown: green = multi-use trail · grey = street</span>
            <span>Speed assumed 15 mph</span>
            <span>OpenStreetMap data</span>
          </p>
        </section>

        {/* ============ HOW IT WORKS ============ */}
        <section className="border-y border-cn-line bg-cn-sand-deep/50">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-2 md:px-8">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Plan a ride in three taps</h2>
              <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-cn-ink-soft">
                The navigator only routes on the network carts may legally use: the community's multi-use paths and the
                streets posted 25 mph or less.
              </p>
            </div>
            <ol className="space-y-5">
              {[
                ["1", "Pick a destination", "Tap a chip like Town Center or Splash Waterpark."],
                ["2", "Set your start", "Tap the map, or press Locate to use where you are."],
                ["3", "Follow the trace", "The route draws itself, with turns and distances listed beside the map."],
              ].map(([n, t, d]) => (
                <li key={n} className="flex gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cn-ink font-mono text-[12px] font-medium text-white">
                    {n}
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold">{t}</p>
                    <p className="text-[13px] leading-relaxed text-cn-ink-soft">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ============ RULES ============ */}
        <section id="rules" className="mx-auto max-w-7xl px-5 py-16 md:px-8">
          <div className="grid gap-10 md:grid-cols-2">
            <div className="rounded-2xl border border-cn-line bg-cn-paper p-6">
              <p className="font-mono text-[10px] tracking-[0.18em] text-cn-ink-soft uppercase">Ride it right</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Where carts are allowed</h2>
              <ul className="mt-5 space-y-3 text-[14px] leading-relaxed text-cn-ink">
                <li className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cn-teal" />
                  Streets posted 25 mph or less that Nocatee has approved
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cn-teal" />
                  Designated golf cart multi-use paths with signage
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cn-clay" />
                  Not the parkways, berms, or limited access roads
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-cn-line bg-cn-paper p-7">
              <p className="font-mono text-[10px] tracking-[0.18em] text-cn-ink-soft uppercase">Before you go</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Cart rules of the road</h2>
              <ul className="mt-5 space-y-3 text-[14px] leading-relaxed text-cn-ink">
                <li className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cn-teal" />
                  Drivers at least 14, with a license or photo ID
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cn-teal" />
                  Yield to pedestrians and bicyclists at all times
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cn-teal" />
                  Horn or warning device on every cart
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cn-clay" />
                  Night rides: headlights, brakes, turn signals, windshield
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cn-clay" />
                  11 pm to 6 am only with a valid driver's license
                </li>
              </ul>
              <p className="mt-6 text-[12px] leading-relaxed text-cn-ink-soft">
                Per the Nocatee{" "}
                <a className="underline decoration-cn-teal underline-offset-2 hover:text-cn-teal-deep" href="https://www.nocatee.com/golfcartmap" target="_blank" rel="noreferrer">
                  Golf Cart Map
                </a>{" "}
                and St. Johns County ordinances. Signage on the ground always wins.
              </p>
            </div>
          </div>
        </section>

        {/* ============ ABOUT THE MAP ============ */}
        <section className="border-t border-cn-line bg-cn-paper">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:px-8">
            <img
              src="/assets/hero.jpg"
              alt="A teal golf cart driving along a Nocatee greenway path"
              className="aspect-[4/3] w-full rounded-2xl border border-cn-line object-cover shadow-[0_2px_14px_rgba(20,43,43,0.1)]"
              loading="lazy"
            />
            <div>
              <p className="font-mono text-[10px] tracking-[0.18em] text-cn-ink-soft uppercase">Open map data</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Built from the ground truth of the neighborhood</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-cn-ink">
                Routes are computed on a graph of the cart network in Nocatee: multi-use paths, trail sections, and low
                speed streets, clipped to the community boundary. The routing model follows the official EV path map and
                the published golf cart rules. It can change as the community changes.
              </p>
              <p className="mt-4 text-[14px] leading-relaxed text-cn-ink-soft">
                Built with <a className="underline decoration-cn-teal underline-offset-2 hover:text-cn-teal-deep" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>{" "}
                contributions and Nocatee's public <a className="underline decoration-cn-teal underline-offset-2 hover:text-cn-teal-deep" href="https://www.nocatee.com/lifestyle/electric-vehicle-paths/" target="_blank" rel="noreferrer">EV path map</a>.
                Not affiliated with Nocatee or The PARC Group.
              </p>
            </div>
          </div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="border-t border-cn-line">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 md:px-8">
            <p className="text-[13px] font-medium">Nocatee Cart Navigator</p>
            <p className="font-mono text-[10px] tracking-[0.18em] text-cn-ink-soft uppercase">
              Ponte Vedra, FL · Paths, parks, Town Center
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}