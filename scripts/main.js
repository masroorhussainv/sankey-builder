
// ─── MULTI-CHART SUPPORT ────────────────────────────────────────────────────────
function parseMultipleCharts(raw){
  const charts=[];

  // Check if data contains chart markers
  const chartMarkerRegex=/^===+\s*CHART:\s*(.+?)\s*===+/mi;
  if(!chartMarkerRegex.test(raw)){
    // No chart markers, treat entire input as single chart
    const chartId="Chart 1";
    const meta=extractMetadata(raw);
    return[{id:chartId,name:chartId,data:raw,meta:meta}];
  }

  // Split by chart markers
  const parts=raw.split(chartMarkerRegex);
  // parts[0] is empty (before first marker), parts[1] is first chart name, parts[2] is first data, etc.

  for(let i=1;i<parts.length;i+=2){
    if(i+1>=parts.length) break;
    const chartName=parts[i].trim()||`Chart ${charts.length+1}`;
    const chartData=parts[i+1].trim();
    const chartId=`Chart ${charts.length+1}`;
    const meta=extractMetadata(chartData);
    charts.push({id:chartId,name:chartName,data:chartData,meta:meta});
  }

  return charts.length>0?charts:[{id:"Chart 1",name:"Chart 1",data:raw,meta:extractMetadata(raw)}];
}

// Extract metadata from chart data for tab display
function extractMetadata(data){
  let company="", period="", scope="";
  const lines=data.split('\n');
  for(const line of lines){
    if(line.match(/^COMPANY,/i)){
      company=line.split(',')[1]?.trim()||"";
    }else if(line.match(/^PERIOD,/i)){
      period=line.split(',')[1]?.trim()||"";
    }else if(line.match(/^SCOPE,/i)){
      scope=line.split(',')[1]?.trim()||"";
    }
    if(company&&period&&scope) break;
  }
  return{company,period,scope};
}

let chartsData=[]; // Array of chart objects
let activeChartIndex=0;
let chartPositions=new Map(); // Store y-positions for each chart to prevent jumping

function renderTabs(){
  const container=document.getElementById("tabsContainer");
  const tabsBar=document.getElementById("chartTabs");
  container.innerHTML="";

  chartsData.forEach((chart,index)=>{
    const tab=document.createElement("div");
    tab.className=`chart-tab${index===activeChartIndex?" active":""}`;
    tab.dataset.index=index;
    tab.draggable=true;
    // Use metadata for two-line display, fallback to chart name
    const meta=chart.meta||extractMetadata(chart.data);
    const subtitle=[meta.period,meta.scope].filter(Boolean).join(" - ");
    const displayName=meta.company||chart.name;
    tab.innerHTML=`
      <div class="chart-tab-content">
        <span class="chart-tab-name">${displayName}</span>
        ${subtitle?`<span class="chart-tab-subtitle">${subtitle}</span>`:""}
      </div>
      <span class="chart-tab-close" data-index="${index}">✕</span>
    `;

    // Drag and drop handlers
    tab.addEventListener("dragstart",(e)=>{
      tab.classList.add("dragging");
      e.dataTransfer.setData("text/plain",index);
      e.dataTransfer.effectAllowed="move";
    });

    tab.addEventListener("dragend",()=>{
      tab.classList.remove("dragging");
      container.querySelectorAll(".chart-tab").forEach(t=>t.classList.remove("drag-over"));
    });

    tab.addEventListener("dragover",(e)=>{
      e.preventDefault();
      e.dataTransfer.dropEffect="move";
      const dragging=container.querySelector(".dragging");
      if(dragging&&dragging!==tab){
        tab.classList.add("drag-over");
      }
    });

    tab.addEventListener("dragleave",()=>{
      tab.classList.remove("drag-over");
    });

    tab.addEventListener("drop",(e)=>{
      e.preventDefault();
      tab.classList.remove("drag-over");
      const fromIndex=parseInt(e.dataTransfer.getData("text/plain"));
      const toIndex=index;
      if(fromIndex!==toIndex){
        reorderCharts(fromIndex,toIndex);
      }
    });

    tab.addEventListener("click",(e)=>{
      if(!e.target.classList.contains("chart-tab-close")){
        switchToChart(index);
      }
    });
    container.appendChild(tab);
  });

  // Add close button handlers
  container.querySelectorAll(".chart-tab-close").forEach(btn=>{
    btn.addEventListener("click",(e)=>{
      e.stopPropagation();
      const index=parseInt(btn.dataset.index);
      removeChart(index);
    });
  });

  // Show/hide tabs bar
  tabsBar.style.display=chartsData.length>1?"flex":"none";

  // Show/hide "Export All Charts" menu item
  const exportAllItem=document.getElementById("exportAllPdfItem");
  if(exportAllItem){
    exportAllItem.style.display=chartsData.length>1?"flex":"none";
  }
}

function switchToChart(index){
  if(index<0||index>=chartsData.length)return;
  activeChartIndex=index;
  renderTabs();
  // Update input with chart data
  document.getElementById("inData").value=chartsData[index].data;
  // Re-generate chart
  generate();
}

function addNewChart(){
  const newId=`Chart ${chartsData.length+1}`;
  chartsData.push({id:newId,name:newId,data:""});
  activeChartIndex=chartsData.length-1;
  renderTabs();
  document.getElementById("inData").value="";
  document.getElementById("inData").focus();
}

function removeChart(index){
  // Clear position cache for the chart being removed
  const removedChartId=chartsData[index]?.id;
  if(removedChartId){
    chartPositions.delete(removedChartId);
  }

  if(chartsData.length<=1){
    // If removing last chart, add a new empty one
    chartsData=[{id:"Chart 1",name:"Chart 1",data:""}];
    activeChartIndex=0;
    renderTabs();
    document.getElementById("inData").value="";
    document.getElementById("inData").focus();
    return;
  }
  chartsData.splice(index,1);
  // Reassign chart IDs
  chartsData.forEach((chart,i)=>{
    chart.id=`Chart ${i+1}`;
    if(chart.name.startsWith("Chart ")){
      chart.name=chart.id;
    }
  });
  // Clear old position cache entries
  const validIds=new Set(chartsData.map(c=>c.id));
  for(const key of chartPositions.keys()){
    if(!validIds.has(key)){
      chartPositions.delete(key);
    }
  }
  if(activeChartIndex>=chartsData.length){
    activeChartIndex=chartsData.length-1;
  }
  renderTabs();
  switchToChart(activeChartIndex);
}

function updateChartData(data){
  // Check if data contains multiple chart markers
  const chartMarkerRegex=/^===+\s*CHART:\s*(.+?)\s*===+/mi;
  const hasMultipleCharts=chartMarkerRegex.test(data);

  if(hasMultipleCharts){
    // Parse multiple charts
    const charts=parseMultipleCharts(data);
    if(charts.length>0){
      chartsData=charts;
      activeChartIndex=0;
      // Update input field with first chart's data
      document.getElementById("inData").value=chartsData[0].data;
      renderTabs();
      generate();
      return;
    }
  }

  // Single chart or update current chart
  const meta=extractMetadata(data);
  if(chartsData.length===0){
    const newId="Chart 1";
    chartsData.push({id:newId,name:newId,data:data,meta:meta});
    activeChartIndex=0;
  }else{
    chartsData[activeChartIndex].data=data;
    chartsData[activeChartIndex].meta=meta;
  }
  renderTabs();
}

// apply currency from parsed meta
function applyCurrencyMeta(cur, unit){
  const curInput=document.getElementById("inCurrency");
  const unitInput=document.getElementById("inUnit");
  if(cur){
    curInput.value=cur.trim().toUpperCase();
  }
  if(unit){
    unitInput.value=unit.trim();
  }
}


function setTheme(theme){
  activeTheme = theme;
  document.documentElement.style.setProperty("--accent", theme.accent);
  document.documentElement.style.setProperty("--accent-dark", theme.dark);
  document.querySelectorAll(".theme-swatch").forEach(el=>{
    el.style.outline = el.dataset.name===theme.name ? `2px solid ${theme.accent}` : "2px solid transparent";
  });
}

window.addEventListener("DOMContentLoaded",()=>{
  const heightInput = document.getElementById("inHeight");
  console.log('[Page Load] Initial height input value:', heightInput.value, 'text:', document.getElementById("inHeightVal").textContent);
  // collapse panel by default on mobile
  if(window.innerWidth<=700){
    const p=document.getElementById("panel");
    if(p) p.classList.add("collapsed");
  }

  // build theme swatches
  const wrap=document.getElementById("themeSwatches");
  if(wrap){
    APP_THEMES.forEach(theme=>{
      const dot=document.createElement("div");
      dot.className="theme-swatch";
      dot.dataset.name=theme.name;
      dot.title=theme.name;
      dot.style.width="22px";dot.style.height="22px";dot.style.borderRadius="50%";
      dot.style.background=theme.accent;dot.style.cursor="pointer";
      dot.style.transition="transform .15s";
      dot.style.outline=`2px solid ${theme===activeTheme?theme.accent:"transparent"}`;
      dot.style.outlineOffset="2px";dot.style.flexShrink="0";
      dot.addEventListener("click",()=>setTheme(theme));
      dot.addEventListener("mouseenter",()=>{dot.style.transform="scale(1.2)";});
      dot.addEventListener("mouseleave",()=>{dot.style.transform="scale(1)";});
      wrap.appendChild(dot);
    });
  }

  // palette select (both top bar and settings)
  const paletteSelects=[document.getElementById("paletteSelect"),document.getElementById("paletteSelectTop")];
  paletteSelects.forEach(sel=>{
    if(sel){
      sel.innerHTML="";
      Object.keys(PALETTES).forEach(n=>{
        const o=document.createElement("option");
        o.value=n;o.textContent=n;
        if(n===(window._pendingPalette||activePalette))o.selected=true;
        sel.appendChild(o);
      });
    }
  });
  if(window._pendingPalette) activePalette=window._pendingPalette;
  renderSwatch(activePalette);
  renderHistory();

  // multi-chart buttons
  document.getElementById("btnAddChart").addEventListener("click",addNewChart);
});
function toggleDd(id){
  const menu=document.getElementById(id+"Menu");
  const isOpen=menu.classList.contains("open");
  document.querySelectorAll(".dd-menu").forEach(m=>m.classList.remove("open"));
  if(!isOpen) menu.classList.add("open");
}
document.addEventListener("click",e=>{
  if(!e.target.closest(".dd-wrap")) document.querySelectorAll(".dd-menu").forEach(m=>m.classList.remove("open"));
});

// ─── PALETTE ──────────────────────────────────────────────────────────────────
function renderSwatch(name){
  ["paletteSwatch","paletteSwatchTop"].forEach(swatchId=>{
    const w=document.getElementById(swatchId);
    if(w){
      w.innerHTML="";
      PALETTES[name].slice(0,8).forEach(c=>{
        const d=document.createElement("div");
        d.style.cssText=`width:10px;height:10px;border-radius:2px;background:${c};`;
        w.appendChild(d);
      });
    }
  });
}
function switchPalette(name){
  activePalette=name;renderSwatch(name);
  // Sync both palette selects
  document.getElementById("paletteSelect").value=name;
  document.getElementById("paletteSelectTop").value=name;
  if(currentNodes) applyPalette();
}
function applyPalette(){
  const pal=getPalette(),svgEl=document.getElementById("svg");
  const palName=activePalette||"";
  const isMono=palName.startsWith("Mono:");
  const getLum=hex=>{
    const rgb=hexToRgb(hex);if(!rgb)return 0.5;
    const [r,g,b]=rgb.map(c=>{const s=c/255;return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);});
    return 0.2126*r+0.7152*g+0.0722*b;
  };
  let sorted=null;
  if(isMono) sorted=[...pal].sort((a,b)=>getLum(a)-getLum(b));
  const numCols2=currentNodes?Math.max(...currentNodes.map(n=>n.col))+1:1;
  currentNodes.forEach(n=>{
    if(isMono){
      const colFrac=numCols2<=1?0:n.col/(numCols2-1);
      const idx=Math.round(colFrac*(sorted.length-1));
      n.color=sorted[idx];
    } else {
      n.color=pal[n.id%pal.length];
    }
    if(n._rect) n._rect.setAttribute("fill",n.color);
    if(n._t1) n._t1.setAttribute("fill",n.color);
    if(n._t3){
      // only update color if label is above bar (not inside)
      if(!n._t3._isInside){
        const readableColor=getReadableColor(n.color);
        // Update value tspan (first child)
        const tsV=n._t3.querySelector("tspan");
        if(tsV) tsV.setAttribute("fill",readableColor);
        // Update YoY percentage tspan (stored as _tsYoY)
        if(n._t3._tsYoY) n._t3._tsYoY.setAttribute("fill",readableColor);
      }else{
        // Inside bar: update all 3 line text colors
        const insideBarColor=getInsideBarTextColor(n.color);
        if(n._t3._line1) n._t3._line1.setAttribute("fill",insideBarColor);
        if(n._t3._line2) n._t3._line2.setAttribute("fill",insideBarColor);
        if(n._t3._line3) n._t3._line3.setAttribute("fill",insideBarColor);
      }
    }
  });
  currentLinks.forEach((l,i)=>{
    const g=svgEl.querySelector(`#gr${i}`);if(!g)return;
    const s=g.querySelectorAll("stop");
    if(s[0])s[0].setAttribute("stop-color",l.source.color);
    if(s[1])s[1].setAttribute("stop-color",l.target.color);
  });
}

// ─── CHART LIBRARY (unlimited localStorage) ───────────────────────────────────
const HIST_KEY="sankeyLib1";
const HIST_KEY_OLD="sankeyHistory2";

function getHistory(){
  try{
    // migrate from old key if new key is empty
    const existing=localStorage.getItem(HIST_KEY);
    if(!existing){
      const old=localStorage.getItem(HIST_KEY_OLD);
      if(old){
        localStorage.setItem(HIST_KEY,old);
        localStorage.removeItem(HIST_KEY_OLD);
      }
    }
    return JSON.parse(localStorage.getItem(HIST_KEY)||"[]");
  }catch(e){return[];}
}
function saveHistory(company,year,scope,data){
  let h=getHistory();

  // Check if we have multiple charts - save as multi-chart session
  if(chartsData.length>1){
    // Save all charts as one session
    const charts=chartsData.map(c=>({
      id:c.id,
      name:c.name,
      data:c.data
    }));

    // Safely extract metadata for display
    let periods=[], scopes=[];
    chartsData.forEach(c=>{
      try{
        const parsed=parseData(c.data);
        if(parsed.meta?.PERIOD) periods.push(parsed.meta.PERIOD);
        if(parsed.meta?.SCOPE) scopes.push(parsed.meta.SCOPE);
      }catch(e){
        // Ignore parsing errors for metadata display
        periods.push("");
        scopes.push("");
      }
    });

    const entry={
      isMultiChart:true,
      company:"Multiple Charts",
      year:periods.filter(Boolean).join(", "),
      scope:scopes.filter(Boolean).join(", "),
      charts:charts,
      palette:activePalette,
      colSpacing:document.getElementById("inColSpacing").value||"150",
      ts:Date.now()
    };

    // Check if same multi-chart session exists
    const chartIds=chartsData.map(c=>c.id).sort().join(",");
    const idx=h.findIndex(x=>x.isMultiChart && x.charts && x.charts.map(c=>c.id).sort().join(",")===chartIds);

    if(idx>=0) h[idx]=entry;
    else h.unshift(entry);
  }else{
    // Single chart - save as before
    const idx=h.findIndex(x=>x.company===company&&x.year===year && !x.isMultiChart);
    const entry={company,year,scope,data,
      palette:activePalette,
      colSpacing:document.getElementById("inColSpacing").value||"150",
      ts:Date.now()};
    if(idx>=0) h[idx]=entry;
    else h.unshift(entry);
  }

  try{localStorage.setItem(HIST_KEY,JSON.stringify(h));}catch(e){}
  renderHistory();
}
function deleteHistory(i,e){
  e.stopPropagation();
  const h=getHistory();h.splice(i,1);
  try{localStorage.setItem(HIST_KEY,JSON.stringify(h));}catch(e){}
  renderHistory();
}
function renderHistory(){
  const list=document.getElementById("historyList");
  const h=getHistory();
  if(!h.length){list.innerHTML='<div class="history-empty">No saved charts</div>';return;}
  list.innerHTML=h.map((it,i)=>{
    // Check if multi-chart entry
    const isMulti=it.isMultiChart && it.charts && it.charts.length>1;
    const multiBadge=isMulti?`<span class="history-multi-badge">${it.charts.length} charts</span>`:"";

    const isActive=!isMulti && currentCompany&&currentYear
      ? it.company===currentCompany&&it.year===currentYear
      : false;
    const badge=isActive?`<span class="history-active-badge">current</span>`:"";

    return`<div class="history-item${isActive?" active-chart":""}" data-idx="${i}">
      <div class="history-item-info" onclick="loadHistory(${i})">
        <strong>${it.company||"Unnamed"}${multiBadge}${badge}</strong>
        <span>${[it.year,it.scope].filter(Boolean).join(" · ")} · ${new Date(it.ts).toLocaleDateString()}</span>
      </div>
      <button class="history-del" onclick="deleteHistory(${i},event)" title="Delete">✕</button>
    </div>`;
  }).join("");
  // scroll active item into view
  const active=list.querySelector(".active-chart");
  if(active) active.scrollIntoView({block:"nearest",behavior:"smooth"});
}
function loadHistory(i){
  const it=getHistory()[i];if(!it)return;

  if(it.isMultiChart && it.charts){
    // Load all charts from multi-chart session
    chartsData=it.charts.map(c=>({
      id:c.id,
      name:c.name,
      data:c.data
    }));
    activeChartIndex=0;

    // Apply settings
    if(it.palette&&PALETTES[it.palette]){
      activePalette=it.palette;
      document.getElementById("paletteSelect").value=it.palette;
      renderSwatch(it.palette);
    }
    if(it.colSpacing){
      const sl=document.getElementById("inColSpacing");
      sl.value=it.colSpacing;
      document.getElementById("inColSpacingVal").textContent=it.colSpacing+"px";
    }

    renderTabs();
    // Update input field with first chart's data
    document.getElementById("inData").value=chartsData[0].data;
    generate();
  }else{
    // Single chart load - original behavior
    document.getElementById("inCompany").value=it.company||"";
    document.getElementById("inYear").value=it.year||"";
    document.getElementById("inScope").value=it.scope||"";
    document.getElementById("inData").value=it.data||"";
    if(it.palette&&PALETTES[it.palette]){
      activePalette=it.palette;
      document.getElementById("paletteSelect").value=it.palette;
      renderSwatch(it.palette);
    }
    if(it.colSpacing){
      const sl=document.getElementById("inColSpacing");
      sl.value=it.colSpacing;
      document.getElementById("inColSpacingVal").textContent=it.colSpacing+"px";
    }
    generate();
  }
}

