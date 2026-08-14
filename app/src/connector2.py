import json, math, heapq

D = json.load(open("public/data/graph.json"))
nodes = list(zip(D["nodes"][::2], D["nodes"][1::2]))
N = len(nodes)
adj = [[] for _ in range(N)]
for i in range(len(D["edgesA"])):
    a, b, w = D["edgesA"][i], D["edgesB"][i], D["edgesW"][i]
    adj[a].append((b, w)); adj[b].append((a, w))

def hav(a, b):
    la1, lo1 = nodes[a]; la2, lo2 = nodes[b]
    s = math.sin(math.radians(la2-la1)/2)**2 + math.cos(math.radians(la1))*math.cos(math.radians(la2))*math.sin(math.radians(lo2-lo1)/2)**2
    return 2*6371000*math.asin(math.sqrt(s))

def route(a, b, banned=()):
    dist = [1e18]*N; dist[a] = 0; pq = [(0, a)]
    while pq:
        du, u = heapq.heappop(pq)
        if du > dist[u]: continue
        if u == b: break
        for v, w in adj[u]:
            if v in banned: continue
            if du + w < dist[v]:
                dist[v] = du + w; heapq.heappush(pq, (du + w, v))
    return dist[b] if dist[b] < 1e18 else None

def ends_of(name):
    ix = D["names"].index(name)
    es = [i for i in range(len(D["edgesA"])) if D["edgesNameIdx"][i] == ix]
    deg = {}
    for i in es:
        deg[D["edgesA"][i]] = deg.get(D["edgesA"][i], 0) + 1
        deg[D["edgesB"][i]] = deg.get(D["edgesB"][i], 0) + 1
    return [n for n, c in deg.items() if c == 1]

H = ends_of("Heron Trail")
P = ends_of("Pelican Trail")

import heapq
print("heron ends", H)
print("pelican ends", P)