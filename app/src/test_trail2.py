import json, math, heapq

D = json.load(open("public/data/graph.json"))
nodes = list(zip(D["nodes"][::2], D["nodes"][1::2]))
adj = [[] for _ in range(len(nodes))]
for i in range(len(D["edgesA"])):
    a, b, w = D["edgesA"][i], D["edgesB"][i], D["edgesW"][i]
    adj[a].append((b, w))
    adj[b].append((a, w))

trail1 = json.load(open("trail1.json"))
trail2 = json.load(open("trail2.json"))

def hav_ll(p1, p2):
    la1, lo1 = p1; la2, lo2 = p2
    s = math.sin(math.radians(la2-la1)/2)**2 + math.cos(math.radians(la1))*math.cos(math.radians(la2))*math.sin(math.radians(lo2-lo1)/2)**2
    return 2*6371000*math.asin(math.sqrt(s))

def length(t):
    return sum(hav_ll(t[i], t[i+1]) for i in range(len(t)-1))

print("trail1 %.2f km | trail2 %.2f km" % (length(trail1)/1000, length(trail2)/1000))
print("trail2 bbox lat %.4f-%.4f lon %.4f-%.4f" % (min(p[0] for p in trail2), max(p[0] for p in trail2), min(p[1] for p in trail2), max(p[1] for p in trail2)))

def nearest(la, lo):
    return min(range(len(nodes)), key=lambda i: (nodes[i][0]-la)**2+(nodes[i][1]-lo)**2)

def add_trail(t):
    ids = []
    for (la, lo) in t:
        n = nearest(la, lo)
        if ((nodes[n][0]-la)**2+(nodes[n][1]-lo)**2)**0.5*111000 > 40:
            nodes.append((la, lo))
            adj.append([])
            n = len(nodes)-1
        if ids and ids[-1] == n:
            continue
        ids.append(n)
    for i in range(len(ids)-1):
        a, b = ids[i], ids[i+1]
        if a == b: continue
        w = max(1, round(hav_ll(nodes[a], nodes[b])))
        adj[a].append((b, w))
        adj[b].append((a, w))

def route(a, b):
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
BOT = nearest(30.09167, -81.41840)  # bottom end of your new greenway

print("before (network, no drawn trails):", route(H, BOT))
add_trail(trail1)
add_trail(trail2)
r = route(H, BOT)
def f(x): return ("%.2f km / ~%d min" % (x/1000, max(1, round(x/6.7/60)))) if x else "NO ROUTE"
print("after (with both drawn trails):   ", f(r))