import json, math

R = 6371000.0
def hav(a, b):
    dlat = math.radians(b[0]-a[0]); dlon = math.radians(b[1]-a[1])
    s = math.sin(dlat/2)**2 + math.cos(math.radians(a[0]))*math.cos(math.radians(b[0]))*math.sin(dlon/2)**2
    return 2*R*math.asin(math.sqrt(s))

def rings(rel):
    out = []
    for m in rel.get("members", []):
        if m["role"] == "outer" and "geometry" in m:
            r = [(g["lat"], g["lon"]) for g in m["geometry"]]
            if len(r) > 2: out.append(r)
    return out

def inpoly(pt, poly):
    x, y = pt[1], pt[0]
    inside = False
    n, j = len(poly), len(poly)-1
    for i in range(n):
        xi, yi = poly[i][1], poly[i][0]
        xj, yj = poly[j][1], poly[j][0]
        if ((yi > y) != (yj > y)) and (x < (xj-xi)*(y-yi)/(yj-yi)+xi): inside = not inside
        j = i
    return inside

def inany(pt, polys): return any(inpoly(pt, p) for p in polys)

def segdist(px, py, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]
    if dx == 0 and dy == 0:
        return ((px-a[0])**2 + (py-a[1])**2)**0.5
    t = max(0.0, min(1.0, ((px-a[0])*dx + (py-a[1])*dy) / (dx*dx + dy*dy)))
    ex, ey = a[0]+t*dx, a[1]+t*dy
    return ((px-ex)**2 + (py-ey)**2)**0.5

def inside(geoms, polys):
    pts = [(g["lat"], g["lon"]) for g in geoms]
    if inany(pts[0], polys) or inany(pts[-1], polys): return True
    for i in range(len(pts)-1):
        m = ((pts[i][0]+pts[i+1][0])/2, (pts[i][1]+pts[i+1][1])/2)
        if inany(m, polys): return True
    # Town Center sits just outside the boundary ring: include a ~180 m band
    tol = 0.0017
    for pt in pts:
        for ring in polys:
            for j in range(len(ring)-1):
                if inside(pt, [ring[j], ring[j+1]]) if False else segdist(pt[0], pt[1], ring[j], ring[j+1]) < tol:
                    return True
    return False

PATH = {"cycleway", "footway", "path", "pedestrian", "track"}
ROAD = {"residential", "unclassified", "living_street"}
SERVICE = {"service"}
ARTERIAL = {"secondary", "tertiary"}
ALLOWED_NAME = {"Crosstown Drive", "Preservation Trail", "Twenty Mile Road", "20 Mile Road", "Pine Island Road", "Stone Ridge Drive", "Cross Ridge Drive"}
FORBIDDEN = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link"}

def mph(t):
    ms = t.get("maxspeed")
    if not ms: return None
    try:
        if "mph" in ms: return int(ms.split()[0])
        if ms.isdigit(): return int(ms)
    except: return None
    return None

def snap(coords, sd):
    n = len(coords); par = list(range(n))
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    grid = {}
    for i, (la, lo) in enumerate(coords): grid.setdefault((int(la/sd), int(lo/sd)), []).append(i)
    for i, (la, lo) in enumerate(coords):
        cx, cy = int(la/sd), int(lo/sd)
        for gx in range(cx-1, cx+2):
            for gy in range(cy-1, cy+2):
                for j in grid.get((gx, gy), []):
                    if j <= i: continue
                    if (la-coords[j][0])**2 + (lo-coords[j][1])**2 < sd*sd:
                        ra, rb = find(i), find(j)
                        if ra != rb: par[rb] = ra
    root = {}
    for i in range(n):
        r = find(i)
        if r not in root: root[r] = coords[i]
    rem = {}; nc = []
    for i in range(n):
        r = find(i)
        if r not in rem: rem[r] = len(nc); nc.append(root[r])
    return nc, [rem[find(i)] for i in range(n)]

def comps(adj):
    seen = [False]*len(adj); res = []
    for i in range(len(adj)):
        if seen[i]: continue
        st = [i]; seen[i] = True; c = []
        while st:
            u = st.pop(); c.append(u)
            for v in adj[u]:
                if not seen[v]: seen[v] = True; st.append(v)
        res.append(c)
    return res

