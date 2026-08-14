import json, math, heapq

# the app's logic: load base graph, then add the user-drawn trail to the router
D = json.load(open("public/data/graph.json"))
nodes = list(zip(D["nodes"][::2], D["nodes"][1::2]))
N = len(nodes)
adj = [[] for _ in range(N)]
for i in range(len(D["edgesA"])):
    a, b, w = D["edgesA"][i], D["edgesB"][i], D["edgesW"][i]
    adj[a].append((b, w))
    adj[b].append((a, w))

trail = json.load(open("trail_geom.json"))

def hav_ll(la1, lo1, la2, lo2):
    import math
    s = math.sin(math.radians(la2-la1)/2)**2 + math.cos(math.radians(la1))*math.cos(math.radians(la2))*math.sin(math.radians(lo2-lo1)/2)**2
    return 2*6371000*math.asin(math.sqrt(s))

# trail length
L = 0
for i in range(len(trail)-1):
    L += hav_ll(*trail[i], *trail[i+1])
print("your drawn trail length: %.2f km" % (L/1000))

def nearest(la, lo):
    return min(range(N), key=lambda i: (nodes[i][0]-la)**2 + (nodes[i][1]-lo)**2)

# mimic app: snap points, create missing nodes, add edges
ids = []
for (la, lo) in trail:
    n = nearest(la, lo)
    if ((nodes[n][0]-la)**2 + (nodes[n][1]-lo)**2)**0.5 * 111000 > 40:
        nodes.append((la, lo))
        adj.append([])
        n = len(nodes) - 1
    if ids and ids[-1] == n:
        continue
    ids.append(n)

def full_route(a, b):
    NN = len(nodes)
    dist = [1e18]*NN; dist[a] = 0; pq = [(0, a)]
    while pq:
        du, u = heapq.heappop(pq)
        if du > dist[u]: continue
        if u == b: break
        for v, w in adj[u]:
            if du + w < dist[v]:
                dist[v] = du + w
                heapq.heappush(pq, (du + w, v))
    return dist[b] if dist[b] < 1e18 else None

H = nearest(30.10639, -81.43247)
P = nearest(30.10445, -81.41806)
print("(heron->pelican without your trail)", full_route(H, P))
# now with the trail's edges added
for i in range(len(ids)-1):
    a, b = ids[i], ids[i+1]
    w = max(1, round(hav_ll(nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1])))
    adj[a].append((b, w)); adj[b].append((a, w))
r = full_route(H, P)
def fmt(x): return ("%.2f km / ~%d min" % (x/1000, max(1, round(x/6.7/60)))) if x else "NO ROUTE"
print("Heron -> Pelican WITH your drawn trail: ", fmt(r))