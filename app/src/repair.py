import json

D = json.load(open("public/data/graph.json"))
full_edges = len(D["edgesA"])
orig_edges = 5101
orig_nodes = 3977
if full_edges == 5116:
    # drop the 15 broken connector edges appended at the end; restore node list to base
    D["edgesA"] = D["edgesA"][: orig_edges]
    D["edgesB"] = D["edgesB"][: orig_edges]
    D["edgesW"] = D["edgesW"][: orig_edges]
    D["edgesNameIdx"] = D["edgesNameIdx"][: orig_edges]
    D["edgesPath"] = D["edgesPath"][: orig_edges]
    D["nodes"] = D["nodes"][: orig_nodes * 2]
    print("trimmed to edges", len(D["edgesA"]), "nodes", len(D["nodes"]) // 2)
else:
    print("unexpected edge count", full_edges, "- leaving untouched")
json.dump(D, open("public/data/graph.json", "w"), separators=(",", ":"))
print("saved")