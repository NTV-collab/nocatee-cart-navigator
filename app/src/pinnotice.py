import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")

p = "src/routes/index.tsx"
s = open(p).read()

old = "  const [pinOverrides, setPinOverrides] = useState<Record<string, [number, number]>>({});"
new = old + '\n  const [pinNotice, setPinNotice] = useState<string | null>(null);'
assert old in s, "notice-state"
s = s.replace(old, new, 1)

old = """        if (label) {
          try {
            upsertTrail({ data: { name: label, geom: JSON.stringify([[p.lat, p.lng], [p.lat, p.lng]]) } });
          } catch {}
        }
        return;"""
new = """        if (label) {
          upsertTrail({ data: { name: label, geom: JSON.stringify([[p.lat, p.lng], [p.lat, p.lng]]) } })
            .then(() => {
              setPinNotice("Pin saved: " + label);
              window.setTimeout(() => setPinNotice(null), 4000);
            })
            .catch(() => setPinNotice("Could not save the pin. Try again."));
        }
        return;"""
assert old in s, "pin-save"
s = s.replace(old, new, 1)

# render the notice banner (below the location banner slot)
old = """      {locError && !locBannerDismissed && ("""
new = """      {pinNotice && (
        <div className="absolute left-1/2 top-40 z-[650] w-[max-content] max-w-md -translate-x-1/2 rounded-lg border border-cn-teal/40 bg-cn-paper/95 px-4 py-2 text-[12px] font-medium text-cn-teal-deep shadow-lg backdrop-blur-sm">
          {pinNotice}
        </div>
      )}
      {locError && !locBannerDismissed && ("""
assert old in s, "notice-render"
s = s.replace(old, new, 1)

open(p, "w").write(s)
print("pin notice wired")