// ─── EXPORT JSON ──────────────────────────────────────────────────────────────
function exportJSON(){
  if(!currentNodes){alert("Generate a chart first.");return;}
  const payload={
    version:1,
    company:currentCompany,year:currentYear,scope:currentScope,
    data:document.getElementById("inData").value,
    palette:activePalette,
    colSpacing:document.getElementById("inColSpacing").value||"0",
    chartHeight:document.getElementById("inHeight").value||"600",
    ts:Date.now()
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`${currentCompany||"chart"}${currentYear?" "+currentYear:""}.json`.replace(/[^a-z0-9 _.-]/gi,"_");
  a.click();URL.revokeObjectURL(a.href);
}

// hidden file input for import
const _importInput=document.createElement("input");
_importInput.type="file";_importInput.accept=".json,application/json";
_importInput.addEventListener("change",e=>{
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const p=JSON.parse(ev.target.result);
      document.getElementById("inCompany").value=p.company||"";
      document.getElementById("inYear").value=p.year||"";
      document.getElementById("inScope").value=p.scope||"";
      document.getElementById("inData").value=p.data||"";
      if(p.palette&&PALETTES[p.palette]){
        activePalette=p.palette;
        document.getElementById("paletteSelect").value=p.palette;
        renderSwatch(p.palette);
      }
      if(p.colSpacing){
        const sl=document.getElementById("inColSpacing");
        sl.value=p.colSpacing;
        document.getElementById("inColSpacingVal").textContent=p.colSpacing+"px";
      }
      if(p.chartHeight){
        const sl=document.getElementById("inHeight");
        sl.value=p.chartHeight;
        document.getElementById("inHeightVal").textContent=p.chartHeight+"px";
      }
      generate();
    }catch(err){alert("Invalid JSON file: "+err.message);}
  };
  reader.readAsText(file);
  _importInput.value="";
});
function importJSON(){_importInput.click();}

// ─── SHAREABLE URL ────────────────────────────────────────────────────────────
// Simple LZ-inspired base64 encode (no external lib needed for reasonable data sizes)
function encodePayload(obj){
  try{return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));}catch(e){return null;}
}
function decodePayload(str){
  try{return JSON.parse(decodeURIComponent(escape(atob(str))));}catch(e){return null;}
}
function copyShareURL(btnEl){
  // Get active chart's data only
  let dataToShare = "";
  if (chartsData.length > 1) {
    // Multi-chart mode: use active chart's data
    const activeChart = chartsData[activeChartIndex];
    if (!activeChart) { alert("No chart to share."); return; }
    dataToShare = activeChart.data;
  } else {
    // Single chart mode
    dataToShare = document.getElementById("inData").value.trim();
  }

  if(!dataToShare){alert("Generate a chart first.");return;}

  // Store full node positions (y0, y1) with names for exact restoration
  const nodePos=currentNodes?currentNodes.map(n=>({n:n.name,y0:Math.round(n.y0),y1:Math.round(n.y1)})):[];

  const payload={
    c:document.getElementById("inCompany").value.trim(),
    y:document.getElementById("inYear").value.trim(),
    s:document.getElementById("inScope").value.trim(),
    d:dataToShare,  // Only active chart's data
    p:activePalette,
    cs:document.getElementById("inColSpacing").value||"0",
    h:document.getElementById("inHeight").value||"600",
    cur:getCurrencySymbol(),
    unit:getUnit(),
    np:nodePos  // Full positions with names
  };
  const encoded=encodePayload(payload);
  if(!encoded){alert("Data too large to encode as URL.");return;}
  const url=`${location.origin}${location.pathname}#chart=${encoded}`;

  // Show feedback on button
  const btn=btnEl||document.getElementById("btnShareChart");
  if(btn){
    const origText=btn.textContent;
    const origColor=btn.style.color;
    btn.textContent="✓ Copied!";
    btn.style.color="#22c55e";
    btn.style.borderColor="#22c55e";
    setTimeout(()=>{
      btn.textContent=origText;
      btn.style.color=origColor;
      btn.style.borderColor="";
    },2500);
  }

  navigator.clipboard.writeText(url).catch(()=>prompt("Copy this URL:",url));
}

// on load, check for shared chart in URL hash
(function checkURLHash(){
  const hash=location.hash;
  if(!hash.startsWith("#chart=")) return;
  const encoded=hash.slice(7);
  const p=decodePayload(encoded);
  if(!p) return;
  document.getElementById("inCompany").value=p.c||"";
  document.getElementById("inYear").value=p.y||"";
  document.getElementById("inScope").value=p.s||"";
  document.getElementById("inData").value=p.d||"";
  if(p.p&&PALETTES[p.p]){
    activePalette=p.p;
    window._pendingPalette=p.p;
  }
  if(p.cur||p.unit) applyCurrencyMeta(p.cur||null, p.unit||null);
  if(p.cs){
    document.getElementById("inColSpacing").value=p.cs;
    document.getElementById("inColSpacingVal").textContent=p.cs+"px";
  }
  if(p.h){
    document.getElementById("inHeight").value=p.h;
    document.getElementById("inHeightVal").textContent=p.h+"px";
  }
  if(p.np&&Array.isArray(p.np)&&p.np.length) window._pendingNodePos=p.np;
  // generate after DOM is ready
  window.addEventListener("DOMContentLoaded",()=>setTimeout(generate,100));
})();

// ─── PROMPTS ──────────────────────────────────────────────────────────────────
function copyPrompt(type){
  const texts={
    csv:`Extract P&L flows. Return comma-separated lines, node names in DOUBLE QUOTES:

COMPANY, [name]
PERIOD, [FY 2025]
SCOPE, [Consolidated/Unconsolidated]
CURRENCY, [PKR/USD]
UNIT, [Millions]
"Net Sales", "Total Revenue|Total Rev", 25789.24
"Total Revenue|Total Rev", "Cost of Sales|COGS", 11662.35
"Total Revenue|Total Rev", "Gross Profit|GP", 14126.89
"Gross Profit|GP", "Selling and Distribution|Selling & Dist", 6312.00
"Gross Profit|GP", "Admin Expenses|Admin Exp", 1029.00
"Gross Profit|GP", "Other Operating Expenses|Other Op Exp", 104.00
"Gross Profit|GP", "Operating Profit|Op Profit", 6584.05
"Operating Profit|Op Profit", "Profit Before Tax|PBT", 6584.05
"Other Income", "Profit Before Tax|PBT", 446.67
"Investment Income|Inv. Income", "Profit Before Tax|PBT", 125.50
"Dividends from Subsidiaries|Div. Subsid", "Profit Before Tax|PBT", 85.30
"Share of Profit from Associates|Assoc. Profit", "Profit Before Tax|PBT", 64.20
"Foreign Exchange Gain/Loss|FX Gain/Loss", "Profit Before Tax|PBT", -15.30
"Gain/Loss on Sale of Assets|Asset Sale Gain/Loss", "Profit Before Tax|PBT", 32.50
"Profit Before Tax|PBT", "Taxation", 2464.73
"Profit Before Tax|PBT", "Net Profit", 4119.31
"Net Profit", "Dividends Paid|Dividends", 2119.34
"Net Profit", "Retained Earnings|Retained", 1999.98
"Retained Earnings|Retained", "Capital Expenditure|CapEx", 850.00
"Retained Earnings|Retained", "Loans and Advances|Loans", 320.50
"Retained Earnings|Retained", "Short-Term Investments|ST Inv.", 450.30
"Retained Earnings|Retained", "Cash and Cash Equivalents|Cash", 179.68
EPS, 15.42
DPS, 8.50

Format: "Source","Target",value. ALL nodes quoted. Every flow on own line.
SHORT NAMES: Use "Full Name|Short Name" format for concise labels. Short names must be understandable (8-15 chars). Use abbreviations: GP=Gross Profit, PBT=Profit Before Tax, COGS=Cost of Sales, Op=Operating, Exp=Expenses, Rev=Revenue, CapEx=Capital Expenditure, ST=Short-Term.

ABOVE EXAMPLES for structure reference ONLY. Extract ALL items from ACTUAL report.

MANDATORY BALANCE: Every node MUST balance (inflows=outflows). If any node doesn't balance, you MISSED items - find them and include. Missing items cause extraction FAILURE. Last line: END_OF_DATA`,

    multichart:`Extract ONE chart from EACH uploaded annual report. Separate with: === CHART: [Company - Period] ===

ALL node names in DOUBLE QUOTES.

=== CHART: [Company Name - Period] ===
COMPANY, [name]
PERIOD, [FY 2025]
SCOPE, [Consolidated/Unconsolidated/Standalone]
CURRENCY, [PKR/USD/EUR]
UNIT, [Millions/Billions/Thousands]
"Net Sales", "Total Revenue|Total Rev", [cur], [prior]
"Total Revenue|Total Rev", "Cost of Sales|COGS", [cur], [prior]
"Total Revenue|Total Rev", "Gross Profit|GP", [cur], [prior]
"Gross Profit|GP", "Selling and Distribution|Selling & Dist", [cur], [prior]
"Gross Profit|GP", "Admin Expenses|Admin Exp", [cur], [prior]
"Gross Profit|GP", "Other Operating Expenses|Other Op Exp", [cur], [prior]
"Gross Profit|GP", "Operating Profit|Op Profit", [cur], [prior]
"Operating Profit|Op Profit", "Profit Before Tax|PBT", [cur], [prior]
"Other Income", "Profit Before Tax|PBT", [cur], [prior]
"Investment Income|Inv. Income", "Profit Before Tax|PBT", [cur], [prior]
"Dividends from Subsidiaries|Div. Subsid", "Profit Before Tax|PBT", [cur], [prior]
"Share of Profit from Associates|Assoc. Profit", "Profit Before Tax|PBT", [cur], [prior]
"Foreign Exchange Gain/Loss|FX Gain/Loss", "Profit Before Tax|PBT", [cur], [prior]
"Gain/Loss on Sale of Assets|Asset Sale Gain/Loss", "Profit Before Tax|PBT", [cur], [prior]
"Profit Before Tax|PBT", "Taxation", [cur], [prior]
"Profit Before Tax|PBT", "Net Profit", [cur], [prior]
"Net Profit", "Dividends Paid|Dividends", [cur], [prior]
"Net Profit", "Retained Earnings|Retained", [cur], [prior]
"Retained Earnings|Retained", "Capital Expenditure|CapEx", [cur], [prior]
"Retained Earnings|Retained", "Loans and Advances|Loans", [cur], [prior]
"Retained Earnings|Retained", "Short-Term Investments|ST Inv.", [cur], [prior]
"Retained Earnings|Retained", "Cash and Cash Equivalents|Cash", [cur], [prior]
EPS, [cur], [prior]
DPS, [cur], [prior]

[Repeat for ALL reports]

Rules:
- Every node in "Quotes". Commas in names allowed.
- Each flow on own line. Prior year empty ok: "Source","Target",123,
- SHORT NAMES: Use "Full Name|Short Name" for concise labels (8-15 chars). Use abbreviations: GP, PBT, COGS, Op=Operating, Exp=Expenses, Rev=Revenue, CapEx, ST=Short-Term.
- ABOVE EXAMPLES for structure reference only. Extract ALL items from ACTUAL report.
- Follow P&L flow: Net Sales→Total Revenue→Cost of Sales+Gross Profit, Gross Profit→Op Expenses+Operating Profit, Operating Profit→Finance Costs(if any)→PBT, Other income→PBT, PBT→Taxation+Net Profit
- MANDATORY BALANCE: Every node MUST balance (inflows=outflows). If unbalanced, you MISSED items - find and include. Missing items = extraction FAILURE. Last line: END_OF_DATA`,

    comparative:`Extract P&L flows (comparative). Return comma-separated lines, nodes in DOUBLE QUOTES:

COMPANY, [name]
PERIOD, [FY 2025]
SCOPE, [Consolidated/Unconsolidated]
CURRENCY, [PKR/USD]
UNIT, [Millions]
"Net Sales", "Total Revenue|Total Rev", 25789.24, 22340.11
"Total Revenue|Total Rev", "Cost of Sales|COGS", 11662.35, 10234.55
"Total Revenue|Total Rev", "Gross Profit|GP", 14126.89, 12105.55
"Gross Profit|GP", "Selling and Distribution|Selling & Dist", 6312.00, 5820.00
"Gross Profit|GP", "Admin Expenses|Admin Exp", 1029.00, 944.00
"Gross Profit|GP", "Operating Profit|Op Profit", 6584.05, 5133.15
"Operating Profit|Op Profit", "Profit Before Tax|PBT", 6584.05, 5133.15
"Profit Before Tax|PBT", "Taxation", 2464.73, 1920.50
"Profit Before Tax|PBT", "Net Profit", 4119.31, 3212.65
"Net Profit", "Dividends Paid|Dividends", 2119.34, 1680.00
"Net Profit", "Retained Earnings|Retained", 1999.98, 1532.65
"Retained Earnings|Retained", "Capital Expenditure|CapEx", 850.00, 720.50
"Retained Earnings|Retained", "Cash and Cash Equivalents|Cash", 179.68, 219.75
EPS, 15.42, 13.37
DPS, 8.50, 7.00

Format: "Source","Target",cur,prior. ALL nodes quoted. Each flow own line.
SHORT NAMES: Use "Full Name|Short Name" for concise labels (8-15 chars). Use abbreviations: GP, PBT, COGS, Op=Operating, Exp=Expenses, Rev=Revenue, CapEx.

ABOVE EXAMPLES for structure reference ONLY. Extract ALL items from ACTUAL report.

MANDATORY BALANCE: Every node MUST balance (inflows=outflows). If unbalanced, you MISSED items - find and include. Missing items = extraction FAILURE. Last line: END_OF_DATA`,

    detailed:`Extract P&L flows. Return comma-separated lines, nodes in DOUBLE QUOTES:

COMPANY, [name]
PERIOD, [FY 2025]
SCOPE, [Consolidated/Unconsolidated]
CURRENCY, [PKR/USD]
UNIT, [Millions]
"Net Sales", "Total Revenue|Total Rev", [cur], [prior]
"Total Revenue|Total Rev", "Cost of Sales|COGS", [cur], [prior]
"Total Revenue|Total Rev", "Gross Profit|GP", [cur], [prior]
"Gross Profit|GP", "Selling and Distribution|Selling & Dist", [cur], [prior]
"Gross Profit|GP", "Admin Expenses|Admin Exp", [cur], [prior]
"Gross Profit|GP", "Other Operating Expenses|Other Op Exp", [cur], [prior]
"Gross Profit|GP", "Operating Profit|Op Profit", [cur], [prior]
"Operating Profit|Op Profit", "Profit Before Tax|PBT", [cur], [prior]
"Other Income", "Profit Before Tax|PBT", [cur], [prior]
"Investment Income|Inv. Income", "Profit Before Tax|PBT", [cur], [prior]
"Dividends from Subsidiaries|Div. Subsid", "Profit Before Tax|PBT", [cur], [prior]
"Share of Profit from Associates|Assoc. Profit", "Profit Before Tax|PBT", [cur], [prior]
"Foreign Exchange Gain/Loss|FX Gain/Loss", "Profit Before Tax|PBT", [cur], [prior]
"Gain/Loss on Sale of Assets|Asset Sale Gain/Loss", "Profit Before Tax|PBT", [cur], [prior]
"Profit Before Tax|PBT", "Taxation", [cur], [prior]
"Profit Before Tax|PBT", "Net Profit", [cur], [prior]
"Net Profit", "Dividends Paid|Dividends", [cur], [prior]
"Net Profit", "Retained Earnings|Retained", [cur], [prior]
"Retained Earnings|Retained", "Capital Expenditure|CapEx", [cur], [prior]
"Retained Earnings|Retained", "Loans and Advances|Loans", [cur], [prior]
"Retained Earnings|Retained", "Short-Term Investments|ST Inv.", [cur], [prior]
"Retained Earnings|Retained", "Cash and Cash Equivalents|Cash", [cur], [prior]
EPS, [cur], [prior]
DPS, [cur], [prior]

Format: "Source","Target",cur,prior. ALL nodes quoted. Each flow own line.
SHORT NAMES: Use "Full Name|Short Name" for concise labels (8-15 chars). Use abbreviations: GP, PBT, COGS, Op=Operating, Exp=Expenses, Rev=Revenue, CapEx, ST=Short-Term.

ABOVE EXAMPLES for structure reference ONLY. Extract ALL items from ACTUAL report.

MANDATORY BALANCE: Every node MUST balance (inflows=outflows). If unbalanced, you MISSED items - find and include. Missing items = extraction FAILURE. Last line: END_OF_DATA`
  };
  navigator.clipboard.writeText(texts[type]).then(()=>{
    const btn=document.querySelector("#promptDd .tbtn");
    const orig=btn.textContent;
    btn.textContent="✓ Copied!";btn.style.borderColor="#2d9e6b";btn.style.color="#2d9e6b";
    setTimeout(()=>{btn.textContent=orig;btn.style.borderColor="";btn.style.color="";},2000);
  });
}

// ─── PANEL RESIZE ─────────────────────────────────────────────────────────────
(function initPanelResize(){
  const resizer=document.getElementById("panelResizer");
  const panel=document.getElementById("panel");
  if(!resizer||!panel) return;
  let dragging=false,startX=0,startW=0;

  resizer.addEventListener("mousedown",e=>{
    if(window.innerWidth<=700) return;
    dragging=true;
    startX=e.clientX;
    startW=panel.offsetWidth;
    resizer.classList.add("dragging");
    document.body.style.cursor="col-resize";
    document.body.style.userSelect="none";
    e.preventDefault();
  });

  document.addEventListener("mousemove",e=>{
    if(!dragging) return;
    const dx=e.clientX-startX;
    const newW=Math.min(Math.max(startW+dx, 220), 620);
    panel.style.width=newW+"px";
  });

  document.addEventListener("mouseup",()=>{
    if(!dragging) return;
    dragging=false;
    resizer.classList.remove("dragging");
    document.body.style.cursor="";
    document.body.style.userSelect="";
    // re-render chart to fit new width
    if(currentNodes) setTimeout(generate, 50);
  });
})();
function togglePanel(){
  const p=document.getElementById("panel");
  const b=document.getElementById("btnPanel");
  const overlay=document.getElementById("panelOverlay");
  const isMobile=window.innerWidth<=700;
  if(isMobile){
    const isOpen=p.classList.contains("mobile-open");
    p.classList.toggle("mobile-open",!isOpen);
    p.classList.toggle("collapsed",isOpen);
    if(overlay) overlay.classList.toggle("on",!isOpen);
  } else {
    const isCollapsed=p.classList.toggle("collapsed");
    if(b){b.classList.toggle("active",!isCollapsed);b.textContent=isCollapsed?"⟩ Panel":"⟨ Panel";}
    if(!isCollapsed&&parseInt(p.style.width||0)<220) p.style.width="360px";
    setTimeout(()=>{if(currentNodes)generate();},280);
  }
}

