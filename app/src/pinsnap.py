p = 'src/components/NavMap.tsx'
s = open(p).read()

old = '''    if (st) group.addLayer(mk(st.lat, st.lng, "A", "cn-marker-start"));
    if (en) group.addLayer(mk(en.lat, en.lng, "B", "cn-marker-end"));'''
new = '''    // pins sit exactly on the route ends so they can never appear detached
    const rEnd = rt && rt.points.length > 1 ? rt.points[rt.points.length - 1] : null;
    const rStart = rt && rt.points.length > 1 ? rt.points[0] : null;
    if (st || rStart) group.addLayer(mk((rStart ?? st).lat, (rStart ?? st).lng, "A", "cn-marker-start"));
    if (en || rEnd) group.addLayer(mk((rEnd ?? en).lat, (rEnd ?? en).lng, "B", "cn-marker-end"));'''
assert old in s, 'pins'
s = s.replace(old, new, 1)
open(p, 'w').write(s)
print('pins snap to route ends')