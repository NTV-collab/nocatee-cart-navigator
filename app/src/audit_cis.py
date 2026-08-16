import json, math, heapq, urllib.request

D = json.load(open("/tmp/g.json"))
nodes = list(zip(D["nodes"][::2], D["nodes"][1::2]))
N = len(nodes)
adj = [[] for _ in range(N)]
for i in range(len(D["edgesA"])):
    a, b, w = D["edgesA"][i], D["edgesB"][i], D["edgesW"][i]
    adj[a].append((b, w)); adj[b].append((a, w))

def nearest(la, lo):
    return min(range(N), key=lambda i: (nodes[i][0]-la)**2 + (nodes[i][1]-lo)**2)

def snap_m(a):  # meters between pin and its routing node
    return math.sqrt((nodes[a][0]-la)**2 + (nodes[a][1]-lo)**2)*111000

def route(a, b):
    dist=[1e18]*N; dist[a]=0; pq=[(0,a)]
    while pq:
        du,u=heapq.heappop(pq)
        if du>dist[u]: continue
        if u==b: break
        for v,w in adj[u]:
            if du+w<dist[v]: dist[v]=du+w; heapq.heappush(pq,(du+w,v))
    return dist[b] if dist[b]<1e18 else None

dests = [
 ("Nocatee Town Center",30.1100,-81.41787),
 ("Nocatee Welcome Center",30.1088,-81.4203),
 ("Nocatee Resident Services",30.1086,-81.4202),
 ("Nocatee Fitness Club",30.10318,-81.41554),
 ("Lap Pool",30.10305,-81.41685),
 ("Orangetheory Fitness",30.10972,-81.41809),
 ("Crosswater & Preservation Roundabout",30.1062,-81.4248),
 ("Splash Waterpark",30.10359,-81.41623),
 ("Spray Waterpark",30.10006,-81.41568),
 ("Nocatee Community Park",30.09667,-81.41431),
 ("Crosswater Hall",30.1033,-81.41516),
 ("Crosswater Park",30.07135,-81.40175),
 ("Palm Valley Academy",30.12056,-81.40763),
 ("Ponte Vedra HS",30.11246,-81.39451),
 ("Pine Island Academy",30.05015,-81.39475),
 ("Publix TC",30.11054,-81.41951),
 ("Crosswater Church",30.12156,-81.39673),
 ("Valley Ridge Academy",30.09867,-81.45477),
 ("Nease HS",30.07942,-81.44765),
 ("Palm Valley Golf",30.10135,-81.43561),
 ("Cypress Pool",30.11511,-81.45579),
 ("St JP II",30.12303,-81.43508),
]
TC = nearest(30.11,-81.41787)
for name, lat0, lon0 in dests:
    la, lo = lat0, abs(lon0) if lon0<0 else lon0
    a = nearest(la, -lo)
    snapM = math.sqrt((nodes[a][0]-la)**2 + (nodes[a][1]-(-lo))**2)*111000
    r = route(TC, a)
    print("%-36s snap %3d m  route %s" % (name, round(snapM), ("%.2f km"% (r/1000)) if r else "NO ROUTE"))