// ─── CHART BOUNDARY ─────────────────────────────────────────────────────────
function toggleChartBoundary(show){
  const wrap=document.getElementById('wrap');
  if(show){
    wrap.classList.add('show-boundary');
  }else{
    wrap.classList.remove('show-boundary');
  }
  // Save preference
  try{
    localStorage.setItem('showChartBoundary', show);
  }catch(e){}
}

// Load chart boundary preference on startup
window.addEventListener('DOMContentLoaded',()=>{
  const show=localStorage.getItem('showChartBoundary')==='true';
  const checkbox=document.getElementById('showChartBoundary');
  if(checkbox){
    checkbox.checked=show;
    if(show) toggleChartBoundary(true);
  }

  // Load shadow intensity preference
  const shadowIntensity=localStorage.getItem('shadowIntensity');
  if(shadowIntensity){
    const slider=document.getElementById('inShadowIntensity');
    const display=document.getElementById('inShadowIntensityVal');
    if(slider && display){
      slider.value=shadowIntensity;
      display.textContent=shadowIntensity+'%';
    }
  }
});

// ─── SIDEBAR TABS ─────────────────────────────────────────────────────────────
function switchSidebarTab(tabId){
  document.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.classList.remove('active');
    if(tab.dataset.tab === tabId) tab.classList.add('active');
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  document.getElementById('tab-' + tabId).classList.add('active');
}

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
function loadSample(){
  document.getElementById("inCompany").value="";
  document.getElementById("inYear").value="";
  document.getElementById("inScope").value="";
  document.getElementById("inData").value=
`=== CHART: Fauji Fertilizer ===
COMPANY, Fauji Fertilizer Company
PERIOD, FY 2025
SCOPE, Unconsolidated
CURRENCY, PKR
UNIT, Millions
Net Sales, Total Revenue, 25789, 22340
Total Revenue, Cost of Sales, 11662, 10234
Total Revenue, Gross Profit, 14127, 12106
Gross Profit, Selling and Distribution, 6312, 5820
Gross Profit, Admin Expenses, 1029, 944
Gross Profit, Other Operating Expenses, 104, 0
Gross Profit, Operating Profit, 6584, 5133
Operating Profit, Profit Before Tax, 6584, 5133
Profit Before Tax, Taxation, 2465, 1921
Profit Before Tax, Net Profit, 4119, 3213
Net Profit, Dividends, 2119, 1680
Net Profit, Retained Earnings, 2000, 1533
EPS, 15.42, 13.37
DPS, 8.50, 7.00

=== CHART: Engro Fertilizer ===
COMPANY, Engro Fertilizer
PERIOD, FY 2025
SCOPE, Consolidated
CURRENCY, PKR
UNIT, Millions
"Net Sales", "Total Revenue", 18456, 16234
"Total Revenue", "Cost of Sales", 8234, 7892
"Total Revenue", "Gross Profit", 10222, 8342
"Gross Profit", "Selling and Distribution", 3560, 3120
"Gross Profit", "Admin Expenses", 1245, 1120
"Gross Profit", "Other Operating Expenses", 428, 571
"Gross Profit", "Operating Profit", 4989, 3431
"Operating Profit", "Profit Before Tax", 4833, 3297
"Foreign Exchange Gain/Loss", "Profit Before Tax", -156, -134
"Profit Before Tax", "Taxation", 1456, 987
"Profit Before Tax", "Net Profit", 3377, 2309
"Net Profit", "Dividends Paid", 1234, 1089
"Net Profit", "Retained Earnings", 2143, 1220
"Retained Earnings", "Capital Expenditure", 850, 720
"Retained Earnings", "Loans and Advances", 320, 280
"Retained Earnings", "Short-Term Investments", 450, 312
"Retained Earnings", "Cash and Cash Equivalents", 179, 220
EPS, 12.45, 8.52
DPS, 6.25, 5.50`;
}

// ─── PARSE ────────────────────────────────────────────────────────────────────
// Parse CSV line handling quoted fields (e.g. "Gross Profit", "Selling, Distribution", 1234)
function parseCSVLine(line){
  const parts=[];
  let current="";
  let inQuotes=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      inQuotes=!inQuotes;
    }else if(ch===','&&!inQuotes){
      parts.push(current.trim());
      current="";
    }else{
      current+=ch;
    }
  }
  parts.push(current.trim());
  return parts;
}

function parseData(raw){
  // truncate at END_OF_DATA sentinel — ignore everything after it
  const sentinelIdx=raw.toUpperCase().indexOf("END_OF_DATA");
  const cleaned=sentinelIdx>=0 ? raw.slice(0,sentinelIdx) : raw;

  // handle collapsed output: if lines got merged with spaces, split at
  // boundaries where a number is immediately followed by a word that starts
  // a new "X, Y, number" pattern (e.g. "...4119.31 Net Profit, Dividends...")
  // Exclude common abbreviations like FY, Q1-Q4, H1-H2 to avoid breaking metadata
  const normalized=cleaned.replace(/(\d)\s+(?!FY|Q[1-4]|H[1-2])(COMPANY|PERIOD|SCOPE|CURRENCY|UNIT|EPS|DPS|[A-Z][a-zA-Z])/g,(_,num,word)=>`${num}\n${word}`);

  const lines=normalized.split("\n").map(l=>l.trim()).filter(l=>l&&l!="#"&&!l.startsWith("==="));
  const nodeIndex=new Map();
  const links=[];
  let hasYoY=false;
  const meta={}; // EPS, DPS etc.
  const nodeShortNames=new Map(); // Store short names separately
  const getNode=name=>{
    name=name.trim();
    // Remove surrounding quotes if present
    if(name.startsWith('"')&&name.endsWith('"')) name=name.slice(1,-1);
    // Extract short name if present in "Full Name|Short Name" format
    const shortName=name.includes('|')?name.split('|')[1].trim():null;
    const fullName=name.includes('|')?name.split('|')[0].trim():name;
    // Store short name if present
    if(shortName) nodeShortNames.set(fullName, shortName);
    // Use full name for deduplication
    const key=fullName;
    if(!nodeIndex.has(key))nodeIndex.set(key,nodeIndex.size);
    return nodeIndex.get(key);
  };
  const META_KEYS=["EPS","DPS"];
  const META_TEXT=["COMPANY","PERIOD","SCOPE","CURRENCY","UNIT"];
  for(const line of lines){
    // Skip chart marker lines
    if(line.startsWith("===")) continue;
    const parts=parseCSVLine(line);
    const key=parts[0].trim().toUpperCase();
    // text metadata: COMPANY, PERIOD, SCOPE
    if(META_TEXT.includes(key)){
      meta[key]=parts.slice(1).join(",").trim();
      continue;
    }
    // numeric metadata: EPS, DPS — always intercept, take first value only
    if(META_KEYS.includes(key)){
      const v=parseFloat((parts[1]||"").replace(/[^0-9.-]/g,""));
      if(!isNaN(v)) meta[key]=v;
      // capture prior period value if provided (e.g. "EPS, 15.42, 13.37")
      if(parts.length>=3){
        const vp=parseFloat((parts[2]||"").replace(/[^0-9.-]/g,""));
        if(!isNaN(vp)) meta[key+"_PRIOR"]=vp;
      }
      continue;
    }
    if(parts.length<3) throw new Error(`Bad line: "${line}" — need at least Source, Target, Value`);

    // Strategy: last part is always prior (or blank), second-to-last is always current value.
    // Everything before the value columns is source (first part) and target (rest).
    // This correctly handles commas inside node names.
    const lastPart=parts[parts.length-1].trim();
    const secondLast=parts[parts.length-2].trim();
    const lastNum=parseFloat(lastPart.replace(/[^0-9.-]/g,""));
    const secondNum=parseFloat(secondLast.replace(/[^0-9.-]/g,""));
    const lastIsNum=lastPart===""||(!isNaN(lastNum)&&lastPart.replace(/[^0-9.-]/g,"")===lastPart.replace(/\s/g,""));
    const secondIsNum=!isNaN(secondNum)&&secondLast.replace(/[^0-9.-]/g,"")===secondLast.replace(/\s/g,"");
    const secondIsEmpty=secondLast==="";

    let curIdx, priorIdx=null;
    if(secondIsEmpty&&lastIsNum&&parts.length>=4){
      // Handle empty current value with prior: "Source, Target, , prior"
      // Treat as 4-column format with current=0
      curIdx=parts.length-2;
      priorIdx=parts.length-1;
      // Insert a "0" for the empty current value
      parts[curIdx]="0";
    } else if(secondIsNum&&lastIsNum&&parts.length>=4){
      // 4-column format: ..., value, prior
      curIdx=parts.length-2;
      priorIdx=parts.length-1;
    } else if(secondIsNum&&parts.length>=3){
      // 3-column format: ..., value (last part is not a clean number)
      curIdx=parts.length-1;
    } else {
      throw new Error(`Invalid value on line: "${line}"`);
    }

    const srcName=parts[0].trim();
    const tgtName=parts.slice(1,curIdx).join(",").trim();
    if(!srcName||!tgtName) throw new Error(`Bad line: "${line}" — need Source, Target`);

    const vRaw=parseFloat(parts[curIdx].replace(/[^0-9.-]/g,""));
    if(isNaN(vRaw)) throw new Error(`Invalid value on line: "${line}"`);
    if(vRaw===0) continue; // Skip zero-value flows BEFORE creating nodes

    const s=getNode(srcName),t=getNode(tgtName);
    if(s===t) throw new Error(`Source equals target: "${line}"`);
    const v=Math.abs(vRaw);
    const isNegative=vRaw<0;
    let prior=null;
    if(priorIdx!==null&&parts[priorIdx].trim()!==""){
      const pv=parseFloat(parts[priorIdx].replace(/[^0-9.-]/g,""));
      if(!isNaN(pv)&&pv!==0){prior=Math.abs(pv);hasYoY=true;}
    }
    links.push({s,t,v,prior,isNegative});
  }
  console.log('[parseData] shortNames map size:', nodeShortNames.size, 'entries:', [...nodeShortNames.entries()]);
  return{nodeNames:[...nodeIndex.keys()],links,hasYoY,meta,shortNames:nodeShortNames};
}

// ─── VALIDATION ───────────────────────────────────────────────────────────────
function validateFlows(nodes,links){
  const warnings=[];
  nodes.forEach(n=>{
    const inLinks =links.filter(l=>l.target===n);
    const outLinks=links.filter(l=>l.source===n);
    if(!inLinks.length||!outLinks.length) return;
    // Skip Retained Earnings - it's a balance sheet account that accumulates surplus, not a flow node
    if(n.name.toLowerCase().includes("retained earnings")) return;
    // Skip if any connected link is negative (legitimate financial offset)
    if([...inLinks,...outLinks].some(l=>l.isNegative)) return;
    // Skip if any downstream target also receives from other sources (merger node downstream)
    const hasDownstreamMerge=outLinks.some(l=>links.filter(x=>x.target===l.target).length>1);
    if(hasDownstreamMerge) return;
    // Skip multi-source nodes (they are mergers themselves)
    if(inLinks.length>1) return;
    const inSum =inLinks.reduce((a,l)=>a+l.v,0);
    const outSum=outLinks.reduce((a,l)=>a+l.v,0);
    const diff=Math.abs(inSum-outSum);
    if(diff/Math.max(inSum,outSum)>0.02&&diff>10)
      warnings.push(`"${n.name}" inflow (${fmtVal(inSum)}) ≠ outflow (${fmtVal(outSum)}) — Δ${fmtVal(diff)}`);
  });
  return warnings;
}

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
function buildLayout(nodeNames,rawLinks,IW,IH,NODE_W,NODE_PAD,MARGIN,colSpacing=150,shortNames=null){
  console.log('[buildLayout] shortNames received:', shortNames);
  const nodes=nodeNames.map((name,id)=>({
    id,
    name,
    shortName:shortNames?.get(name)||null,
    sourceLinks:[],
    targetLinks:[],
    value:0,
    col:0
  }));
  console.log('[buildLayout] Sample nodes:', nodes.slice(0, 3).map(n => ({name: n.name, shortName: n.shortName})));
  const links=rawLinks.map((l,i)=>({...l,index:i,source:nodes[l.s],target:nodes[l.t]}));
  links.forEach(l=>{l.source.sourceLinks.push(l);l.target.targetLinks.push(l);});
  nodes.forEach(n=>{n.value=Math.max(n.sourceLinks.reduce((a,l)=>a+l.v,0),n.targetLinks.reduce((a,l)=>a+l.v,0));});
  // column assignment
  let changed=true;
  while(changed){changed=false;links.forEach(l=>{if(l.target.col<=l.source.col){l.target.col=l.source.col+1;changed=true;}});}
  const numCols=Math.max(...nodes.map(n=>n.col))+1;

  // ── column drag state ──────────────────────────────────────────────────────
  // Store column order as array of col indices, initially [0,1,2,...,numCols-1]
  const colOrder=Array.from({length:numCols},(_,i)=>i);

  const colX=col=>{
    const pos=colOrder.indexOf(col);
    return MARGIN.left+pos*colSpacing;
  };
  nodes.forEach(n=>{n.x0=colX(n.col);n.x1=n.x0+NODE_W;});

  const byCol={};
  nodes.forEach(n=>{(byCol[n.col]=byCol[n.col]||[]).push(n);});

  // Calculate per-column spacing - relaxed spacing for all columns
  const colSpacingMap={};
  Object.keys(byCol).forEach(colIdx=>{
    const col=byCol[colIdx];
    const nodeCount=col.length;
    // Aggressive spacing for small columns, progressive for larger
    // 1-3 nodes get much larger base spacing
    const relaxationMultiplier=nodeCount<=3
      ?2.8+(nodeCount*0.35)  // 1 node: 3.15x, 2 nodes: 3.5x, 3 nodes: 3.85x
      :4.0+(nodeCount*0.15); // 4+ nodes: progressive from 4.6x (more aggressive)
    colSpacingMap[colIdx]=Math.floor(NODE_PAD*relaxationMultiplier);
  });

  let globalKy=Infinity;
  Object.values(byCol).forEach(col=>{
    const colIdx=col[0]?.col||0;
    const spacing=colSpacingMap[colIdx]||NODE_PAD;
    const total=col.reduce((a,n)=>a+n.value,0);
    const ky=(IH-spacing*(col.length-1))/total;
    if(ky<globalKy)globalKy=ky;
  });

  // ── Pass 1: Initial placement by value (largest at top) ────────────────────────
  Object.values(byCol).forEach(col=>{
    const colIdx=col[0]?.col||0;
    const spacing=colSpacingMap[colIdx]||NODE_PAD;
    col.sort((a,b)=>b.value-a.value);
    const totalH=col.reduce((a,n)=>a+n.value*globalKy,0)+spacing*(col.length-1);
    let y=MARGIN.top+(IH-totalH)/2;
    col.forEach(n=>{n.y0=y;n.h=n.value*globalKy;n.y1=y+n.h;n.ky=globalKy;y=n.y1+spacing;});
  });

  // ── Pass 2: Smart reordering based on weighted source positions ─────────────────
  // For columns 2+, reorder nodes to align with their source nodes, reducing crossings
  for(let colIdx=1;colIdx<numCols;colIdx++){
    const col=byCol[colIdx];
    if(!col||col.length<=1) continue;

    // Calculate target Y for each node based on weighted average of source positions
    const nodeTargets=col.map(node=>{
      if(node.targetLinks.length===0){
        return {node,targetY:node.y0,weight:0};
      }
      let totalWeight=0;
      let weightedSum=0;
      node.targetLinks.forEach(l=>{
        const srcMidY=(l.source.y0+l.source.y1)/2;
        weightedSum+=srcMidY*l.v;
        totalWeight+=l.v;
      });
      return {
        node,
        targetY:totalWeight>0?weightedSum/totalWeight:node.y0,
        weight:totalWeight
      };
    });

    // Sort by target Y position (nodes with sources should align with them)
    nodeTargets.sort((a,b)=>a.targetY-b.targetY);

    // Reassign Y positions in sorted order, maintaining spacing
    const spacing=colSpacingMap[colIdx]||NODE_PAD;
    const totalH=col.reduce((a,n)=>a+n.value*globalKy,0)+spacing*(col.length-1);
    let newY=MARGIN.top+(IH-totalH)/2;
    nodeTargets.forEach(({node})=>{
      node.y0=newY;
      node.h=node.value*globalKy;
      node.y1=newY+node.h;
      newY=node.y1+spacing;
    });
  }

  // store initial y0 for clamping — prevent nodes from straying too far from initial layout
  nodes.forEach(n=>{n.initY0=n.y0;n.initY1=n.y1;});

  // Use per-column MIN_GAP for resolveCol
  function getColMinGap(col){
    if(!col||col.length===0) return NODE_PAD;
    const colIdx=col[0]?.col||0;
    return colSpacingMap[colIdx]||NODE_PAD;
  }

  const MIN_GAP=NODE_PAD; // guaranteed minimum pixels between any two node bars

  function resolveCol(col){
    if(col.length===0) return;
    const s=[...col].sort((a,b)=>a.y0-b.y0);
    const minGap=getColMinGap(col);
    const totalNodeH=s.reduce((sum,n)=>sum+(n.y1-n.y0),0);
    const totalNeeded=totalNodeH+(s.length-1)*minGap;
    const avail=IH;

    if(totalNeeded<=avail){
      // enough space — CENTER nodes vertically instead of pushing down
      const totalH=totalNodeH+(s.length-1)*minGap;
      const startY=MARGIN.top+(avail-totalH)/2;

      // First pass: enforce minimum gaps from top
      let y=startY;
      s.forEach(n=>{
        if(n.y0<y){n.y1+=y-n.y0;n.y0=y;}
        y=n.y1+minGap;
      });

      // Second pass: pull back from bottom if needed
      y=startY+totalH;
      [...s].reverse().forEach(n=>{
        if(n.y1>y){const sh=n.y1-y;n.y0-=sh;n.y1-=sh;}
        y=n.y0-minGap;
      });
    } else {
      // not enough space — distribute proportionally with minimum gap squeezed as needed
      const minG=Math.max(2,(avail-totalNodeH)/Math.max(s.length-1,1));
      let y=MARGIN.top;
      s.forEach(n=>{n.y0=y;n.y1=y+(n.y1-n.y0);y=n.y1+minG;});
    }

    // final clamp — never go out of SVG bounds, preserve bar height
    s.forEach(n=>{
      const h=n.y1-n.y0;
      n.y0=Math.max(MARGIN.top,Math.min(MARGIN.top+IH-h,n.y0));
      n.y1=n.y0+h;
    });
  }

  // gentler relaxation — column-aware iterations and alpha
  for(let it=0;it<30;it++){
    const a=0.15*Math.pow(0.9,it);
    for(let c=1;c<numCols;c++){
      const col=byCol[c]||[];
      // Progressive force reduction: more nodes = less force
      const colForce=col.length>=1?0.35:1.0;
      col.forEach(n=>{
        if(!n.targetLinks.length)return;
        const ws=n.targetLinks.reduce((s2,l)=>s2+((l.source.y0+l.source.y1)/2)*l.v,0);
        const vs=n.targetLinks.reduce((s2,l)=>s2+l.v,0);
        const dy=(ws/vs-(n.y0+n.y1)/2)*a*colForce;
        n.y0+=dy;n.y1+=dy;
      });
      resolveCol(col);
    }
    for(let c=numCols-2;c>=0;c--){
      const col=byCol[c]||[];
      // Progressive force reduction: more nodes = less force
      const colForce=col.length>=1?0.35:1.0;
      col.forEach(n=>{
        if(!n.sourceLinks.length)return;
        const ws=n.sourceLinks.reduce((s2,l)=>s2+((l.target.y0+l.target.y1)/2)*l.v,0);
        const vs=n.sourceLinks.reduce((s2,l)=>s2+l.v,0);
        const dy=(ws/vs-(n.y0+n.y1)/2)*a*colForce;
        n.y0+=dy;n.y1+=dy;
      });
      resolveCol(col);
    }
  }

  // final pass — enforce minimum gap one last time after all relaxation is done
  Object.values(byCol).forEach(col=>resolveCol(col));

  // ── Scale nodes to use available height proportionally ───────────────────────
  // When height increases, nodes should grow to fill the space, not just add empty padding
  const minY=Math.min(...nodes.map(n=>n.y0));
  const maxY=Math.max(...nodes.map(n=>n.y1));
  const currentContentH=maxY-minY;
  // Target: use up to 85% of available height (leave some breathing room)
  const targetH=IH*0.85;
  if(currentContentH>0&&currentContentH<targetH){
    const scaleFactor=targetH/currentContentH;
    // Scale all node heights and positions from the center
    const midY=(minY+maxY)/2;
    nodes.forEach(n=>{
      const h=n.y1-n.y0;
      const center=n.y0+h/2;
      const newH=h*scaleFactor;
      const dist=center-midY;
      const newCenter=midY+dist*scaleFactor;
      n.y0=newCenter-newH/2;
      n.y1=newCenter+newH/2;
    });
  }

  return{nodes,links,byCol,numCols,colOrder,colX};
}

