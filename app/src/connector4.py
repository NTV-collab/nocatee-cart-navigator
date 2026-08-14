import json, math

D = json.load(open("public/data/graph.json"))
nodes = D["nodes"]  # flat [lat, lon, ...]
N = len(nodes) // 2

def ll(i):
    return nodes[i * 2], nodes[i * 2 + 1]

def hav(a, b):
    la1, lo1 = ll(a); la2, lo2 = ll(b)
    s = math.sin(math.radians(la2 - la1) / 2) ** 2 + math.cos(math.radians(la1)) * math.cos(math.radians(la2)) * math.sin(math.radians(lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(s))

# nearest existing node within 50 m, else create
def snap(la, lo):
    best, bd = -1, (50.0 / 111000.0) ** 2
    for i in range(N):
        d = (nodes[i * 2] - la) ** 2 + (nodes[i * 2 + 1] - lo) ** 2
        if d < bd:
            bd = d
            best = i
    if best >= 0:
        return best
    nodes.extend([la, lo])
    return N - 1  # caller must not re-length; see below

# instruction: create node AFTER snap() because N grows; instead use the returned appended id EARLY:
# easier: track id via list length BEFORE mutate
def add_flat(la, lo):
    nodes.append(la)
    nodes.append(lo)
    return len(nodes) // 2

# Preservation road points
pres = []
if "Preservation Trail" in D["names"]:
    ix = D["names"].index("Preservation Trail")
    ids = set()
    for i in range(len(D["edgesA"])):
        if D["edgesNameIdx"][i] == ix:
            ids.add(D["edgesA"][i])
            ids.add(D["edgesB"][i])
    pres = [ll(i) for i in ids]
print("pres nodes", len(pres))

la1, lo1 = 30.10639, -81.43247   # Heron east end
la2, lo2 = 30.10445, -81.41806   # Pelican west end

ids = []
for k in range(16):
    t = k / 15.0
    la = la1 + t * (la2 - la1)
    lo = lo1 + t * (lo2 - lo1)
    if any((q[0] - la) ** 2 + (q[1] - lo) ** 2 < 0.0016 for q in pres):
        la = la - 35.0 / 111000.0
    la = round(la, 6)
    lo = round(lo, 6)
    # reuse near node or append
    use = -1
    for i in range(len(nodes) // 2):
        if (nodes[i * 2] - la) ** 2 + (nodes[i * 2 + 1] - lo) ** 2 < (50.0 / 111000.0) ** 2:
            use = i
            break
    if use == -1:
        nodes.append(la)
        nodes.append(lo)
        use = len(nodes) // 2 - 1
    if ids and ids[-1] == use:
        continue
    ids.append(use)

# name idx
name = "Heron-Pelican Connector"
if name not in D["names"]:
    D["names"].append(name)
ni = D["names"].index(name)

added = 0
for i in range(len(ids) - 1):
    a, b = ids[i], ids[i + 1]
    if a == b:
        continue
    w = max(1, int(round(hav(a, b))))
    D["edgesA"].append(a)
    D["edgesB"].append(b)
    D["edgesW"].append(w)
    D["edgesNameIdx"].append(ni)
    D["edgesPath"].append(1)
    added += 1

json.dump(D, open("public/data/graph.json", "w"), separators=(",", ":"))
print("connector edges added:", added)
print("nodes now:", len(nodes) // 2)