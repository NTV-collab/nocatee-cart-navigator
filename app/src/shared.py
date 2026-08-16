import os
os.chdir("/home/user/nocatee-cart-navigator-665d7ec0-6962-4020-bb8a-b2e86975b39c/app")

p = "src/components/NavMap.tsx"
s = open(p).read()

old = """        style: (f: any) => {
          const nm = f.properties?.name || "";
          if (f.properties?.kind === "road") {
            return { color: "#aeb4ad", weight: 1.8, opacity: 0.55 };
          }
          if (nm) {
            return { color: "#1f9d55", weight: 4.5, opacity: 0.95 };
          }
          return { color: "#74c08a", weight: 2.2, opacity: 0.6 };
        },"""
new = """        style: (f: any) => {
          const nm = f.properties?.name || "";
          if (f.properties?.kind === "road") {
            const shared = ["marketside avenue", "capital green drive", "settlement drive"];
            if (shared.includes(nm.toLowerCase())) {
              return { color: "#43618c", weight: 3.2, opacity: 0.85 };
            }
            return { color: "#aeb4ad", weight: 1.8, opacity: 0.55 };
          }
          if (nm) {
            return { color: "#1f9d55", weight: 4.5, opacity: 0.95 };
          }
          return { color: "#74c08a", weight: 2.2, opacity: 0.6 };
        },"""
assert old in s, "style"
s = s.replace(old, new, 1)
open(p, "w").write(s)
print("shared roadways blue")