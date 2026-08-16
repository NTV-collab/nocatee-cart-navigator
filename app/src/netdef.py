import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")
p = "src/components/NavMap.tsx"
s = open(p).read()

# 1) drawNetwork: build overlays into refs only, never auto-show
for addline, ref in [
    ("      paths.addTo(map);\n      netLayers.current.paths = paths;", "netLayers.current.paths = paths;"),
    ("      roads.addTo(map);\n      netLayers.current.roads = roads;", "netLayers.current.roads = roads;"),
    ("      forb.addTo(map);\n      netLayers.current.forbidden = forb;", "netLayers.current.forbidden = forb;"),
    ("      hv.addTo(map);\n      netLayers.current.highlight = hv;", "netLayers.current.highlight = hv;"),
]:
    assert addline in s, addline
    s = s.replace(addline, ref, 1)

# 2) replace routeOnly + exportRef + netView effects with unified effect
old_start = "  // ---- routeOnly: hide every overlay so only the highlighted route + pins show ----"
old_end = "  }, [netView, satellite, mapReady]);"
i0 = s.index(old_start)
i1 = s.index(old_end) + len(old_end)
replacement = """  // ---- exportRef registration ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (exportRef) {
      exportRef.current = exportPNG;
      return () => {
        if (exportRef) exportRef.current = null;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  // ---- unified overlay + basemap visibility: overlays are an editor view ----
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
    const showOv = netView && !routeOnly;
    ovs.forEach(showOv ? on : off);
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
  }, [netView, routeOnly, satellite, mapReady]);"""
s = s[:i0] + replacement + s[i1:]

open(p, "w").write(s)
print("overlays default-hidden")