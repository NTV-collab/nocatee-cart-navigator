p = 'src/routes/index.tsx'
s = open(p).read()

old = '<ol className="space-y-2">'
new_ol = '<ol className="space-y-1.5">'
# both step lists start with the same <ol className="space-y-2">
count = s.count(old)
print('ol count', count)

block_start = '<ol className="space-y-2">'
block_end = '</ol>'
# replace every occurrence between these markers with the compact next-step block
compact = (
    '<ol className="space-y-1.5">'
    '{route.steps.slice(0, 1).map((n) => ('
    '<li key={0} className="flex items-center gap-2 px-1">'
    '<span className="grid size-6 shrink-0 place-items-center rounded-full bg-cn-teal font-mono text-[10px] font-bold text-white">'
    '{route.steps.length > 1 ? route.steps.length : "\\u2192"}'
    '</span>'
    '<span className="min-w-0 flex-1 truncate text-[13px] font-medium text-cn-ink">'
    '{n ? n.text : "Arrive at destination"}'
    '</span>'
    '{route.steps.length > 1 && ('
    '<span className="shrink-0 rounded-full bg-cn-mist px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-cn-ink-soft">'
    '+{route.steps.length - 1} turns'
    '</span>'
    ')}'
    '</li>'
    '))}'
    '</ol>'
)

res = s
pos = 0
for _ in range(count):
    i = res.find(block_start, pos)
    if i < 0:
        break
    j = res.find(block_end, i)
    if j < 0:
        break
    res = res[:i] + compact + res[j + len(block_end):]
    pos = i + len(compact)

open(p, 'w').write(res)
print('replaced', count, 'step lists')