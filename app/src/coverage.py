import json, math
from PIL import Image, ImageDraw, ImageFont

d = json.load(open("public/data/graph.json"))
nodes = list(zip(d["nodes"][::2], d["nodes"][1::2]))
saved = json.load(open("saved_roads.json"))

lats = [n[0] for n in nodes]
lons = [n[1] for n in nodes]
for line in saved:
    for p in line["geom"]:
        lats.append(p[0]); lons.append(p[1])
min_lat, max_lat = min(lats), max(lats)
min_lon, max_lon = min(lons), max(lons)

W, H = 1400, 1000
pad = 40
def P(lat, lon):
    x = pad + (lon - min_lon) / (max_lon - min_lon + 1e-9) * (W - 2 * pad)
    y = pad + (max_lat - lat) / (max_lat - min_lat + 1e-9) * (H - 2 * pad)
    return x, y

img = Image.new("RGB", (W, H), "#f7f4ec")
dr = ImageDraw.Draw(img)

for i in range(len(d["edgesA"])):
    a, b = d["edgesA"][i], d["edgesB"][i]
    dr.line([P(nodes[a][0], nodes[a][1]), P(nodes[b][0], nodes[b][1])], fill=(43, 132, 78), width=2)

for poly in d.get("forbidden", []):
    pts = [P(lat, lon) for lat, lon in poly]
    dr.line(pts, fill=(205, 64, 54), width=3)

def pt_seg_m(lat, lon):
    best = 1e18
    for idx in range(len(d["edgesA"])):
        a = d["edgesA"][idx]
        b = d["edgesB"][idx]
        lat_a, lon_a = nodes[a]
        lat_b, lon_b = nodes[b]
        M = math.cos(math.radians((lat + lat_a) / 2))
        dx = (lon_b - lon_a) * M * 111110.0
        dy = (lat_b - lat_a) * 110540.0
        px = (lon - lon_a) * M * 111110.0
        py = (lat - lat_a) * 110540.0
        t = max(0.0, min(1.0, (px * dx + py * dy) / (dx * dx + dy * dy + 1e-12)))
        ex = lon_a * M * 111110.0 + t * dx
        ey = lat_a * 110540.0 + t * dy
        exx = lon * M * 111110.0 - ex
        eyy = lat * 110540.0 - ey
        dd = exx * exx + eyy * eyy
        if dd < best:
            best = dd
    return math.sqrt(best)

print("saved-line veer report (distance from each point to the auto network):")
for line in saved:
    ds = [pt_seg_m(lat, lon) for lat, lon in line["geom"]]
    mean = sum(ds) / len(ds)
    far = sum(1 for v in ds if v > 60)
    print("  id=%s kind=%s pts=%d mean=%.0f m far(>60m)=%d/%d"
          % (line["id"], line["kind"], len(line["geom"]), mean, far, len(line["geom"])))
    for lat, lon in line["geom"]:
        dr.line([P(lat, lon), P(lat, lon)], fill=(70, 96, 145), width=6)

dr.rectangle([0, 0, W, 30], fill=(18, 42, 42))
try:
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
except Exception:
    f = ImageFont.load_default()
dr.text((14, 6), "Nocatee Cart Navigator - coverage map", fill=(255, 255, 255), font=f)
img.save("coverage.png")
print("coverage.png saved")