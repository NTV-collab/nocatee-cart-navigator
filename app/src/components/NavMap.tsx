import { useEffect, useRef, useState } from "react";
import type { CartGraph } from "../lib/cart-data";
import type { RouteResult, MapPoint } from "../lib/cart-core";

type Props = {
  graph: CartGraph | null;
  start: MapPoint | null;
  end: MapPoint | null;
  route: RouteResult | null;
  pickMode: "start" | "end";
  locPos: MapPoint | null;
  locAcc: number | null;
  follow: boolean;
  onMapClick: (p: MapPoint) => void;
  onReady: () => void;
};

const ROAD_MIN_ZOOM = 13.5;

export default function NavMap({ graph, start, end, route, pickMode, locPos, locAcc, follow, onMapClick, onReady }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const netLayers = useRef<{ paths?: any; roads?: any }>({});
  const routeGroup = useRef<any>(null);
  const baseStreet = useRef<any>(null);
  const baseSat = useRef<any>(null);
  const fallbackTried = useRef(false);
  const live = useRef({ graph, start, end, route, pickMode, locPos, locAcc, follow, onMapClick, onReady });
  live.current = { graph, start, end, route, pickMode, locPos, locAcc, follow, onMapClick, onReady };
  const readyFired = useRef(false);
  const [satellite, setSatellite] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Merge the raw edge list into continuous polylines (paths or roads).
  function buildChains(L: any, g: CartGraph, wantPath: boolean) {
    const m = g.edgesA.length;
    const adj = new Map<number, [number, number][]>();
    const lonOf = (i: number) => g.nodes[i * 2 + 1];
    const latOf = (i: number) => g.nodes[i * 2];
    for (let i = 0; i < m; i++) {
      if ((g.edgesPath[i] === 1) !== wantPath) continue;
      const a = g.edgesA[i];
      const b = g.edgesB[i];
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a)!.push([b, i]);
      adj.get(b)!.push([a, i]);
    }
    const used = new Set<number>();
    const chains: [number, number][][] = [];
    for (let seed = 0; seed < m; seed++) {
      if (used.has(seed) || (g.edgesPath[seed] === 1) !== wantPath) continue;
      used.add(seed);
      const a = g.edgesA[seed];
      const b = g.edgesB[seed];
      const chain: [number, number][] = [
        [lonOf(a), latOf(a)],
        [lonOf(b), latOf(b)],
      ];
      let cur = b;
      for (;;) {
        const nbs = adj.get(cur);
        let nxt: number | null = null;
        if (nbs) {
          for (const [to, j] of nbs) {
            if (!used.has(j)) {
              nxt = to;
              used.add(j);
              break;
            }
          }
        }
        if (nxt === null) break;
        chain.push([lonOf(nxt), latOf(nxt)]);
        cur = nxt;
      }
      cur = a;
      for (;;) {
        const nbs = adj.get(cur);
        let nxt: number | null = null;
        if (nbs) {
          for (const [to, j] of nbs) {
            if (!used.has(j)) {
              nxt = to;
              used.add(j);
              break;
            }
          }
        }
        if (nxt === null) break;
        chain.unshift([lonOf(nxt), latOf(nxt)]);
        cur = nxt;
      }
      chains.push(chain);
    }
    if (!chains.length) return null;
    return L.geoJSON(
      {
        type: "FeatureCollection",
        features: chains.map((coords) => ({
          type: "Feature",
          properties: { c: wantPath ? 1 : 0 },
          geometry: { type: "LineString", coordinates: coords },
        })),
      },
      {
        interactive: false,
        style: {
          color: wantPath ? "#1e7c66" : "#8d9a94",
          weight: wantPath ? 3.4 : 2.4,
          opacity: wantPath ? 0.85 : 0.55,
        },
      },
    );
  }

  function drawNetwork() {
    const L = LRef.current;
    const map = mapRef.current;
    const g = live.current.graph;
    if (!L || !map || !g || netLayers.current.paths) return;
    const paths = buildChains(L, g, true);
    const roads = buildChains(L, g, false);
    if (paths) {
      paths.addTo(map);
      netLayers.current.paths = paths;
    }
    if (roads) {
      netLayers.current.roads = roads;
    }
    const apply = () => {
      const roadsLayer = netLayers.current.roads;
      if (!roadsLayer) return;
      if (map.getZoom() >= ROAD_MIN_ZOOM) {
        if (!map.hasLayer(roadsLayer)) roadsLayer.addTo(map);
      } else if (map.hasLayer(roadsLayer)) {
        map.removeLayer(roadsLayer);
      }
    };
    map.on("zoomend", apply);
    apply();
  }

  // ---- init the map once, only once the container actually has size ----
  useEffect(() => {
    let disposed = false;
    let map: any = null;
    let ro: ResizeObserver | null = null;
    let attempts = 0;
    const el = holder.current;
    if (!el) return;

    const fixSize = () => {
      if (mapRef.current) mapRef.current.invalidateSize({ animate: false });
    };

    const createMap = () => {
      if (disposed || !holder.current) return;
      void import("leaflet")
        .then((Mod) => {
          if (disposed || !holder.current) return;
          const L = (Mod as any).default ?? Mod;
          LRef.current = L;
          map = L.map(holder.current, {
            zoomControl: false,
            attributionControl: true,
            preferCanvas: true,
            zoomAnimation: false,
            fadeAnimation: false,
            markerZoomAnimation: false,
          }).setView([30.095, -81.414], 13);

          // Primary: Google-Maps-style street style (CARTO Voyager).
          baseStreet.current = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            maxZoom: 20,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          });
          baseStreet.current.addTo(map);
          // If a tile fails to load (blocked or flaky network), fall back to
          // OpenStreetMap's own servers so the map always fills the screen.
          baseStreet.current.on("tileerror", () => {
            if (fallbackTried.current || !mapRef.current) return;
            fallbackTried.current = true;
            const L2 = LRef.current;
            const m2 = mapRef.current;
            if (!L2 || !m2) return;
            const osm = L2.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
              maxZoom: 19,
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            });
            m2.removeLayer(baseStreet.current);
            baseStreet.current = osm;
            osm.addTo(m2);
          });

          baseSat.current = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
            maxZoom: 19,
            attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
          });

          L.control.zoom({ position: "bottomright" }).addTo(map);
          map.on("click", (ev: any) => {
            live.current.onMapClick({ lat: ev.latlng.lat, lng: ev.latlng.lng });
          });
          mapRef.current = map;

          // Re-measure several times after mount: the container can be mid-layout
          // when the worker lands, and a single check can fire too early.
          [0, 150, 400, 800, 1500].forEach((t) => window.setTimeout(fixSize, t));
          ro = new ResizeObserver(fixSize);
          if (holder.current) ro.observe(holder.current);
          window.addEventListener("resize", fixSize);

          drawNetwork();
          if (!readyFired.current) {
            readyFired.current = true;
            live.current.onReady();
          }
          setMapReady(true);
        })
        .catch((err) => {
          console.error("leaflet failed to load", err);
        });
    };

    const waitForSize = () => {
      if (disposed) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if ((w > 60 && h > 60) || attempts >= 8) {
        createMap();
      } else {
        attempts += 1;
        window.setTimeout(waitForSize, 80);
      }
    };
    waitForSize();

    return () => {
      disposed = true;
      if (ro) ro.disconnect();
      window.removeEventListener("resize", fixSize);
      if (map) map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- street / satellite toggle ----
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    if (satellite) {
      if (!map.hasLayer(baseSat.current)) baseSat.current.addTo(map);
      if (map.hasLayer(baseStreet.current)) map.removeLayer(baseStreet.current);
    } else {
      if (!map.hasLayer(baseStreet.current)) baseStreet.current.addTo(map);
      if (map.hasLayer(baseSat.current)) map.removeLayer(baseSat.current);
    }
  }, [satellite, mapReady]);

  // ---- graph arrives: draw the network ----
  useEffect(() => {
    if (!graph) return;
    drawNetwork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // ---- start / end / route / location changes ----
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (routeGroup.current) {
      map.removeLayer(routeGroup.current);
      routeGroup.current = null;
    }
    const svg = L.svg({ padding: 0.5 });
    const group = L.layerGroup();
    const { start: st, end: en, route: rt, locPos: lp, locAcc: ac } = live.current;
    const mk = (lat: number, lng: number, letter: string, cls: string) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="cn-marker ${cls}">${letter}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      return L.marker([lat, lng], { icon, interactive: false });
    };
    if (st) group.addLayer(mk(st.lat, st.lng, "A", "cn-marker-start"));
    if (en) group.addLayer(mk(en.lat, en.lng, "B", "cn-marker-end"));
    if (lp) {
      const ring = L.circle([lp.lat, lp.lng], {
        radius: Math.max(ac ?? 12, 8),
        color: "#2fae9a",
        weight: 1,
        opacity: 0.4,
        fillColor: "#2fae9a",
        fillOpacity: 0.1,
        interactive: false,
      });
      const dot = L.circleMarker([lp.lat, lp.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: "#0e7c66",
        fillOpacity: 1,
        interactive: false,
      });
      group.addLayer(ring);
      group.addLayer(dot);
    }
    if (rt && rt.points.length > 1) {
      const ll = rt.points.map((p) => [p.lat, p.lng]);
      const casing = L.polyline(ll, { color: "#ffffff", weight: 13, opacity: 0.9, interactive: false, renderer: svg });
      const line = L.polyline(ll, { color: "#1e7c66", weight: 6, opacity: 0.95, className: "route-line", interactive: false, renderer: svg });
      casing.addTo(group);
      line.addTo(group);
    }
    group.addTo(map);
    routeGroup.current = group;

    const bounds: any[] = [];
    if (st) bounds.push([st.lat, st.lng]);
    if (en) bounds.push([en.lat, en.lng]);
    if (rt && rt.points.length > 1) {
      bounds.push([rt.points[0].lat, rt.points[0].lng]);
      bounds.push([rt.points[rt.points.length - 1].lat, rt.points[rt.points.length - 1].lng]);
    }
    if (bounds.length >= 2) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [46, 46], maxZoom: 15 });
    } else if (bounds.length === 1 && !lp) {
      map.setView([bounds[0][0], bounds[0][1]], 15);
    }
  }, [start, end, route, locPos, locAcc]);

  // ---- live follow ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const { locPos: lp, follow: f } = live.current;
    if (lp && f) {
      map.setView([lp.lat, lp.lng], Math.max(map.getZoom(), 15), { animate: true });
    }
  }, [locPos, follow]);

  return (
    <div className="relative h-full w-full">
      <div ref={holder} className="h-full w-full" aria-label="Nocatee cart path map" />
      <button
        onClick={() => setSatellite((v) => !v)}
        title={satellite ? "Show street map" : "Show satellite view"}
        aria-label={satellite ? "Show street map" : "Show satellite view"}
        className="absolute left-3 top-3 z-[500] rounded-full border border-cn-line bg-white/95 px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-cn-ink-soft shadow-md transition hover:text-cn-teal-deep active:scale-95"
      >
        {satellite ? "Map" : "Satellite"}
      </button>
    </div>
  );
}