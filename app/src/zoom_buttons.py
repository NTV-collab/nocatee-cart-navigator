p = 'src/components/NavMap.tsx'
s = open(p).read()

# props
old = '''  onMapClick: (p: MapPoint) => void;
  onReady: () => void;
};'''
new = '''  onMapClick: (p: MapPoint) => void;
  onReady: () => void;
  onMapReady?: (map: any) => void;
};'''
assert old in s, 'proptype'
s = s.replace(old, new, 1)

old = '''  onMapClick,
  onReady,
}: Props) {'''
new = '''  onMapClick,
  onReady,
  onMapReady,
}: Props) {'''
assert old in s, 'destructure'
s = s.replace(old, new, 1)

old = '''          mapRef.current = map;
          L.control.zoom({ position: "bottomright" }).addTo(map);'''
new = '''          mapRef.current = map;
          onMapReady?.(map);'''
assert old in s, 'ctrl'
s = s.replace(old, new, 1)

open(p, 'w').write(s)
print('navmap zoom wired')

p = 'src/routes/index.tsx'
t = open(p).read()
old = '''  const routerRef = useRef<CartRouter | null>(null);'''
new = '''  const routerRef = useRef<CartRouter | null>(null);
  const leafletMap = useRef<any>(null);'''
assert old in t, 'ref'
t = t.replace(old, new, 1)

old = '''        onMapClick={onMapClick}
        onReady={() => setReady(true)}'''
new = '''        onMapClick={onMapClick}
        onReady={() => setReady(true)}
        onMapReady={(m) => {
          leafletMap.current = m;
        }}'''
assert old in t, 'prop'
t = t.replace(old, new, 1)

old = '''            <button
              onClick={() => setDrawing((v) => !v)}'''
new = '''            <div className="flex flex-col gap-1 rounded-full border border-cn-line bg-white/95 p-1 shadow-md">
              <button
                onClick={() => leafletMap.current?.zoomIn()}
                aria-label="Zoom in"
                className="grid size-8 place-items-center rounded-full text-cn-ink-soft transition hover:bg-cn-mist hover:text-cn-teal-deep active:scale-95"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <div className="h-px w-5 bg-cn-line" />
              <button
                onClick={() => leafletMap.current?.zoomOut()}
                aria-label="Zoom out"
                className="grid size-8 place-items-center rounded-full text-cn-ink-soft transition hover:bg-cn-mist hover:text-cn-teal-deep active:scale-95"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h14" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => setDrawing((v) => !v)}'''
assert old in t, 'buttons'
t = t.replace(old, new, 1)

open(p, 'w').write(t)
print('index zoom buttons added')