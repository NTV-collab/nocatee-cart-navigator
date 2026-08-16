import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")

def edit(path, old, new, tag):
    s = open(path).read()
    if old not in s:
        print("MISS", tag)
        return
    open(path, "w").write(s.replace(old, new, 1))
    print("ok", tag)

edit("src/lib/cart-core.ts",
 """      this.adj[a].push({ to: b, w, nameIdx, path: true, cost });
      this.adj[b].push({ to: a, w, nameIdx, path: true, cost });""",
 """      this.adj[a].push({ to: b, w, nameIdx, path: !isRoad, cost: isRoad ? Math.round(w * 1.3) : w });
      this.adj[b].push({ to: a, w, nameIdx, path: !isRoad, cost: isRoad ? Math.round(w * 1.3) : w });""",
 "core-edge")

s = open("src/routes/index.tsx").read()
start = s.find('onClick={() => saveDraft()}')
if start > -1:
    end = s.find("</button>", start)
    old_block = s[start:end + len("</button>")]
    new_block = """<button
              onClick={() => saveDraft()}
              disabled={draft.length < 2 || saving}
              className="rounded-full bg-cn-teal px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save"}
            </button>"""
    s = s.replace(old_block, new_block, 1)
    print("ok draw-panel button")

legend_old = "red = not permitted for carts \\u00b7 green = legal paths & streets (incl. parking-lot drives)"
if legend_old in s:
    s = s.replace(legend_old, "blue = saved streets \\u00b7 green = saved trails \\u00b7 red = not permitted", 1)
    print("ok legend")
else:
    print("MISS legend")

# insert the drawKind toggle right before the save button block
anchor = "onClick={() => saveDraft()}"
tog = """<div className="flex items-center gap-1 rounded-full bg-cn-sand-deep p-0.5">
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
              <"""
s = s.replace(anchor, tog, 1)  # placeholder: anchor contains only onClick; prepend toggle before it

# fix structure: the toggle must sit above the <button>; replace the open <button after toggle
s = s.replace(toggle + "<", toggle + "\n            <button", 1)
open("src/routes/index.tsx", "w").write(s)
print("index written")