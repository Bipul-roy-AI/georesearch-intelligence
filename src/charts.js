// Hand-rolled, dependency-free chart primitives: a ranked bar list and a multi-series
// year line chart, each with a visible value (no value is hover-only) and a table view.
const Charts = (() => {
  'use strict';
  const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
  // SVG elements only; tags are passed as "svg" or "svg:line" etc.
  const node = (tag, cls) => { const svgEl = document.createElementNS('http://www.w3.org/2000/svg', tag.replace('svg:', '')); if (cls) svgEl.setAttribute('class', cls); return svgEl; };
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const txt = (tag, value, cls) => { const e = el(tag, cls); e.textContent = value; return e; };
  function compactNumber(n) {
    if (!Number.isFinite(n)) return '0';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  }
  function niceStep(maxValue, ticks = 4) {
    const raw = maxValue / ticks || 1, mag = 10 ** Math.floor(Math.log10(raw));
    for (const step of [1, 2, 5, 10]) if (step * mag >= raw) return step * mag;
    return 10 * mag;
  }
  // A ranked horizontal bar list. Every value is printed, so nothing depends on hover.
  function barList(container, { rows, color = '#155f55', formatValue = String, emptyText = 'No data for this selection.' }) {
    container.replaceChildren();
    if (!rows.length) { container.append(txt('p', emptyText, 'dashEmpty')); return; }
    const max = Math.max(...rows.map(r => r.value), 1);
    const list = el('div', 'dashBars');
    for (const row of rows) {
      const line = el('div', 'dashBarRow');
      line.append(txt('span', row.label, 'dashBarLabel'));
      const track = el('div', 'dashBarTrack'), fill = el('div', 'dashBarFill');
      fill.style.width = Math.max(2, (row.value / max) * 100) + '%'; fill.style.background = color;
      track.append(fill); line.append(track);
      line.append(txt('span', formatValue(row.value), 'dashBarValue'));
      list.append(line);
    }
    container.append(list);
  }
  // A ranked article list (title, journal, year, citation count), used for "most cited".
  function citedList(container, rows, { emptyText = 'No data for this selection.' } = {}) {
    container.replaceChildren();
    if (!rows.length) { container.append(txt('p', emptyText, 'dashEmpty')); return; }
    const list = el('ol', 'dashCited');
    for (const row of rows) {
      const item = el('li');
      if (row.url) { const a = el('a'); a.href = Atlas.url(row.url); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = row.title; item.append(a); }
      else item.append(txt('span', row.title));
      const meta = [row.journal, row.year || '', row.cited + ' citation' + (row.cited === 1 ? '' : 's')].filter(Boolean).join(' · ');
      item.append(txt('div', meta, 'dashCitedMeta'));
      list.append(item);
    }
    container.append(list);
  }
  // Up to four year-indexed series on one chart: SVG lines plus a legend, a text
  // crosshair readout reachable by hover and keyboard focus, and a table-view fallback.
  function trendChart(container, { series, formatValue = compactNumber, emptyText = 'No data for this selection.' }) {
    container.replaceChildren();
    const live = series.filter(s => s.points && s.points.length);
    if (!live.length || !live[0].points.length) { container.append(txt('p', emptyText, 'dashEmpty')); return; }
    const years = live[0].points.map(p => p.year);
    const maxValue = Math.max(1, ...live.flatMap(s => s.points.map(p => p.count)));
    const width = 640, height = 230, padL = 40, padB = 26, padT = 10, padR = live.length > 1 && live.length <= 4 ? 10 : 10;
    const plotW = width - padL - padR, plotH = height - padT - padB;
    const step = niceStep(maxValue), top = Math.ceil(maxValue / step) * step;
    const x = i => padL + (years.length === 1 ? plotW / 2 : (i / (years.length - 1)) * plotW);
    const y = v => padT + plotH - (v / top) * plotH;
    const wrap = el('div', 'dashChartWrap');
    if (live.length > 1) {
      const legend = el('div', 'dashLegend');
      live.forEach((s, i) => { const item = el('span', 'dashLegendItem'); const swatch = el('span', 'dashLegendSwatch'); swatch.style.background = SERIES[i % SERIES.length]; item.append(swatch, document.createTextNode(s.name)); legend.append(item); });
      wrap.append(legend);
    }
    const svg = node('svg'); svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height); svg.setAttribute('class', 'dashSvg'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Chart of ' + live.map(s => s.name).join(', ') + ' by year.');
    for (let g = 0; g <= 4; g++) {
      const v = (top / 4) * g, ln = node('svg:line');
      ln.setAttribute('x1', padL); ln.setAttribute('x2', width - padR); ln.setAttribute('y1', y(v)); ln.setAttribute('y2', y(v)); ln.setAttribute('class', 'dashGrid');
      svg.append(ln);
      const label = node('svg:text'); label.setAttribute('x', padL - 6); label.setAttribute('y', y(v) + 3); label.setAttribute('class', 'dashAxisLabel'); label.setAttribute('text-anchor', 'end'); label.textContent = formatValue(v);
      svg.append(label);
    }
    const tickEvery = years.length > 12 ? Math.ceil(years.length / 8) : 1;
    years.forEach((yr, i) => { if (i % tickEvery === 0 || i === years.length - 1) { const label = node('svg:text'); label.setAttribute('x', x(i)); label.setAttribute('y', height - 6); label.setAttribute('class', 'dashAxisLabel'); label.setAttribute('text-anchor', 'middle'); label.textContent = String(yr); svg.append(label); } });
    live.forEach((s, i) => {
      const color = SERIES[i % SERIES.length];
      const pts = s.points.map((p, j) => x(j) + ',' + y(p.count)).join(' ');
      const poly = node('svg:polyline'); poly.setAttribute('points', pts); poly.setAttribute('class', 'dashLine'); poly.setAttribute('stroke', color);
      svg.append(poly);
      const last = s.points[s.points.length - 1];
      const dot = node('svg:circle'); dot.setAttribute('cx', x(s.points.length - 1)); dot.setAttribute('cy', y(last.count)); dot.setAttribute('r', 5); dot.setAttribute('class', 'dashDot'); dot.setAttribute('fill', color);
      svg.append(dot);
      if (live.length <= 4) { const label = node('svg:text'); label.setAttribute('x', x(s.points.length - 1) + 6); label.setAttribute('y', y(last.count) - 7); label.setAttribute('class', 'dashEndLabel'); label.textContent = formatValue(last.count); svg.append(label); }
    });
    const tip = el('div', 'dashTooltip'); tip.hidden = true; wrap.append(svg, tip);
    years.forEach((yr, i) => {
      const hit = node('svg:rect'); const slice = plotW / Math.max(1, years.length);
      hit.setAttribute('x', x(i) - slice / 2); hit.setAttribute('y', padT); hit.setAttribute('width', slice); hit.setAttribute('height', plotH);
      hit.setAttribute('class', 'dashHit'); hit.setAttribute('tabindex', '0');
      const readout = String(yr) + ': ' + live.map(s => s.name + ' ' + formatValue(s.points[i].count)).join(', ');
      hit.setAttribute('aria-label', readout);
      const show = () => {
        tip.replaceChildren();
        tip.append(txt('div', String(yr), 'dashTooltipYear'));
        live.forEach((s, si) => { const row = el('div', 'dashTooltipRow'); const key = el('span', 'dashTooltipKey'); key.style.background = SERIES[si % SERIES.length]; row.append(key, txt('span', s.name + ' ', 'dashTooltipName'), txt('strong', formatValue(s.points[i].count))); tip.append(row); });
        tip.hidden = false; tip.style.left = Math.min(width - 150, Math.max(0, x(i) - 70)) / width * 100 + '%'; tip.style.top = '4px';
      };
      hit.addEventListener('pointerenter', show); hit.addEventListener('focus', show);
      hit.addEventListener('pointerleave', () => { tip.hidden = true; }); hit.addEventListener('blur', () => { tip.hidden = true; });
      svg.append(hit);
    });
    container.append(wrap);
    const details = el('details', 'dashTableView'); details.append(txt('summary', 'View as table'));
    const table = el('table'); const head = el('tr'); head.append(txt('th', 'Year'));
    live.forEach(s => head.append(txt('th', s.name))); const thead = el('thead'); thead.append(head); table.append(thead);
    const tbody = el('tbody');
    years.forEach((yr, i) => { const row = el('tr'); row.append(txt('td', String(yr))); live.forEach(s => row.append(txt('td', String(s.points[i].count)))); tbody.append(row); });
    table.append(tbody); details.append(table); container.append(details);
  }
  function statTile(container, { label, value, sub }) {
    container.replaceChildren();
    const tile = el('div', 'dashStat');
    tile.append(txt('span', label, 'dashStatLabel'), txt('strong', value, 'dashStatValue'));
    if (sub) tile.append(txt('span', sub, 'dashStatSub'));
    container.append(tile);
  }
  return { SERIES, compactNumber, barList, citedList, trendChart, statTile };
})();
