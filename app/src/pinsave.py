import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")

# 1) upsert endpoint in trails.functions.ts
p = "src/lib/api/trails.functions.ts"
s = open(p).read()
add = '''

export const upsertTrail = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1).max(120),
      geom: z.string().min(10).max(500000),
    }),
  )
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) throw new Error("database unavailable");
    await DB.prepare("DELETE FROM trails WHERE name = ?").bind(data.name).run();
    await DB.prepare("INSERT INTO trails (name, geom, kind) VALUES (?, ?, 'path')")
      .bind(data.name, data.geom)
      .run();
    return { ok: true };
  });
'''
assert "export const deleteTrail" in s
s = s.replace("export const deleteTrail", add + "export const deleteTrail", 1)
open(p, "w").write(s)
print("api ok")

# 2) index.tsx: import, auto-save on move, overrides on load/select
p = "src/routes/index.tsx"
t = open(p).read()

old = 'import { listTrails, saveTrail } from "../lib/api/trails.functions";'
new = 'import { listTrails, saveTrail, upsertTrail } from "../lib/api/trails.functions";'
assert old in t, "import"
t = t.replace(old, new, 1)

# auto-save the moved pin (uses the destination label as the name)
old = """      if (movePin) {
        setEnd((prev) => (prev ? { lat: p.lat, lng: p.lng, label: prev.label } : { lat: p.lat, lng: p.lng }));
        setMovePin(false);
        return;
      }"""
new = """      if (movePin) {
        let label: string | null = null;
        setEnd((prev) => {
          label = prev?.label ?? null;
          return prev ? { lat: p.lat, lng: p.lng, label: prev.label } : { lat: p.lat, lng: p.lng };
        });
        setMovePin(false);
        if (label) {
          try {
            upsertTrail({ data: { name: label, geom: JSON.stringify([[p.lat, p.lng], [p.lat, p.lng]]) } });
          } catch {}
        }
        return;
      }"""
assert old in t, "movepin-save"
t = t.replace(old, new, 1)

# overrides map from saved trails
old = """        setTrails(parsed);
        for (const t of parsed) {
          routerRef.current?.addExternalTrail(t.geom, undefined, t.kind === "road");
        }"""
new = """        setTrails(parsed);
        const ov: Record<string, [number, number]> = {};
        for (const t of parsed) {
          if (t.name && t.geom.length) ov[t.name] = t.geom[0];
          routerRef.current?.addExternalTrail(t.geom, undefined, t.kind === "road");
        }
        setPinOverrides(ov);"""
assert old in t, "load-override"
t = t.replace(old, new, 1)

# state
old = '  const [movePin, setMovePin] = useState(false);'
new = old + '\n  const [pinOverrides, setPinOverrides] = useState<Record<string, [number, number]>>({});'
assert old in t, "state"
t = t.replace(old, new, 1)

# pickDestination respects overrides
old = """      const t = target ?? pickMode;
      const pt: MapPoint = { lat: d.lat, lng: d.lng, label: d.name };"""
new = """      const t = target ?? pickMode;
      const ov = pinOverrides[d.name];
      const pt: MapPoint = ov
        ? { lat: ov[0], lng: ov[1], label: d.name }
        : { lat: d.lat, lng: d.lng, label: d.name };"""
assert old in t, "pickdest"
t = t.replace(old, new, 1)

open(p, "w").write(t)
print("index ok")