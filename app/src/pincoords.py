import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")

p = "src/routes/index.tsx"
s = open(p).read()

old = """          upsertTrail({ data: { name: label, geom: JSON.stringify([[p.lat, p.lng], [p.lat, p.lng]]) } })
            .then(() => {
              setPinNotice("Pin saved: " + label);
              window.setTimeout(() => setPinNotice(null), 4000);
            })
            .catch(() => setPinNotice("Could not save the pin. Try again."));"""
new = """          upsertTrail({ data: { name: label, geom: JSON.stringify([[p.lat, p.lng], [p.lat, p.lng]]) } })
            .then(() => {
              setPinNotice(
                "Pin saved (lat " + p.lat.toFixed(6) + ", lng " + p.lng.toFixed(6) + ")",
              );
              window.setTimeout(() => setPinNotice(null), 6000);
            })
            .catch(() => setPinNotice("Could not save the pin. Try again."));"""
assert old in s, "coords-toast"
s = s.replace(old, new, 1)

open(p, "w").write(s)
print("coords toast ok")