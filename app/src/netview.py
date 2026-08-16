import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")

p = "src/components/NavMap.tsx"
s = open(p).read()

# props + destructure
old = "  onMapReady?: (map: any) => void;\n};"
new = "  netView?: boolean;\n  onMapReady?: (map: any) => void;\n};"
assert old in s, "props"
s = s.replace(old, new, 1)

old = """  onMapReady,
}: Props) {"""
new = """  onMapReady,
  netView,
}: Props) {"""
assert old in s, "destruct"
s = s.replace(old, new, 1)

# highlight + netView effects (insert before "// ---- street / satellite toggle ----")
old = "  // ---- street / satellite toggle ----"
new = """  // ---- Nocatee Village Drive: always-on bright route highlight ----
  function highlightVillage(L: any, g: CartGraph) {
    const ix = g.names.indexOf("Nocatee Village Drive");
    if (ix < 0) return null;
    const adj: Record<string, number[]> = {};
    for (let i = 0; i < g.edgesA.length; i++) {
      if (g.edgesNameIdx[i] !== ix) continue;
      const a = String(g.edgesA[i]);
      const b = String(g.edgesB[i]);
      (adj[a] ||= []).push(g.edgesB[i]);
      (adj[b] ||= []).push(g.edgesA[i]);
    }
    const seen = new Set<string>();
    const chains: number[][][] = [];
    for (const start of Object.keys(adj)) {
      if (seen.has(start)) continue;
      const chain: number[][] = [];
      let cur: number = Number(start);
      while (cur != null && !seen.has(String(cur))) {
        seen.add(String(cur));
        chain.push([g.nodes[cur * 2 + 1], g.nodes[cur * 2]]);
        const nxt = (adj[String(cur)] || []).find((x) => !seen.has(String(x)));
        cur = nxt != null ? nxt : NaN;
        if (Number.isNaN(cur)) cur = NaN as unknown as number;
      }
      if (chain.length > 1) chains.push(chain);
    }
    if (!chains.length) return null;
    const grp = L.layerGroup();
    for (const ch of chains) {
      grp.addLayer(L.polyline(ch, { color: "#ffffff", weight: 7, opacity: 0.9, interactive: false }));
      grp.addLayer(L.polyline(ch, { color: "#1e88e5", weight: 6, opacity: 0.95, interactive: false }));
    }
    return grp;
  }

  // ---- netView: hide the basemap so only the routed network shows ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const off = (l: any) => l && map.hasLayer(l) && map.removeLayer(l);
    const on = (l: any) => l && !map.hasLayer(l) && l.addTo(map);
    if (netView) {
      off(streetLayer.current);
      off(satLayer.current);
    } else if (satellite) {
      on(satLayer.current);
      off(streetLayer.current);
    } else {
      on(streetLayer.current);
      off(satLayer.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netView, satellite, mapReady]);

  // ---- street / satellite toggle ----"""
assert old in s, "insert"
s = s.replace(old, new, 1)

# draw highlight in drawNetwork after forbidden block
old = """    const forb = buildForbidden(L, g);
    if (forb) {
      forb.addTo(map);
      netLayers.current.forbidden = forb;
    }
  }"""
new = """    const forb = buildForbidden(L, g);
    if (forb) {
      forb.addTo(map);
      netLayers.current.forbidden = forb;
    }
    const hv = highlightVillageHighlight(L, map);
    if (hv) {
      hv.addTo(map);
      netLayers.current.highlight = hv;
    }
  }"""
assert old in s, "forbidden"
s = s.replace(old, new, 1)

# extend netLayers ref type
s = s.replace(
  "const netLayers = useRef<{ paths?: any; roads?: any; forbidden?: any }>({});",
  "const netLayers = useRef<{ paths?: any; roads?: any; forbidden?: any; highlight?: any }>({});",
)
open(p, "w").write(s)
print("navmap netview+highlight ok")