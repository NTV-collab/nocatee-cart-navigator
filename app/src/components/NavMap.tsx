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
  evOverlay: boolean;
  evOpacity: number;
  trails: { id: number; geom: [number, number][] }[];
  draftPoints: MapPoint[];
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
  evOverlay,
  evOpacity,
  trails,
  draftPoints,
  onMapClick,
  onReady,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const netLayers = useRef<{ paths?: any; roads?: any; forbidden?: any }>({});
  const routeGroup = useRef<any>(null);
  const streetLayer = useRef<any>(null);
  const satLayer = useRef<any>(null);
  const chainIdx = useRef(0);
  const autoCentered = useRef(false);
  const overlayLayer = useRef<any>(null);
  const overlayBounds = useRef<any>(null);
  const overlayDrag = useRef<any>(null);
  const trailsGroup = useRef<any>(null);
  const live = useRef({ graph, start, end, route, locPos, locAcc, follow, onMapClick, onReady });
  live.current = { graph, start, end, route, locPos, locAcc, follow, onMapClick, onReady };
  const readyFired = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [redrawTick, setRedrawTick] = useState(0);

  // Merge raw edges into continuous polylines, splitting at name changes so
  // each trail keeps its official color boundary.
  function buildChains(L: any, g: CartGraph, wantPath: boolean) {
    const m = g.edgesA.length;
    const adj = new Map<number, [number, number][]>();
    const names: Map<string, number> = new Map();
    const lonOf = (i: number) => g.nodes[i * 2 + 1];
    const latOf = (i: number) => g.nodes[i * 2];
    const keyOf = (a: number, b: number) => (a < b ? a + "_" + b : b + "_" + a);
    for (let i = 0; i < m; i++) {
      if ((g.edgesPath[i] === 1) !== wantPath) continue;
      const a = g.edgesA[i];
      const b = g.edgesB[i];
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a)!.push([b, i]);
      adj.get(b)!.push([a, i]);
      names.set(keyOf(a, b), g.edgesNameIdx[i]);
    }
    const used = new Set<number>();
    const chains: { coords: [number, number][]; name: string }[] = [];
    for (let seed = 0; seed < m; seed++) {
      if (used.has(seed) || (g.edgesPath[seed] === 1) !== wantPath) continue;
      used.add(seed);
      const a = g.edgesA[seed];
      const b = g.edgesB[seed];
      const cname = g.edgesNameIdx[seed];
      const chain: number[][] = [
        [lonOf(a), latOf(a)],
        [lonOf(b), latOf(b)],
      ];
      const walk = (cur: number, pushFront: boolean) => {
        for (;;) {
          const nbs = adj.get(cur);
          let nxt: number | null = null;
          if (nbs) {
            for (const [to, j] of nbs) {
              if (used.has(j)) continue;
              const jn = names.get(keyOf(cur, to)) ?? -1;
              if (jn !== cname) continue;
              nxt = to;
              used.add(j);
              break;
            }
          }
          if (nxt === null) break;
          if (pushFront) chain.unshift([lonOf(nxt), latOf(nxt)]);
          else chain.push([lonOf(nxt), latOf(nxt)]);
          cur = nxt;
        }
      };
      walk(b, false);
      walk(a, true);
      if (!wantPath && cname < 0) continue; // don't draw the unnamed connector web
      chains.push({ coords: chain as [number, number][], name: cname >= 0 ? g.names[cname] : "" });
    }
    if (!chains.length) return null;
    return L.geoJSON(
      {
        type: "FeatureCollection",
        features: chains.map((c) => ({
          type: "Feature",
          properties: { kind: wantPath ? "path" : "road", name: c.name },
          geometry: { type: "LineString", coordinates: c.coords },
        })),
      },
      {
        interactive: false,
        style: (f: any) => {
          const nm = f.properties?.name || "";
          if (f.properties?.kind === "road") {
            return { color: "#aeb4ad", weight: 1.8, opacity: 0.55 };
          }
          if (nm) {
            return { color: "#1f9d55", weight: 4.5, opacity: 0.95 };
          }
          return { color: "#74c08a", weight: 2.2, opacity: 0.6 };
        },
      },
    );
  }

  // Draw roadways that are NOT permitted for golf carts (red, per official EV map).
  function buildForbidden(L: any, g: CartGraph) {
    const fl = g.forbidden || [];
    if (!fl.length) return null;
    return L.geoJSON(
      {
        type: "FeatureCollection",
        features: fl.map((coords) => ({
          type: "Feature",
          properties: { k: "no" },
          geometry: { type: "LineString", coordinates: coords.map((c) => [c[1], c[0]]) },
        })),
      },
      {
        interactive: false,
        style: { color: "#d64541", weight: 3, opacity: 0.75, dashArray: "6 6" },
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
    const forb = buildForbidden(L, g);
    if (forb) {
      forb.addTo(map);
      netLayers.current.forbidden = forb;
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

  // ---- official EV-map overlay: align it yourself with two corner handles ----
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    if (evOverlay && !overlayLayer.current) {
      let b = overlayBounds.current;
      if (!b) {
        try {
          const saved = localStorage.getItem("evOverlayBounds");
          if (saved) {
            const j = JSON.parse(saved);
            if (j && j.sw && j.ne) b = L.latLngBounds(j.sw, j.ne);
          }
        } catch {}
      }
      if (!b) b = L.latLngBounds([30.083, -81.508], [30.122, -81.336]);
      overlayBounds.current = b;
      const ov = L.imageOverlay("/assets/ev-overlay.png", b, { opacity: evOpacity, interactive: true });
      ov.addTo(map);
      overlayLayer.current = ov;

      const handles = overlayLayer.current;  // placeholder
      const mkHandle = (latlng: any, cls: string) =>
        L.marker(latlng, {
          draggable: true,
          interactive: true,
          icon: L.divIcon({ className: "", html: "<div class=\"cn-handle " + cls + "\"></div>", iconSize: [22, 22], iconAnchor: [11, 11] }),
          zIndexOffset: 900,
        });
      const hTL = mkHandle(b.getNorthWest(), "cn-handle-tl");
      const hBR = mkHandle(b.getSouthEast(), "cn-handle-br");
      hTL.addTo(map);
      hBR.addTo(map);

      const persist = () => {
        try {
          const bb = overlayLayer.current.getBounds();
          const rec = { sw: [bb.getSouth(), bb.getWest()], ne: [bb.getNorth(), bb.getEast()] };
          localStorage.setItem("evOverlayBounds", JSON.stringify(rec));
        } catch {}
      };
      const sync = () => {
        const bb = overlayLayer.current.getBounds();
        hTL.setLatLng(bb.getNorthWest());
        hBR.setLatLng(bb.getSouthEast());
      };
      hTL.on("drag", () => {
        const nd = hTL.getLatLng();
        const bb = overlayLayer.current.getBounds();
        overlayLayer.current.setBounds(L.latLngBounds(nd, [bb.getSouth(), bb.getEast()]));
      });
      hBR.on("drag", () => {
        const nd = hBR.getLatLng();
        const bb = overlayLayer.current.getBounds();
        overlayLayer.current.setBounds(L.latLngBounds([bb.getNorth(), bb.getWest()], nd));
      });
      hTL.on("dragend", persist);
      hBR.on("dragend", persist);
      map.on("moveend zoomend", sync);
      (ov as any)._cnHandles = { hTL: hTL, hBR: hBR, persist: persist, sync: sync };
    } else if (evOverlay && overlayLayer.current) {
      overlayLayer.current.setOpacity(evOpacity);
    } else if (!evOverlay && overlayLayer.current) {
      const h = (overlayLayer.current as any)._cnHandles;
      if (h) {
        map.off("moveend zoomend", h.sync);
        h.hTL.remove();
        h.hBR.remove();
      }
      map.removeLayer(overlayLayer.current);
      overlayLayer.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evOverlay, evOpacity, mapReady]);

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

  // ---- user-drawn trails + draft rendering ----
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    if (trailsGroup.current) {
      map.removeLayer(trailsGroup.current);
      trailsGroup.current = null;
    }
    const g = L.layerGroup();
    for (const t of trails) {
      if (!t.geom || t.geom.length < 2) continue;
      const pl = L.polyline(t.geom.map((c) => [c[0], c[1]]), {
        color: "#127a43",
        weight: 3.2,
        opacity: 0.9,
        interactive: false,
      });
      g.addLayer(pl);
    }
    if (draftPoints && draftPoints.length > 1) {
      g.addLayer(
        L.polyline(
          draftPoints.map((p) => [p.lat, p.lng]),
          { color: "#127a43", weight: 3, opacity: 0.55, dashArray: "6 8", interactive: false },
        ),
      );
    }
    g.addTo(map);
    trailsGroup.current = g;
  }, [trails, draftPoints, mapReady]);

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