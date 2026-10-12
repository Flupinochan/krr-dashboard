"use strict";

const SEVERITY_ORDER = ["CRITICAL", "WARNING", "UNKNOWN", "OK", "GOOD"];
const POLL_INTERVAL_MS = 3000;
const MIB = 1024 * 1024;

const COLUMNS = [
  { key: "namespace", label: "Namespace", sort: (r) => r.namespace },
  { key: "name", label: "Name", sort: (r) => r.name },
  { key: "type", label: "Type", sort: (r) => r.type },
  { key: "container", label: "Container", sort: (r) => r.container },
  { key: "pods", label: "Pods", num: true, sort: (r) => r.pods },
  { key: "severity", label: "Severity", sort: (r) => severityRank(r.severity) },
  { key: "cpu_requests", label: "CPU Requests\n現在 → 推奨", metric: "cpu_requests", unit: "cpu", sort: (r) => r.cpu_requests_current.value },
  { key: "cpu_requests_diff", label: "CPU Requests\n差分", diff: "cpu_requests", unit: "cpu", sort: (r) => diffOf(r, "cpu_requests") },
  { key: "cpu_limits", label: "CPU Limits\n現在 → 推奨", metric: "cpu_limits", unit: "cpu", sort: (r) => r.cpu_limits_current.value },
  { key: "cpu_limits_diff", label: "CPU Limits\n差分", diff: "cpu_limits", unit: "cpu", sort: (r) => diffOf(r, "cpu_limits") },
  { key: "memory_requests", label: "Memory Requests\n現在 → 推奨", metric: "memory_requests", unit: "memory", sort: (r) => r.memory_requests_current.value },
  { key: "memory_requests_diff", label: "Memory Requests\n差分", diff: "memory_requests", unit: "memory", sort: (r) => diffOf(r, "memory_requests") },
  { key: "memory_limits", label: "Memory Limits\n現在 → 推奨", metric: "memory_limits", unit: "memory", sort: (r) => r.memory_limits_current.value },
  { key: "memory_limits_diff", label: "Memory Limits\n差分", diff: "memory_limits", unit: "memory", sort: (r) => diffOf(r, "memory_limits") },
];

const HIDDEN_COLUMNS_KEY = "krr-dashboard.hiddenColumns";

const DEFAULT_HIDDEN_COLUMNS = ["namespace", "type", "container", "pods"];

function loadHiddenColumns() {
  try {
    const raw = localStorage.getItem(HIDDEN_COLUMNS_KEY);
    // 未保存と「すべて表示」を保存した状態を区別するため、null のときだけ初期値を使う
    if (raw === null) return new Set(DEFAULT_HIDDEN_COLUMNS);
    const known = new Set(COLUMNS.map((column) => column.key));
    return new Set(JSON.parse(raw).filter((key) => known.has(key)));
  } catch {
    return new Set(DEFAULT_HIDDEN_COLUMNS);
  }
}

function saveHiddenColumns() {
  try {
    localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify([...state.hiddenColumns]));
  } catch {
    // 保存できなくても表示自体には影響しない
  }
}

function visibleColumns() {
  return COLUMNS.filter((column) => !state.hiddenColumns.has(column.key));
}

const COLUMN_WIDTHS_KEY = "krr-dashboard.columnWidths";
const MIN_COLUMN_WIDTH = 48;
const DEFAULT_WIDTHS = { namespace: 140, name: 260, type: 110, container: 180, pods: 64, severity: 100 };

function loadColumnWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMN_WIDTHS_KEY) ?? "{}");
    const widths = {};
    for (const column of COLUMNS) {
      const value = saved[column.key];
      if (Number.isFinite(value) && value >= MIN_COLUMN_WIDTH) widths[column.key] = value;
    }
    return widths;
  } catch {
    return {};
  }
}

function saveColumnWidths() {
  try {
    localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(state.columnWidths));
  } catch {
    // 保存できなくても表示自体には影響しない
  }
}

function columnWidth(column) {
  return state.columnWidths[column.key] ?? DEFAULT_WIDTHS[column.key] ?? (column.diff ? 150 : 170);
}

function applyTableWidth() {
  const total = visibleColumns().reduce((sum, column) => sum + columnWidth(column), 0);
  el("table").style.width = total + "px";
}

const state = {
  rows: [],
  generatedAt: null,
  status: { state: "idle", error: null },
  sortKey: "severity",
  sortDir: "asc",
  filters: { namespace: "", severity: "", type: "", text: "" },
  hiddenColumns: loadHiddenColumns(),
  columnWidths: loadColumnWidths(),
};

