import json, heapq

D = json.load(open("public/data/graph.json"))
nodes = list(zip(D["nodes"][::2], D["nodes"][1::2]))
N = len(nodes)
adj = [[] for _ in range(N)]
for i in range(len(D["edgesA"])):
    a, b, w = D["edgesA"][i], D["edgesB"][i], D["edgesW"][i]
    adj[a].append((b, w))
    adj[b].append((a, w))

CON = set()
for i in range(len(D["edgesA"])):
    if D["edgesNameIdx"][i] >= 0 and D["names"][D["edgesNameIdx"][i]] == "Heron-Pelican Connector":
        CON.add(i)

def route(a, b, withconn):
    dist = [1e18] * N
    dist[a] = 0
    pq = [(0, a)]
    while pq:
        du, u = heapq.heappop(pq)
        if du > dist[u]:
            continue
        if u == b:
            break
        for v, w in adj[u]:
            if (not withconn) and v in CON:
                continue
            if du + w < dist[v]:
                dist[v] = du + w
                heapq.heappush(pq, (du + w, v))
    return dist[b] if dist[b] < 1e18 else None

H = min(range(N), key=lambda i: (nodes[i][0] - 30.10639) ** 2 + (nodes[i][1] + 81.43247) ** 2)
P = min(range(N), key=lambda i: (nodes[i][0] - 30.10445) ** 2 + (nodes[i][1] + 81.41806) ** 2)

rb = route(H, P, False)
ra = route(H, P, True)

def show(x):
    if x is None:
        return "NO ROUTE"
    return "%.2f km / ~%d min" % (x / 1000, max(1, round(x / 6.7 / 60)))

print("connector edges:", len(CON))
print("BEFORE (connector removed):", show(rb))
print("AFTER  (with connector):    ", show(ra))
print("endpoints H,P:", nodes[H], nodes[P])