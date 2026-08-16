import os, sys

ROOT = "/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app"
os.chdir(ROOT)

def edit(path, pairs):
    s = open(path).read()
    sz = len(s)
    for old, new, tag in pairs:
        if old not in s:
            print("MISS (%s): %s" % (path, tag))
            continue
        s = s.replace(old, new, 1)
        print("ok (%s): %s" % (path, tag))
    if len(s) != sz:
        open(path, "w").write(s)

edit("src/lib/cart-core.ts", [
  ("  addExternalTrail(coords: [number, number][], name = \"Drawn Trail\") {",
   "  addExternalTrail(coords: [number, number][], name = \"Drawn Trail\", isRoad = false) {", "signature"),
  ("""      const w = Math.max(1, Math.round(hav(this.lat(a), this.lng(a), this.lat(b), this.lng(b))));
      this.adj[a].push({ to: b, w, nameIdx, path: true, cost: w });
      this.adj[b].push({ to: a, w, nameIdx, path: true, cost: w });""",
   """      const w = Math.max(1, Math.round(hav(this.lat(a), this.lng(a), this.lat(b), this.lng(b))));
      this.adj[a].push({ to: b, w, nameIdx, path: !isRoad, cost: isRoad ? Math.round(w * 1.3) : w });
      this.adj[b].push({ to: a, w, nameIdx, path: !isRoad, cost: isRoad ? Math.round(w * 1.3) : w });""", "core-edge"),
])

edit("src/lib/api/trails.functions.ts", [
  ("export type TrailRow = {\n  id: number;\n  name: string;\n  geom: string;\n};",
   "export type TrailRow = {\n  id: number;\n  name: string;\n  geom: string;\n  kind: string;\n};", "rowtype"),
  ("    \"SELECT id, name, geom FROM trails ORDER BY id ASC\",",
   "    \"SELECT id, name, geom, kind FROM trails ORDER BY id ASC\",", "select"),
  ("      name: z.string().max(120).optional(),\n      geom: z.string().min(10).max(500000),",
   "      name: z.string().max(120).optional(),\n      geom: z.string().min(10).max(500000),\n      kind: z.enum([\"path\", \"road\"]).optional().default(\"path\"),", "validator"),
  ("    const res = await DB.prepare(\n      \"INSERT INTO trails (name, geom) VALUES (?, ?)\",\n    )\n      .bind(data.name ?? \"\", data.geom)\n      .run();",
   "    const res = await DB.prepare(\n      \"INSERT INTO trails (name, geom, kind) VALUES (?, ?, ?)\",\n    )\n      .bind(data.name ?? \"\", data.geom, data.kind ?? \"path\")\n      .run();", "insert-sql"),
])

edit("src/components/NavMap.tsx", [
  ("  trails: { id: number; geom: [number, number][] }[];",
   "  trails: { id: number; geom: [number, number][]; kind?: \"path\" | \"road\" }[];", "trails-type"),
  ("""      const pl = L.polyline(t.geom.map((c) => [c[0], c[1]]), {
        color: "#127a43",
        weight: 3.2,
        opacity: 0.9,
        interactive: false,
      });""",
   """      const pl = L.polyline(t.geom.map((c) => [c[0], c[1]]), {
        color: t.kind === "road" ? "#43618c" : "#127a43",
        weight: t.kind === "road" ? 3 : 3.2,
        opacity: 0.9,
        interactive: false,
      });""", "navmap-color"),
])

edit("src/routes/index.tsx", [
  ("  const [trails, setTrails] = useState<{ id: number; geom: [number, number][] }[]>([]);",
   "  const [trails, setTrails] = useState<{ id: number; geom: [number, number][]; kind: \"path\" | \"road\" }[]>([]);\n  const [drawKind, setDrawKind] = useState<\"path\" | \"road\">(\"path\");", "trail-state"),
  ("        const parsed: { id: number; geom: [number, number][] }[] = [];",
   "        const parsed: { id: number; geom: [number, number][]; kind: \"path\" | \"road\" }[] = [];", "parsed-type"),
  ("              parsed.push({ id: r.id, geom: g as [number, number][] });",
   "              parsed.push({ id: r.id, geom: g as [number, number][], kind: r.kind === \"road\" ? \"road\" : \"path\" });", "parsed-push"),
  ("          routerRef.current?.addExternalTrail(t.geom);",
   "          routerRef.current?.addExternalTrail(t.geom, undefined, t.kind === \"road\");", "attach-load"),
  ("""      await saveTrail({ data: { geom: JSON.stringify(geo) } });
      routerRef.current?.addExternalTrail(geo);
      setTrails((prev) => [...prev, { id: Date.now(), geom: geo }]);""",
   """      await saveTrail({ data: { geom: JSON.stringify(geo), kind: drawKind } });
      routerRef.current?.addExternalTrail(geo, undefined, drawKind === "road");
      setTrails((prev) => [...prev, { id: Date.now(), geom: geo, kind: drawKind }]);""", "save-draft"),
  ("  }, [draft]);", "  }, [draft, drawKind]);", "save-deps"),
  ("""            <button
              onClick={() => saveDraft()}
              disabled={draft.length < 2 || saving}
              className="rounded-full bg-cn-teal px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save trail"}
            </button>""",
   """            <div className="flex items-center gap-1 rounded-full bg-cn-sand-deep p-0.5">
              <button
                onClick={() => setDrawKind("path")}
                className={
                  "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition " +
                  (drawKind === "path" ? "bg-cn-teal text-white" : "text-cn-ink-soft")
                }
              >
                Path
              </button>
              <button
                onClick={() => setDrawKind("road")}
                className={
                  "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition " +
                  (drawKind === "road" ? "bg-[#43618c] text-white" : "text-cn-ink-soft")
                }
              >
                Road
              </button>
            </div>
            <button
              onClick={() => saveDraft()}
              disabled={draft.length < 2 || saving}
              className="rounded-full bg-cn-teal px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save"}
            </button>""", "draw-panel"),
  ("OpenStreetMap & cart-path data · red = not permitted for carts · green = legal paths & streets (incl. parking-lot drives) · not affiliated with Nocatee",
   "OpenStreetMap & cart-path data · blue = saved streets · green = saved trails · red = not permitted · not affiliated with Nocatee", "legend"),
])

print("all edits applied")