let pollTimer = null;

const el = (id) => document.getElementById(id);

function severityRank(severity) {
  const index = SEVERITY_ORDER.indexOf(severity);
  return index === -1 ? SEVERITY_ORDER.length : index;
}

function diffOf(row, metric) {
  const current = row[metric + "_current"].value;
  const recommended = row[metric + "_recommended"].value;
  if (current === null || recommended === null) return null;
  return recommended - current;
}

function formatValue(value, unit) {
  if (unit === "cpu") return Math.round(value * 1000 * 10) / 10 + "m";
  return Math.round((value / MIB) * 10) / 10 + "Mi";
}

function formatSigned(value, unit) {
  const text = formatValue(Math.abs(value), unit);
  if (value === 0) return text;
  return (value > 0 ? "+" : "-") + text;
}

function formatMetric(metric) {
  if (metric.state === "unset") return "未設定";
  if (metric.state === "unknown") return "算出不可";
  return null;
}

function formatPair(row, base, unit) {
  const current = row[base + "_current"];
  const recommended = row[base + "_recommended"];
  const left = formatMetric(current) ?? formatValue(current.value, unit);
  const right = formatMetric(recommended) ?? formatValue(recommended.value, unit);
  return left + " → " + right;
}

function matchesFilters(row) {
  const f = state.filters;
  if (f.namespace && row.namespace !== f.namespace) return false;
  if (f.severity && row.severity !== f.severity) return false;
  if (f.type && row.type !== f.type) return false;
  if (f.text) {
    const needle = f.text.toLowerCase();
    if (!row.name.toLowerCase().includes(needle) && !row.container.toLowerCase().includes(needle)) {
      return false;
    }
  }
  return true;
}

function compareValues(a, b) {
  // 値のない行は昇順降順にかかわらず末尾へ寄せる
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "string") return a.localeCompare(b);
  return a - b;
}

function visibleRows() {
  const column = COLUMNS.find((c) => c.key === state.sortKey);
  const direction = state.sortDir === "asc" ? 1 : -1;
  return state.rows.filter(matchesFilters).sort((x, y) => {
    const a = column.sort(x);
    const b = column.sort(y);
    if (a === null || b === null) return compareValues(a, b);
    return compareValues(a, b) * direction;
  });
}

function makeCell(text, className) {
  const td = document.createElement("td");
  td.textContent = text;
  td.title = text;
  if (className) td.className = className;
  return td;
}

function renderHeader() {
  const table = el("table");
  const colgroup = document.createElement("colgroup");
  const tr = document.createElement("tr");
  for (const column of visibleColumns()) {
    const col = document.createElement("col");
    col.dataset.key = column.key;
    col.style.width = columnWidth(column) + "px";
    colgroup.appendChild(col);

    const th = document.createElement("th");
    th.textContent = column.label;
    th.title = column.label.replace("\n", " ");
    th.dataset.key = column.key;
    th.tabIndex = 0;
    if (column.key === state.sortKey) {
      th.setAttribute("aria-sort", state.sortDir === "asc" ? "ascending" : "descending");
    }
    const handle = document.createElement("span");
    handle.className = "resizer";
    th.appendChild(handle);
    tr.appendChild(th);
  }
  table.querySelector("colgroup")?.remove();
  table.prepend(colgroup);
  table.tHead.replaceChildren(tr);
  applyTableWidth();
}

function startResize(event) {
  const handle = event.target.closest(".resizer");
  if (!handle) return;
  event.preventDefault();

  const key = handle.parentElement.dataset.key;
  const column = COLUMNS.find((c) => c.key === key);
  const col = el("table").querySelector('col[data-key="' + key + '"]');
  const startX = event.clientX;
  const startWidth = columnWidth(column);
  handle.setPointerCapture(event.pointerId);

  const onMove = (moveEvent) => {
    const width = Math.max(MIN_COLUMN_WIDTH, Math.round(startWidth + moveEvent.clientX - startX));
    state.columnWidths[key] = width;
    col.style.width = width + "px";
    applyTableWidth();
  };
  const onEnd = () => {
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onEnd);
    handle.removeEventListener("pointercancel", onEnd);
    saveColumnWidths();
  };
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onEnd);
  handle.addEventListener("pointercancel", onEnd);
}

function resetColumnWidth(event) {
  const handle = event.target.closest(".resizer");
  if (!handle) return;
  delete state.columnWidths[handle.parentElement.dataset.key];
  saveColumnWidths();
  renderHeader();
}

