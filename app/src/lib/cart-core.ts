import type { CartGraph } from "./cart-data";

export type MapPoint = { lat: number; lng: number; label?: string };

export type RouteStep = {
  text: string;
  dist: number;
  kind: "go" | "turn" | "cross" | "arrive";
};

export type RouteResult = {
  points: MapPoint[];
  nodePath: number[];
  meters: number;
  minutes: number;
  steps: RouteStep[];
};

type Edge = { to: number; w: number; nameIdx: number; path: boolean; cost: number };

const CART_SPEED_MS = 6.7; // ~15 mph cruising

export class CartRouter {
  private nodes: number[];
  private adj: Edge[][];

  constructor(private g: CartGraph) {
    this.nodes = g.nodes;
    this.adj = Array.from({ length: g.nodes.length / 2 }, () => []);
    for (let i = 0; i < g.edgesA.length; i++) {
      const a = g.edgesA[i];
      const b = g.edgesB[i];
      const w = g.edgesW[i];
      const path = g.edgesPath[i] === 1;
      const nameIdx = g.edgesNameIdx[i];
      // trails cost least; named streets a little; unnamed cut-throughs a lot
      const cost = path ? w : nameIdx >= 0 ? Math.round(w * 1.2) : Math.round(w * 2.4);
      this.adj[a].push({ to: b, w, nameIdx, path, cost });
      this.adj[b].push({ to: a, w, nameIdx, path, cost });
    }
  }

  lat(idx: number): number {
    return this.nodes[idx * 2];
  }
  lng(idx: number): number {
    return this.nodes[idx * 2 + 1];
  }

