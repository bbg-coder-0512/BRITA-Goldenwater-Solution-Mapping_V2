const GEOJSON_URL = "https://geojson.cn/api/china/100000.json";

const SOLUTION_CODE = {
  "XtraSafe大胖紫": 1,
  "Quell ST风味大师": 2,
  "Quell ST+MinUp": 3
};

const SOLUTION_COLOR = {
  "XtraSafe大胖紫": "#B7A4F3",
  "Quell ST风味大师": "#00B0F0",
  "Quell ST+MinUp": "#FFFF00",
  "无数据": "#D9D9D9"
};

let chart;
let geoNameMap = {};
let currentRows = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeProvince(name) {
  return String(name || "")
    .replace("特别行政区", "")
    .replace("维吾尔自治区", "")
    .replace("壮族自治区", "")
    .replace("回族自治区", "")
    .replace("自治区", "")
    .replace("省", "")
    .replace("市", "")
    .trim();
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  return Number(value).toFixed(1);
}

function buildGeoNameMap(geoJson) {
  geoNameMap = {};
  geoJson.features.forEach(feature => {
    const props = feature.properties || {};
    const name = props.name || props.fullname;
    if (name) geoNameMap[normalizeProvince(name)] = name;
  });
}

function mapName(province) {
  return geoNameMap[normalizeProvince(province)] || province;
}

function getActiveSolutions() {
  return Array.from(document.querySelectorAll(".solution-filter:checked")).map(input => input.value);
}

function getDominantSolution(counts) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function aggregateByProvince(rows) {
  const active = getActiveSolutions();
  const provinceMap = {};

  rows.forEach(row => {
    if (!active.includes(row.primary)) return;
    const key = normalizeProvince(row.province);
    if (!provinceMap[key]) {
      provinceMap[key] = {
        name: mapName(row.province),
        province: row.province,
        total: 0,
        counts: { "XtraSafe大胖紫": 0, "Quell ST风味大师": 0, "Quell ST+MinUp": 0 },
        rows: []
      };
    }
    provinceMap[key].total += 1;
    provinceMap[key].counts[row.primary] += 1;
    provinceMap[key].rows.push(row);
  });

  return Object.values(provinceMap).map(item => {
    const dominant = getDominantSolution(item.counts);
    return {
      name: item.name,
      value: SOLUTION_CODE[dominant],
      dominant,
      total: item.total,
      counts: item.counts,
      rows: item.rows,
      itemStyle: { areaColor: SOLUTION_COLOR[dominant] }
    };
  });
}

async function init() {
  chart = echarts.init(document.getElementById("chinaMap"));
  currentRows = window.WATER_DATA || [];

  try {
    const geoJson = await fetch(GEOJSON_URL).then(res => res.json());
    buildGeoNameMap(geoJson);
    echarts.registerMap("china", geoJson);
    bindEvents();
    render();
  } catch (error) {
    document.getElementById("chinaMap").innerHTML = `<div class="loading">地图数据加载失败。请检查网络，或把GeoJSON下载为 assets/china.json 后修改 js/app.js 中的 GEOJSON_URL。</div>`;
    console.error(error);
  }
}

function render() {
  const provinceData = aggregateByProvince(currentRows);
  const option = {
    backgroundColor: "#ffffff",
    tooltip: {
      trigger: "item",
      formatter: params => {
        if (!params.data) return `${escapeHtml(params.name)}<br/>暂无数据`;
        const d = params.data;
        return `
          <strong>${escapeHtml(params.name)}</strong><br/>
          主推最多：${escapeHtml(d.dominant)}<br/>
          区域记录数：${d.total}<br/>
          XtraSafe大胖紫：${d.counts["XtraSafe大胖紫"]}<br/>
          Quell ST风味大师：${d.counts["Quell ST风味大师"]}<br/>
          Quell ST+MinUp：${d.counts["Quell ST+MinUp"]}
        `;
      }
    },
    visualMap: {
      type: "piecewise",
      left: 24,
      bottom: 24,
      itemWidth: 18,
      itemHeight: 14,
      textStyle: { color: "#334155" },
      pieces: [
        { value: 1, label: "XtraSafe大胖紫", color: SOLUTION_COLOR["XtraSafe大胖紫"] },
        { value: 2, label: "Quell ST风味大师", color: SOLUTION_COLOR["Quell ST风味大师"] },
        { value: 3, label: "Quell ST+MinUp", color: SOLUTION_COLOR["Quell ST+MinUp"] }
      ],
      outOfRange: { color: SOLUTION_COLOR["无数据"] }
    },
    series: [{
      name: "最终主推方案",
      type: "map",
      map: "china",
      roam: true,
      selectedMode: "single",
      zoom: 1.15,
      label: { show: true, color: "#334155", fontSize: 10 },
      itemStyle: { borderColor: "#ffffff", borderWidth: 1, areaColor: SOLUTION_COLOR["无数据"] },
      emphasis: { label: { color: "#111827", fontWeight: "bold" }, itemStyle: { areaColor: "#f97316" } },
      data: provinceData
    }]
  };

  chart.setOption(option, true);
  updateSummary(currentRows, "全国汇总");
  updateDetailTable(currentRows.slice(0, 120), "全国汇总");
}

