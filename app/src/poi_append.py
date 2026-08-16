import json, os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")

rows = json.load(open("poi_results.json"))
dests = []
seen = {
    "publix at town center", "nocatee town center", "splash waterpark", "spray waterpark",
    "crosswater hall", "orangetheory fitness", "nocatee welcome center", "nocatee resident services",
    "fitness club", "lap pool", "crosswater & preservation roundabout",
}
for name, group, sub, src, loc in rows:
    if src == "missing" or not loc:
        continue
    if name.lower() in seen:
        continue
    seen.add(name.lower())
    gmap = {"food": "food & shops", "retail": "food & shops", "health": "pools & clubs", "services": "venues"}
    dests.append({
        "name": name,
        "sub": sub,
        "lat": loc[0],
        "lng": loc[1],
        "zone": "east",
        "group": gmap.get(group, "venues"),
    })

lines = ["  { name: %r, sub: %r, lat: %.6f, lng: %.6f, zone: %r, group: %r }," % (
    d["name"], d["sub"], d["lat"], d["lng"], d["zone"], d["group"]) for d in dests]

p = "src/lib/destinations.ts"
s = open(p).read().rstrip()
assert s.endswith("];")
s = s[:-2] + "\n" + "\n".join(lines) + "\n];\n"
open(p, "w").write(s)
print("appended", len(dests), "destinations")
for d in dests:
    print(" +", d["name"], (d["lat"], d["lng"]))