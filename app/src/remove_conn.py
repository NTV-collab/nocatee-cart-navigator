import json

D = json.load(open("public/data/graph.json"))

idx = None
if "Heron-Pelican Connector" in D["names"]:
    idx = D["names"].index("Heron-Pelican Connector")

keep_edges = []
for i in range(len(D["edgesA"])):
    is_conn = idx is not None and D["edgesNameIdx"][i] == idx
    if not is_conn:
        keep_edges.append(i)

def pick(field):
    return [D[field][i] for i in keep_edges]

D["edgesA"] = pick("edgesA")
D["edgesB"] = pick("edgesB")
D["edgesW"] = pick("edgesW")
D["edgesNameIdx"] = pick("edgesNameIdx")
D["edgesPath"] = pick("edgesPath")

if idx is not None:
    D["names"] = [n for n in D["names"] if n != "Heron-Pelican Connector"]

json.dump(D, open("public/data/graph.json", "w"), separators=(",", ":"))
print("edges now:", len(D["edgesA"]), "| connector removed:", idx is not None)