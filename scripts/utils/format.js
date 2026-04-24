// ─── FORMAT UTILITIES ────────────────────────────────────────────────────────────

// Get currency symbol from input
function getCurrencySymbol(){
  const sel=document.getElementById("inCurrency").value;
  if(sel==="custom") return document.getElementById("inCustomCurrency").value.trim()||"$";
  return sel;
}

// Get unit from input
function getUnit(){
  return document.getElementById("inUnit").value;
}

// Format value with currency and unit abbreviations
function fmtVal(v){
  const cur=getCurrencySymbol(), unit=getUnit();
  if(unit==="Billions"){
    // values are in billions
    if(v>=1000) return `${cur} ${(v/1000).toFixed(2)}T`;
    return `${cur} ${v.toFixed(2)}B`;
  }
  if(unit==="Thousands"){
    // values are already in thousands — abbreviate for readability
    if(v>=1000000) return `${cur} ${(v/1000000).toFixed(2)}B`;   // millions of thousands = billions
    if(v>=1000)    return `${cur} ${(v/1000).toFixed(2)}M`;       // thousands of thousands = millions
    return `${cur} ${v.toLocaleString(undefined,{maximumFractionDigits:0})}K`;
  }
  // Millions (default)
  if(v>=1000) return `${cur} ${(v/1000).toFixed(2)}B`;
  if(v>=1)    return `${cur} ${v.toLocaleString(undefined,{maximumFractionDigits:2})}M`;
  return `${cur} ${(v*1000000).toLocaleString(undefined,{maximumFractionDigits:0})}`;
}

// Split formatted value into currency and value parts for 2-line rendering
function splitFmtVal(formatted){
  // Match: 2-4 uppercase letters with optional dot (RS., PKR., USD, EUR) OR currency symbol ($, £, €)
  const match=formatted.match(/^([A-Z]{2,4}\.?|[$£€₹])\s+(.+)$/);
  if(match) return {currency:match[1], value:match[2]};
  return {currency:"", value:formatted};
}
