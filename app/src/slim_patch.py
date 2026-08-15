p = 'src/routes/index.tsx'
s = open(p).read()

s = s.replace('max-w-md px-2 sm:px-3', 'max-w-sm px-2 sm:px-3', 1)

old = 'className="flex items-center gap-2 rounded-lg border border-cn-line bg-white px-2.5 py-1.5 transition focus-within:border-cn-teal"'
new = 'className="flex items-center gap-1.5 rounded-lg border border-cn-line bg-white px-2 py-1 transition focus-within:border-cn-teal"'
assert old in s, 'field'
s = s.replace(old, new, 1)

open(p, 'w').write(s)
print('slim search applied')