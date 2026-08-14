export type CartPoi = {
  n: string;
  c: string;
  t: string;
  lat: number;
  lon: number;
};

export type CartGraph = {
  nodes: number[];
  edgesA: number[];
  edgesB: number[];
  edgesW: number[];
  edgesNameIdx: number[];
  edgesPath: number[];
  names: string[];
  pois: CartPoi[];
  bbox: number[];
};

let cache: CartGraph | null = null;

export async function loadCartGraph(): Promise<CartGraph> {
  if (cache) return cache;
  const res = await fetch("/data/graph.json", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("graph load failed");
  cache = (await res.json()) as CartGraph;
  return cache;
}