function bindEvents() {
  window.addEventListener("resize", () => chart.resize());
  document.querySelectorAll(".solution-filter").forEach(input => input.addEventListener("change", render));
  document.getElementById("resetBtn").addEventListener("click", () => {
    chart.dispatchAction({ type: "mapUnSelect" });
    updateSummary(currentRows, "全国汇总");
    updateDetailTable(currentRows.slice(0, 120), "全国汇总");
  });
  document.getElementById("downloadBtn").addEventListener("click", downloadCurrentRows);
  chart.on("click", params => {
    if (!params.data || !params.data.rows) return;
    updateSummary(params.data.rows, params.name);
    updateDetailTable(params.data.rows, params.name);
  });
}

function updateSummary(rows, title) {
  const counts = { "XtraSafe大胖紫": 0, "Quell ST风味大师": 0, "Quell ST+MinUp": 0 };
  rows.forEach(row => { if (counts[row.primary] !== undefined) counts[row.primary] += 1; });
  const total = rows.length;
  const top = total ? getDominantSolution(counts) : "-";
  document.getElementById("panelTitle").textContent = title;
  document.getElementById("totalCount").textContent = total;
  document.getElementById("topSolution").textContent = top;

  const container = document.getElementById("solutionSummary");
  container.innerHTML = "";
  Object.entries(counts).forEach(([solution, count]) => {
    const div = document.createElement("div");
    div.className = "summary-item";
    div.style.borderLeftColor = SOLUTION_COLOR[solution];
    div.innerHTML = `<span>${escapeHtml(solution)}</span><strong>${count}</strong>`;
    container.appendChild(div);
  });
}

function updateDetailTable(rows, title) {
  currentTableRows = rows;
  document.getElementById("panelTitle").textContent = title;
  const tbody = document.querySelector("#detailTable tbody");
  tbody.innerHTML = "";
  rows.forEach(row => {
    const primaryColor = SOLUTION_COLOR[row.primary] || "#ddd";
    const secondaryColor = SOLUTION_COLOR[row.secondary] || "#ddd";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.province)}</td>
      <td>${escapeHtml(row.city)}</td>
      <td>${escapeHtml(row.district)}</td>
      <td>${formatNumber(row.gh)}</td>
      <td>${formatNumber(row.kh)}</td>
      <td>${formatNumber(row.tds)}</td>
      <td><span class="color-dot" style="background:${primaryColor}"></span>${escapeHtml(row.primary)}</td>
      <td><span class="color-dot" style="background:${secondaryColor}"></span>${escapeHtml(row.secondary)}</td>
      <td>${escapeHtml(row.primaryBasis || row.primaryNote)}</td>
    `;
    tbody.appendChild(tr);
  });
}

let currentTableRows = [];
function downloadCurrentRows() {
  const headers = ["省份", "城市", "行政区", "GH硬度", "KH碱度", "TDS", "主推方案", "次推方案", "主推依据"];
  const lines = [headers.join(",")];
  currentTableRows.forEach(row => {
    const values = [row.province, row.city, row.district, row.gh, row.kh, row.tds, row.primary, row.secondary, row.primaryBasis || row.primaryNote]
      .map(v => `"${String(v ?? "").replaceAll('"', '""')}"`);
    lines.push(values.join(","));
  });

  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "water-map-current-detail.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

init();
