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
  satellite: boolean;
  onToggleSatellite: () => void;
  onMapClick: (p: MapPoint) => void;
  onReady: () => void;
};

const CART_GLYPH = `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="9.5" width="12" height="5.5" rx="1.6"/><path d="M9.5 9.5V6.2h4.6a1.9 1.9 0 0 1 1.9 1.9v1.4"/><path d="M10.5 6.2 9.8 4.6"/><circle cx="7.2" cy="16.2" r="1.5"/><circle cx="13.8" cy="16.2" r="1.5"/><path d="M17.5 8h1.8a1 1 0 0 1 1 1v3.4"/></svg>`;

// Raster tile chain: plain <img> tiles, no WebGL, no workers.
const TILE_CHAIN: { url: string; opts: Record<string, unknown> }[] = [
  {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    opts: { subdomains: "abcd", maxZoom: 20, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' },
  },
  {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    opts: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
  },
  {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    opts: { maxZoom: 19, attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors" },
  },
];
const SAT_TILES = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  opts: { maxZoom: 19, attribution: "Tiles &copy; Esri &mdash; Maxar, Earthstar Geographics, and the GIS User Community" },
};

export default function NavMap({
  graph,
  start,
  end,
  route,
  locPos,
  locAcc,
  follow,
  satellite,
  onMapClick,
  onReady,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const netLayers = useRef<{ paths?: any; roads?: any }>({});
  const routeGroup = useRef<any>(null);
  const streetLayer = useRef<any>(null);
  const satLayer = useRef<any>(null);
  const chainIdx = useRef(0);
  const autoCentered = useRef(false);
  const live = useRef({ graph, start, end, route, locPos, locAcc, follow, onMapClick, onReady });
  live.current = { graph, start, end, route, locPos, locAcc, follow, onMapClick, onReady };
  const readyFired = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [redrawTick, setRedrawTick] = useState(0);

  // Merge raw edges into continuous polylines (paths or roads) -> fewer, longer lines.
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
      roads.addTo(map);
      netLayers.current.roads = roads;
    }
  }

  function installStreetLayer(L: any, map: any) {
    const spec = TILE_CHAIN[chainIdx.current];
    const layer = L.tileLayer(spec.url, spec.opts);
    layer.on("tileerror", () => {
      if (chainIdx.current >= TILE_CHAIN.length - 1) return;
      chainIdx.current += 1;
      if (map.hasLayer(streetLayer.current)) map.removeLayer(streetLayer.current);
      streetLayer.current = installStreetLayer(L, map);
    });
    layer.addTo(map);
    streetLayer.current = layer;
    return layer;
  }

  // ---- init once ----
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    let onVis: (() => void) | null = null;
    let attempts = 0;
    const el = holder.current;
    if (!el) return;

    const fixSize = () => {
      if (mapRef.current) mapRef.current.invalidateSize({ animate: false });
    };

    const createMap = () => {
      if (disposed || !holder.current) return;
      void Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")])
        .then(([Mod]) => {
          if (disposed || !holder.current) return;
          const L = (Mod as any).default ?? Mod;
          LRef.current = L;
          const map = L.map(holder.current, {
            zoomControl: false,
            attributionControl: true,
            preferCanvas: true,
          }).setView([30.095, -81.414], 13);
          mapRef.current = map;
          L.control.zoom({ position: "bottomright" }).addTo(map);
          map.on("click", (ev: any) => {
            live.current.onMapClick({ lat: ev.latlng.lat, lng: ev.latlng.lng });
          });
          installStreetLayer(L, map);
          satLayer.current = L.tileLayer(SAT_TILES.url, SAT_TILES.opts);
          drawNetwork();
          ro = new ResizeObserver(fixSize);
          ro.observe(holder.current);
          onVis = () => {
            if (!document.hidden) fixSize();
          };
          document.addEventListener("visibilitychange", onVis);
          window.addEventListener("pageshow", fixSize);
          window.addEventListener("resize", fixSize);
          [0, 150, 400, 900].forEach((t) => window.setTimeout(fixSize, t));
          if (!readyFired.current) {
            readyFired.current = true;
            live.current.onReady();
          }
          setMapReady(true);
          setRedrawTick((t) => t + 1);
        })
        .catch((err) => {
          console.error("leaflet failed to load", err);
          if (!readyFired.current) {
            readyFired.current = true;
            live.current.onReady();
          }
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
      if (onVis) document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", fixSize);
      window.removeEventListener("resize", fixSize);
      if (mapRef.current) {
        mapRef.current.remove();
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- street / satellite toggle ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (satellite) {
      if (!map.hasLayer(satLayer.current)) satLayer.current.addTo(map);
      if (map.hasLayer(streetLayer.current)) map.removeLayer(streetLayer.current);
    } else {
      if (!map.hasLayer(streetLayer.current)) streetLayer.current.addTo(map);
      if (map.hasLayer(satLayer.current)) map.removeLayer(satLayer.current);
    }
  }, [satellite, mapReady]);

  // ---- graph arrives: draw the network ----
  useEffect(() => {
    if (!graph) return;
    drawNetwork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // ---- markers + route + fit ----
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    if (routeGroup.current) {
      map.removeLayer(routeGroup.current);
      routeGroup.current = null;
    }
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
        fillOpacity: 0.12,
        interactive: false,
      });
      const pin = L.marker([lp.lat, lp.lng], {
        icon: L.divIcon({
          className: "cn-loc-pin",
          html: `<div class="cn-loc-wrap"><div class="cn-cart">${CART_GLYPH}</div><div class="cn-loc-tag">You</div></div>`,
          iconSize: [46, 66],
          iconAnchor: [23, 54],
        }),
        interactive: false,
        zIndexOffset: 1000,
      });
      group.addLayer(ring);
      group.addLayer(pin);
      if (!st && !en && !autoCentered.current) {
        autoCentered.current = true;
        map.setView([lp.lat, lp.lng], 15, { animate: true });
      }
    }
    if (rt && rt.points.length > 1) {
      const ll = rt.points.map((p) => [p.lat, p.lng]);
      const casing = L.polyline(ll, { color: "#ffffff", weight: 12, opacity: 0.9, interactive: false });
      const line = L.polyline(ll, { color: "#1e88e5", weight: 5.5, opacity: 0.98, interactive: false });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, route, locPos, locAcc, redrawTick]);

  // ---- live follow ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const lp = live.current.locPos;
    const f = live.current.follow;
    if (lp && f) {
      map.setView([lp.lat, lp.lng], Math.max(map.getZoom(), 15), { animate: true });
    }
  }, [locPos, follow, mapReady]);

  return <div ref={holder} className="h-full w-full" aria-label="Nocatee cart path map" />;
}