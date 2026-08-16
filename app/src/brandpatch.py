import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")

p = "src/styles.css"
s = open(p).read()

old = """  --color-cn-ink: #142b2b;
  --color-cn-ink-soft: #3c5452;
  --color-cn-teal: #1e7c66;
  --color-cn-teal-deep: #06504c;
  --color-cn-lagoon: #2fae9a;
  --color-cn-sand: #f3efe5;
  --color-cn-sand-deep: #eae3d3;
  --color-cn-paper: #fbf9f3;
  --color-cn-line: #ddd5c2;
  --color-cn-mist: #e7efec;
  --color-cn-clay: #9e5b3b;"""
new = """  --color-cn-ink: #00364a;
  --color-cn-ink-soft: #2e5562;
  --color-cn-teal: #0099ba;
  --color-cn-teal-deep: #00788f;
  --color-cn-lagoon: #33b3ce;
  --color-cn-sand: #f6f4ee;
  --color-cn-sand-deep: #ece8de;
  --color-cn-paper: #ffffff;
  --color-cn-line: #dbe3e5;
  --color-cn-mist: #e6f3f6;
  --color-cn-clay: #ba5700;"""
assert old in s, "tokens"
s = s.replace(old, new, 1)

open(p, "w").write(s)
print("tokens ok")

p = "src/routes/index.tsx"
t = open(p).read()
# brand-ish header: keep CN monogram, navy text, cyan accent is automatic via tokens;
# add the tagline under the wordmark for a brand lockup feel
old = '<span className="text-[14px] font-semibold tracking-tight">Nocatee Cart Navigator</span>'
new = ('<span className="text-[14px] font-semibold tracking-tight text-cn-ink">Nocatee Cart Navigator</span>\n'
       '                    <span className="text-cn-teal">{'+"'"+'}EV PATH GPS</span>')
assert old in t, "header"
t = t.replace(old, new, 1)
open(p, "w").write(t)
print("header ok")