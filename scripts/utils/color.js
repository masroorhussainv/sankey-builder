// ─── COLOR UTILITIES ──────────────────────────────────────────────────────────────

// Convert hex color to RGB array
function hexToRgb(hex){
  const m=(hex||"").replace(/^var\(.*\)$/,"#888").match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m?[parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)]:null;
}

// Returns a readable text color for a given bar hex color
// If the color is very light (luminance > 0.65), darken it significantly for text
function getReadableColor(hex){
  const rgb=hexToRgb(hex);
  if(!rgb) return hex;
  const [r,g,b]=rgb.map(c=>{const s=c/255;return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);});
  const L=0.2126*r+0.7152*g+0.0722*b; // relative luminance
  if(L>0.45){
    // too light for text — darken by blending with black
    const factor=0.45;
    const dr=Math.round(rgb[0]*factor);
    const dg=Math.round(rgb[1]*factor);
    const db=Math.round(rgb[2]*factor);
    return `#${dr.toString(16).padStart(2,"0")}${dg.toString(16).padStart(2,"0")}${db.toString(16).padStart(2,"0")}`;
  }
  return hex;
}

// Returns white or dark text color for text inside bars
// If bar is dark (luminance < 0.5), use white text
// If bar is light (luminance >= 0.5), use dark text
function getInsideBarTextColor(hex){
  const rgb=hexToRgb(hex);
  if(!rgb) return "#fff";
  const [r,g,b]=rgb.map(c=>{const s=c/255;return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);});
  const L=0.2126*r+0.7152*g+0.0722*b;
  return L<0.5?"#fff":"#1a1a2e";
}

// Helper for rounded rectangles (PDF export)
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}