def main():
    rel = [e for e in json.load(open("cartdata/boundary.json"))["elements"] if e["type"] == "relation"][0]
    polys = rings(rel)
    print("boundary rings:", len(polys))

    ways = json.load(open("cartdata/ways.json"))["elements"]
    keep = []; stats = {}; forbidden = []
    TC_BBOX = (30.1025, -81.4275, 30.1135, -81.4035)
    def in_tc(g):
        pts = [(q["lat"], q["lon"]) for q in g]
        return any(TC_BBOX[0] <= la <= TC_BBOX[2] and TC_BBOX[1] <= lo <= TC_BBOX[3] for la, lo in pts)
    for w in ways:
        if w.get("type") != "way" or "geometry" not in w: continue
        t = w["tags"]; h = t.get("highway")
        if not h: continue
        name = t.get("name", "")
        if not (inside(w["geometry"], polys) or in_tc(w["geometry"])): continue
        if h in PATH:
            if t.get("footway") == "sidewalk": continue
            if t.get("access") == "private": continue
            keep.append(w); stats[h] = stats.get(h, 0) + 1
        elif h in ROAD:
            m = mph(t)
            if m is not None and m > 30: forbidden.append(w); continue
            if t.get("access") == "private": continue
            keep.append(w); stats[h] = stats.get(h, 0) + 1
        elif h in SERVICE:
            # parking lots and internal drives: always legal for carts
            m = mph(t)
            if m is not None and m > 30: continue
            keep.append(w); stats[h] = stats.get(h, 0) + 1
        elif h in ARTERIAL:
            m = mph(t)
            if name in ALLOWED_NAME or (m is not None and m <= 30):
                keep.append(w); stats[h] = stats.get(h, 0) + 1
            else:
                forbidden.append(w)
        elif h in FORBIDDEN:
            forbidden.append(w)
    print("kept:", len(keep), stats)
    print("forbidden ways:", len(forbidden))

    fl = [[(g["lat"], g["lon"]) for g in w["geometry"]] for w in forbidden]
    print("forbidden polylines:", len(fl))

    idx = {}; nodes = []; edges = []; seen = set()
    def nid(n):
        if n not in idx: idx[n] = len(nodes); nodes.append(None)
        return idx[n]
    for w in keep:
        t = w["tags"]; h = t.get("highway")
        name = t.get("name", ""); is_path = h in PATH
        geom = [(g["lat"], g["lon"]) for g in w["geometry"]]
        for gi in w["geometry"]:
            if "id" not in gi: gi["id"] = ("c", round(gi["lat"], 6), round(gi["lon"], 6))
        ids = [nid(g["id"]) for g in w["geometry"]]
        for gi in w["geometry"]: nodes[idx[gi["id"]]] = (gi["lat"], gi["lon"])
        for i in range(len(ids)-1):
            a, b = ids[i], ids[i+1]
            if a == b: continue
            key = (min(a,b), max(a,b))
            d = int(round(hav(geom[i], geom[i+1])))
            if d == 0 or key in seen: continue
            seen.add(key); edges.append((a, b, d, name, 1 if is_path else 0))

    coords = [(p[0], p[1]) for p in nodes]
    nc, rm = snap(coords, 0.00011); nodes = nc

    best = {}
    for e in edges:
        a, b = rm[e[0]], rm[e[1]]
        if a == b: continue
        if a > b: a, b = b, a
        d = int(round(hav(nodes[a], nodes[b])))
        if d == 0: continue
        key = (a, b)
        if key not in best or d < best[key][2]: best[key] = (a, b, d, e[3], e[4])
    edges = list(best.values())

    adj = [[] for _ in nodes]
    for e in edges:
        adj[e[0]].append(e[1]); adj[e[1]].append(e[0])

    XD = 0.00110
    for _ in range(3):
        lab = [-1]*len(adj); cur = 0
        for i in range(len(adj)):
            if lab[i] != -1: continue
            st = [i]; lab[i] = cur
            while st:
                u = st.pop()
                for v in adj[u]:
                    if lab[v] == -1: lab[v] = cur; st.append(v)
            cur += 1
        grid = {}
        for i, (la, lo) in enumerate(nodes):
            grid.setdefault((int(la/XD), int(lo/XD)), []).append(i)
        added = 0
        for i, (la, lo) in enumerate(nodes):
            cx, cy = int(la/XD), int(lo/XD)
            for gx in range(cx-1, cx+2):
                for gy in range(cy-1, cy+2):
                    for j in grid.get((gx, gy), []):
                        if j <= i or lab[i] == lab[j]: continue
                        dl = (la-nodes[j][0])**2 + (lo-nodes[j][1])**2
                        if dl < XD*XD:
                            adj[i].append(j); adj[j].append(i)
                            edges.append((i, j, int(round(hav(nodes[i], nodes[j]))), "", 0)); added += 1
        if added == 0: break
    print("components:", [len(c) for c in sorted(comps(adj), key=len, reverse=True)[:4]])

    names = sorted(set(e[3] for e in edges if e[3]))
    ni = {n: i for i, n in enumerate(names)}
    out = {
        "nodes": [round(v, 7) for p in nodes for v in p],
        "edgesA": [e[0] for e in edges],
        "edgesB": [e[1] for e in edges],
        "edgesW": [e[2] for e in edges],
        "edgesNameIdx": [ni.get(e[3], -1) for e in edges],
        "edgesPath": [e[4] for e in edges],
        "names": names,
        "forbidden": [[[round(a,7), round(b,7)] for a, b in poly] for poly in fl],
        "pois": [],
        "bbox": [min(p[0] for p in nodes), min(p[1] for p in nodes), max(p[0] for p in nodes), max(p[1] for p in nodes)],
    }
    json.dump(out, open("cartdata/cart-graph.json", "w"), separators=(",", ":"))
    print("graph bytes:", len(json.dumps(out, separators=(",", ":")).encode()))

if __name__ == "__main__":
    main()