const SOLUTION_CODE = { "XtraSafe大胖紫": 1, "Quell ST风味大师": 2, "Quell ST+MinUp": 3 };
const SOLUTION_COLOR = { "XtraSafe大胖紫": "#B7A4F3", "Quell ST风味大师": "#00B0F0", "Quell ST+MinUp": "#FFFF00", "无数据": "#D9D9D9" };
const PROVINCE_FILE = {
  "北京":"beijing","天津":"tianjin","河北":"hebei","山西":"shanxi","内蒙古":"neimenggu","辽宁":"liaoning","吉林":"jilin","黑龙江":"heilongjiang","上海":"shanghai","江苏":"jiangsu","浙江":"zhejiang","安徽":"anhui","福建":"fujian","江西":"jiangxi","山东":"shandong","河南":"henan","湖北":"hubei","湖南":"hunan","广东":"guangdong","广西":"guangxi","海南":"hainan","重庆":"chongqing","四川":"sichuan","贵州":"guizhou","云南":"yunnan","西藏":"xizang","陕西":"shanxi1","甘肃":"gansu","青海":"qinghai","宁夏":"ningxia","新疆":"xinjiang","台湾":"taiwan","香港":"xianggang","澳门":"aomen"
};
const DIRECT_CITY = new Set(["北京","上海","天津","重庆"]);
let chart;
let currentRows = [];
let currentTableRows = [];
let state = { level: "country", name: "全国", province: null, city: null, stack: [] };
let loadedProvinceScripts = new Set();

