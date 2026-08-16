import json, math, urllib.request, urllib.parse, time, os

os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")
HDR = {"User-Agent": "nocatee-cartnav/1.0 (resident tool)"}
TC = (30.1095, -81.4185)

def overpass(q):
    req = urllib.request.Request("https://overpass-api.de/api/interpreter",
                                 data=("data=" + urllib.parse.quote(q)).encode(),
                                 headers=HDR)
    return json.load(urllib.request.urlopen(req, timeout=90))["elements"]

def nom(q):
    url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&q=" + urllib.parse.quote(q)
    try:
        rows = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=25))
        hits = []
        for r in rows:
            la = float(r["lat"]); lo = float(r["lon"])
            d = math.hypot(la - TC[0], lo - TC[1]) * 111000
            if d < 4000:
                hits.append((d, la, lo))
        hits.sort()
        if hits:
            return hits[0][1], hits[0][2]
    except Exception:
        pass
    return None, None

ots = []
for _ in range(3):
    try:
        ots = overpass('[out:json][timeout:120];node["name"](30.103,-81.430,30.1138,-81.405);out;')
        break
    except Exception:
        time.sleep(6)
osm = {}
for e in ots:
    nm = e.get("tags", {}).get("name", "")
    if nm:
        osm[nm.lower()] = (round(e["lat"], 6), round(e["lon"], 6))
print("OSM TC POIs:", len(osm))

BUS = [
 ("Anejo Cocina Mexicana", "food", "Mexican"),
 ("Bronx House Pizza", "food", "Pizza"),
 ("Chop House at Nocatee", "food", "Steakhouse"),
 ("Clean Juice", "food", "Juice bar"),
 ("Dunkin' Donuts", "food", "Coffee"),
 ("Jersey Mike's Subs", "food", "Subs"),
 ("M Shack Nocatee", "food", "Burgers"),
 ("Publix GreenWise Market", "food", "Market"),
 ("Salata", "food", "Salads"),
 ("South Kitchen & Spirits", "food", "Dining"),
 ("Starbucks Coffee", "food", "Coffee"),
 ("Tank's Sushi Bistro", "food", "Sushi"),
 ("The Kookaburra Coffee", "food", "Coffee"),
 ("Loop Restaurant", "food", "Dining"),
 ("Tijuana Flats", "food", "Mexican"),
 ("CVS Pharmacy", "retail", "Pharmacy"),
 ("GNC", "retail", "Vitamins"),
 ("Publix Super Market", "retail", "Grocery"),
 ("Tillman's Meats & Country Store", "retail", "Meats"),
 ("Verizon Wireless", "retail", "Mobile"),
 ("Aesthetix Plus", "health", "Wellness"),
 ("All American Acupuncture", "health", "Acupuncture"),
 ("Anytime Fitness Center", "health", "Gym"),
 ("Baptist Health AgeWell Center", "health", "Health"),
 ("Fit20 Personal Training", "health", "Fitness"),
 ("Orange Theory Fitness", "health", "Fitness"),
 ("Wholistic Wellness", "health", "Wellness"),
 ("AT&T", "services", "Mobile"),
 ("Baggett Law", "services", "Law"),
 ("Gate Gas Station & Convenience Store", "services", "Gas"),
 ("The Link (Innovation & Activity Hub)", "services", "Hub"),
 ("Truist Bank", "services", "Bank"),
]

results = []
for name, group, sub in BUS:
    loc = None
    src = "missing"
    for key, val in osm.items():
        probe = name.split(" ")[0].lower()
        if probe and probe in key:
            loc = val; src = "osm"
            break
    if not loc:
        lat, lon = nom(name + " Nocatee")
        if lat:
            loc = (lat, lon); src = "nom"
        time.sleep(1.1)
    results.append((name, group, sub, src, loc))

for r in results:
    print(r)
json.dump(results, open("poi_results.json", "w"))
print("DONE")