p = 'src/routes/index.tsx'
s = open(p).read()

helper = '''const toRad = (d: number) => (d * Math.PI) / 180;

function nextTurnAngle(route: RouteResult): number {
  const pts = route?.points;
  if (!pts || pts.length < 2) return 0;
  const brg = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
    const x =
      Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
      Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  };
  const b0 = brg(pts[0], pts[1]);
  if (route.steps[0]?.kind === "turn" && pts.length > 2) {
    const b1 = brg(pts[1], pts[2]);
    return (b1 - b0 + 540) % 360 - 180;
  }
  return b0;
}

'''
anchor = 'const fmtMeters = (m: number): string => {\n  if (m < 1000) return'
if 'function nextTurnAngle' not in s:
    assert anchor in s, 'fmtanchor'
    s = s.replace(anchor, helper + anchor, 1)
    print('helper inserted')

old_badge = '<span className="grid size-6 shrink-0 place-items-center rounded-full bg-cn-teal font-mono text-[10px] font-bold text-white">{route.steps.length > 1 ? route.steps.length : "\\u2192"}</span>'
new_badge = '<span className="grid size-7 shrink-0 place-items-center rounded-full border border-cn-line bg-white text-cn-ink shadow-sm"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ transform: `rotate(${nextTurnAngle(route)}deg)` }} aria-hidden="true"><path d="M12 3l6.5 7.5h-4.2V21h-4.6V10.5H5.5L12 3z" /></svg></span>'
count = s.count(old_badge)
print('badge occurrences', count)
assert count > 0, 'badge'
s = s.replace(old_badge, new_badge)

open(p, 'w').write(s)
print('arrow patched', count)