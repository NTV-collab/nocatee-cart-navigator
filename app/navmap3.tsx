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

// CARTO free vector basemap (Google-Maps style, no API key).
const STYLE_STREET = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const SAT_STYLE: any = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [{ id: "sat", type: "raster", source: "esri" }],
};

export default function NavMap({
  graph,
  start,
  end,
  route,
  pickMode,
  locPos,
  locAcc,
  follow,
  satellite,
  onMapClick,
  onReady,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mbRef = useRef<any>(null);
  const netDone = useRef(false);
  const routeLayersDone = useRef(false);
  const markers = useRef<{ a?: any; b?: any; loc?: any }>({});
  const live = useRef({ graph, start, end, route, locPos, follow, onMapClick, onReady });
  live.current = { graph, start, end, route, locPos, follow, onMapClick, onReady };
  const readyFired = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [redrawTick, setRedrawTick] = useState(0);

  // Merge the raw edge list into continuous polylines (paths or roads).
  // Returns chains of [lng, lat] pairs, one array per continuous way.
  function buildChains(g: CartGraph, wantPath: boolean): number[][][] {
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
    const chains: number[][][] = [];
    for (let seed = 0; seed < m; seed++) {
      if (used.has(seed) || (g.edgesPath[seed] === 1) !== wantPath) continue;
      used.add(seed);
      const a = g.edgesA[seed];
      const b = g.edgesB[seed];
      const chain: number[][] = [
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
    return chains;
  }

  function ensureOverlays() {
    const map = mapRef.current;
    if (!map) return;
    // cart network (teal paths + grey streets)
    if (!mapDone() && live.current.graph) {
      mapDone.current = true;
      const g = live.current.graph;
      const features: any[] = [];
      for (const [kind, want] of [
        ["path", true],
        ["road", false],
      ] as const) {
        for (const coords of buildChains(g, want)) {
          features.push({
            type: "Feature",
            properties: { kind },
            geometry: { type: "LineString", coordinates: coords },
          });
        }
      }
      map.addSource("cartnet", { type: "geojson", data: { type: "FeatureCollection", features } });
      map.addLayer({
        id: "net-path",
        type: "line",
        source: "cartnet",
        filter: ["==", ["get", "kind"], "path"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#1e7c66", "line-width": 3, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "net-road",
        type: "line",
        source: "cartnet",
        filter: ["==", ["get", "kind"], "road"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#8d9a94", "line-width": 2, "line-opacity": 0.6 },
      });
    }
    // route layers (created once, data swapped later)
    if (!routeLayersDone.current) {
      routeLayersDone.current = true;
      map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 12, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#1e7c66", "line-width": 5.5, "line-opacity": 0.98 },
      });
    }
    applyRouteData(map);
  }

  function mapDone() {
    return mapRef.current && mapRef.current.isStyleLoaded ? mapRef.current.isStyleLoaded() : Boolean(mapRef.current);
  }

  function applyRouteData(map: any) {
    if (!map || !map.getSource("route")) return;
    const rt = live.current.route;
    const features =
      rt && rt.points.length > 1
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: rt.points.map((p) => [p.lng, p.lat]) } }]
        : [];
    map.getSource("route").setData({ type: "FeatureCollection", features });
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
      if (mapRef.current) {
        try {
          mapRef.current.resize();
        } catch {
          /* not ready yet */
        }
      }
    };

    const createMap = () => {
      if (disposed || !holder.current) return;
      void Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")])
        .then(([Mod]) => {
          if (disposed || !holder.current) return;
          const mb = (Mod as any).default ?? Mod;
          mbRef.current = mb;
          const map = new mb.Map({
            container: holder.current,
            style: STREET_STREET,
            center: [-81.414, 30.095],
            zoom: 13,
            attributionControl: false,
            trackResize: false,
          });
          mapRef.current = map;
          map.addControl(new mb.NavigationControl({ showCompass: false }), "bottom-right");
          map.on("click", (e: any) => {
            if (e && e.lngLat) {
              live.current.onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
            }
          });
          map.on("load", () => {
            if (disposed) return;
            ensureOverlays();
            if (!readyFired.current) {
              readyFired.current = true;
              live.current.onReady();
            }
            setMapReady(true);
            setRedrawTick((t) => t + 1);
          });
          map.on("style.load", () => {
            if (!disposed) ensureOverlays();
          });
          ro = new ResizeObserver(fixSize);
          ro.observe(holder.current);
          onVis = () => {
            if (!document.hidden) fixSize();
          };
          document.addEventListener("visibilitychange", onVis);
          window.addEventListener("pageshow", fixSize);
          window.addEventListener("resize", fixSize);
          [0, 150, 400, 900].forEach((t) => window.setTimeout(fixSize, t));
        })
        .catch((err) => {
          console.error("maplibre failed to load", err);
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
      document.removeEventListener("visibilitychange", onVis ?? (() => undefined));
      window.removeEventListener("pageshow", fixSize);
      window.removeEventListener("resize", fixSize);
      if (mapRef.current) {
        mapRef.current.remove();
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- street / satellite ----
  useEffect(() => {
    const map = mapRef.current;
    const mb = mbRef.current;
    if (!map || !mb || !mapReady) return;
    if (live.current.route && map.getLayer("route-line")) {
      // keep overlays above the raster satellite layer
      const hasSat = map.getLayer("sat");
      if (satellite && !hasSat) {
        map.addSource("esri", SATILE.sources.esri);
        map.addLayer({ id: "sat", type: "raster", source: "esri" });
      } else if (!satellite && hasSat) {
        map.removeLayer("sat");
        map.removeSource("esri");
      }
    } else if (satellite !== (map.getLayer("sat") != null)) {
      if (satellite) {
        map.addSource("esri", SATILE.sources.esri);
        map.addLayer({ id: "sat", type: "raster", source: "esri" });
      } else if (map.getLayer("sat")) {
        map.removeLayer("sat");
        map.removeSource("esri");
      }
    }
  }, [satellite, mapReady]);

  // ---- graph arrives: draw the network ----
  useEffect(() => {
    if (!graph || !mapReady) return;
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      if (!mapDone.current) {
        ensureOverlays();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, mapReady]);

  // ---- markers + route + fit ----
  useEffect(() => {
    const map = mapRef.current;
    const mb = mbRef.current;
    if (!map || !mb || !mapReady) return;

    const setMarker = (key: "a" | "b" | "loc", lngLat: MapPoint | null, html: string) => {
      const existed = markers.current[key];
      if (!lngLat) {
        if (existed) {
          existed.remove();
          markers.current[key] = undefined;
        }
        return;
      }
      if (existed) {
        existed.setLngLat([lngLat.lng, lngLat.lat]);
      } else {
        const el = document.createElement("div");
        el.innerHTML = html;
        markers.current[key] = new mb.Marker({ element: el.firstElementChild as HTMLElement, anchor: "center" })
          .setLngLat([lngLat.lng, lngLat.lat])
          .addTo(map);
      }
    };

    const { start: st, end: en, locPos: lp, locAcc: ac } = live.current;
    setMarker("a", st, `<div class="cn-marker cn-marker-start">A</div>`);
    setMarker("b", en, `<div class="cn-marker cn-marker-end">B</div>`);
    if (lp) {
      setMarker("loc", lp, `<div class="cn-locdot" style="--acc:${Math.max(ac ?? 12, 8)}px"></div>`);
    } else {
      setMarker("loc", null, "");
    }
    applyRouteData(map);

    const pts: number[][] = [];
    if (st) pts.push([st.lng, st.lat]);
    if (en) pts.push([en.lng, en.lat]);
    const rt = live.current.route;
    if (rt && rt.points.length > 1) {
      pts.push([rt.points[0].lng, rt.points[0].lat]);
      pts.push([rt.points[rt.points.length - 1].lng, rt.points[rt.points.length - 1].lat]);
    }
    if (pts.length >= 2) {
      map.fitBounds(pts, { padding: 60, maxZoom: 15, duration: 250 });
    } else if (pts.length === 1 && !lp) {
      map.jumpTo({ center: pts[0], zoom: 15 });
    }
  }, [start, end, route, locPos, locAcc, redrawTick, mapReady]);

  // ---- live follow ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const lp = live.current.locPos;
    const f = live.current.follow;
    if (lp && f) {
      map.jumpTo({ center: [lp.lng, lp.lat], zoom: Math.max(map.getZoom(), 15) });
    }
  }, [locPos, follow, mapReady]);

  return <div ref={holder} className="h-full w-full" aria-label="Nocatee cart path map" />;
}