function computeLinkOffsets(nodes){
  nodes.forEach(n=>{
    n.sourceLinks.sort((a,b)=>a.target.y0-b.target.y0);
    n.targetLinks.sort((a,b)=>a.source.y0-b.source.y0);
    // scale ribbons to fit exactly within the node's actual bar height
    const barH=Math.max(n.y1-n.y0,1);
    const outTotal=n.sourceLinks.reduce((s,l)=>s+l.v,0);
    const inTotal =n.targetLinks.reduce((s,l)=>s+l.v,0);
    const srcKy=outTotal>0?barH/outTotal:n.ky;
    const tgtKy=inTotal >0?barH/inTotal :n.ky;
    let sy=n.y0,ty=n.y0;
    n.sourceLinks.forEach(l=>{l.sy0=sy;l.sh=l.v*srcKy;l.sy1=sy+l.sh;sy+=l.sh;});
    n.targetLinks.forEach(l=>{l.ty0=ty;l.th=l.v*tgtKy;l.ty1=ty+l.th;ty+=l.th;});
  });
}


// ─── INSIGHT CARDS ────────────────────────────────────────────────────────────
function buildCards(nodes, links, meta={}){
  const find=(...ps)=>nodes.find(n=>ps.some(p=>n.name.toLowerCase().includes(p.toLowerCase())));
  const cur=getCurrencySymbol();

  const netSales    = find("Net Sales","Net Revenue","Total Net Sales");
  const grossProfit = find("Gross Profit","Gross margin");
  const netProfit   = find("Net Profit","Net income","NPAT","Profit After Tax");
  const dividends   = find("Dividend");
  const opProfit    = find("Operating Profit","Operating income");
  const finCost     = find("Finance Cost","Finance Charges","Interest");

  // helper: get prior value of a node from its incoming links
  const nodePrior=n=>{
    if(!n) return null;
    const inPrior=links.filter(l=>l.target===n&&l.prior!=null).reduce((a,l)=>a+l.prior,0);
    return inPrior>0?inPrior:null;
  };
  const pct=(a,b)=>a&&b&&b>0?Math.round(a/b*100):null;
  const chg=(cur,prv)=>prv&&prv>0?((cur-prv)/prv*100):null;
  const fmtChg=v=>{
    if(v==null) return null;
    return{label:(v>=0?`▲ ${Math.abs(v).toFixed(1)}%`:`▼ ${Math.abs(v).toFixed(1)}%`), cls:v>=0?"up":"down"};
  };

  const card=(lbl,color,val,prev,dsc,change)=>({lbl,color,val,prev:prev??null,dsc:dsc||"",change:change??null});

  const cards=[];

  // 1. EPS
  if(meta.EPS!=null){
    const prevEPS=meta.EPS_PRIOR||null;
    cards.push(card("EPS","#6366f1",
      `${cur} ${meta.EPS.toFixed(2)}`,
      prevEPS!=null?`${cur} ${prevEPS.toFixed(2)}`:null,
      "Earnings per share as reported",
      fmtChg(chg(meta.EPS,prevEPS))
    ));
  }

  // 2. DPS
  if(meta.DPS!=null){
    const prevDPS=meta.DPS_PRIOR||null;
    cards.push(card("DPS","#8b5cf6",
      `${cur} ${meta.DPS.toFixed(2)}`,
      prevDPS!=null?`${cur} ${prevDPS.toFixed(2)}`:null,
      "Dividends per share as reported",
      fmtChg(chg(meta.DPS,prevDPS))
    ));
  }

  // 3. Gross Margin
  if(grossProfit&&netSales&&netSales.value>0){
    const gm=pct(grossProfit.value,netSales.value);
    const prevNS=nodePrior(netSales), prevGP=nodePrior(grossProfit);
    const prevGM=prevNS&&prevGP?pct(prevGP,prevNS):null;
    cards.push(card("Gross Margin","#2d9e6b",
      `${gm}%`, prevGM!=null?`${prevGM}%`:null,
      `${fmtVal(grossProfit.value)} gross profit`,
      fmtChg(prevGM!=null?gm-prevGM:null)
    ));
  }

  // 4. Net Margin
  if(netProfit&&netSales&&netSales.value>0){
    const nm=pct(netProfit.value,netSales.value);
    const prevNS=nodePrior(netSales), prevNP=nodePrior(netProfit);
    const prevNM=prevNS&&prevNP?pct(prevNP,prevNS):null;
    cards.push(card("Net Margin","#059669",
      `${nm}%`, prevNM!=null?`${prevNM}%`:null,
      `${fmtVal(netProfit.value)} net profit`,
      fmtChg(prevNM!=null?nm-prevNM:null)
    ));
  }

  // 5. Operating Margin
  if(opProfit&&netSales&&netSales.value>0){
    const om=pct(opProfit.value,netSales.value);
    const prevNS=nodePrior(netSales), prevOP=nodePrior(opProfit);
    const prevOM=prevNS&&prevOP?pct(prevOP,prevNS):null;
    cards.push(card("Operating Margin","#0d9488",
      `${om}%`, prevOM!=null?`${prevOM}%`:null,
      `${fmtVal(opProfit.value)} operating profit`,
      fmtChg(prevOM!=null?om-prevOM:null)
    ));
  }

  // 6. Revenue Growth
  if(netSales){
    const prevNS=links.filter(l=>l.target===netSales&&l.prior).reduce((a,l)=>a+l.prior,0);
    if(prevNS>0){
      const growth=(netSales.value-prevNS)/prevNS*100;
      const col=growth>=0?"#22c55e":"#ef4444";
      cards.push(card("Revenue Growth",col,
        `${growth>=0?"▲":"▼"} ${Math.abs(growth).toFixed(1)}%`,
        `${fmtVal(prevNS)}`,
        `Current: ${fmtVal(netSales.value)}`,
        null
      ));
    }
  }

  // 7. Interest Coverage
  if(opProfit&&finCost&&finCost.value>0){
    const cov=opProfit.value/finCost.value;
    const col=cov>=3?"#2d9e6b":cov>=1.5?"#f59e0b":"#ef4444";
    const prevOP=nodePrior(opProfit), prevFC=nodePrior(finCost);
    const prevCov=prevOP&&prevFC&&prevFC>0?(prevOP/prevFC):null;
    cards.push(card("Interest Coverage",col,
      `${cov.toFixed(1)}×`,
      prevCov!=null?`${prevCov.toFixed(1)}×`:null,
      `>3× is healthy`,
      fmtChg(prevCov!=null?chg(cov,prevCov):null)
    ));
  }

  // 8. Dividend Cover
  if(netProfit&&dividends&&dividends.value>0){
    const cov=netProfit.value/dividends.value;
    const col=cov>=2?"#2d9e6b":cov>=1?"#f59e0b":"#ef4444";
    const prevNP=nodePrior(netProfit), prevDiv=nodePrior(dividends);
    const prevCov=prevNP&&prevDiv&&prevDiv>0?(prevNP/prevDiv):null;
    cards.push(card("Dividend Cover",col,
      `${cov.toFixed(2)}×`,
      prevCov!=null?`${prevCov.toFixed(2)}×`:null,
      `>2× is comfortable`,
      fmtChg(prevCov!=null?chg(cov,prevCov):null)
    ));
  }

  return cards;
}

// ─── INLINE-EDITABLE CHART HEADER ────────────────────────────────────────────
function renderMetaChip(field, value, extraStyle=""){
  if(!value) return "";
  return `<span class="meta-field" style="${extraStyle}" onclick="startMetaEdit(this,'${field}')" title="Click to edit">
    <span class="meta-val">${value}</span>
    <span class="meta-pencil">✏</span>
  </span>`;
}

function renderChartHeader(company, year, scope){
  const titleEl=document.getElementById("chartTitle");
  titleEl.innerHTML=
    renderMetaChip("company", company, "font-size:inherit;font-weight:700;color:#1a1a2e;")+
    (year?`<span style="color:#fff;margin:0 4px;font-weight:400;">—</span>`+
      renderMetaChip("year", year, `font-size:inherit;font-weight:700;color:var(--accent);`): "");
}

function startMetaEdit(chipEl, field){
  const valEl=chipEl.querySelector(".meta-val");
  const current=valEl.textContent;
  const inp=document.createElement("input");
  inp.className="meta-chip-input";
  inp.value=current;
  inp.style.fontSize=getComputedStyle(chipEl).fontSize;
  inp.style.fontWeight=getComputedStyle(chipEl).fontWeight;
  chipEl.replaceWith(inp);
  inp.focus();inp.select();

  const commit=()=>{
    const v=inp.value.trim()||current;
    // update the input field and re-render header
    if(field==="company"){
      document.getElementById("inCompany").value=v;
      currentCompany=v;
    } else if(field==="year"){
      document.getElementById("inYear").value=v;
      currentYear=v;
    } else if(field==="scope"){
      document.getElementById("inScope").value=v;
      currentScope=v;
    }
    // re-render header chips
    renderChartHeader(
      document.getElementById("inCompany").value.trim()||"Company",
      document.getElementById("inYear").value.trim()||"",
      document.getElementById("inScope").value.trim()||""
    );
    // update subtitle scope chip
    const cur=getCurrencySymbol(),unit=getUnit();
    const sc=document.getElementById("inScope").value.trim();
    document.getElementById("chartSubtitle").innerHTML=
      renderMetaChip("scope",sc,"font-size:11px;color:#666;letter-spacing:.06em;text-transform:uppercase;")+
      (sc?`<span style="color:#ccc;font-size:10px;margin:0 3px;">·</span>`:"")+
      `<span style="font-size:11px;color:#666;letter-spacing:.06em;text-transform:uppercase;">${cur} ${unit}</span>`;
    // update watermark
    const wmEl=document.getElementById("svg").querySelector("text:last-child");
    if(wmEl) wmEl.textContent=[currentCompany,currentYear,currentScope,`${cur} ${unit}`].filter(Boolean).join(" · ");
  };
  inp.addEventListener("blur",commit);
  inp.addEventListener("keydown",ev=>{
    if(ev.key==="Enter"){ev.preventDefault();commit();}
    if(ev.key==="Escape"){commit();}
  });
}

// ─── MINI MAP ───────────────────────────────────────────────────────────────────
let miniMapEnabled=true; // track mini map enabled state

function toggleMiniMap(){
  miniMapEnabled=!miniMapEnabled;
  const miniMap=document.getElementById("miniMap");
  const toggle=document.getElementById("miniMapToggle");
  const close=document.getElementById("miniMapClose");

  if(miniMapEnabled){
    // Show mini map, move toggle to top-right corner
    miniMap.style.display="block";
    toggle.style.display="none";
    close.style.display="block";
  }else{
    // Hide mini map, show toggle button in its place
    miniMap.style.display="none";
    toggle.style.display="block";
    close.style.display="none";
  }
}
function updateMiniMap(){
  const wrap=document.getElementById("wrap");
  const svg=document.getElementById("svg");
  const miniMap=document.getElementById("miniMap");
  const miniMapSvg=document.getElementById("miniMapSvg");
  const toggle=document.getElementById("miniMapToggle");

  if(!wrap||!svg||!miniMap||!miniMapSvg) return;

  // only show mini map if chart overflows horizontally AND is enabled
  if(wrap.scrollWidth<=wrap.clientWidth || !miniMapEnabled){
    miniMap.style.display="none";
    if(wrap.scrollWidth>wrap.clientWidth && !miniMapEnabled){
      toggle.style.display="block";
    }else{
      toggle.style.display="none";
    }
    return;
  }

  // mini map is enabled and chart overflows
  miniMap.style.display="block";
  toggle.style.display="none";

  // clear previous content
  while(miniMapSvg.firstChild){
    miniMapSvg.removeChild(miniMapSvg.firstChild);
  }

  // get chart dimensions
  const chartRect=svg.getBoundingClientRect();
  const chartWidth=parseFloat(svg.getAttribute("width"));
  const chartHeight=parseFloat(svg.getAttribute("height"));

  // mini map scale
  const miniWidth=120;
  const miniHeight=60;
  const scaleX=miniWidth/chartWidth;
  const scaleY=miniHeight/chartHeight;
  const scale=Math.min(scaleX,scaleY);

  // create simplified mini map (just colored rectangles for nodes)
  const NS="http://www.w3.org/2000/svg";
  const miniGroup=document.createElementNS(NS,"g");
  miniMapSvg.appendChild(miniGroup);

  // scale and center
  const offsetX=(miniWidth-chartWidth*scale)/2;
  const offsetY=(miniHeight-chartHeight*scale)/2;
  miniGroup.setAttribute("transform",`translate(${offsetX},${offsetY}) scale(${scale})`);

  if(currentNodes){
    currentNodes.forEach(n=>{
      const rect=document.createElementNS(NS,"rect");
      rect.setAttribute("x",n.x0);
      rect.setAttribute("y",n.y0);
      rect.setAttribute("width",n.x1-n.x0);
      rect.setAttribute("height",n.y1-n.y0);
      rect.setAttribute("fill",n.color);
      rect.setAttribute("opacity","0.6");
      rect.setAttribute("stroke","none");
      miniGroup.appendChild(rect);
    });
  }

  updateMiniMapViewport();
}

function updateMiniMapViewport(){
  const wrap=document.getElementById("wrap");
  const miniMap=document.getElementById("miniMap");
  const viewport=document.getElementById("miniMapViewport");
  const svg=document.getElementById("svg");

  if(!wrap||!miniMap||!viewport||!svg||wrap.scrollWidth<=wrap.clientWidth) return;

  // get visible area
  const chartWidth=parseFloat(svg.getAttribute("width"));
  const chartHeight=parseFloat(svg.getAttribute("height"));

  // mini map scale
  const miniWidth=120;
  const miniHeight=60;
  const scaleX=miniWidth/chartWidth;
  const scaleY=miniHeight/chartHeight;
  const scale=Math.min(scaleX,scaleY);

  const offsetX=(miniWidth-chartWidth*scale)/2;
  const offsetY=(miniHeight-chartHeight*scale)/2;

  // viewport rectangle in mini map coordinates
  const viewX=wrap.scrollLeft*scale+offsetX;
  const viewY=0; // no vertical scrolling
  const viewW=wrap.clientWidth*scale;
  const viewH=chartHeight*scale;

  viewport.style.left=viewX+"px";
  viewport.style.top=viewY+"px";
  viewport.style.width=viewW+"px";
  viewport.style.height=viewH+"px";
}

function scrollToMiniMapPosition(e){
  const wrap=document.getElementById("wrap");
  const miniMap=document.getElementById("miniMap");
  const svg=document.getElementById("svg");

  if(!wrap||!miniMap||!svg) return;

  const rect=miniMap.getBoundingClientRect();
  const chartWidth=parseFloat(svg.getAttribute("width"));

  // mini map scale
  const scaleX=180/chartWidth;
  const scaleY=100/parseFloat(svg.getAttribute("height"));
  const scale=Math.min(scaleX,scaleY);
  const offsetX=(180-chartWidth*scale)/2;

  // calculate click position relative to mini map content
  const clickX=e.clientX-rect.left;
  const scrollX=(clickX-offsetX)/scale-wrap.clientWidth/2;

  wrap.scrollLeft=Math.max(0,Math.min(scrollX,wrap.scrollWidth-wrap.clientWidth));
}

// ─── GENERATE ─────────────────────────────────────────────────────────────────
let currentNodes=null,currentLinks=null,currentLinkPaths=[],currentLinkBadges=[],dragging=null;
let previousHeight=600; // Track height changes to skip position restore
let currentCompany="",currentYear="",currentScope="",currentHasYoY=false,currentW=0,currentH=0;
let currentRawLinks=null,currentNodeNames=null;
let currentRawData=null; // Store full raw data for multi-chart sessions

