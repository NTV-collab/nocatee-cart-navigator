import json, math, heapq

def hav_ll(la1, lo1, la2, lo2):
    s = math.sin(math.radians(la2-la1)/2)**2 + math.cos(math.radians(la1))*math.cos(math.radians(la2))*math.sin(math.radians(lo2-lo1)/2)**2
    return 2*6371000*math.asin(math.sqrt(s))

D = json.load(open("public/data/graph.json"))
nodes = list(zip(D["nodes"][::2], D["nodes"][1::2]))
N = len(nodes)

def endpoints(name):
    ix = D["names"].index(name)
    deg = {}
    for i in range(len(D["edgesA"])):
        if D["edgesNameIdx"][i] == ix:
            deg[D["edgesA"][i]] = deg.get(D["edgesA"][i], 0) + 1
            deg[D["edgesB"][i]] = deg.get(D["edgesB"][i], 0) + 1
    return [n for n, c in deg.items() if c == 1]

H = endpoints("Heron Trail")
P = endpoints("Pelican Trail")
print("heron ends", H, [nodes[e] for e in H])
print("pelican ends", P, [nodes[e] for e in P])

best = None
for h in H:
    for p in P:
        d = hav_ll(nodes[h][0], nodes[h][1], nodes[p][0], nodes[p][1])
        if best is None or d < best[0]:
            best = (d, h, p)
print("nearest h->p", round(best[0]), "m", nodes[best[1]], nodes[best[2]])

# build the connector along the south side of Preservation Trail
pres = []
if "Preservation Trail" in D["names"]:
    ix = D["names"].index("Preservation Trail")
    Pset = set()
    for i in range(len(D["edgesA"])):
        if D["edgesNameIdx"][i] == ix:
            Pset.add(D["edgesA"][i])
            Pset.add(D["edgesB"][i])
    pres = [nodes[n] for n in Pset]
print("preservation nodes", len(pres))

h0, p0 = best[1], best[2]
la1, lo1 = nodes[h0]; la2, lo2 = nodes[p0]
# midpoints: 15 samples; for each, if any preservation point is near, push south 35 m
pts = []
for k in range(16):
    t = k / 15.0
    la = la1 + t*(la2-la1)
    lo = lo1 + t*(lo2-lo1)
    near = [q for q in pres if (q[0]-la)**2+(q[1]-lo)**2 < 0.0016]
    if near:
        la = la - 35.0/111000.0
    pts.append((round(la,6), round(lo,6)))

# add nodes/edges
node_ids = []
for la, lo in pts:
    best_n = min(range(N), key=lambda i: (nodes[i][0]-la)**2+(nodes[i][1]-lo)**2)
    if ((nodes[best_n][0]-la)**2+(nodes[best_n][1]-lo)**2)**0.5*111000 < 50:
        node_ids.append(best_n)
    else:
        nodes.append((la, lo))
        node_ids.append(N)
        N += 1

name = "Heron-Pelican Connector"
if name not in D["names"]:
    D["names"].append(name)
ni = D["names"].index(name)
before = len(D["edgesA"])
for i in range(len(node_ids)-1):
    a, b = node_ids[i], node_ids[i+1]
    if a == b:
        continue
    w = 0 # placeholder fixed below
    la1_, lo1_ = nodes[a]; la2_, lo2_ = nodes[b]
    w = max(1, round(hav_ll(la1_, lo1_, la2_, lo2_)))
    D["edgesA"].append(a); D["edgesB"].append(b)
    D["edgesW"].append(w); D["edgesNameIdx"].append(ni); D["edgesPath"].append(1)
json.dump(D, open("public/data/graph.json", "w"), separators=(",", ":"))
print("connector edges added:", len(D["edgesA"]) - before)
print("heron-pelican encoded")