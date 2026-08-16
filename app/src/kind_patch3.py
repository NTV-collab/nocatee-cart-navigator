import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")

p = "src/routes/index.tsx"
s = open(p).read()

old = """                <span className="font-mono text-[9px] uppercase tracking-wide text-cn-ink-soft">
                  Drawing trail ({draft.length} pts)
                </span>
                <button
                  onClick={() => saveDraft()}
                  disabled={draft.length < 2 || saving}
                  className="rounded-full bg-cn-teal px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save trail"}
                </button>"""
new = """                <span className="font-mono text-[9px] uppercase tracking-wide text-cn-ink-soft">
                  Drawing {drawKind === "road" ? "street" : "trail"} ({draft.length} pts)
                </span>
                <div className="flex items-center gap-1 rounded-full bg-cn-sand-deep p-0.5">
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
                </button>"""
assert old in s, "panel"
s = s.replace(old, new, 1)

leg = "red = not permitted for carts \\u00b7 green = legal paths & streets (incl. parking-lot drives)"
if leg in s:
    s = s.replace(leg, "blue = saved streets \\u00b7 green = saved trails \\u00b7 red = not permitted", 1)
    print("legend ok")

open(p, "w").write(s)
print("index patched (panel + legend)")