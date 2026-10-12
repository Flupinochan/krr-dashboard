"use strict";

const Charts = (() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const MIB = 1024 * 1024;
  const MAX_NAMESPACES = 15;
  const TOP_CONTAINERS = 10;

  const WIDTH = 560;
  const LABEL_WIDTH = 180;
  const VALUE_WIDTH = 72;
  const BAR_HEIGHT = 12;
  const BAR_GAP = 2;
  const ROW_GAP = 14;
  const TOP_PAD = 8;
  const AXIS_HEIGHT = 26;
  const LABEL_MAX_CHARS = 24;

  const UNITS = {
    cpu: { scale: (value) => value * 1000, suffix: "m" },
    memory: { scale: (value) => value / MIB, suffix: "Mi" },
  };

  const CURRENT = { name: "現在", cls: "bar-current" };
  const RECOMMENDED = { name: "推奨", cls: "bar-recommended" };

  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  function formatNumber(value) {
    return value.toLocaleString("en-US", { maximumFractionDigits: value < 10 ? 1 : 0 });
  }

  function formatWithUnit(value, unit) {
    return formatNumber(UNITS[unit].scale(value)) + UNITS[unit].suffix;
  }

  function niceTicks(max, target = 4) {
    if (!(max > 0)) return [0, 1];
    const rough = max / target;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const residual = rough / magnitude;
    const factor = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
    const step = factor * magnitude;
    const count = Math.ceil(max / step);
    return Array.from({ length: count + 1 }, (_, index) => index * step);
  }

  function svg(tag, attributes = {}, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // 基線側は直角、データ端のみ 4px の角丸にする
  function barPath(x, y, width, height) {
    if (width <= 0) return null;
    const r = Math.min(4, width, height / 2);
    return `M${x},${y} H${x + width - r} A${r},${r} 0 0 1 ${x + width},${y + r} V${y + height - r} A${r},${r} 0 0 1 ${x + width - r},${y + height} H${x} Z`;
  }

  function truncate(label) {
    return label.length > LABEL_MAX_CHARS ? label.slice(0, LABEL_MAX_CHARS - 1) + "…" : label;
  }

  function buildChart(items, series, ariaLabel) {
    const groupHeight = series.length * BAR_HEIGHT + (series.length - 1) * BAR_GAP;
    const pitch = groupHeight + ROW_GAP;
    const height = TOP_PAD + items.length * pitch + AXIS_HEIGHT;
    const plotLeft = LABEL_WIDTH;
    const plotRight = WIDTH - VALUE_WIDTH;

    const max = Math.max(...items.flatMap((item) => item.values));
    const ticks = niceTicks(max);
    const top = ticks[ticks.length - 1];
    const xOf = (value) => plotLeft + ((plotRight - plotLeft) * value) / top;

    const root = svg("svg", { viewBox: `0 0 ${WIDTH} ${height}`, class: "chart-svg", role: "img", "aria-label": ariaLabel });

    for (const tick of ticks) {
      const x = xOf(tick);
      root.appendChild(svg("line", { x1: x, x2: x, y1: TOP_PAD, y2: height - AXIS_HEIGHT, class: tick === 0 ? "chart-axis" : "chart-grid" }));
      root.appendChild(svg("text", { x, y: height - AXIS_HEIGHT + 16, class: "chart-tick", "text-anchor": "middle" }, formatNumber(tick)));
    }

    items.forEach((item, index) => {
      const y = TOP_PAD + index * pitch + ROW_GAP / 2;
      const row = svg("g", { class: "chart-row" });
      row.dataset.tip = item.tip;
      // 細いバーでも行全体でホバーできるよう、透明な当たり判定を重ねる
      row.appendChild(svg("rect", { x: 0, y: y - ROW_GAP / 2, width: WIDTH, height: pitch, class: "chart-hit" }));
      row.appendChild(svg("text", { x: plotLeft - 8, y: y + groupHeight / 2, class: "chart-label", "text-anchor": "end" }, truncate(item.label)));

      series.forEach((entry, seriesIndex) => {
        const value = item.values[seriesIndex];
        const barY = y + seriesIndex * (BAR_HEIGHT + BAR_GAP);
        const width = xOf(value) - plotLeft;
        const path = barPath(plotLeft, barY, width, BAR_HEIGHT);
        if (path) row.appendChild(svg("path", { d: path, class: "bar " + entry.cls }));
        row.appendChild(svg("text", { x: plotLeft + Math.max(width, 0) + 6, y: barY + BAR_HEIGHT / 2, class: "chart-value" }, formatNumber(value)));
      });
      root.appendChild(row);
    });
    return root;
  }

  function buildLegend(series) {
    const legend = document.createElement("div");
    legend.className = "chart-legend";
    for (const entry of series) {
      const item = document.createElement("span");
      const swatch = document.createElement("span");
      swatch.className = "swatch " + entry.cls;
      item.append(swatch, entry.name);
      legend.appendChild(item);
    }
    return legend;
  }

  function buildCard({ title, subtitle, items, series }) {
    const section = document.createElement("section");
    section.className = "chart-card";

    const heading = document.createElement("h2");
    heading.textContent = title;
    const sub = document.createElement("p");
    sub.className = "chart-sub";
    sub.textContent = subtitle;
    section.append(heading, sub);

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "chart-empty";
      empty.textContent = "対象データがありません";
      section.appendChild(empty);
      return section;
    }
    if (series.length > 1) section.appendChild(buildLegend(series));
    section.appendChild(buildChart(items, series, title));
    return section;
  }

  function namespaceCard(rows, base, unit, title) {
    const groups = new Map();
    let counted = 0;
    for (const row of rows) {
      const current = row[base + "_current"].value;
      const recommended = row[base + "_recommended"].value;
      if (current === null || recommended === null) continue;
      counted += 1;
      const group = groups.get(row.namespace) ?? { namespace: row.namespace, current: 0, recommended: 0, count: 0 };
      group.current += current * row.pods;
      group.recommended += recommended * row.pods;
      group.count += 1;
      groups.set(row.namespace, group);
    }

    const ranked = [...groups.values()].sort((a, b) => b.current - a.current);
    const items = ranked.slice(0, MAX_NAMESPACES).map((group) => ({
      label: group.namespace,
      values: [UNITS[unit].scale(group.current), UNITS[unit].scale(group.recommended)],
      tip: [
        group.namespace,
        "現在 " + formatWithUnit(group.current, unit),
        "推奨 " + formatWithUnit(group.recommended, unit),
        "対象 " + group.count + " 件",
      ].join("\n"),
    }));

    let subtitle = "Pods 数を乗算した合計 / 現在値と推奨値の両方があるコンテナのみ (" + counted + " / " + rows.length + " 件)";
    if (ranked.length > MAX_NAMESPACES) subtitle += " / 現在値の上位 " + MAX_NAMESPACES + " namespace";
    return buildCard({ title, subtitle, items, series: [CURRENT, RECOMMENDED] });
  }

  function topContainerCard(rows, base, unit, title) {
    const key = base + "_recommended";
    const ranked = rows
      .filter((row) => row[key].value !== null)
      .sort((a, b) => b[key].value - a[key].value)
      .slice(0, TOP_CONTAINERS);

    const items = ranked.map((row) => {
      const current = row[base + "_current"];
      return {
        label: row.container,
        values: [UNITS[unit].scale(row[key].value)],
        tip: [
          row.namespace + " / " + row.name,
          "コンテナ " + row.container,
          "現在 " + (current.value === null ? "未設定" : formatWithUnit(current.value, unit)),
          "推奨 " + formatWithUnit(row[key].value, unit),
          "Pods " + row.pods,
        ].join("\n"),
      };
    });
    const subtitle = "推奨値の上位 " + TOP_CONTAINERS + " (" + UNITS[unit].suffix + ")";
    return buildCard({ title, subtitle, items, series: [RECOMMENDED] });
  }

  function render(container, rows) {
    container.replaceChildren(
      namespaceCard(rows, "cpu_requests", "cpu", "CPU Requests: namespace 別の現在 vs 推奨"),
      namespaceCard(rows, "memory_requests", "memory", "Memory Requests: namespace 別の現在 vs 推奨"),
      topContainerCard(rows, "cpu_requests", "cpu", "推奨 CPU が大きいコンテナ"),
      topContainerCard(rows, "memory_requests", "memory", "推奨メモリが大きいコンテナ"),
    );
  }

  function bindTooltip(container) {
    const margin = 12;
    container.addEventListener("pointermove", (event) => {
      const target = event.target.closest("[data-tip]");
      if (!target) {
        tooltip.hidden = true;
        return;
      }
      tooltip.textContent = target.dataset.tip;
      tooltip.hidden = false;

      const size = tooltip.getBoundingClientRect();
      let left = event.clientX + margin;
      let topPosition = event.clientY + margin;
      if (left + size.width > window.innerWidth - 8) left = event.clientX - size.width - margin;
      if (topPosition + size.height > window.innerHeight - 8) topPosition = event.clientY - size.height - margin;
      tooltip.style.left = Math.max(8, left) + "px";
      tooltip.style.top = Math.max(8, topPosition) + "px";
    });
    container.addEventListener("pointerleave", () => {
      tooltip.hidden = true;
    });
  }

  return { render, bindTooltip };
})();
