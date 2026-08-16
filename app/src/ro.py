import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")
p = "src/components/NavMap.tsx"
s = open(p).read()

old = "  netView?: boolean;\n  onMapReady?: (map: any) => void;\n  exportRef?: { current: (() => void) | null };\n};"
new = "  netView?: boolean;\n  routeOnly?: boolean;\n  onMapReady?: (map: any) => void;\n  exportRef?: { current: (() => void) | null };\n};"
assert old in s, "props"
s = s.replace(old, new, 1)

old = "  netView,\n  onMapReady,\n  exportRef,"
new = "  netView,\n  routeOnly,\n  onMapReady,\n  exportRef,"
assert old in s, "desc"
s = s.replace(old, new, 1)

old = "  // ---- netView: hide the basemap so only the routed network shows ----"
new = """  // ---- routeOnly: hide every overlay so only the highlighted route + pins show ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const off = (l: any) => l && map.hasLayer(l) && map.removeLayer(l);
    const on = (l: any) => l && !map.hasLayer(l) && l.addTo(map);
    const ovs = [
      netLayers.current.paths,
      netLayers.current.roads,
      netLayers.current.forbidden,
      netLayers.current.highlight,
      trailsGroup.current,
      overlayLayer.current,
    ];
    (routeOnly ? ovs.forEach(off) : ovs.forEach(on));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeOnly, mapReady]);

  // ---- netView: hide the basemap so only the routed network shows ----"""
assert old in s, "effect"
s = s.replace(old, new, 1)

open(p, "w").write(s)
print("navmap routeOnly applied")