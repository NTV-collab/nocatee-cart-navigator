import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")
p = "src/components/NavMap.tsx"
s = open(p).read()

# 1) props type add exportRef
old = "  netView?: boolean;\n  onMapReady?: (map: any) => void;\n};"
new = """  netView?: boolean;
  onMapReady?: (map: any) => void;
  exportRef?: { current: (() => void) | null };
};"""
assert old in s, "props"
s = s.replace(old, new, 1)

old = "  netView,\n}: Props) {"
new = "  netView,\n  exportRef,\n}: Props) {"
assert old in s, "desc"
s = s.replace(old, new, 1)

# 2) add exportPNG + registration, insert before street/satellite toggle comment
old = "  // ---- Nocatee Village Drive: always-on bright route highlight ----"
new = """  // ---- export current view as PNG (network + markers, paper bg) ----
  function exportPNG() {
    const map = mapRef.current;
    if (!map) return;
    const lines: { ll: any[]; stroke: string; w: number }[] = [];
    const collect = (c: any) => {
      if (!c) return;
      if (c.getLayers) {
        (c.getLayers() || []).forEach(collect);
        return;
      }
      const ll = c._latlngs;
      const o = c.options || {};
      if (ll && o.color) lines.push({ ll, stroke: o.color, w: o.weight || 3 });
    };
    (Object.values(netLayers.current) as any[]).forEach(collect);
    if (routeRef.current) collect(routeRef.current);
    const size = map.getSize();
    const W = 1600;
    const R = W / size.x;
    const H = Math.round(size.y * R);
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const cx = cv.getContext("2d");
    if (!cx) return;
    cx.setTransform(R, 0, 0, R, 0, 0);
    cx.fillStyle = "#f3f1e8";
    cx.fillRect(0, 0, W, H);
    cx.lineCap = "round";
    cx.lineJoin = "round";
    for (const ln of lines) {
      cx.strokeStyle = ln.stroke;
      cx.lineWidth = ln.w;
      cx.beginPath();
      let first = true;
      const fl = ln.ll;
      for (let k = 0; k < fl.length; k++) {
        const p = map.latLngToContainerPoint(fl[k]);
        if (first) {
          cx.moveTo(p.x, p.y);
          first = false;
        } else {
          cx.lineTo(p.x, p.y);
        }
      }
      cx.stroke();
    }
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png");
    a.download = "nocatee-cart-network.png";
    a.click();
  }

  // ---- Nocatee Village Drive: always-on bright route highlight ----"""
assert old in s, "export"
s = s.replace(old, new, 1)

# 3) register exportRef once mapReady
old = "  useEffect(() => {\n    const map = mapRef.current;\n    if (!map || !mapReady) return;\n    const off = (l: any) => l && map.hasLayer(l) && map.removeLayer(l);"
new = """  useEffect(() => {
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const off = (l: any) => l && map.hasLayer(l) && map.removeLayer(l);"""
assert old in s, "reg"
s = s.replace(old, new, 1)

open(p, "w").write(s)
print("xpng ok")