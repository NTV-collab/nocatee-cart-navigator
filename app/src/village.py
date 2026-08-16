import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b21863fc5e8442bcd948e3a677f1bc4b/app" if False else "/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")
p = "src/components/NavMap.tsx"
s = open(p).read()
old = 'const shared = ["marketside avenue", "capital green drive", "settlement drive"];'
new = 'const shared = ["marketside avenue", "capital green drive", "settlement drive", "nocatee village drive"];'
assert old in s, "shared"
open(p, "w").write(s.replace(old, new, 1))
print("nocatee village drive added to shared blue")