function generate(){
  const errBox=document.getElementById("errBox");
  errBox.classList.remove("on");
  const raw=document.getElementById("inData").value.trim();
  if(!raw){errBox.textContent="Please enter flow data.";errBox.classList.add("on");return;}

  // Save full raw data for multi-chart sessions
  currentRawData=raw;

  // Check for multiple charts and update chartsData
  const charts=parseMultipleCharts(raw);
  if(charts.length>1){
    // Multiple charts detected
    chartsData=charts;
    // Use the active chart data for generation
    const activeChart=chartsData[activeChartIndex];
    document.getElementById("inData").value=activeChart.data;
    renderTabs();
  }
  updateChartData(document.getElementById("inData").value);

  let parsed;
  try{parsed=parseData(chartsData[activeChartIndex].data);}
  catch(e){errBox.textContent=e.message;errBox.classList.add("on");return;}
  const{nodeNames,links:rawLinks,hasYoY,meta,shortNames}=parsed;

  // auto-fill currency/unit from meta
  const hasCurrencyMeta=meta.CURRENCY||meta.UNIT;
  applyCurrencyMeta(meta.CURRENCY||null, meta.UNIT||null);

  // highlight currency/unit fields if not provided by prompt
  const curField=document.getElementById("inCurrency").closest(".field");
  const unitField=document.getElementById("inUnit").closest(".field");
  if(!hasCurrencyMeta){
    curField.classList.add("field-warn");
    unitField.classList.add("field-warn");
  } else {
    curField.classList.remove("field-warn");
    unitField.classList.remove("field-warn");
  }

  // auto-fill text metadata
  if(meta.COMPANY) document.getElementById("inCompany").value=meta.COMPANY;
  if(meta.PERIOD)  document.getElementById("inYear").value=meta.PERIOD;
  if(meta.SCOPE)   document.getElementById("inScope").value=meta.SCOPE;

  const company=document.getElementById("inCompany").value.trim()||"Company";
  const year   =document.getElementById("inYear").value.trim()||"";
  const scope  =document.getElementById("inScope").value.trim()||"";

  // cache for re-use by export functions
  currentCompany=company;currentYear=year;currentScope=scope;currentHasYoY=hasYoY;
  currentRawLinks=rawLinks;currentNodeNames=nodeNames;

  document.getElementById("placeholder").style.display="none";
  const ci=document.getElementById("chartInner");ci.style.display="flex";

  // render inline-editable header chips
  renderChartHeader(company,year,scope);

  const unit=getUnit(),cur=getCurrencySymbol();
  document.getElementById("chartSubtitle").innerHTML=
    renderMetaChip("scope",scope,"font-size:11px;color:#666;letter-spacing:.06em;text-transform:uppercase;")+
    (scope?`<span style="color:#ccc;font-size:10px;">·</span>`:"")+
    `<span style="font-size:11px;color:#666;letter-spacing:.06em;text-transform:uppercase;">${cur} ${unit}</span>`;

  const H=parseInt(document.getElementById("inHeight").value)||600;
  console.log('[Generate] Using height H =', H, 'from input value:', document.getElementById("inHeight").value);
  const heightChanged = Math.abs(H - previousHeight) > 10; // More than 10px difference
  previousHeight = H; // Store for next comparison
  currentH=H;
  const NODE_W=parseInt(document.getElementById("inNodeWidth").value)||40, NODE_PAD=16;
  const LABEL_SIZE=parseInt(document.getElementById("inLabelSize").value)||12;
  const VALUE_LABEL_SIZE=parseInt(document.getElementById("inValueLabelSize").value)||10;
  const isMobile=window.innerWidth<=700;
  const marginLR=isMobile?60:160;
  const MARGIN={top:32, right:marginLR, bottom:52, left:marginLR};
  const chartArea=document.querySelector(".chart-area");
  // mobile: fixed 800px — always readable, #wrap scrolls it horizontally
  const W=isMobile ? 800 : Math.min(Math.max(chartArea.clientWidth-56, 900), 1400);
  currentW=W;
  const IW=W-MARGIN.left-MARGIN.right, IH=H-MARGIN.top-MARGIN.bottom;
  const colSpacing=parseInt(document.getElementById("inColSpacing").value)||150;

  const{nodes,links,byCol,numCols,colOrder,colX}=buildLayout(nodeNames,rawLinks,IW,IH,NODE_W,NODE_PAD,MARGIN,colSpacing,shortNames);

  // Save/restore node positions to prevent jerky movement when switching charts
  // NOTE: Don't restore positions if height has changed - layout needs to recalibrate
  const chartKey=chartsData[activeChartIndex]?.id||"current";
  if(!heightChanged && chartPositions.has(chartKey)){
    // Restore saved positions - use node names to match since indices can change
    const savedPositions=chartPositions.get(chartKey);
    nodes.forEach(n=>{
      const savedPos=savedPositions.find(sp=>sp.name===n.name);
      if(savedPos){
        n.y0=savedPos.y0;
        n.y1=savedPos.y1;
      }
    });
  }
  // Always save/update positions after generation
  const positions=nodes.map(n=>({name:n.name,y0:n.y0,y1:n.y1}));
  chartPositions.set(chartKey,positions);

  // svgW = left margin + column spans + right margin — both sides equal
  const svgW=MARGIN.left + Math.max(numCols-1,0)*colSpacing + NODE_W + MARGIN.right;
  currentNodes=nodes;currentLinks=links;

  const sources=nodes.filter(n=>n.targetLinks.length===0);
  document.getElementById("chartTotal").textContent=fmtVal(sources.reduce((a,n)=>a+n.value,0));
  // assign palette colors
  // monochrome palettes: sort dark→light and assign by column so left=dark, right=light
  // all other palettes: original id-based cycling
  {
    const pal=getPalette();
    const palName=activePalette||"";
    const isMono=palName.startsWith("Mono:");
    if(isMono){
      const getLum=hex=>{
        const rgb=hexToRgb(hex);if(!rgb)return 0.5;
        const [r,g,b]=rgb.map(c=>{const s=c/255;return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);});
        return 0.2126*r+0.7152*g+0.0722*b;
      };
      const sorted=[...pal].sort((a,b)=>getLum(a)-getLum(b)); // darkest first
      const numCols2=Math.max(...nodes.map(n=>n.col))+1;
      nodes.forEach(n=>{
        // spread colors evenly across columns
        const colFrac=numCols2<=1?0:n.col/(numCols2-1);
        const idx=Math.round(colFrac*(sorted.length-1));
        n.color=sorted[idx];
      });
    } else {
      nodes.forEach(n=>{n.color=pal[n.id%pal.length];});
    }
  }

  // warnings
  const warnings=validateFlows(nodes,links);
  if(!hasCurrencyMeta) warnings.unshift("Currency and unit not found in data — please set them manually in the fields highlighted above");
  const wb=document.getElementById("warnBox");
  if(warnings.length){wb.innerHTML="⚠ "+warnings.map(w=>`${w}`).join("<br>⚠ ");wb.classList.add("on");}
  else{wb.classList.remove("on");wb.innerHTML="";}

  // YoY legend
  const yoyLeg=document.getElementById("yoyLegend");
  yoyLeg.classList.toggle("on",hasYoY);

  computeLinkOffsets(nodes);

  const NS="http://www.w3.org/2000/svg";
  const svgEl=document.getElementById("svg");
  svgEl.innerHTML="";
  svgEl.setAttribute("width",svgW);svgEl.setAttribute("height",H);

  // defs
  const defs=document.createElementNS(NS,"defs");svgEl.appendChild(defs);

  // subtle shadow for node bars (intensity controlled by slider)
  const shadowIntensity=parseInt(document.getElementById("inShadowIntensity").value)||20;
  const shadowOpacity=(shadowIntensity/100).toFixed(2);
  const shadowFilter=document.createElementNS(NS,"filter");
  shadowFilter.setAttribute("id","barShadow");
  shadowFilter.setAttribute("x","-20%");shadowFilter.setAttribute("y","-10%");
  shadowFilter.setAttribute("width","140%");shadowFilter.setAttribute("height","120%");
  const feShadow=document.createElementNS(NS,"feDropShadow");
  feShadow.setAttribute("dx","1");feShadow.setAttribute("dy","1");
  feShadow.setAttribute("stdDeviation","1");feShadow.setAttribute("flood-opacity",shadowOpacity);
  shadowFilter.appendChild(feShadow);
  defs.appendChild(shadowFilter);

  links.forEach((l,i)=>{
    const g=document.createElementNS(NS,"linearGradient");
    g.setAttribute("id",`gr${i}`);g.setAttribute("x1","0%");g.setAttribute("x2","100%");
    [[0,l.source.color],[1,l.target.color]].forEach(([off,col])=>{
      const s=document.createElementNS(NS,"stop");
      s.setAttribute("offset",off===0?"0%":"100%");s.setAttribute("stop-color",col);s.setAttribute("stop-opacity","0.45");
      g.appendChild(s);
    });
    defs.appendChild(g);
  });

  const tip=document.getElementById("tip");

  // ── link layer ───────────────────────────────────────────────────────────────
  const linkGroup=document.createElementNS(NS,"g");svgEl.appendChild(linkGroup);
  currentLinkPaths=[];currentLinkBadges=[];

  links.forEach((l,i)=>{
    const path=document.createElementNS(NS,"path");
    path.setAttribute("fill",`url(#gr${i})`);path.setAttribute("stroke","none");
    path.setAttribute("fill-opacity","0.5");path.style.cursor="pointer";path.style.transition="fill-opacity 0.15s";
    const yoyPct=hasYoY&&l.prior!=null&&l.prior>0?((l.v-l.prior)/l.prior*100):null;
    path.addEventListener("mousemove",e=>{
      if(dragging)return;
      path.setAttribute("fill-opacity","0.85");
      let html=`<strong style="color:#1a1a2e">${l.source.name}</strong> <span style="color:#aaa">→</span> <strong style="color:#1a1a2e">${l.target.name}</strong><br><span style="color:var(--accent);font-weight:600">${l.isNegative?"(−)":""}${fmtVal(l.v)}</span>`;
      if(yoyPct!=null){
        const sign=yoyPct>=0?"▲":"▼",col=yoyPct>=0?"#22c55e":"#ef4444";
        const absPct=Math.abs(yoyPct);
        const yoyText=absPct>=150?(absPct/100).toFixed(1)+"x":absPct.toFixed(1)+"%";
        html+=` <span style="color:${col};font-weight:600">${sign}${yoyText}</span>`;
        if(l.prior!=null) html+=`<br><span style="color:#aaa;font-size:11px;">Prior: ${fmtVal(l.prior)}</span>`;
      }
      tip.innerHTML=html;tip.classList.add("on");
      tip.style.left=(e.clientX+14)+"px";tip.style.top=(e.clientY-42)+"px";
    });
    path.addEventListener("mouseleave",()=>{path.setAttribute("fill-opacity","0.5");tip.classList.remove("on");});
    linkGroup.appendChild(path);currentLinkPaths.push(path);
  });

  // ── per-node YoY delta map (used by label and tooltip) ──────────────────────
  const nodeYoY=new Map(); // node.id → pct
  if(hasYoY){
    nodes.forEach(n=>{
      const relevant=n.targetLinks.filter(l=>l.prior!=null&&l.prior>0).length
        ?n.targetLinks.filter(l=>l.prior!=null&&l.prior>0)
        :n.sourceLinks.filter(l=>l.prior!=null&&l.prior>0);
      if(!relevant.length)return;
      const totalCur=relevant.reduce((a,l)=>a+l.v,0);
      const totalPrior=relevant.reduce((a,l)=>a+(l.prior||0),0);
      if(totalPrior===0)return;
      nodeYoY.set(n.id,(totalCur-totalPrior)/totalPrior*100);
    });
  }

  // badge visibility state (controls whether delta shows in labels)
  let badgesVisible=true;
  const btnYoY=document.getElementById("btnYoY");
  if(btnYoY){
    btnYoY.style.display=hasYoY?"":"none";
    btnYoY.classList.toggle("active",true);
    btnYoY.onclick=()=>{
      badgesVisible=!badgesVisible;
      btnYoY.classList.toggle("active",badgesVisible);
      nodes.forEach(n=>{
        if(n._t3&&n._t3._tsYoY){
          n._t3._tsYoY.style.display=badgesVisible?"":"none";
          if(n._t3._tsSp) n._t3._tsSp.style.display=badgesVisible?"":"none";
        }
      });
    };
  }

  // ── node layer ───────────────────────────────────────────────────────────────
  const nodeGroup=document.createElementNS(NS,"g");svgEl.appendChild(nodeGroup);
  dragging=null;

  // watermark — company bold+dark, year accent green, rest muted
  const wm=document.createElementNS(NS,"text");
  wm.setAttribute("x",svgW-MARGIN.right);wm.setAttribute("y",H-18);
  wm.setAttribute("text-anchor","end");
  wm.setAttribute("font-size","13");
  wm.setAttribute("font-family","Segoe UI,sans-serif");wm.setAttribute("pointer-events","none");
  function buildWatermark(co,yr,sc,cu){
    wm.textContent="";
    const parts=[];
    if(co) parts.push({text:co,fill:"#1a1a2e",weight:"700"});
    if(yr) parts.push({text:yr,fill:"var(--accent)",weight:"600"});
    if(sc) parts.push({text:sc,fill:"#bbb",weight:"400"});
    if(cu) parts.push({text:cu.toUpperCase(),fill:"#bbb",weight:"400"});
    parts.forEach((p,i)=>{
      if(i>0){const sep=document.createElementNS(NS,"tspan");sep.setAttribute("fill","#ccc");sep.textContent=" · ";wm.appendChild(sep);}
      const ts=document.createElementNS(NS,"tspan");
      ts.setAttribute("fill",p.fill);ts.setAttribute("font-weight",p.weight);
      ts.textContent=p.text;wm.appendChild(ts);
    });
  }
  buildWatermark(company,year,scope,`${cur} ${unit}`);
  svgEl.appendChild(wm);

  function recomputeLinks(){
    nodes.forEach(n=>{
      n.sourceLinks.sort((a,b)=>a.target.y0-b.target.y0);
      n.targetLinks.sort((a,b)=>a.source.y0-b.source.y0);
      const barH=Math.max(n.y1-n.y0,1);
      const outTotal=n.sourceLinks.reduce((s,l)=>s+l.v,0);
      const inTotal =n.targetLinks.reduce((s,l)=>s+l.v,0);
      const srcKy=outTotal>0?barH/outTotal:n.ky;
      const tgtKy=inTotal >0?barH/inTotal :n.ky;
      let sy=n.y0,ty=n.y0;
      n.sourceLinks.forEach(l=>{l.sy0=sy;l.sh=l.v*srcKy;l.sy1=sy+l.sh;sy+=l.sh;});
      n.targetLinks.forEach(l=>{l.ty0=ty;l.th=l.v*tgtKy;l.ty1=ty+l.th;ty+=l.th;});
    });
  }
  window.redrawAll=function redrawAll(){
    console.log('[redrawAll] CALLED - currentNodes:', typeof currentNodes !== 'undefined' ? 'exists' : 'NULL');
    const useShortNames=document.getElementById("inShortNames").checked;
    console.log('[redrawAll] useShortNames:', useShortNames);
    recomputeLinks();
    links.forEach((l,i)=>currentLinkPaths[i].setAttribute("d",ribbonPath(l)));
    nodes.forEach(n=>{
      n._rect.setAttribute("y",n.y0);n._rect.setAttribute("height",Math.max(n.y1-n.y0,2));

      // Update label text based on short names toggle
      const displayName=useShortNames&&n.shortName?n.shortName:n.name;
      console.log('[redrawAll] Node:', n.name, 'shortName:', n.shortName, 'displayName:', displayName);
      const words=displayName.split(" ");
      const maxChars=22;
      const lines=[];let cur2="";
      words.forEach(w=>{
        if((cur2+" "+w).trim().length>maxChars&&cur2){lines.push(cur2.trim());cur2=w;}
        else cur2=(cur2+" "+w).trim();
      });
      if(cur2) lines.push(cur2);

      // Update tspan content
      const tspans=[...n._t1.querySelectorAll("tspan")];

      // Update or create ts pans with new text
      lines.forEach((line,li)=>{
        if(li<tspans.length){
          tspans[li].textContent=line;
        }else{
          const ts=document.createElementNS(NS,"tspan");
          ts.setAttribute("x",n._t1.getAttribute("x"));
          ts.textContent=line;
          n._t1.appendChild(ts);
        }
      });
      // Remove extra ts pans if we have fewer lines now
      for(let i=lines.length;i<tspans.length;i++){
        tspans[i].remove();
      }

      const lineH=14;
      const numLines=lines.length||1;
      const totalTextH=numLines*lineH;
      const cy2=(n.y0+n.y1)/2;
      const rawTop=cy2-totalTextH/2;
      const clampedTop=Math.max(n.y0+4,Math.min(rawTop,n.y1-4-totalTextH));
      const t1BaseY=clampedTop+lineH-2;
      tspans.forEach((ts,li)=>ts.setAttribute("y",t1BaseY+li*lineH));
      n._t1.setAttribute("y",t1BaseY);
      const t2BaseY=t1BaseY+numLines*lineH+2;
      n._t2.setAttribute("y",t2BaseY);
      // t3: inside bar (3 lines) or above bar (1 line) depending on bar height
      if(n._t3){
        const barCx=n.x0+NODE_W/2;
        const barH=n.y1-n.y0;
        const MIN_H_FOR_INSIDE=50;
        const shouldInside=barH>=MIN_H_FOR_INSIDE;

        n._t3.setAttribute("x",barCx);

        if(shouldInside){
          // Update the 3 separate text elements
          const lineHeight=12;
          const pct=nodeYoY.get(n.id);
          const numLines=pct!=null?3:2;
          const totalTextH=numLines*lineHeight;
          const marginTop=(barH-totalTextH)/2;
          const startY=n.y0+marginTop;

          if(n._t3._line1){
            n._t3._line1.setAttribute("x",barCx);
            n._t3._line1.setAttribute("y",startY+8);
          }
          if(n._t3._line2){
            n._t3._line2.setAttribute("x",barCx);
            n._t3._line2.setAttribute("y",startY+18);
          }
          if(n._t3._line3){
            n._t3._line3.setAttribute("x",barCx);
            n._t3._line3.setAttribute("y",startY+38);
          }
          n._t3._isInside=true;
        }else{
          // Above bar: rebuild t3 content
          if(n._t3.style.display==="none"){
            n._t3.style.display="";
            if(n._t3._line1){n._t3._line1.remove();n._t3._line1=null;}
            if(n._t3._line2){n._t3._line2.remove();n._t3._line2=null;}
            if(n._t3._line3){n._t3._line3.remove();n._t3._line3=null;}
          }

          const pct=nodeYoY.get(n.id);
          n._t3.innerHTML="";
          n._t3.setAttribute("y",n.y0-4);
          n._t3.setAttribute("x",barCx);

          const tsVal=document.createElementNS(NS,"tspan");
          tsVal.setAttribute("fill",getReadableColor(n.color));
          tsVal.setAttribute("font-weight","700");
          tsVal.textContent=fmtVal(n.value);
          n._t3.appendChild(tsVal);

          if(pct!=null){
            const tsSp=document.createElementNS(NS,"tspan");
            tsSp.setAttribute("fill","#ccc");tsSp.textContent=" ";
            n._t3.appendChild(tsSp);

            const tsArrow=document.createElementNS(NS,"tspan");
            tsArrow.setAttribute("fill",pct>=0?"#16a34a":"#dc2626");
            tsArrow.textContent=(pct>=0?"▲":"▼");
            n._t3.appendChild(tsArrow);

            const tsYoY=document.createElementNS(NS,"tspan");
            tsYoY.setAttribute("fill",getReadableColor(n.color));
            tsYoY.setAttribute("font-weight","700");
            // Use multiplier for >=150% instead of percentage
            const absPct=Math.abs(pct);
            tsYoY.textContent=absPct>=150?(absPct/100).toFixed(1)+"x":absPct.toFixed(1)+"%";
            n._t3.appendChild(tsYoY);
            n._t3._tsYoY=tsYoY;n._t3._tsSp=tsSp;
          }
          n._t3._isInside=false;
        }
      }
    });
  }

  recomputeLinks();
  links.forEach((l,i)=>currentLinkPaths[i].setAttribute("d",ribbonPath(l)));


  // ── node vertical drag ────────────────────────────────────────────────────
  // clean up stale listeners from previous generate() calls
  const oldBar=document.getElementById("colHandleBar");
  if(oldBar) oldBar.remove();
  if(window._onColMove) document.removeEventListener("mousemove",window._onColMove);
  if(window._onColUp)   document.removeEventListener("mouseup",  window._onColUp);
  if(window._svgMove)   document.removeEventListener("mousemove",window._svgMove);
  if(window._svgUp)     document.removeEventListener("mouseup",  window._svgUp);

  window._svgMove=e=>{
    if(!dragging) return;
    const n=dragging.node;
    const h=dragging.startY1-dragging.startY0;
    let newY0=dragging.startY0+(e.clientY-dragging.startMouseY);
    newY0=Math.max(MARGIN.top,Math.min(MARGIN.top+IH-h,newY0));
    n.y0=newY0;n.y1=newY0+h;
    window.redrawAll();
  };
  window._svgUp=()=>{
    if(!dragging) return;
    const nd=dragging.node;
    if(nd._rect) nd._rect.style.cursor="grab";
    if(nd._t1) nd._t1.style.cursor="grab";
    if(nd._t2) nd._t2.style.cursor="grab";
    if(nd._t3) nd._t3.style.cursor="grab";
    dragging=null;
    document.body.style.userSelect="";
  };
  // mousemove/mouseup on document so drag works even when mouse leaves SVG bounds
  document.addEventListener("mousemove", window._svgMove);
  document.addEventListener("mouseup",   window._svgUp);

  nodes.forEach(n=>{
    const onRight=n.x0>svgW/2;
    const tx=onRight?n.x0-8:n.x1+8;
    const anchor=onRight?"end":"start";
    const cy=(n.y0+n.y1)/2;

    const rect=document.createElementNS(NS,"rect");
    rect.setAttribute("x",n.x0);rect.setAttribute("y",n.y0);
    rect.setAttribute("width",NODE_W);rect.setAttribute("height",Math.max(n.y1-n.y0,2));
    rect.setAttribute("fill",n.color);rect.setAttribute("rx","0");rect.setAttribute("filter","url(#barShadow)");
    rect.style.cursor="grab";
    n._rect=rect;

    // t1 — node name beside bar
    // anchor: center in bar ideally, but cap so text stays within bar bounds
    const t1=document.createElementNS(NS,"text");
    t1.setAttribute("text-anchor",anchor);
    t1.setAttribute("font-size",(LABEL_SIZE+0.5).toString());t1.setAttribute("fill",n.color);
    t1.setAttribute("font-weight","600");
    t1.setAttribute("font-family","Segoe UI,sans-serif");
    t1.setAttribute("pointer-events","all");
    t1.style.cursor="grab";
    n._t1=t1;
    const useShortNames=document.getElementById("inShortNames").checked;
    const displayName=useShortNames&&n.shortName?n.shortName:n.name;
    const words=displayName.split(" ");
    const maxChars=22;
    const lines=[];let cur2="";
    words.forEach(w=>{
      if((cur2+" "+w).trim().length>maxChars&&cur2){lines.push(cur2.trim());cur2=w;}
      else cur2=(cur2+" "+w).trim();
    });
    if(cur2) lines.push(cur2);
    const lineH=14;
    const totalTextH=lines.length*lineH;
    // ideal center, then clamp so block stays inside bar vertically
    const idealMid=cy;
    const rawTop=idealMid-totalTextH/2;
    const clampedTop=Math.max(n.y0+4, Math.min(rawTop, n.y1-4-totalTextH));
    const t1BaseY=clampedTop+lineH-2;
    lines.forEach((line,li)=>{
      const ts=document.createElementNS(NS,"tspan");
      ts.setAttribute("x",tx);
      ts.setAttribute("y",t1BaseY+li*lineH);
      ts.textContent=line;
      t1.appendChild(ts);
    });
    t1.setAttribute("x",tx);t1.setAttribute("y",t1BaseY);


    // t2 — invisible placeholder, kept for drag handler compatibility
    const t2BaseY = t1BaseY + lines.length*lineH + 2;
    const t2=document.createElementNS(NS,"text");
    t2.setAttribute("x",tx);t2.setAttribute("y",t2BaseY);t2.setAttribute("text-anchor",anchor);
    t2.setAttribute("font-size",(LABEL_SIZE-2).toString());t2.setAttribute("fill","none");
    t2.setAttribute("font-family","Segoe UI,sans-serif");
    t2.setAttribute("pointer-events","all");t2.style.cursor="grab";
    n._t2=t2;

    // t3 — value + YoY label: inside bar (3 lines) for large bars, above bar for small bars
    const pct=nodeYoY.get(n.id);
    const barCx=n.x0+NODE_W/2;
    const barH=n.y1-n.y0;
    const MIN_H_FOR_INSIDE=50; // minimum height to fit 3 lines inside bar
    const isInside=barH>=MIN_H_FOR_INSIDE;

    const t3=document.createElementNS(NS,"text");
    t3.setAttribute("x",barCx);
    t3.setAttribute("text-anchor","middle");
    t3.setAttribute("font-family","Segoe UI,sans-serif");
    t3._isInside=isInside; // store for redrawAll
    t3._wasInsideMode=isInside; // remember initial creation mode
    t3._barCx=barCx; // store for redraw

    if(isInside){
      // Inside bar: 3 separate text elements for 3 lines
      const lineH=11;
      const numLines=pct!=null?3:2;
      const totalTextH=numLines*lineH;
      const marginTop=(barH-totalTextH)/2;
      const startY=n.y0+marginTop;

      const formatted=fmtVal(n.value);
      const {currency, value}=splitFmtVal(formatted);

      // Line 1: currency - separate text element
      const tLine1=document.createElementNS(NS,"text");
      tLine1.setAttribute("x",barCx);
      tLine1.setAttribute("y",startY+8);
      tLine1.setAttribute("dy","0");
      tLine1.setAttribute("text-anchor","middle");
      tLine1.setAttribute("dominant-baseline","hanging");
      tLine1.setAttribute("fill",getInsideBarTextColor(n.color));
      tLine1.setAttribute("font-weight","600");
      tLine1.setAttribute("font-size",VALUE_LABEL_SIZE.toString());
      tLine1.setAttribute("font-family","Segoe UI,sans-serif");
      tLine1.style.cursor="grab";
      tLine1.textContent=currency;
      svg.appendChild(tLine1);
      t3._line1=tLine1;

      // Line 2: value - separate text element
      const tLine2=document.createElementNS(NS,"text");
      tLine2.setAttribute("x",barCx);
      tLine2.setAttribute("y",startY+18);
      tLine2.setAttribute("text-anchor","middle");
      tLine2.setAttribute("dominant-baseline","hanging");
      tLine2.setAttribute("fill",getInsideBarTextColor(n.color));
      tLine2.setAttribute("font-weight","700");
      tLine2.setAttribute("font-size",VALUE_LABEL_SIZE.toString());
      tLine2.setAttribute("font-family","Segoe UI,sans-serif");
      tLine2.style.cursor="grab";
      tLine2.textContent=value;
      svg.appendChild(tLine2);
      t3._line2=tLine2;

      // Line 3: YoY - separate text element with colored arrow
      if(pct!=null){
        const tLine3=document.createElementNS(NS,"text");
        tLine3.setAttribute("x",barCx);
        tLine3.setAttribute("y",startY+32);
        tLine3.setAttribute("text-anchor","middle");
        tLine3.setAttribute("dominant-baseline","hanging");
        tLine3.setAttribute("fill",getInsideBarTextColor(n.color));
        tLine3.setAttribute("font-weight","600");
        tLine3.setAttribute("font-size",VALUE_LABEL_SIZE.toString());
        tLine3.setAttribute("font-family","Segoe UI,sans-serif");
        tLine3.style.cursor="grab";

        const arrowSpan=document.createElementNS(NS,"tspan");
        arrowSpan.setAttribute("fill",pct>=0?"#86efac":"#fca5a5");
        arrowSpan.textContent=(pct>=0?"▲":"▼");
        tLine3.appendChild(arrowSpan);

        const pctSpan=document.createElementNS(NS,"tspan");
        pctSpan.setAttribute("fill",getInsideBarTextColor(n.color));
        // Use multiplier for >=150% instead of percentage
        const absPct=Math.abs(pct);
        if(absPct>=150){
          pctSpan.textContent=(absPct/100).toFixed(1)+"x";
        }else{
          pctSpan.textContent=absPct.toFixed(1)+"%";
        }
        tLine3.appendChild(pctSpan);

        svg.appendChild(tLine3);
        t3._line3=tLine3;
        t3._tsYoY=tLine3;
      }

      // Hide t3 since we created separate elements
      t3.style.display="none";
    }else{
      // Above bar: 1 line, colored text (original behavior)
      t3.setAttribute("y",n.y0-4);
      t3.setAttribute("font-size",VALUE_LABEL_SIZE.toString());

      const tsVal=document.createElementNS(NS,"tspan");
      tsVal.setAttribute("fill",getReadableColor(n.color));
      tsVal.setAttribute("font-weight","700");
      tsVal.textContent=fmtVal(n.value);
      t3.appendChild(tsVal);

      if(pct!=null){
        const tsSp=document.createElementNS(NS,"tspan");
        tsSp.setAttribute("fill","#ccc");tsSp.textContent=" ";
        t3.appendChild(tsSp);

        const tsArrow=document.createElementNS(NS,"tspan");
        tsArrow.setAttribute("fill",pct>=0?"#16a34a":"#dc2626");
        tsArrow.textContent=(pct>=0?"▲":"▼");
        t3.appendChild(tsArrow);

        const tsYoY=document.createElementNS(NS,"tspan");
        tsYoY.setAttribute("fill",getReadableColor(n.color));
        tsYoY.setAttribute("font-weight","700");
        // Use multiplier for >=150% instead of percentage
        const absPct=Math.abs(pct);
        tsYoY.textContent=absPct>=150?(absPct/100).toFixed(1)+"x":absPct.toFixed(1)+"%";
        t3.appendChild(tsYoY);
        t3._tsYoY=tsYoY;t3._tsSp=tsSp;
      }
    }

    // respect badge toggle for YoY part
    if(pct!=null&&!badgesVisible){
      if(t3._tsYoY) t3._tsYoY.style.display="none";
      if(t3._tsSp) t3._tsSp.style.display="none";
    }
    n._t3=t3;

    rect.addEventListener("mouseenter",e=>{
      if(dragging)return;
      const conn=new Set([...n.sourceLinks,...n.targetLinks].map(l=>l.index));
      currentLinkPaths.forEach((p,i)=>p.setAttribute("fill-opacity",conn.has(i)?"0.85":"0.15"));
      let html=`<strong style="color:#1a1a2e">${n.name}</strong><br><span style="color:var(--accent);font-weight:600">${fmtVal(n.value)}</span>`;

      // Show inflows (sources → this node) - use targetLinks
      if(n.targetLinks.length>0){
        html+='<div style="margin-top:4px;font-size:11px;color:#666;">Inflows:</div>';
        n.targetLinks.forEach(l=>{
          const yoyPct=l.prior!=null&&l.prior!==0?((l.v-l.prior)/l.prior*100):null;
          let flowHtml=`<div style="font-size:11px;">• ${l.source.name}: <span style="color:var(--accent);font-weight:600">${fmtVal(l.v)}</span>`;
          if(yoyPct!=null){
            const sign=yoyPct>=0?"▲":"▼",col=yoyPct>=0?"#22c55e":"#ef4444";
            const absPct=Math.abs(yoyPct);
            const yoyText=absPct>=150?(absPct/100).toFixed(1)+"x":absPct.toFixed(1)+"%";
            flowHtml+=` <span style="color:${col};font-weight:600">${sign}${yoyText}</span>`;
          }
          flowHtml+='</div>';
          html+=flowHtml;
        });
      }

      // Show outflows (this node → targets) - use sourceLinks
      if(n.sourceLinks.length>0){
        html+='<div style="margin-top:4px;font-size:11px;color:#666;">Outflows:</div>';
        n.sourceLinks.forEach(l=>{
          const yoyPct=l.prior!=null&&l.prior!==0?((l.v-l.prior)/l.prior*100):null;
          let flowHtml=`<div style="font-size:11px;">• ${l.target.name}: <span style="color:var(--accent);font-weight:600">${fmtVal(l.v)}</span>`;
          if(yoyPct!=null){
            const sign=yoyPct>=0?"▲":"▼",col=yoyPct>=0?"#22c55e":"#ef4444";
            const absPct=Math.abs(yoyPct);
            const yoyText=absPct>=150?(absPct/100).toFixed(1)+"x":absPct.toFixed(1)+"%";
            flowHtml+=` <span style="color:${col};font-weight:600">${sign}${yoyText}</span>`;
          }
          flowHtml+='</div>';
          html+=flowHtml;
        });
      }

      // Show node YoY if available
      if(nodeYoY.has(n.id)){
        const p=nodeYoY.get(n.id);
        const col=p>=0?"#22c55e":"#ef4444";
        const absPct=Math.abs(p);
        const yoyText=absPct>=150?(absPct/100).toFixed(1)+"x":absPct.toFixed(1)+"%";
        html+=`<div style="margin-top:4px;font-size:11px;"><span style="color:${col};font-weight:600">Net ${p>=0?"▲":"▼"}${yoyText} YoY</span></div>`;
      }

      tip.innerHTML=html;tip.classList.add("on");tip.style.left=(e.clientX+14)+"px";tip.style.top=(e.clientY-42)+"px";
    });
    rect.addEventListener("mousemove",e=>{if(!dragging){tip.style.left=(e.clientX+14)+"px";tip.style.top=(e.clientY-42)+"px";}});
    rect.addEventListener("mouseleave",()=>{if(dragging)return;currentLinkPaths.forEach(p=>p.setAttribute("fill-opacity","0.5"));tip.classList.remove("on");});
    // right-click context menu on node and its labels
    const onCtxMenu=e=>{
      const renameFn=newName=>{
        n.name=newName;
        const tspans=[...t1.querySelectorAll("tspan")];
        if(tspans.length){tspans[0].textContent=newName;for(let i=1;i<tspans.length;i++)tspans[i].textContent="";}
        else t1.textContent=newName;
        if(wm) buildWatermark(company,year,scope,`${cur} ${unit}`);
      };
      const resetFn=()=>{
        // reset to original y position from layout
        const h=n.y1-n.y0;
        const col=byCol[n.col]||[];
        col.sort((a,b)=>b.value-a.value);
        const totalH=col.reduce((a2,nd)=>a2+nd.value*n.ky,0)+NODE_PAD*(col.length-1);
        let y2=MARGIN.top+(IH-totalH)/2;
        col.forEach(nd=>{nd.y0=y2;nd.y1=y2+nd.value*n.ky;nd.ky=n.ky;y2=nd.y1+NODE_PAD;});
        window.redrawAll();
      };
      showCtxMenu(e,n,renameFn,resetFn,redrawAll);
    };
    rect.addEventListener("contextmenu",onCtxMenu);
    t1.addEventListener("contextmenu",onCtxMenu);
    t2.addEventListener("contextmenu",onCtxMenu);
    if(t3) t3.addEventListener("contextmenu",onCtxMenu);

    // shared rename function — called from rect dblclick and label dblclick
    let dblclickPending=false;
    const startRename=(clientX,clientY)=>{
      if(dragging){dragging.node._rect.style.cursor="grab";dragging=null;document.body.style.userSelect="";}
      dblclickPending=true;
      setTimeout(()=>{dblclickPending=false;},300);
      tip.classList.remove("on");
      const inp=document.createElement("input");
      inp.className="label-edit";
      inp.value=n.name;
      inp.style.left=(clientX+4)+"px";
      inp.style.top=(clientY-12)+"px";
      document.body.appendChild(inp);
      requestAnimationFrame(()=>{inp.focus();inp.select();});
      const commit=()=>{
        const v=inp.value.trim();
        if(v&&v!==n.name){
          n.name=v;
          const tspans=[...t1.querySelectorAll("tspan")];
          if(tspans.length){tspans[0].textContent=v;for(let i=1;i<tspans.length;i++)tspans[i].textContent="";}
          else t1.textContent=v;
          buildWatermark(company,year,scope,`${cur} ${unit}`);
        }
        inp.remove();
      };
      inp.addEventListener("blur",commit);
      inp.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();commit();}if(ev.key==="Escape")inp.remove();});
    };

    rect.addEventListener("mousedown",e=>{
      if(dblclickPending)return;
      e.preventDefault();
      tip.classList.remove("on");
      dragging={node:n,startMouseY:e.clientY,startY0:n.y0,startY1:n.y1};
      rect.style.cursor="grabbing";
      document.body.style.userSelect="none";
    });
    rect.addEventListener("dblclick",e=>{e.preventDefault();e.stopPropagation();startRename(e.clientX,e.clientY);});

    const startDragFromLabel=e=>{
      if(dblclickPending)return;
      e.preventDefault();e.stopPropagation();
      tip.classList.remove("on");
      dragging={node:n,startMouseY:e.clientY,startY0:n.y0,startY1:n.y1};
      rect.style.cursor="grabbing";t1.style.cursor="grabbing";t2.style.cursor="grabbing";
      document.body.style.userSelect="none";
    };
    const endLabelCursor=()=>{t1.style.cursor="grab";t2.style.cursor="grab";if(t3)t3.style.cursor="grab";};
    t1.addEventListener("mousedown",startDragFromLabel);
    t2.addEventListener("mousedown",startDragFromLabel);
    t1.addEventListener("mouseup",endLabelCursor);
    t2.addEventListener("mouseup",endLabelCursor);
    t1.addEventListener("dblclick",e=>{e.preventDefault();e.stopPropagation();startRename(e.clientX,e.clientY);});
    t2.addEventListener("dblclick",e=>{e.preventDefault();e.stopPropagation();startRename(e.clientX,e.clientY);});
    // tooltip on labels
    const showTipL=e=>{if(dragging)return;const conn=new Set([...n.sourceLinks,...n.targetLinks].map(l=>l.index));currentLinkPaths.forEach((p,i)=>p.setAttribute("fill-opacity",conn.has(i)?"0.85":"0.15"));let html=`<strong style="color:#1a1a2e">${n.name}</strong><br><span style="color:var(--accent);font-weight:600">${fmtVal(n.value)}</span>`;if(nodeYoY.has(n.id)){const p2=nodeYoY.get(n.id);const c2=p2>=0?"#22c55e":"#ef4444";html+=` <span style="color:${c2};font-weight:600">${p2>=0?"▲":"▼"}${Math.abs(p2).toFixed(1)}% YoY</span>`;}tip.innerHTML=html;tip.classList.add("on");tip.style.left=(e.clientX+14)+"px";tip.style.top=(e.clientY-42)+"px";};
    const moveTipL=e=>{if(!dragging){tip.style.left=(e.clientX+14)+"px";tip.style.top=(e.clientY-42)+"px";}};
    const hideTipL=()=>{if(dragging)return;currentLinkPaths.forEach(p=>p.setAttribute("fill-opacity","0.5"));tip.classList.remove("on");};
    [t1,t2].forEach(el=>{el.addEventListener("mouseenter",showTipL);el.addEventListener("mousemove",moveTipL);el.addEventListener("mouseleave",hideTipL);});
    // t3 (above-bar label) — same drag + tooltip behaviour
    if(t3){
      t3.setAttribute("pointer-events","all");t3.style.cursor="grab";
      t3.addEventListener("mousedown",startDragFromLabel);
      t3.addEventListener("mouseup",endLabelCursor);
      t3.addEventListener("mouseenter",showTipL);
      t3.addEventListener("mousemove",moveTipL);
      t3.addEventListener("mouseleave",hideTipL);
    }

    // Inside-bar text labels — same drag + tooltip behaviour
    if(t3._line1){
      t3._line1.addEventListener("mousedown",startDragFromLabel);
      t3._line1.addEventListener("mouseup",endLabelCursor);
      t3._line1.addEventListener("mouseenter",showTipL);
      t3._line1.addEventListener("mousemove",moveTipL);
      t3._line1.addEventListener("mouseleave",hideTipL);
    }
    if(t3._line2){
      t3._line2.addEventListener("mousedown",startDragFromLabel);
      t3._line2.addEventListener("mouseup",endLabelCursor);
      t3._line2.addEventListener("mouseenter",showTipL);
      t3._line2.addEventListener("mousemove",moveTipL);
      t3._line2.addEventListener("mouseleave",hideTipL);
    }
    if(t3._line3){
      t3._line3.addEventListener("mousedown",startDragFromLabel);
      t3._line3.addEventListener("mouseup",endLabelCursor);
      t3._line3.addEventListener("mouseenter",showTipL);
      t3._line3.addEventListener("mousemove",moveTipL);
      t3._line3.addEventListener("mouseleave",hideTipL);
    }

    nodeGroup.appendChild(rect);
    nodeGroup.appendChild(t1);
    nodeGroup.appendChild(t2);
    if(t3) nodeGroup.appendChild(t3);
  }); // end nodes.forEach

  // cards
  const cardData=buildCards(nodes,links,meta);
  document.getElementById("cards").innerHTML=cardData.map(c=>`
    <div class="card" style="--card-accent:${c.color}">
      <div class="card-lbl">${c.lbl}</div>
      <div class="card-main">
        <div class="card-val">${c.val}</div>
        ${c.change?`<div class="card-change ${c.change.cls}">${c.change.label}</div>`:""}
      </div>
      ${c.prev!=null?`<div class="card-prev">prev: <span>${c.prev}</span></div>`:""}
      ${c.dsc?`<div class="card-dsc">${c.dsc}</div>`:""}
    </div>`).join("");

  document.getElementById("exportDd").style.display="flex";
  document.getElementById("paletteWrap").style.display="flex";
  document.getElementById("btnShareChart").style.display="";
  saveHistory(company,year,scope,currentRawData||raw);

  // center SVG horizontally in the wrap container if it overflows
  requestAnimationFrame(()=>{
    const wrap=document.getElementById("wrap");
    if(wrap&&wrap.scrollWidth>wrap.clientWidth){
      wrap.scrollLeft=(wrap.scrollWidth-wrap.clientWidth)/2;
    }
    // update mini map after chart is rendered
    updateMiniMap();
  });

  // listen for scroll events to update mini map viewport
  const wrap=document.getElementById("wrap");
  wrap.addEventListener("scroll",updateMiniMapViewport);
  window.addEventListener("resize",()=>{updateMiniMap();updateMiniMapViewport();});

  // mini map click/drag to scroll
  const miniMap=document.getElementById("miniMap");
  let isDraggingMiniMap=false;
  miniMap.addEventListener("mousedown",e=>{
    isDraggingMiniMap=true;
    scrollToMiniMapPosition(e);
    e.preventDefault();
  });
  document.addEventListener("mousemove",e=>{
    if(isDraggingMiniMap){
      scrollToMiniMapPosition(e);
    }
  });
  document.addEventListener("mouseup",()=>{
    isDraggingMiniMap=false;
  });

  // restore node positions from shared URL if present
  if(window._pendingNodePos&&window._pendingNodePos.length>0){
    // Check if new format (with node names) or old format (array of numbers)
    const hasNames=window._pendingNodePos[0]&&typeof window._pendingNodePos[0]==='object'&&'n'in window._pendingNodePos[0];

    if(hasNames){
      // New format: match by node name, restore both y0 and y1
      nodes.forEach(n=>{
        const saved=window._pendingNodePos.find(sp=>sp.n===n.name);
        if(saved){
          n.y0=saved.y0;
          n.y1=saved.y1;
        }
      });
    }else{
      // Old format: array of y0 values, match by index
      nodes.forEach((n,i)=>{
        if(i<window._pendingNodePos.length){
          const y0=window._pendingNodePos[i];
          const h=n.y1-n.y0;
          n.y0=y0;n.y1=y0+h;
        }
      });
    }
    window.redrawAll();
    window._pendingNodePos=null;
  }

  // on mobile close the panel after generating so chart is visible
  if(window.innerWidth<=700){
    const p=document.getElementById("panel");
    const overlay=document.getElementById("panelOverlay");
    p.classList.remove("mobile-open");
    p.classList.add("collapsed");
    if(overlay) overlay.classList.remove("on");
  }
}

