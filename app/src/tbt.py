import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")

p = "src/routes/index.tsx"
s = open(p).read()

old = "  const [pinNotice, setPinNotice] = useState<string | null>(null);"
new = old + '\n  const [showSteps, setShowSteps] = useState(false);'
assert old in s, "state"
s = s.replace(old, new, 1)

# button in the planning trip card (beside Clear)
old = """                      <button
                        onClick={clearAll}
                        className="text-[12px] font-medium text-cn-ink-soft underline decoration-cn-line underline-offset-4 hover:text-cn-teal-deep"
                      >
                        Clear
                      </button>"""
new = """                      <button
                        onClick={() => setShowSteps(true)}
                        className="text-[12px] font-medium text-cn-ink-soft underline decoration-cn-line underline-offset-4 hover:text-cn-teal-deep"
                      >
                        Turns
                      </button>
                      <button
                        onClick={clearAll}
                        className="text-[12px] font-medium text-cn-ink-soft underline decoration-cn-line underline-offset-4 hover:text-cn-teal-deep"
                      >
                        Clear
                      </button>"""
assert old in s, "plan-btn"
s = s.replace(old, new, 1)

# button in the drive HUD (beside End Drive)
old = """                <button
                  onClick={endDrive}
                  className="rounded-full border border-cn-line bg-white px-4 py-2 text-[13px] font-semibold text-cn-ink-soft transition hover:border-cn-clay hover:text-cn-clay active:scale-95"
                >
                  End Drive
                </button>"""
new = """                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSteps(true)}
                    className="rounded-full border border-cn-line bg-white px-4 py-2 text-[13px] font-semibold text-cn-ink transition hover:text-cn-teal-deep active:scale-95"
                  >
                    Turns
                  </button>
                  <button
                    onClick={endDrive}
                    className="rounded-full border border-cn-line bg-white px-4 py-2 text-[13px] font-semibold text-cn-ink-soft transition hover:border-cn-clay hover:text-cn-clay active:scale-95"
                  >
                    End Drive
                  </button>
                </div>"""
assert old in s, "drive-btn"
s = s.replace(old, new, 1)

# the list overlay, right before the tiny attribution line
old = """      {/* tiny attribution line */}
      <div className="absolute bottom-1 left-2 z-[300]"""
new = """      {showSteps && route && (
        <div className="absolute inset-0 z-[800] flex items-end justify-center bg-cn-ink/40 backdrop-blur-[1px] sm:items-center sm:pb-0">
          <div className="flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-cn-paper shadow-2xl">
            <div className="flex items-center justify-between border-b border-cn-line px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cn-ink-soft">
                Turn by turn · {route.steps.length} steps
              </p>
              <button
                onClick={() => setShowSteps(false)}
                aria-label="Close turn-by-turn"
                className="grid size-8 place-items-center rounded-full text-cn-ink-soft transition hover:bg-cn-sand-deep hover:text-cn-ink"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <ol className="space-y-3 overflow-y-auto px-4 py-4">
              {route.steps.map((st, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className={
                      "mt-0.5 shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] " +
                      (st.kind === "arrive"
                        ? "bg-cn-ink text-white"
                        : st.kind === "turn"
                          ? "bg-cn-mist text-cn-teal-deep"
                          : st.kind === "cross"
                            ? "bg-cn-sand-deep text-cn-clay"
                            : "bg-cn-mist text-cn-ink-soft")
                    }
                  >
                    {st.kind === "arrive" ? "OK" : i + 1}
                  </span>
                  <span className="text-[13px] leading-snug text-cn-ink">
                    {st.text}
                    {st.dist > 0 && (
                      <span className="ml-2 font-mono text-[11px] text-cn-ink-soft">{fmtMeters(st.dist)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between border-t border-cn-line px-4 py-3 text-[12px] text-cn-ink-soft">
              <span>
                {fmtMeters(route.meters)} · about {route.minutes} min
              </span>
              <button
                onClick={() => {
                  setShowSteps(false);
                  clearAll();
                }}
                className="font-medium text-cn-ink-soft underline decoration-cn-line underline-offset-4 hover:text-cn-teal-deep"
              >
                Clear route
              </button>
            </div>
          </div>
        </div>
      )}

      {/* tiny attribution line */}
      <div className="absolute bottom-1 left-2 z-[300]"""
assert old in s, "overlay"
s = s.replace(old, new, 1)

open(p, "w").write(s)
print("turn-by-turn sheet wired")