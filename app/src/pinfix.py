import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")

p = "src/routes/index.tsx"
s = open(p).read()

old = """      if (movePin) {
        let label: string | null = null;
        setEnd((prev) => {
          label = prev?.label ?? null;
          return prev ? { lat: p.lat, lng: p.lng, label: prev.label } : { lat: p.lat, lng: p.lng };
        });
        setMovePin(false);
        if (label) {
          upsertTrail({ data: { name: label, geom: JSON.stringify([[p.lat, p.lng], [p.lat, p.lng]]) } })
            .then(() => {
              setPinNotice(
                "Pin saved (lat " + p.lat.toFixed(6) + ", lng " + p.lng.toFixed(6) + ")",
              );
              window.setTimeout(() => setPinNotice(null), 6000);
            })
            .catch(() => setPinNotice("Could not save the pin. Try again."));
        }
        return;
      }"""
new = """      if (movePin) {
        const label = end?.label ?? null;
        setEnd((prev) =>
          prev ? { lat: p.lat, lng: p.lng, label: prev.label } : { lat: p.lat, lng: p.lng },
        );
        setMovePin(false);
        if (label) {
          upsertTrail({ data: { name: label, geom: JSON.stringify([[p.lat, p.lng], [p.lat, p.lng]]) } })
            .then(() => {
              setPinNotice("Pin saved (lat " + p.lat.toFixed(6) + ", lng " + p.lng.toFixed(6) + ")");
              window.setTimeout(() => setPinNotice(null), 6000);
            })
            .catch(() => setPinNotice("Could not save the pin. Try again."));
        } else {
          setPinNotice("Moved (no name to save)");
          window.setTimeout(() => setPinNotice(null), 3000);
        }
        return;
      }"""
assert old in s, "movepin"
s = s.replace(old, new, 1)

old = "    [pickMode, start, driving, drawing, movePin],"
new = "    [pickMode, start, driving, drawing, movePin, end],"
assert old in s, "deps"
s = s.replace(old, new, 1)

open(p, "w").write(s)
print("pin save fixed")