// ─── EXPORT PNG ───────────────────────────────────────────────────────────────
function exportChart(chartOnly=false){
  const svgEl=document.getElementById("svg");
  const company=currentCompany,year=currentYear,scope=currentScope;
  const cur=getCurrencySymbol(),unit=getUnit();
  const suffix=chartOnly?"-chart":"";
  const filename=`${company}${year?" - "+year:""}${suffix}`.replace(/[^a-z0-9 _-]/gi,"_")+".png";
  const totalVal=document.getElementById("chartTotal").textContent;
  const svgW=parseInt(svgEl.getAttribute("width")),svgH=parseInt(svgEl.getAttribute("height"));
  const TARGET_W=Math.max(svgW,1800);
  const exportScale=TARGET_W/svgW;
  const PAD=28,HDR_H=80,FOOTER_H=28;

  // cards section (skipped when chartOnly)
  const cardEls=document.querySelectorAll("#cards .card");
  const cards=chartOnly?[]:([...cardEls].map(c=>({
    lbl:c.querySelector(".card-lbl")?.textContent||"",
    val:c.querySelector(".card-val")?.textContent||"",
    color:getComputedStyle(c).getPropertyValue("--card-accent").trim()||"#333",
    dsc:c.querySelector(".card-dsc")?.textContent||""
  })));
  const CARD_H=72,CARD_GAP=8;
  const CARDS_PER_ROW=Math.max(Math.min(cards.length,4),1);
  const CARD_ROWS=cards.length?Math.ceil(cards.length/CARDS_PER_ROW):0;
  const CARD_W=(svgW-PAD*2-CARD_GAP*(CARDS_PER_ROW-1))/CARDS_PER_ROW;
  const CARDS_SECTION_H=CARD_ROWS*(CARD_H+CARD_GAP);
  const CARDS_Y=HDR_H+svgH+10;
  const TOTAL_H=HDR_H+svgH+(chartOnly?0:10+CARDS_SECTION_H)+FOOTER_H;

  const canvas=document.createElement("canvas");
  canvas.width=svgW*exportScale;canvas.height=TOTAL_H*exportScale;
  const ctx=canvas.getContext("2d");ctx.scale(exportScale,exportScale);
  ctx.fillStyle="#f0f2f5";ctx.fillRect(0,0,svgW,TOTAL_H);
  ctx.fillStyle="#fff";ctx.fillRect(0,0,svgW,HDR_H);
  ctx.fillStyle="#e0e0e0";ctx.fillRect(0,HDR_H-1,svgW,1);
  ctx.textBaseline="middle";
  ctx.fillStyle="#1a1a2e";ctx.font="bold 22px 'Segoe UI',sans-serif";
  const cl=company+(year?" — ":"");ctx.fillText(cl,PAD,26);
  if(year){const cw=ctx.measureText(cl).width;ctx.fillStyle=activeTheme.accent;ctx.fillText(year,PAD+cw,26);}
  ctx.fillStyle="#888";ctx.font="11px 'Segoe UI',sans-serif";
  ctx.fillText([scope,`${cur} ${unit}`].filter(Boolean).join(" · ").toUpperCase(),PAD,50);
  ctx.textAlign="right";
  ctx.fillStyle=activeTheme.accent;ctx.font="bold 19px 'Segoe UI',sans-serif";ctx.fillText(totalVal,svgW-PAD,26);
  ctx.fillStyle="#999";ctx.font="10px 'Segoe UI',sans-serif";ctx.fillText("TOTAL INFLOW",svgW-PAD,50);
  if(scope){
    const bt=scope.toUpperCase();
    ctx.font="bold 9px 'Segoe UI',sans-serif";
    const bw=ctx.measureText(bt).width+16;
    const bx=svgW-PAD-bw, by=54, bh=16;
    ctx.fillStyle=activeTheme.accent;
    roundRect(ctx,bx,by,bw,bh,4);ctx.fill();
    ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(bt, bx+bw/2, by+bh/2);
    ctx.textAlign="left";ctx.textBaseline="middle";
  }
  ctx.textAlign="left";
  const svgClone=svgEl.cloneNode(true);
  const bg=document.createElementNS("http://www.w3.org/2000/svg","rect");
  bg.setAttribute("width",svgW);bg.setAttribute("height",svgH);bg.setAttribute("fill","#ffffff");
  svgClone.insertBefore(bg,svgClone.firstChild);
  const svgStr=new XMLSerializer().serializeToString(svgClone);
  const svgBlob=new Blob([svgStr],{type:"image/svg+xml;charset=utf-8"});
  const svgUrl=URL.createObjectURL(svgBlob);
  const img=new Image();
  img.onload=()=>{
    ctx.drawImage(img,0,HDR_H,svgW,svgH);URL.revokeObjectURL(svgUrl);
    if(!chartOnly){
      cards.forEach((c,i)=>{
        const col=i%CARDS_PER_ROW;
        const row=Math.floor(i/CARDS_PER_ROW);
        const cx=PAD+col*(CARD_W+CARD_GAP);
        const cy=CARDS_Y+row*(CARD_H+CARD_GAP);
        ctx.fillStyle="#fff";roundRect(ctx,cx,cy,CARD_W,CARD_H,5);ctx.fill();
        ctx.strokeStyle="#ebebeb";ctx.lineWidth=1;roundRect(ctx,cx,cy,CARD_W,CARD_H,5);ctx.stroke();
        ctx.fillStyle=c.color||"#e0e0e0";roundRect(ctx,cx,cy,3,CARD_H,5);ctx.fill();
        ctx.fillStyle="#1a1a2e";ctx.font="bold 9.5px 'Segoe UI',sans-serif";
        ctx.fillText((c.lbl||"").toUpperCase(),cx+11,cy+14);
        ctx.fillStyle=c.color||"#1a1a2e";ctx.font="bold 15px 'Segoe UI',sans-serif";
        ctx.fillText(c.val||"",cx+11,cy+32);
        const prevEl=document.querySelector(`#cards .card:nth-child(${i+1}) .card-prev`);
        const prevTxt=prevEl?.textContent||"";
        if(prevTxt){ctx.fillStyle="#aaa";ctx.font="9px 'Segoe UI',sans-serif";ctx.fillText(prevTxt,cx+11,cy+46);}
        ctx.fillStyle="#bbb";ctx.font="9px 'Segoe UI',sans-serif";
        ctx.fillText((c.dsc||"").slice(0,38)+(c.dsc&&c.dsc.length>38?"…":""),cx+11,cy+60);
      });
    }
    // footer watermark
    const wmY=chartOnly?HDR_H+svgH+18:CARDS_Y+CARD_ROWS*(CARD_H+CARD_GAP)+14;
    ctx.fillStyle="#999";ctx.font="12px 'Segoe UI',sans-serif";ctx.textAlign="right";
    ctx.fillText([company,year,scope,`${cur} ${unit}`].filter(Boolean).join(" · "),svgW-PAD,wmY);
    ctx.textAlign="left";
    const a=document.createElement("a");a.download=filename;a.href=canvas.toDataURL("image/png");a.click();
    const btn=document.querySelector("#exportDd .tbtn"),orig=btn.textContent;
    btn.textContent="✓ Saved!";btn.style.borderColor="#2d9e6b";btn.style.color="#2d9e6b";
    setTimeout(()=>{btn.textContent=orig;btn.style.borderColor="";btn.style.color="";},2000);
  };
  img.onerror=()=>{alert("PNG export failed — try Chrome or Edge.");URL.revokeObjectURL(svgUrl);};
  img.src=svgUrl;
}