function renderRow(row) {
  const tr = document.createElement("tr");
  for (const column of visibleColumns()) {
    if (column.key === "severity") {
      const td = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "sev sev-" + row.severity;
      badge.textContent = row.severity;
      td.appendChild(badge);
      tr.appendChild(td);
    } else if (column.metric) {
      const base = column.metric;
      const missing = row[base + "_recommended"].state !== "set";
      tr.appendChild(makeCell(formatPair(row, base, column.unit), "num" + (missing ? " muted" : "")));
    } else if (column.diff) {
      const diff = diffOf(row, column.diff);
      if (diff === null) {
        tr.appendChild(makeCell("-", "num muted"));
      } else {
        const current = row[column.diff + "_current"].value;
        const rate = current > 0 ? " (" + Math.round((diff / current) * 100) + "%)" : "";
        const cls = diff > 0 ? "num up" : diff < 0 ? "num down" : "num";
        tr.appendChild(makeCell(formatSigned(diff, column.unit) + rate, cls));
      }
    } else if (column.num) {
      tr.appendChild(makeCell(String(row[column.key]), "num"));
    } else {
      tr.appendChild(makeCell(row[column.key]));
    }
  }
  return tr;
}

function renderBody() {
  const rows = visibleRows();
  const tbody = el("table").tBodies[0];
  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = makeCell(state.rows.length === 0 ? "データがありません" : "条件に一致する行がありません", "empty");
    td.colSpan = Math.max(1, visibleColumns().length);
    tr.appendChild(td);
    tbody.replaceChildren(tr);
  } else {
    tbody.replaceChildren(...rows.map(renderRow));
  }
  el("row-count").textContent = rows.length + " / " + state.rows.length + " 件";
}

function sumRequests(rows, base) {
  let current = 0;
  let recommended = 0;
  let counted = 0;
  for (const row of rows) {
    const cur = row[base + "_current"].value;
    const rec = row[base + "_recommended"].value;
    if (cur === null || rec === null) continue;
    current += cur * row.pods;
    recommended += rec * row.pods;
    counted += 1;
  }
  return { current, recommended, counted };
}

function totalItem(label, base, unit) {
  const sum = sumRequests(state.rows, base);
  const diff = sum.recommended - sum.current;

  const item = document.createElement("div");
  item.className = "total-item";
  item.title = "現在値と推奨値の両方があるコンテナのみ、Pods 数を乗算した合計 (" + sum.counted + " / " + state.rows.length + " 件)";

  const name = document.createElement("span");
  name.className = "total-label";
  name.textContent = label;
  const value = document.createElement("span");
  value.className = "total-value";
  value.textContent = formatValue(sum.current, unit) + " → " + formatValue(sum.recommended, unit);
  const delta = document.createElement("span");
  delta.className = "total-delta " + (diff > 0 ? "up" : diff < 0 ? "down" : "");
  delta.textContent = "(" + formatSigned(diff, unit) + ")";

  item.append(name, value, delta);
  return item;
}

function renderTotals() {
  el("totals").replaceChildren(
    totalItem("CPU Requests 合計", "cpu_requests", "cpu"),
    totalItem("Memory Requests 合計", "memory_requests", "memory"),
  );
}

function renderCharts() {
  Charts.render(el("charts"), state.rows.filter(matchesFilters));
}

function renderFreshness() {
  const label = el("freshness");
  if (!state.generatedAt) {
    label.textContent = "CSV未生成";
    return;
  }
  const generated = new Date(state.generatedAt);
  const minutes = Math.max(0, Math.round((Date.now() - generated.getTime()) / 60000));
  const elapsed = minutes < 60 ? minutes + "分前" : Math.floor(minutes / 60) + "時間前";
  label.textContent = "生成日時 " + generated.toLocaleString("ja-JP") + " (" + elapsed + ")";
}

function renderStatus() {
  const running = state.status.state === "running";
  const button = el("regenerate");
  button.disabled = running;
  button.textContent = running ? "再生成中..." : "再生成";

  const banner = el("banner");
  if (state.status.state === "failed") {
    banner.hidden = false;
    banner.textContent = "再生成に失敗しました。旧データを表示しています: " + (state.status.error ?? "");
  } else if (running && state.rows.length === 0) {
    banner.hidden = false;
    banner.textContent = "初回の生成中です。完了まで数分かかる場合があります";
  } else {
    banner.hidden = true;
  }
}

