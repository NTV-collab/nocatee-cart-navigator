import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")

p = "src/routes/index.tsx"
s = open(p).read()

old = '  const [drawKind, setDrawKind] = useState<"path" | "road">("path");'
new = old + '\n  const [movePin, setMovePin] = useState(false);'
assert old in s, "state"
s = s.replace(old, new, 1)

old = """  const onMapClick = useCallback(
    (p: MapPoint) => {
      if (drawing) {
        setDraft((prev) => [...prev, p]);
        return;
      }"""
new = """  const onMapClick = useCallback(
    (p: MapPoint) => {
      if (movePin) {
        setEnd((prev) => (prev ? { lat: p.lat, lng: p.lng, label: prev.label } : { lat: p.lat, lng: p.lng }));
        setMovePin(false);
        return;
      }
      if (drawing) {
        setDraft((prev) => [...prev, p]);
        return;
      }"""
assert old in s, "click"
s = s.replace(old, new, 1)

old = "    [pickMode, start, driving, drawing],"
new = "    [pickMode, start, driving, drawing, movePin],"
assert old in s, "deps"
s = s.replace(old, new, 1)

# add the Move pin control beside Clear in the trip summary card
old = """                      <button
                        onClick={clearAll}
                        className="text-[12px] font-medium text-cn-ink-soft underline decoration-cn-line underline-offset-4 hover:text-cn-teal-deep"
                      >
                        Clear
                      </button>"""
new = """                      <button
                        onClick={() => setMovePin((v) => !v)}
                        className={
                          "text-[12px] font-medium underline decoration-cn-line underline-offset-4 transition " +
                          (movePin ? "text-cn-teal-deep" : "text-cn-ink-soft hover:text-cn-teal-deep")
                        }
                      >
                        {movePin ? "Tap map to move pin..." : "Move pin"}
                      </button>
                      <button
                        onClick={clearAll}
                        className="text-[12px] font-medium text-cn-ink-soft underline decoration-cn-line underline-offset-4 hover:text-cn-teal-deep"
                      >
                        Clear
                      </button>"""
assert old in s, "clear-btn"
s = s.replace(old, new, 1)

open(p, "w").write(s)
print("move-pin wired")