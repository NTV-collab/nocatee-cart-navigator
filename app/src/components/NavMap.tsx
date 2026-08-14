import { useEffect, useRef } from "react";
import type { CartGraph } from "../lib/cart-data";
import type { RouteResult, MapPoint } from "../lib/cart-core";

type Props = {
  graph: CartGraph | null;
  start: MapPoint | null;
  end: MapPoint | null;
  route: RouteResult | null;
  pickMode: "start" | "end";
  onMapClick: (p: MapPoint) => void;
  onReady: () => void;
};

export default function NavMap({ graph, start, end, route, pickMode, onMapClick, onReady }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const networkLayer = useRef<any>(null);
  const routeGroup = useRef<any>(null);
  const live = useRef({ graph, start, end, route, pickMode, onMapClick, onReady });
  live.current = { graph, start, end, route, pickMode, onMapClick, onReady };
  const readyFired = useRef(false);

  function drawNetwork() {
    const L = LRef.current;
    const map = mapRef.current;
    const g = live.current.graph;
    if (!L || !map || !g || networkLayer.current) return;
    const features: any[] = [];
    for (let i = 0; i < g.edgesA.length; i++) {
      const a = g.edgesA[i];
      const b = g.edgesB[i];
      const isPath = g.edgesPath[i] === 1;
      const name = g.edgesNameIdx[i] >= 0 ? g.names[g.edgesNameIdx[i]] : "";
      features.push({
        type: "Feature",
        properties: { path: isPath ? 1 : 0, name },
        geometry: {
          type: "LineString",
          coordinates: [
            [g.nodes[a * 2 + 1], g.nodes[a * 2]],
            [g.nodes[b * 2 + 1], g.nodes[b * 2]],
          ],
        },
      });
    }
    const layer = L.geoJSON(
      { type: "FeatureCollection", features },
      {
        style: (f: any) => ({
          color: f.properties.path ? "#1e7c66" : "#8d9a94",
          weight: f.properties.path ? 3.2 : 2.2,
          opacity: f.properties.path ? 0.85 : 0.55,
          interactive: false,
        }),
      },
    );
    layer.addTo(map);
    networkLayer.current = layer;
  }

  // ---- init the map once ----
  useEffect(() => {
    let disposed = false;
    let map: any = null;
    void import("leaflet")
      .then((Mod) => {
        if (disposed || !holder.current) return;
        const L = (Mod as any).default ?? Mod;
        LRef.current = L;
        map = L.map(holder.current, {
          zoomControl: false,
          attributionControl: true,
          preferCanvas: true,
        }).setView([30.095, -81.412], 12);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }).addTo(map);
        L.control.zoom({ position: "bottomright" }).addTo(map);
        map.on("click", (ev: any) => {
          live.current.onMapClick({ lat: ev.latlng.lat, lng: ev.latlng.lng });
        });
        mapRef.current = map;
        drawNetwork();
        if (!readyFired.current) {
          readyFired.current = true;
          live.current.onReady();
        }
      })
      .catch((err) => {
        console.error("leaflet failed to load", err);
      });
    return () => {
      disposed = true;
      if (map) {
        map.remove();
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- graph arrives: draw the network ----
  useEffect(() => {
    if (!graph) return;
    drawNetwork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // ---- start / end / route changes ----
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (routeGroup.current) {
      map.removeLayer(routeGroup.current);
      routeGroup.current = null;
    }
    const group = L.layerGroup();
    const { start: st, end: en, route: rt } = live.current;
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
    if (rt && rt.points.length > 1) {
      const ll = rt.points.map((p) => [p.lat, p.lng]);
      const casing = L.polyline(ll, { color: "#ffffff", weight: 13, opacity: 0.9, interactive: false });
      const line = L.polyline(ll, { color: "#1e7c66", weight: 6, opacity: 0.95, className: "route-line", interactive: false });
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
    } else if (bounds.length === 1) {
      map.setView([bounds[0][0], bounds[0][1]], 15);
    }
  }, [start, end, route]);

  return <div ref={holder} className="h-full w-full" aria-label="Nocatee cart path map" />;
}