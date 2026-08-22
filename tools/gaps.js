// ---- Gaps workflow ----
// gap candidates precomputed by the backend into gaps.json; fallback compute here
let GAPS=[];    // [{i,j,d,ci,cj,status}]
const GAP_URL = new URL("gaps.json", location.href).href;
function computeGaps(){
  // brute force across cart nodes via buckets (mirror of server logic)
  const N=G.nodes.length/2; const n=G.nodes;
  const cartSet=new Set();
  for(let e=0;e<G.edgesA.length;e++){ if(isCartLegal(e)){ cartSet.add(G.edgesA[e]); cartSet.add(G.edgesB[e]); } }
  const comps=computeComponentsLocal(cartSet);
  const nodes=[...cartSet];
  const T=0.0006, T2=0.0008;
  const out=[];
  for(let ii=0;ii<nodes.length;ii++){
    const i=nodes[ii]; const ci=comps.map[i];
    for(let jj=ii+1;jj<nodes.length;jj++){
      const j=nodes[jj];
      if(comps.map[j]===ci)continue;
      const dlat=(n[i*2]-n[j*2])*110000, dlng=(n[i*2+1]-n[j*2+1])*96000;
      const d=Math.hypot(dlat,dlng);
      if(d<=60) out.push({i,j,d,ci:comps.map[i],cj:comps.map[j],status:'open'});
    }
  }
  return out;
}
function computeOffsets(cartSet){
  // component ids over cart nodes
  const N=G.nodes.length/2;
  const adj=[...Array(N)].map(()=>[]);
  for(let e=0;e<G.edgesA.length;e++){ if(isCartLegal(e)){ const a=G.edgesA[e],b=G.edgesB[e]; adj[a].push(b); adj[b].push(a); } }
  const map=new Array(N).fill(-1); let nc=0;
  for(let s=0;s<N;s++){ if(map[s]!==-1||!cartSet.has(s))continue; const st=[s]; map[s]=nc;
    while(st.length){ const u=st.pop(); for(const v of adj[u]){ if(map[v]===-1&&cartSet.has(v)){ map[v]=nc; st.push(v);} } }
    nc++;
  }
  return {map,nc};
}