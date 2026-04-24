// ─── GEOMETRY UTILITIES ───────────────────────────────────────────────────────────

// Generate SVG path for ribbon/link between nodes
function ribbonPath(l){
  const x0=l.source.x1,x1=l.target.x0,mx=(x0+x1)/2;
  return`M ${x0} ${l.sy0} C ${mx} ${l.sy0}, ${mx} ${l.ty0}, ${x1} ${l.ty0} L ${x1} ${l.ty1} C ${mx} ${l.ty1}, ${mx} ${l.sy1}, ${x0} ${l.sy1} Z`;
}