// ─── EXPORT PDF ───────────────────────────────────────────────────────────────
async function exportPDF(){
  if(typeof window.jspdf==="undefined"){alert("PDF library not loaded. Check your internet connection.");return;}
  const{jsPDF}=window.jspdf;
  const svgEl=document.getElementById("svg");
  const company=currentCompany,year=currentYear,scope=currentScope;
  const cur=getCurrencySymbol(),unit=getUnit();
  const svgW=parseInt(svgEl.getAttribute("width")),svgH=parseInt(svgEl.getAttribute("height"));
  const filename=`${company}${year?" - "+year:""}`.replace(/[^a-z0-9 _-]/gi,"_")+".pdf";

  // render SVG to canvas first
  const SCALE=1.5;
  const svgClone=svgEl.cloneNode(true);
  const bg=document.createElementNS("http://www.w3.org/2000/svg","rect");
  bg.setAttribute("width",svgW);bg.setAttribute("height",svgH);bg.setAttribute("fill","#ffffff");
  svgClone.insertBefore(bg,svgClone.firstChild);
  const svgStr=new XMLSerializer().serializeToString(svgClone);
  const svgBlob=new Blob([svgStr],{type:"image/svg+xml;charset=utf-8"});
  const svgUrl=URL.createObjectURL(svgBlob);

  const img=await new Promise((res,rej)=>{
    const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=svgUrl;
  });
  URL.revokeObjectURL(svgUrl);

  const canvas=document.createElement("canvas");
  canvas.width=svgW*SCALE;canvas.height=svgH*SCALE;
  const ctx=canvas.getContext("2d");ctx.scale(SCALE,SCALE);
  ctx.fillStyle="#fff";ctx.fillRect(0,0,svgW,svgH);ctx.drawImage(img,0,0,svgW,svgH);
  const chartImg=canvas.toDataURL("image/png");

  // PDF — landscape A4
  const doc=new jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
  const pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight();

  // ── Page 1: Chart ────────────────────────────────────────────────────────────
  // header bar
  doc.setFillColor(255,255,255);doc.rect(0,0,pw,22,"F");
  doc.setFillColor(240,242,245);doc.rect(0,22,pw,ph-22,"F");

  // title
  doc.setFont("helvetica","bold");doc.setFontSize(16);doc.setTextColor(26,26,46);
  doc.text(company,14,10);
  if(year){
    const cw=doc.getTextWidth(company+" — ");
    doc.setTextColor(184,134,11);doc.text("— "+year,14+doc.getTextWidth(company+" "),10);
  }
  doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(150,150,150);
  doc.text([scope,`${cur} ${unit}`].filter(Boolean).join(" · ").toUpperCase(),14,16);

  // total inflow right
  const totalVal=document.getElementById("chartTotal").textContent;
  doc.setFont("helvetica","bold");doc.setFontSize(13);doc.setTextColor(184,134,11);
  doc.text(totalVal,pw-14,10,{align:"right"});
  doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(150,150,150);
  doc.text("TOTAL INFLOW",pw-14,16,{align:"right"});

  // divider
  doc.setDrawColor(224,224,224);doc.line(0,22,pw,22);

  // chart image — fit leaving room for stats at bottom
  const cardEls2=document.querySelectorAll("#cards .card");
  const pdfCards=[...cardEls2].map(c=>({
    lbl:c.querySelector(".card-lbl")?.textContent||"",
    val:c.querySelector(".card-val")?.textContent||"",
    color:getComputedStyle(c).getPropertyValue("--card-accent").trim()||"#888",
    prev:c.querySelector(".card-prev")?.textContent||"",
    dsc:c.querySelector(".card-dsc")?.textContent||""
  }));
  const STATS_H=22;
  const STAT_ROWS=Math.ceil(pdfCards.length/4);
  const maxW=pw-10, maxH=ph-32-STAT_ROWS*STATS_H-6;
  const ratio=Math.min(maxW/svgW,maxH/svgH);
  const iW=svgW*ratio,iH=svgH*ratio;
  const ix=(pw-iW)/2,iy=24;
  doc.addImage(chartImg,"PNG",ix,iy,iW,iH);

  // ── Stats cards on page 1 ────────────────────────────────────────────────────
  const statsY=iy+iH+4;
  const statW=(pw-28)/Math.min(pdfCards.length,4);
  pdfCards.forEach((c,i)=>{
    const col=i%4, row=Math.floor(i/4);
    const sx=14+col*statW, sy=statsY+row*(STATS_H+2);
    // bg
    doc.setFillColor(255,255,255);doc.roundedRect(sx,sy,statW-2,STATS_H-2,1,1,"F");
    doc.setDrawColor(235,235,235);doc.roundedRect(sx,sy,statW-2,STATS_H-2,1,1,"S");
    // accent bar
    const rgb=hexToRgb(c.color)||[88,88,88];
    doc.setFillColor(...rgb);doc.rect(sx,sy,1.5,STATS_H-2,"F");
    // label
    doc.setFont("helvetica","bold");doc.setFontSize(6.5);doc.setTextColor(...rgb);
    doc.text(c.lbl.toUpperCase(),sx+4,sy+4.5);
    // value
    doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(...rgb);
    doc.text((c.val||"").replace(/▲/g,"+").replace(/▼/g,"-"),sx+4,sy+11);
    // prev
    if(c.prev){doc.setFont("helvetica","normal");doc.setFontSize(6);doc.setTextColor(160,160,160);doc.text(c.prev.replace(/▲/g,"+").replace(/▼/g,"-"),sx+4,sy+16);}
    // dsc
    doc.setFont("helvetica","normal");doc.setFontSize(6);doc.setTextColor(190,190,190);
    doc.text((c.dsc||"").slice(0,32),sx+4,sy+20);
  });

  // watermark
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(120,120,120);
  doc.text([company,year,scope,`${cur} ${unit}`].filter(Boolean).join(" · "),pw-14,ph-4,{align:"right"});

  // ── Page 2: Flow Data Table ───────────────────────────────────────────────────
  doc.addPage();
  doc.setFillColor(255,255,255);doc.rect(0,0,pw,ph,"F");

  doc.setFont("helvetica","bold");doc.setFontSize(13);doc.setTextColor(26,26,46);
  doc.text(`${company} — Flow Data`,14,12);
  doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(150,150,150);
  doc.text([year,scope,`${cur} ${unit}`].filter(Boolean).join(" · "),14,18);
  doc.setDrawColor(224,224,224);doc.line(14,21,pw-14,21);

  // table headers
  const hasYoY=currentHasYoY;
  const cols=hasYoY
    ?[{h:"Source",w:55},{h:"Target",w:55},{h:`${year||"Current"}`,w:35},{h:"Prior Year",w:35},{h:"Change",w:25}]
    :[{h:"Source",w:65},{h:"Target",w:65},{h:`${year||"Value"} (${cur} ${unit})`,w:50}];
  let tx=14,ty=27;
  doc.setFillColor(248,249,250);doc.rect(14,ty-4,pw-28,8,"F");
  doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(100,100,100);
  cols.forEach(c=>{doc.text(c.h,tx,ty);tx+=c.w;});

  ty+=6;doc.setFont("helvetica","normal");doc.setFontSize(8);
  currentLinks.forEach((l,i)=>{
    if(ty>ph-14){doc.addPage();ty=20;doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(100,100,100);tx=14;cols.forEach(c=>{doc.text(c.h,tx,ty);tx+=c.w;});ty+=6;doc.setFont("helvetica","normal");}
    if(i%2===0){doc.setFillColor(248,249,250);doc.rect(14,ty-4,pw-28,6,"F");}
    doc.setTextColor(26,26,46);tx=14;
    doc.text(l.source.name,tx,ty);tx+=cols[0].w;
    doc.text(l.target.name,tx,ty);tx+=cols[1].w;
    doc.text(fmtVal(l.v),tx,ty);tx+=cols[2].w;
    if(hasYoY){
      doc.text(l.prior!=null?fmtVal(l.prior):"—",tx,ty);tx+=cols[3].w;
      if(l.prior!=null&&l.prior>0){
        const pct=(l.v-l.prior)/l.prior*100;
        doc.setTextColor(pct>=0?22:220,pct>=0?197:38,pct>=0?90:38);
        doc.text((pct>=0?"+":"-")+Math.abs(pct).toFixed(1)+"%",tx,ty);
        doc.setTextColor(26,26,46);
      }else{doc.text("—",tx,ty);}
    }
    ty+=6;
  });

  doc.save(filename);
  const btn=document.querySelector("#exportDd .tbtn"),orig=btn.textContent;
  btn.textContent="✓ PDF Saved!";btn.style.borderColor="#2d9e6b";btn.style.color="#2d9e6b";
  setTimeout(()=>{btn.textContent=orig;btn.style.borderColor="";btn.style.color="";},2500);
}