function fillSelect(id, values, selected) {
  const select = el(id);
  const options = [new Option("すべて", "")];
  for (const value of values) options.push(new Option(value, value));
  select.replaceChildren(...options);
  select.value = values.includes(selected) ? selected : "";
}

function renderFilters() {
  const unique = (key) => [...new Set(state.rows.map((r) => r[key]))].sort();
  const severities = unique("severity").sort((a, b) => severityRank(a) - severityRank(b));
  fillSelect("filter-namespace", unique("namespace"), state.filters.namespace);
  fillSelect("filter-severity", severities, state.filters.severity);
  fillSelect("filter-type", unique("type"), state.filters.type);
}

function renderAll() {
  renderFilters();
  renderHeader();
  renderBody();
  renderCharts();
  renderTotals();
  renderFreshness();
  renderStatus();
}

function renderFiltered() {
  renderBody();
  renderCharts();
}

async function loadRecommendations() {
  const response = await fetch("/api/recommendations");
  if (!response.ok) throw new Error("recommendations " + response.status);
  const body = await response.json();
  state.rows = body.rows;
  state.generatedAt = body.generated_at;
  state.status = body.status;
  renderAll();
  return body.status.state;
}

async function loadStatus() {
  const response = await fetch("/api/status");
  if (!response.ok) throw new Error("status " + response.status);
  state.status = await response.json();
  renderStatus();
  return state.status.state;
}

function startPolling() {
  if (pollTimer !== null) return;
  pollTimer = setInterval(async () => {
    try {
      const current = await loadStatus();
      if (current !== "running") {
        stopPolling();
        await loadRecommendations();
      }
    } catch {
      // 一時的な通信失敗は次の周期で再試行する
    }
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

async function regenerate() {
  el("regenerate").disabled = true;
  try {
    const response = await fetch("/api/regenerate", { method: "POST" });
    if (response.status !== 202 && response.status !== 409) {
      throw new Error("regenerate " + response.status);
    }
    state.status = { state: "running", error: null };
    renderStatus();
    startPolling();
  } catch (error) {
    el("banner").hidden = false;
    el("banner").textContent = "再生成を開始できませんでした: " + error.message;
    el("regenerate").disabled = false;
  }
}

function toggleSort(key) {
  if (state.sortKey === key) {
    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  } else {
    state.sortKey = key;
    state.sortDir = "asc";
  }
  renderHeader();
  renderBody();
}

function renderColumnPicker() {
  const options = COLUMNS.map((column) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.key = column.key;
    input.checked = !state.hiddenColumns.has(column.key);
    label.append(input, " " + column.label.replace("\n", " "));
    return label;
  });
  el("column-options").replaceChildren(...options);
}

function applyColumnChange() {
  saveHiddenColumns();
  renderHeader();
  renderBody();
}

function bindEvents() {
  el("regenerate").addEventListener("click", regenerate);

  el("column-options").addEventListener("change", (event) => {
    const key = event.target.dataset.key;
    if (event.target.checked) state.hiddenColumns.delete(key);
    else state.hiddenColumns.add(key);
    applyColumnChange();
  });
  el("columns-show-all").addEventListener("click", () => {
    state.hiddenColumns.clear();
    renderColumnPicker();
    applyColumnChange();
  });
  el("columns-reset").addEventListener("click", () => {
    state.hiddenColumns = new Set(DEFAULT_HIDDEN_COLUMNS);
    renderColumnPicker();
    applyColumnChange();
  });

  const onHeader = (event) => {
    if (event.target.closest(".resizer")) return;
    const th = event.target.closest("th");
    if (th) toggleSort(th.dataset.key);
  };
  el("table").tHead.addEventListener("click", onHeader);
  el("table").tHead.addEventListener("pointerdown", startResize);
  el("table").tHead.addEventListener("dblclick", resetColumnWidth);
  el("table").tHead.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onHeader(event);
    }
  });

  for (const [id, key] of [["filter-namespace", "namespace"], ["filter-severity", "severity"], ["filter-type", "type"]]) {
    el(id).addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      renderFiltered();
    });
  }
  el("filter-text").addEventListener("input", (event) => {
    state.filters.text = event.target.value.trim();
    renderFiltered();
  });
}

async function init() {
  Charts.bindTooltip(el("charts"));
  renderColumnPicker();
  bindEvents();
  try {
    const current = await loadRecommendations();
    if (current === "running") startPolling();
  } catch (error) {
    el("freshness").textContent = "読み込みに失敗しました";
  }
  setInterval(renderFreshness, 60000);
}

init();