  nearest(lat: number, lng: number): number {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < this.nodes.length / 2; i++) {
      const d = (this.lat(i) - lat) ** 2 + (this.lng(i) - lng) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  route(aIdx: number, bIdx: number): RouteResult | null {
    const N = this.adj.length;
    if (aIdx === bIdx) {
      const p = this.lat(aIdx);
      return {
        points: [{ lat: p, lng: this.lng(aIdx) }],
        nodePath: [aIdx],
        meters: 0,
        minutes: 0,
        steps: [{ text: "You are already there.", dist: 0, kind: "arrive" }],
      };
    }
    const dist = new Float64Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const prevW = new Int32Array(N).fill(0);
    dist[aIdx] = 0;
    const heap: number[] = [aIdx];
    const less = (i: number, j: number) => dist[heap[i]] < dist[heap[j]];
    const up = (k: number) => {
      while (k > 0) {
        const par = (k - 1) >> 1;
        if (!less(k, par)) break;
        [heap[par], heap[k]] = [heap[k], heap[par]];
        k = par;
      }
    };
    const down = (k: number) => {
      const n = heap.length;
      for (;;) {
        let m = k;
        const l = 2 * k + 1;
        const r = 2 * k + 2;
        if (l < n && less(l, m)) m = l;
        if (r < n && less(r, m)) m = r;
        if (m === k) break;
        [heap[k], heap[m]] = [heap[m], heap[k]];
        k = m;
      }
    };
    while (heap.length) {
      const u = heap[0];
      const last = heap.pop() as number;
      if (heap.length) {
        heap[0] = last;
        down(0);
      }
      if (dist[u] === Infinity) break;
      if (u === bIdx) break;
      for (const e of this.adj[u]) {
        const nd = dist[u] + e.cost;
        if (nd < dist[e.to]) {
          dist[e.to] = nd;
          prev[e.to] = u;
          prevW[e.to] = e.w;
          heap.push(e.to);
          up(heap.length - 1);
        }
      }
    }
    if (dist[bIdx] === Infinity) return null;
    const nodePath: number[] = [];
    let cur = bIdx;
    while (cur !== -1) {
      nodePath.push(cur);
      cur = prev[cur];
    }
    nodePath.reverse();
    let meters = 0;
    let c2 = bIdx;
    while (prev[c2] !== -1) {
      meters += prevW[c2];
      c2 = prev[c2];
    }
    return {
      points: nodePath.map((n) => ({ lat: this.lat(n), lng: this.lng(n) })),
      nodePath,
      meters,
      minutes: Math.max(1, Math.round(meters / CART_SPEED_MS / 60)),
      steps: this.buildSteps(nodePath),
    };
  }

  // Add an externally drawn trail (user-drawn legal path) to the routable
  // network: snap to nearby nodes where possible, else create new nodes.
  addExternalTrail(coords: [number, number][], name = "Drawn Trail") {
    const hav = (la1: number, lo1: number, la2: number, lo2: number) => {
      const dLat = ((la2 - la1) * Math.PI) / 180;
      const dLon = ((lo2 - lo1) * Math.PI) / 180;
      const s = Math.sin(dLat / 2) ** 2 + Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      return 2 * 6371000 * Math.asin(Math.sqrt(s));
    };
    let nameIdx = -1;
    if (name) {
      if (!this.g.names.includes(name)) this.g.names.push(name);
      nameIdx = this.g.names.indexOf(name);
    }
    const idxs: number[] = [];
    for (const [la, lo] of coords) {
      const n = this.nearest(la, lo);
      const d = Math.sqrt((this.lat(n) - la) ** 2 + (this.lng(n) - lo) ** 2) * 111000;
      let key = n;
      if (d > 40) {
        key = this.g.nodes.length / 2;
        this.g.nodes.push(la, lo);
        this.adj.push([]);
      }
      if (idxs.length && idxs[idxs.length - 1] === key) continue;
      idxs.push(key);
    }
    for (let i = 0; i < idxs.length - 1; i++) {
      const a = idxs[i];
      const b = idxs[i + 1];
      if (a === b) continue;
      const w = Math.max(1, Math.round(hav(this.lat(a), this.lng(a), this.lat(b), this.lng(b))));
      const cost = w;
      this.adj[a].push({ to: b, w, nameIdx, path: true, cost });
      this.adj[b].push({ to: a, w, nameIdx, path: true, cost });
    }
  }

  private buildSteps(nodePath: number[]): RouteStep[] {
    const g = this.g;
    const segs: { a: number; b: number; w: number; name: string; path: boolean }[] = [];
    for (let i = 0; i < nodePath.length - 1; i++) {
      const a = nodePath[i];
      const b = nodePath[i + 1];
      let e: Edge | undefined;
      for (const cand of this.adj[a]) {
        if (cand.to === b) {
          e = cand;
          break;
        }
      }
      if (!e) continue;
      segs.push({ a, b, w: e.w, name: e.nameIdx >= 0 ? g.names[e.nameIdx] : "", path: e.path });
    }
    if (!segs.length) return [];

    const cardinal = (deg: number): string => {
      const d = (deg % 360 + 360) % 360;
      const dirs = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
      return dirs[Math.round(d / 45) % 8];
    };

    const brg = (a: number, b: number): number => {
      const la1 = (this.lat(a) * Math.PI) / 180;
      const la2 = (this.lat(b) * Math.PI) / 180;
      const dLon = ((this.lng(b) - this.lng(a)) * Math.PI) / 180;
      const y = Math.sin(dLon) * Math.cos(la2);
      const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
      return (Math.atan2(y, x) * 180) / Math.PI;
    };

    const legs: { name: string; path: boolean; meters: number; firstB: number; lastB: number }[] = [];
    let prevSeg: { a: number; b: number; name: string; path: boolean } | null = null;
    for (const s of segs) {
      const last = legs[legs.length - 1];
      if (last && last.name === s.name && last.path === s.path) {
        last.meters += s.w;
        last.lastB = brg(s.a, s.b);
      } else {
        legs.push({ name: s.name, path: s.path, meters: s.w, firstB: brg(s.a, s.b), lastB: brg(s.a, s.b) });
      }
      prevSeg = s;
    }

    const label = (name: string, path: boolean): string => {
      if (name) return name;
      return path ? "the cart path" : "the street";
    };

    const steps: RouteStep[] = [];
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const isCrossing = !leg.name && !leg.path && leg.meters < 90;
      if (i === 0) {
        steps.push({ text: `Head ${cardinal(leg.firstB)} on ${label(leg.name, leg.path)}`, dist: leg.meters, kind: "go" });
      } else {
        const delta = (leg.firstB - legs[i - 1].lastB + 540) % 360 - 180;
        if (isCrossing) {
          steps.push({ text: "Cross the road at the junction", dist: leg.meters, kind: "cross" });
        } else if (Math.abs(delta) < 22) {
          steps.push({ text: `Continue straight on ${label(leg.name, leg.path)}`, dist: leg.meters, kind: "go" });
        } else {
          const side = delta > 0 ? "right" : "left";
          const sharp = Math.abs(delta) > 130 ? "sharp " : "";
          steps.push({ text: `Turn ${sharp}${side} onto ${label(leg.name, leg.path)}`, dist: leg.meters, kind: "turn" });
        }
      }
    }
    steps.push({ text: "Arrive at your destination", dist: 0, kind: "arrive" });
    return steps;
  }
}