// ─── EXPORT ALL CHARTS AS SINGLE PDF ───────────────────────────────────────────
async function exportAllChartsPDF(){
  if(typeof window.jspdf==="undefined"){alert("PDF library not loaded. Check your internet connection.");return;}
  if(chartsData.length<=1){alert("Use 'Export as PDF' for single charts.");return;}

  const{jsPDF}=window.jspdf;
  const cur=getCurrencySymbol(),unit=getUnit();
  const filename=`All_Charts_${currentCompany||"sankey"}`.replace(/[^a-z0-9 _-]/gi,"_")+".pdf";

  // PDF — landscape A4
  const doc=new jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
  const pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight();

  // Store current chart state
  const originalActiveIndex=activeChartIndex;
  const originalData=document.getElementById("inData").value;

  // Process each chart
  for(let chartIdx=0;chartIdx<chartsData.length;chartIdx++){
    const chart=chartsData[chartIdx];

    // Switch to this chart and generate
    activeChartIndex=chartIdx;
    document.getElementById("inData").value=chart.data;
    await new Promise(resolve=>{
      // Wait for generation to complete
      const originalGenerate=generate;
      generate();
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(()=>requestAnimationFrame(resolve));
    });

    const svgEl=document.getElementById("svg");
    const svgW=parseInt(svgEl.getAttribute("width")),svgH=parseInt(svgEl.getAttribute("height"));

    // Render SVG to canvas
    const SCALE=1.5;
    const svgClone=svgEl.cloneNode(true);
    const bg=document.createElementNS("http://www.w3.org/2000/svg","rect");
    bg.setAttribute("width",svgW);bg.setAttribute("height",svgH);bg.setAttribute("fill","#ffffff");
    svgClone.insertBefore(bg,svgClone.firstChild);
    const svgStr=new XMLSerializer().serializeToString(svgClone);
    const svgBlob=new Blob([svgStr],{type:"image/svg+xml;charset=utf-8"});
    const svgUrl=URL.createObjectURL(svgBlob);

    const img=await new Promise((res,rej)=>{
      const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=svgUrl;
    });
    URL.revokeObjectURL(svgUrl);

    const canvas=document.createElement("canvas");
    canvas.width=svgW*SCALE;canvas.height=svgH*SCALE;
    const ctx=canvas.getContext("2d");ctx.scale(SCALE,SCALE);
    ctx.fillStyle="#fff";ctx.fillRect(0,0,svgW,svgH);ctx.drawImage(img,0,0,svgW,svgH);
    const chartImg=canvas.toDataURL("image/png");

    // Add new page for this chart (except first chart uses initial page)
    if(chartIdx>0) doc.addPage();

    // Get chart metadata from data
    const parsed=parseData(chart.data);
    const meta=parsed.meta||{};

    // ── Header bar ────────────────────────────────────────────────────────────
    doc.setFillColor(255,255,255);doc.rect(0,0,pw,22,"F");
    doc.setFillColor(240,242,245);doc.rect(0,22,pw,ph-22,"F");

    // title
    doc.setFont("helvetica","bold");doc.setFontSize(16);doc.setTextColor(26,26,46);
    doc.text(`${chart.name}`,14,10);
    if(meta.COMPANY){
      const cw=doc.getTextWidth(chart.name+" — ");
      doc.setTextColor(184,134,11);doc.text("— "+meta.COMPANY,14+doc.getTextWidth(chart.name+" "),10);
    }
    doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(150,150,150);
    const yearText=[meta.PERIOD,meta.SCOPE,`${cur} ${unit}`].filter(Boolean).join(" · ");
    if(yearText) doc.text(yearText.toUpperCase(),14,16);

    // total inflow right
    const totalVal=currentNodes?currentNodes.reduce((sum,n)=>sum+Math.max(...n.sourceLinks.map(l=>l.v)),0):0;
    doc.setFont("helvetica","bold");doc.setFontSize(13);doc.setTextColor(184,134,11);
    doc.text(fmtVal(totalVal),pw-14,10,{align:"right"});
    doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(150,150,150);
    doc.text("TOTAL INFLOW",pw-14,16,{align:"right"});

    // divider
    doc.setDrawColor(224,224,224);doc.line(0,22,pw,22);

    // ── Chart image ─────────────────────────────────────────────────────────────
    const cardEls=document.querySelectorAll("#cards .card");
    const pdfCards=[...cardEls].map(c=>({
      lbl:c.querySelector(".card-lbl")?.textContent||"",
      val:c.querySelector(".card-val")?.textContent||"",
      color:getComputedStyle(c).getPropertyValue("--card-accent").trim()||"#888",
      prev:c.querySelector(".card-prev")?.textContent||"",
      dsc:c.querySelector(".card-dsc")?.textContent||""
    }));
    const STATS_H=22;
    const STAT_ROWS=Math.ceil(pdfCards.length/4);
    const maxW=pw-10, maxH=ph-32-STAT_ROWS*STATS_H-6;
    const ratio=Math.min(maxW/svgW,maxH/svgH);
    const iW=svgW*ratio,iH=svgH*ratio;
    const ix=(pw-iW)/2,iy=24;
    doc.addImage(chartImg,"PNG",ix,iy,iW,iH);

    // ── Stats cards ─────────────────────────────────────────────────────────────
    const statsY=iy+iH+4;
    const statW=(pw-28)/Math.min(pdfCards.length,4);
    pdfCards.forEach((c,i)=>{
      const col=i%4, row=Math.floor(i/4);
      const sx=14+col*statW, sy=statsY+row*(STATS_H+2);
      doc.setFillColor(255,255,255);doc.roundedRect(sx,sy,statW-2,STATS_H-2,1,1,"F");
      doc.setDrawColor(235,235,235);doc.roundedRect(sx,sy,statW-2,STATS_H-2,1,1,"S");
      const rgb=hexToRgb(c.color)||[88,88,88];
      doc.setFillColor(...rgb);doc.rect(sx,sy,1.5,STATS_H-2,"F");
      doc.setFont("helvetica","bold");doc.setFontSize(6.5);doc.setTextColor(...rgb);
      doc.text(c.lbl.toUpperCase(),sx+4,sy+4.5);
      doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(...rgb);
      doc.text((c.val||"").replace(/▲/g,"+").replace(/▼/g,"-"),sx+4,sy+11);
      if(c.prev){doc.setFont("helvetica","normal");doc.setFontSize(6);doc.setTextColor(160,160,160);doc.text(c.prev.replace(/▲/g,"+").replace(/▼/g,"-"),sx+4,sy+16);}
      doc.setFont("helvetica","normal");doc.setFontSize(6);doc.setTextColor(190,190,190);
      doc.text((c.dsc||"").slice(0,32),sx+4,sy+20);
    });

    // watermark
    doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(120,120,120);
    const wmText=[meta.COMPANY,meta.PERIOD,meta.SCOPE,`${cur} ${unit}`].filter(Boolean).join(" · ");
    doc.text(wmText,pw-14,ph-4,{align:"right"});

    // ── Page 2: Flow Data Table ─────────────────────────────────────────────────
    doc.addPage();
    doc.setFillColor(255,255,255);doc.rect(0,0,pw,ph,"F");

    doc.setFont("helvetica","bold");doc.setFontSize(13);doc.setTextColor(26,26,46);
    doc.text(`${chart.name} — Flow Data`,14,12);
    doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(150,150,150);
    doc.text([meta.COMPANY,meta.PERIOD,meta.SCOPE,`${cur} ${unit}`].filter(Boolean).join(" · "),14,18);
    doc.setDrawColor(224,224,224);doc.line(14,21,pw-14,21);

    // table headers
    const hasYoY=parsed.hasYoY;
    const cols=hasYoY
      ?[{h:"Source",w:55},{h:"Target",w:55},{h:`${meta.PERIOD||"Current"}`,w:35},{h:"Prior Year",w:35},{h:"Change",w:25}]
      :[{h:"Source",w:65},{h:"Target",w:65},{h:`Value (${cur} ${unit})`,w:50}];
    let tx=14,ty=27;
    doc.setFillColor(248,249,250);doc.rect(14,ty-4,pw-28,8,"F");
    doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(100,100,100);
    cols.forEach(c=>{doc.text(c.h,tx,ty);tx+=c.w;});

    ty+=6;doc.setFont("helvetica","normal");doc.setFontSize(8);
    parsed.links.forEach((l,i)=>{
      if(ty>ph-14){doc.addPage();ty=20;doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(100,100,100);tx=14;cols.forEach(c=>{doc.text(c.h,tx,ty);tx+=c.w;});ty+=6;doc.setFont("helvetica","normal");}
      if(i%2===0){doc.setFillColor(248,249,250);doc.rect(14,ty-4,pw-28,6,"F");}
      doc.setTextColor(26,26,46);tx=14;
      const srcName=parsed.nodeNames[l.s]||`Source ${l.s}`;
      const tgtName=parsed.nodeNames[l.t]||`Target ${l.t}`;
      doc.text(srcName,tx,ty);tx+=cols[0].w;
      doc.text(tgtName,tx,ty);tx+=cols[1].w;
      doc.text(fmtVal(l.v),tx,ty);tx+=cols[2].w;
      if(hasYoY){
        doc.text(l.prior!=null?fmtVal(l.prior):"—",tx,ty);tx+=cols[3].w;
        if(l.prior!=null&&l.prior>0){
          const pct=(l.v-l.prior)/l.prior*100;
          doc.setTextColor(pct>=0?22:220,pct>=0?197:38,pct>=0?90:38);
          doc.text((pct>=0?"+":"-")+Math.abs(pct).toFixed(1)+"%",tx,ty);
          doc.setTextColor(26,26,46);
        }else{doc.text("—",tx,ty);}
      }
      ty+=6;
    });
  }

  // Restore original chart state
  activeChartIndex=originalActiveIndex;
  document.getElementById("inData").value=originalData;
  generate();

  doc.save(filename);
  const btn=document.querySelector("#exportDd .tbtn"),orig=btn.textContent;
  btn.textContent="✓ All Charts Saved!";btn.style.borderColor="#2d9e6b";btn.style.color="#2d9e6b";
  setTimeout(()=>{btn.textContent=orig;btn.style.borderColor="";btn.style.color="";},2500);
}


// ─── ORIENTATION HANDLING ─────────────────────────────────────────────────────
// ─── NODE CONTEXT MENU ────────────────────────────────────────────────────────
let _ctxNode=null;
const ctxMenu=document.getElementById("nodeCtxMenu");

function showCtxMenu(e, node, renameFn, resetFn, redrawFn){
  e.preventDefault();e.stopPropagation();
  _ctxNode=node;
  const x=Math.min(e.clientX, window.innerWidth-160);
  const y=Math.min(e.clientY, window.innerHeight-150);
  ctxMenu.style.left=x+"px";ctxMenu.style.top=y+"px";
  ctxMenu.classList.add("on");

  document.getElementById("ctxRename").onclick=()=>{
    hideCtxMenu();
    const v=window.prompt("Rename node:",node.name);
    if(v&&v.trim()&&v.trim()!==node.name) renameFn(v.trim());
  };
  // +/- resize buttons — keep menu open, click repeatedly
  const STEP=20; // px per click
  const doResize=delta=>{
    // Get current chart height from input
    const chartH=parseInt(document.getElementById("inHeight").value)||600;
    // Account for margins (top: 32, bottom: 52)
    const maxBarY=chartH-52; // bottom margin
    const minBarY=32; // top margin

    const currentH=node.y1-node.y0;
    let newH=Math.max(6,currentH+delta);

    // Check if expanding would go beyond chart boundaries
    if(node.y0+newH > maxBarY){
      newH=maxBarY-node.y0;
    }
    // Check minimum height constraint
    if(newH < 6){
      newH=6;
    }

    node.y1=node.y0+newH;
    node.ky=node.value>0?newH/node.value:node.ky;
    redrawFn();
  };
  document.getElementById("ctxGrow").onclick=e=>{e.stopPropagation();doResize(STEP);};
  document.getElementById("ctxShrink").onclick=e=>{e.stopPropagation();doResize(-STEP);};
  document.getElementById("ctxHighlight").onclick=()=>{
    hideCtxMenu();
    if(window.currentLinkPaths&&window.currentLinks){
      const conn=new Set([...node.sourceLinks,...node.targetLinks].map(l=>l.index));
      currentLinkPaths.forEach((p,i)=>p.setAttribute("fill-opacity",conn.has(i)?"0.9":"0.08"));
    }
  };
  document.getElementById("ctxReset").onclick=()=>{
    hideCtxMenu();
    if(resetFn) resetFn();
  };
}
function hideCtxMenu(){ctxMenu.classList.remove("on");}
document.addEventListener("click",e=>{if(!e.target.closest("#nodeCtxMenu"))hideCtxMenu();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")hideCtxMenu();});
document.addEventListener("contextmenu",e=>{if(!e.target.closest("#nodeCtxMenu"))hideCtxMenu();});

// ─── KEYBOARD ─────────────────────────────────────────────────────────────────
document.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)) generate();
  if(e.key==="Escape") hideHelp();
});

// ─── HOW TO USE DIALOG ────────────────────────────────────────────────────────
function showHelp(){
  document.getElementById("helpOverlay").style.display="flex";
}
function hideHelp(){
  document.getElementById("helpOverlay").style.display="none";
}
document.getElementById("helpOverlay").addEventListener("click",e=>{
  if(e.target===document.getElementById("helpOverlay")) hideHelp();
});