function escapeHtml(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function norm(n){return String(n||"").replace("特别行政区","").replace("维吾尔自治区","").replace("壮族自治区","").replace("回族自治区","").replace("自治区","").replace("省","").replace("市","").replace("地区","").replace("盟","").trim()}
function fmt(v){return v===null||v===undefined||v===""?"-":Number(v).toFixed(1)}
function activeSolutions(){return Array.from(document.querySelectorAll(".solution-filter:checked")).map(i=>i.value)}
function dominant(counts){return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0]}
function setStatus(msg){document.getElementById("statusBar").textContent = msg}
function mapDisplayName(province){return norm(province)}
function getRowsForState(){
  if(state.level === "country") return currentRows;
  if(state.level === "province") return currentRows.filter(r => norm(r.province) === norm(state.province));
  if(state.level === "city") return currentRows.filter(r => norm(r.province) === norm(state.province) && norm(r.city) === norm(state.city));
  return currentRows;
}
function aggregate(rows, keyGetter){
  const active = activeSolutions();
  const map = {};
  rows.forEach(r => {
    if(!active.includes(r.primary)) return;
    const key = keyGetter(r);
    if(!key) return;
    if(!map[key]) map[key] = {name:key,total:0,counts:{"XtraSafe大胖紫":0,"Quell ST风味大师":0,"Quell ST+MinUp":0},rows:[]};
    map[key].total++;
    map[key].counts[r.primary]++;
    map[key].rows.push(r);
  });
  return Object.values(map).map(item => {
    const d = dominant(item.counts);
    return {name:item.name,value:SOLUTION_CODE[d],dominant:d,total:item.total,counts:item.counts,rows:item.rows,itemStyle:{areaColor:SOLUTION_COLOR[d]}};
  });
}
function loadScript(src){
  return new Promise((resolve,reject)=>{
    if(document.querySelector(`script[src="${src}"]`)){resolve();return;}
    const s=document.createElement("script");
    s.src=src;
    s.onload=resolve;
    s.onerror=()=>reject(new Error(`地图脚本加载失败：${src}`));
    document.head.appendChild(s);
  });
}
async function ensureProvinceMap(provinceName){
  const shortName = norm(provinceName);
  const file = PROVINCE_FILE[shortName];
  if(!file) throw new Error(`没有找到 ${provinceName} 的省级地图文件映射。`);
  if(loadedProvinceScripts.has(shortName)) return shortName;
  await loadScript(`https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/js/province/${file}.js`);
  loadedProvinceScripts.add(shortName);
  return shortName;
}
function mergeMapDataWithExistingGeo(mapName, aggregatedData){
  const existed = new Map(aggregatedData.map(d => [norm(d.name), d]));
  const geo = echarts.getMap(mapName);
  if(!geo || !geo.geoJSON || !geo.geoJSON.features) return aggregatedData;
  return geo.geoJSON.features.map(f => {
    const name = f.properties.name;
    const matched = existed.get(norm(name));
    if(matched) return {...matched, name};
    return {name,value:0,total:0,counts:{"XtraSafe大胖紫":0,"Quell ST风味大师":0,"Quell ST+MinUp":0},rows:[],itemStyle:{areaColor:SOLUTION_COLOR["无数据"]}};
  });
}
async function render(){
  if(state.level === "country") return renderCountry();
  if(state.level === "province") return renderProvince();
  if(state.level === "city") return renderDistrictBlocks();
}
function renderCountry(){
  setStatus("当前层级：省级。点击省份进入市级。此版本不再调用 geo.datav，避免 403。 ");
  const rows = getRowsForState();
  const data = aggregate(rows, r => mapDisplayName(r.province));
  const fullData = mergeMapDataWithExistingGeo("china", data);
  chart.setOption(getMapOption("china", fullData, "点击省份进入市级"), true);
  updatePanels(rows, "全国汇总");
  updateNav();
}
async function renderProvince(){
  const provinceMapName = await ensureProvinceMap(state.province);
  const rows = getRowsForState();
  const isDirect = DIRECT_CITY.has(norm(state.province));
  const data = aggregate(rows, r => isDirect ? r.district : r.city);
  const fullData = mergeMapDataWithExistingGeo(provinceMapName, data);
  chart.setOption(getMapOption(provinceMapName, fullData, isDirect ? "点击区县查看明细" : "点击城市进入区级色块"), true);
  setStatus(isDirect ? `当前层级：${state.name} 区级。点击区县查看明细。` : `当前层级：${state.name} 市级。点击城市进入区级色块。`);
  updatePanels(rows, state.name);
  updateNav();
}
function renderDistrictBlocks(){
  const rows = getRowsForState();
  const active = activeSolutions();
  const districts = aggregate(rows.filter(r => active.includes(r.primary)), r => r.district);
  chart.clear();
  const el = document.getElementById("chinaMap");
  el.innerHTML = `<div class="map-placeholder-title">${escapeHtml(state.name)} 区级方案色块</div><div class="map-placeholder-note">该层级展示区/县主推方案色块。点击色块可在右侧查看该区/县明细。</div><div class="block-grid" id="districtBlocks"></div>`;
  const box = document.getElementById("districtBlocks");
  districts.forEach(d => {
    const div = document.createElement("div");
    div.className = "block-card";
    div.style.background = SOLUTION_COLOR[d.dominant] || SOLUTION_COLOR["无数据"];
    div.innerHTML = `<div class="block-title">${escapeHtml(d.name)}</div><div class="block-meta">主推：${escapeHtml(d.dominant)}<br/>记录数：${d.total}<br/>XtraSafe：${d.counts["XtraSafe大胖紫"]}，ST：${d.counts["Quell ST风味大师"]}，MinUp：${d.counts["Quell ST+MinUp"]}</div>`;
    div.onclick = () => updatePanels(d.rows, d.name);
    box.appendChild(div);
  });
  setStatus(`当前层级：${state.name} 区级色块。点击色块查看明细。`);
  updatePanels(rows, state.name);
  updateNav();
}
function getMapOption(mapName, data, hint){
  return {
    backgroundColor:"#fff",
    tooltip:{trigger:"item",formatter:p=>{if(!p.data||!p.data.total)return `${escapeHtml(p.name)}<br/>暂无匹配数据`;return `<strong>${escapeHtml(p.name)}</strong><br/>主推最多：${escapeHtml(p.data.dominant)}<br/>区域记录数：${p.data.total}<br/>XtraSafe大胖紫：${p.data.counts["XtraSafe大胖紫"]}<br/>Quell ST风味大师：${p.data.counts["Quell ST风味大师"]}<br/>Quell ST+MinUp：${p.data.counts["Quell ST+MinUp"]}<br/><span style="color:#64748b">${hint}</span>`}},
    visualMap:{type:"piecewise",left:22,bottom:20,pieces:[{value:1,label:"XtraSafe大胖紫",color:SOLUTION_COLOR["XtraSafe大胖紫"]},{value:2,label:"Quell ST风味大师",color:SOLUTION_COLOR["Quell ST风味大师"]},{value:3,label:"Quell ST+MinUp",color:SOLUTION_COLOR["Quell ST+MinUp"]}],outOfRange:{color:SOLUTION_COLOR["无数据"]}},
    series:[{name:"主推方案",type:"map",map:mapName,roam:true,zoom:1.05,label:{show:true,fontSize:11,color:"#334155"},itemStyle:{borderColor:"#fff",borderWidth:1,areaColor:SOLUTION_COLOR["无数据"]},emphasis:{itemStyle:{areaColor:"#f97316"}},data}]
  };
}
function updatePanels(rows,title){
  const counts={"XtraSafe大胖紫":0,"Quell ST风味大师":0,"Quell ST+MinUp":0}; rows.forEach(r=>{if(counts[r.primary]!==undefined)counts[r.primary]++});
  document.getElementById("panelTitle").textContent=title;
  document.getElementById("levelName").textContent=state.level==="country"?"全国/省级":state.level==="province"?"省内/市级":"市内/区级";
  document.getElementById("totalCount").textContent=rows.length;
  document.getElementById("topSolution").textContent=rows.length?dominant(counts):"-";
  document.getElementById("colorDim").textContent=state.level==="country"?"省级":state.level==="province"?"市级":"区级";
  const box=document.getElementById("solutionSummary"); box.innerHTML="";
  Object.entries(counts).forEach(([s,n])=>{const d=document.createElement("div");d.className="summary-item";d.style.borderLeftColor=SOLUTION_COLOR[s];d.innerHTML=`<span>${escapeHtml(s)}</span><strong>${n}</strong>`;box.appendChild(d)});
  updateTable(rows);
}
function updateTable(rows){
  currentTableRows=rows; const tb=document.querySelector("#detailTable tbody"); tb.innerHTML="";
  rows.forEach(r=>{const tr=document.createElement("tr"); tr.innerHTML=`<td>${escapeHtml(r.province)}</td><td>${escapeHtml(r.city)}</td><td>${escapeHtml(r.district)}</td><td>${fmt(r.gh)}</td><td>${fmt(r.kh)}</td><td>${fmt(r.tds)}</td><td><span class="color-dot" style="background:${SOLUTION_COLOR[r.primary]||'#ddd'}"></span>${escapeHtml(r.primary)}</td><td><span class="color-dot" style="background:${SOLUTION_COLOR[r.secondary]||'#ddd'}"></span>${escapeHtml(r.secondary)}</td><td>${escapeHtml(r.primaryBasis)}</td>`; tb.appendChild(tr)});
}
function updateNav(){
  document.getElementById("breadcrumb").textContent = state.stack.map(s=>s.name).concat([state.name]).join(" / ");
  document.getElementById("backBtn").disabled = state.level === "country";
}
function goHome(){state={level:"country",name:"全国",province:null,city:null,stack:[]}; document.getElementById("chinaMap").innerHTML=""; chart=echarts.init(document.getElementById("chinaMap")); attachChartClick(); render();}
function goBack(){if(state.stack.length===0)return; const prev=state.stack.pop(); state={...prev,stack:state.stack}; document.getElementById("chinaMap").innerHTML=""; chart=echarts.init(document.getElementById("chinaMap")); attachChartClick(); render();}
function attachChartClick(){
  chart.off("click");
  chart.on("click", p => {
    if(!p.data || !p.data.total) return;
    if(state.level === "country"){
      const provFull = p.data.rows[0].province;
      state.stack.push({...state,stack:[...state.stack]});
      state = {level:"province",name:p.name,province:provFull,city:null,stack:state.stack};
      render();
    } else if(state.level === "province"){
      if(DIRECT_CITY.has(norm(state.province))){ updatePanels(p.data.rows,p.name); return; }
      const cityFull = p.data.rows[0].city;
      state.stack.push({...state,stack:[...state.stack]});
      state = {level:"city",name:p.name,province:state.province,city:cityFull,stack:state.stack};
      render();
    }
  });
}
function downloadCurrentRows(){
  const headers=["省份","城市","行政区","GH硬度","KH碱度","TDS","主推方案","次推方案","主推依据"];
  const lines=[headers.join(",")];
  currentTableRows.forEach(r=>{lines.push([r.province,r.city,r.district,r.gh,r.kh,r.tds,r.primary,r.secondary,r.primaryBasis].map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(","))});
  const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8;"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`${state.name}-water-detail.csv`; a.click(); URL.revokeObjectURL(url);
}
function init(){ currentRows=window.WATER_DATA||[]; chart=echarts.init(document.getElementById("chinaMap")); attachChartClick(); document.getElementById("homeBtn").onclick=goHome; document.getElementById("backBtn").onclick=goBack; document.getElementById("downloadBtn").onclick=downloadCurrentRows; document.querySelectorAll(".solution-filter").forEach(i=>i.addEventListener("change",render)); window.addEventListener("resize",()=>chart.resize()); render(); }
init();
