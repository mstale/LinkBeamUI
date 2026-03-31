/* ============================================================
   Link Beam STM Designer
   Based on: El-Zoughiby et al., Engineering Structures 299 (2024)
   ACI 318-19 Ch. 23 Strut-and-Tie Method
   BY: ST
   ============================================================ */

// ── Helpers ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const num = id => parseFloat($(id).value);
const fmt1 = v => v.toFixed(1);
const fmt2 = v => v.toFixed(2);
const fmt0 = v => Math.round(v).toLocaleString();
const rad  = deg => deg * Math.PI / 180;
const deg  = r   => r  * 180 / Math.PI;

// ── Main Calculation ─────────────────────────────────────────
function calculate() {
  // 1. Read inputs
  const l    = num('inp-l');      // mm
  const h    = num('inp-h');      // mm
  const b    = num('inp-b');      // mm
  const fc   = num('inp-fc');     // MPa
  const fy   = num('inp-fy');     // MPa
  const phi  = num('inp-phi');    // resistance factor
  const Vu   = num('inp-vu') * 1000; // kN → N
  const bs   = num('inp-bs');     // strut effectiveness
  const bc   = num('inp-bc');     // confinement
  const SR_t = num('inp-sr');     // target stress ratio
  const th_min = num('inp-thmin'); // deg

  // Validate
  if ([l,h,b,fc,fy,phi,Vu,bs,bc,SR_t,th_min].some(v => isNaN(v) || v <= 0)) {
    alert('Please fill all inputs with positive values.');
    return;
  }
  if (Vu <= 0) { alert('Vu must be > 0'); return; }

  // 2. Step 1: Bearing length lb  (Eq. 19)
  //    SR_t = Vu / (phi * 0.85*bc*bs*fc * lb*b)  → lb = Vu / (SR_t * phi * 0.85*bc*bs*fc * b)
  //    Paper writes it as:  lb = Vu / (0.45*fc*b)  where 0.45 = SR_t * phi * 0.85*bc*bs
  //    with SR_t=0.95, phi=0.75, bc=1, bs=0.75 → 0.95*0.75*0.85*1*0.75 = 0.4534 ≈ 0.45 ✓
  const k_lb = SR_t * phi * 0.85 * bc * bs;
  const lb   = Vu / (k_lb * fc * b);   // mm

  // 3. Step 2: Determine model type n  (Eq. 2)
  const n_raw = 0.5 * ((l + lb) / (h - 2*lb));
  let n = Math.ceil(n_raw);
  if (n < 1) n = 1;

  // 4. Step 3: Tie width wt  (Eq. 22)
  //    n*wt² - n*h*wt + lb*(l+lb) = 0
  const A = n;
  const B = -n * h;
  const C = lb * (l + lb);
  const disc = B*B - 4*A*C;
  if (disc < 0) {
    showError('Geometry infeasible: discriminant < 0. Try reducing Vu or adjusting dimensions.');
    return;
  }
  const wt = (-B - Math.sqrt(disc)) / (2*A);   // mm  (take the smaller root)

  // 5. Strut-tie angle θ  (Eq. 23)
  const theta = deg(Math.atan(lb / wt));          // degrees

  if (theta < th_min) {
    showError(`Strut angle θ = ${fmt1(theta)}° is below minimum ${th_min}°. App solved for n=${n}, but model is not valid. Consider higher n or different geometry.`);
    return;
  }

  // 6. Strut width ws  (Eq. 24)
  const ws = lb / Math.sin(rad(theta));           // mm

  // 7. STM Forces
  const Cu  = Vu / Math.sin(rad(theta));          // N   (Eq. 3)
  const Thu = n * (Cu / 2) * Math.cos(rad(theta)); // N  (Eq. 10)
  const Tvu = (n > 1) ? Vu : 0;                   // N  (Eq. 12) — only two-panel+
  const Mu  = 0.5 * Vu * (l + lb);               // N·mm (factored moment)
  const z   = h - wt;                             // lever arm mm

  // 8. Stress ratios
  const SRstrut = (Vu / Math.sin(rad(theta))) / (phi * 0.85 * bc * bs * fc * ws * b);
  const bn_node = 0.80;  // CCT node
  const SRnode  = Vu / (phi * 0.85 * bc * bn_node * fc * lb * b);

  // 9. Reinforcement
  const Asl = Thu / (phi * fy);   // mm²  (Eq. 11)
  const Asv = (n > 1) ? (Tvu / (phi * fy)) : 0;  // mm²  (Eq. 13)

  // 10. Confinement distributed reinforcement limits
  //     ACI 9.9.3.1: min ρ = 0.0025 in each direction
  //     Max spacing: 0.20*d  where d = h - 0.5*wt
  const d_eff  = h - 0.5 * wt;
  const s_max  = Math.min(0.20 * d_eff, 300);     // mm

  // ── Populate Results ────────────────────────────────────────
  const panel_labels = ['', 'One-Panel (Diagonal / Arch)', 'Two-Panel (Beam / Truss)'];
  const panel_label  = n <= 2 ? panel_labels[n] : `${n}-Panel`;

  // Banner
  const banner = $('model-banner');
  banner.classList.remove('banner-hidden', 'banner-show');
  const badge = $('model-badge');
  badge.className = '';
  if      (n === 1) badge.classList.add('badge-1panel');
  else if (n === 2) badge.classList.add('badge-2panel');
  else              badge.classList.add('badge-npanel');
  badge.textContent = `${n}-Panel Model`;
  $('model-desc').textContent = `n = ${fmt2(n_raw)} → use n = ${n}  |  θ = ${fmt1(theta)}° (min ${th_min}°)  |  ${panel_label}`;
  void banner.offsetWidth;
  banner.classList.add('banner-show');

  // Geometry card
  set('res-n',     n.toString());
  set('res-theta', fmt1(theta) + '°');
  set('res-lb',    fmt1(lb));
  set('res-wt',    fmt1(wt));
  set('res-ws',    fmt1(ws));
  set('res-z',     fmt1(z));

  // Forces card
  set('res-vu',  fmt0(Vu/1000) + ' kN');
  setUnit('res-vu', '');
  set('res-cu',  fmt0(Cu/1000));
  set('res-thu', fmt0(Thu/1000));
  set('res-tvu', (n > 1) ? fmt0(Tvu/1000) : 'N/A (1-panel)');
  set('res-mu',  fmt1(Mu/1e6));

  // SR card
  const srStrEl = $('res-sr-strut');
  const srNodEl = $('res-sr-node');
  srStrEl.textContent = fmt2(SRstrut);
  srNodEl.textContent = fmt2(SRnode);
  colorSR(srStrEl, SRstrut);
  colorSR(srNodEl, SRnode);

  renderSRBars([
    { label: 'Strut', val: SRstrut },
    { label: 'Node',  val: SRnode  },
  ]);

  // Rebar card
  set('res-asl', fmt0(Asl));
  if (n > 1) {
    set('res-asv', fmt0(Asv));
  } else {
    $('res-asv').textContent = 'N/A';
    $('res-asv').className = 'value value-ok';
  }
  // Indicative min rho checks (rough guide — user selects bar size)
  $('res-rho-v').textContent = 'ρ ≥ 0.0025';
  $('res-rho-h').textContent = 'ρ ≥ 0.0025';
  set('res-smax', fmt0(s_max));

  // Design Summary
  renderSummary({ n, l, Asl, Asv, s_max, fy });

  // STM Diagram
  drawSTM({ n, l, h, lb, wt, ws, theta, Cu, Thu, Tvu, Vu });
}

function showError(msg) {
  alert('Design Error:\n' + msg);
}

function set(id, val) {
  $(id).textContent = val;
}

function setUnit(_id, _u) {
  // no-op placeholder for symmetry
}

function colorSR(el, val) {
  el.classList.remove('value-ok','value-warn','value-fail');
  if      (val <= 0.85) el.classList.add('value-ok');
  else if (val <= 0.95) el.classList.add('value-warn');
  else                  el.classList.add('value-fail');
}

function renderSRBars(items) {
  const wrap = $('sr-bars-wrap');
  wrap.innerHTML = '';
  items.forEach(it => {
    const pct = Math.min(it.val * 100, 100);
    const color = it.val <= 0.85 ? '#10b981' : it.val <= 0.95 ? '#f59e0b' : '#ef4444';
    wrap.innerHTML += `
      <div class="sr-bar-row">
        <div class="sr-bar-label"><span>SR<sub>${it.label}</sub></span><span>${(it.val*100).toFixed(1)}%</span></div>
        <div class="sr-bar-track"><div class="sr-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
  });
}

function renderSummary({ n, l, Asl, Asv, s_max, fy }) {
  // Suggest bar arrangements
  const bar_areas = { T12:113, T16:201, T20:314, T22:380, T25:491, T28:616, T32:804, T36:1018, T40:1257 };

  function suggestBars(Areq) {
    if (Areq <= 0) return '—';
    for (const [name, a] of Object.entries(bar_areas)) {
      for (let count = 1; count <= 60; count++) {
        if (count * a >= Areq) return `${count}${name}  (A=${fmt0(count*a)} mm²)`;
      }
    }
    return `≥ ${fmt0(Areq)} mm²`;
  }

  function suggestStirrups(Areq, spacing) {
    if (Areq <= 0 || n === 1) return 'No vertical ties required (1-panel)';
    // Stirrups over central 0.5l
    const half_l = 0.5 * l;
    // number of stirrups to fit
    const n_stir = Math.ceil(half_l / spacing) + 1;
    for (const [name, a_bar] of Object.entries(bar_areas)) {
      // try 2-leg, 4-leg, 6-leg, 8-leg
      for (const legs of [2, 4, 6, 8]) {
        const A_per = legs * a_bar;
        const A_total = A_per * n_stir;
        if (A_total >= Areq) {
          return `${n_stir} × ${legs}-leg ${name} @ ${fmt0(spacing)} mm c/c (A=${fmt0(A_total)} mm²)`;
        }
      }
    }
    return `Total ${fmt0(Areq)} mm² distributed over central ${fmt0(half_l)} mm`;
  }

  const longText  = suggestBars(Asl);
  const stirText  = suggestStirrups(Asv, s_max);
  const horizNote = `T16 @ ${fmt0(Math.min(s_max, 175))} mm EF (ρ ≥ 0.0025)`;
  const anchorLd  = Math.round(1.0 * fy / (1.1 * Math.sqrt(36) * 1.0) * 25); // rough T25 development length

  $('sum-long').innerHTML = `
    <h4>Longitudinal Ties (each face)</h4>
    <div class="sum-main">${longText.split('(')[0].trim()}</div>
    <div class="sum-sub">A<sub>sl</sub> required = ${fmt0(Asl)} mm²<br>${longText.includes('(') ? longText.split('(')[1].replace(')','') : ''}</div>`;

  $('sum-trans').innerHTML = `
    <h4>Vertical Stirrups</h4>
    <div class="sum-main">${n === 1 ? 'Min. confinement only' : stirText.split('(')[0].trim()}</div>
    <div class="sum-sub">${n === 1 ? 'A<sub>sv</sub> not required — one-panel model' : `A<sub>sv</sub> req. = ${fmt0(Asv)} mm²<br>Distributed over central 0.5l = ${fmt0(0.5*l)} mm`}</div>`;

  $('sum-horiz').innerHTML = `
    <h4>Distributed Horiz. Web Steel</h4>
    <div class="sum-main">${horizNote}</div>
    <div class="sum-sub">ACI 9.9.3.1(b): ρ<sub>h</sub> ≥ 0.0025<br>Max spacing: ${fmt0(Math.min(s_max,300))} mm</div>`;

  $('sum-anchor').innerHTML = `
    <h4>Anchorage (each pier)</h4>
    <div class="sum-main">Straight bars into pier</div>
    <div class="sum-sub">Full development length l<sub>d</sub> required within wall pier<br>Min. ${fmt0(anchorLd)} mm (approx. — verify per ACI 25.5)</div>`;

  $('sum-note').innerHTML = `<strong>Note:</strong> Longitudinal reinforcement must be symmetric (top &amp; bottom) due to moment reversal from seismic loading. All ties to be anchored for full yield strength f<sub>y</sub> = ${fy} MPa at beam–pier interface.`;

  $('design-summary-placeholder').style.display = 'none';
  $('design-summary').style.display = 'block';
}

// ── STM Diagram Renderer ─────────────────────────────────────
function drawSTM({ n, l, h, lb, wt, ws, theta, Cu, Thu, Tvu, Vu }) {
  const svg = $('stm-svg');
  $('diagram-placeholder').style.display = 'none';
  svg.style.display = 'block';
  svg.innerHTML = '';

  // Canvas dimensions
  const W = 900, H = 380;
  const MARGIN = { top: 40, bottom: 60, left: 70, right: 70 };
  const dw = W - MARGIN.left - MARGIN.right;  // drawing width
  const dh = H - MARGIN.top  - MARGIN.bottom; // drawing height

  // Scale: map beam l×h → dw×dh, preserve aspect up to limits
  const scaleX = dw / (l + 2*lb);
  const scaleY = dh / h;
  const sc = Math.min(scaleX, scaleY) * 0.85;

  const bw = l * sc;   // beam span in px
  const bh = h * sc;   // beam height in px
  const lbp = lb * sc; // lb in px
  const wtp = wt * sc; // wt in px
  void (ws * sc); // ws scaled — reserved for future strut-width overlay

  // Centre the beam drawing on canvas
  const ox = (W - (bw + 2*lbp)) / 2;   // left edge of left wall
  const oy = (H - bh) / 2;             // top edge of beam

  // Convenience coords
  const wallW = lbp * 1.4;  // visual wall width
  const beamLeft  = ox + wallW;
  const beamRight = beamLeft + bw;
  const beamTop   = oy;
  const beamBot   = oy + bh;

  // (makeSVGEl is the low-level helper used throughout)

  // ── Hatch pattern (walls) ──
  svg.innerHTML += `
    <defs>
      <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" class="stm-hatch"/>
      </pattern>
    </defs>`;

  // ── Wall piers ──
  const wallH = bh * 1.3;
  const wallTop = oy + bh/2 - wallH/2;
  addRect(svg, ox,                  wallTop, wallW, wallH, 'stm-wall', 'url(#hatch)');
  addRect(svg, beamRight,           wallTop, wallW, wallH, 'stm-wall', 'url(#hatch)');
  // Wall pier labels
  addText(svg, ox + wallW/2, wallTop - 8, 'Wall pier', 'stm-dim-text', 'middle');
  addText(svg, beamRight + wallW/2, wallTop - 8, 'Wall pier', 'stm-dim-text', 'middle');

  // ── Beam body ──
  addRect(svg, beamLeft, beamTop, bw, bh, 'stm-beam-body');

  // ── Vertical load arrow (Vu at top-left) ──
  const arrowX = beamLeft + lbp/2;
  const arrowLen = 28;
  addArrowDown(svg, arrowX, beamTop - arrowLen, arrowLen, '#475569');
  addText(svg, arrowX, beamTop - arrowLen - 6, `Vᵤ = ${(Vu/1000).toFixed(0)} kN`, 'stm-label-force', 'middle');

  // ── Vertical load arrow (Vu at bottom-right, pointing up = reaction) ──
  const arrowX2 = beamRight - lbp/2;
  addArrowUp(svg, arrowX2, beamBot + arrowLen, arrowLen, '#475569');
  addText(svg, arrowX2, beamBot + arrowLen + 14, `Vᵤ`, 'stm-label-force', 'middle');

  if (n === 1) {
    drawOnePanel(svg, { beamLeft, beamRight, beamTop, beamBot, lbp, wtp, bw, bh, theta, Cu, Thu, sc });
  } else {
    drawTwoPanel(svg, { beamLeft, beamRight, beamTop, beamBot, lbp, wtp, bw, bh, theta, Cu, Thu, Tvu, sc });
  }

  // ── Dimension lines ──
  // Span l
  const dimY = beamBot + 36;
  addDimLine(svg, beamLeft, dimY, beamRight, dimY, `l = ${(l/1000).toFixed(3)} m`);
  // Depth h
  const dimX = ox - 28;
  addDimLineV(svg, dimX, beamTop, dimX, beamBot, `h = ${(h/1000).toFixed(3)} m`);
  // lb
  const dim2Y = beamBot + 14;
  addDimLine(svg, beamRight, dim2Y, beamRight + lbp, dim2Y, `lᵦ = ${lb.toFixed(0)}`);

  // ── Legend ──
  const legY = H - 18;
  const legItems = [
    { col: '#e05c2a', dash: '6 3', label: 'Compression strut' },
    { col: '#3b82f6', dash: '',    label: 'Horiz. tension tie' },
    { col: '#10b981', dash: '',    label: 'Vert. tension tie' },
    { col: '#f59e0b', dash: '',    label: 'Node', shape: 'circle' },
  ];
  let lx = 30;
  legItems.forEach(it => {
    if (it.shape === 'circle') {
      addCircle(svg, lx+6, legY, 5, it.col, '#b45309');
    } else {
      addLine(svg, lx, legY, lx+16, legY, it.col, it.dash ? it.dash : null, 2.5);
    }
    addText(svg, lx + 22, legY + 4, it.label, 'stm-dim-text', 'start');
    lx += 140;
  });
}

// ── One-panel drawing ──────────────────────────────────────────
function drawOnePanel(svg, { beamLeft, beamRight, beamTop, beamBot, lbp, wtp, theta, Cu, Thu, sc }) {
  // Node A: top-left  (at strut interface with top-left node)
  const Ax = beamLeft + lbp/2;
  const Ay = beamTop + wtp/2;

  // Node B: bottom-right
  const Bx = beamRight - lbp/2;
  const By = beamBot - wtp/2;

  // ── Inclined strut A→B (dashed) ──
  addLine(svg, Ax, Ay, Bx, By, '#e05c2a', '8 4', 3);
  // Strut label at midpoint
  const mx = (Ax+Bx)/2 - 14;
  const my = (Ay+By)/2 - 14;
  addText(svg, mx, my, `Cᵤ = ${(Cu/1000).toFixed(0)} kN`, 'stm-label-strut', 'end');

  // ── Horizontal tie top ──
  addLine(svg, Ax, Ay, Bx, Ay, '#3b82f6', null, 2.5);
  addText(svg, (Ax+Bx)/2, Ay - 8, `Tₕᵤ = ${(Thu/1000).toFixed(0)} kN`, 'stm-label-tie-h', 'middle');

  // ── Horizontal tie bottom ──
  addLine(svg, Ax, By, Bx, By, '#3b82f6', null, 2.5);
  addText(svg, (Ax+Bx)/2, By + 14, `Tₕᵤ = ${(Thu/1000).toFixed(0)} kN`, 'stm-label-tie-h', 'middle');

  // ── Nodes ──
  addCircle(svg, Ax, Ay, 7, '#f59e0b', '#b45309');
  addCircle(svg, Bx, By, 7, '#f59e0b', '#b45309');
  addText(svg, Ax - 12, Ay - 10, 'A', 'stm-label-node', 'middle');
  addText(svg, Bx + 12, By + 16, 'B', 'stm-label-node', 'middle');

  // ── Node type labels ──
  addText(svg, Ax + 10, Ay - 14, 'CCT', 'stm-dim-text', 'start');
  addText(svg, Bx - 10, By + 22, 'CCT', 'stm-dim-text', 'end');

  // ── Angle arc at node B ──
  drawAngleArc(svg, Bx, By, 30, 180 + theta, 180, `θ=${theta.toFixed(1)}°`);

  // ── wt dimension ──
  const wtLeft = beamLeft;
  addBrace(svg, wtLeft - 8, beamTop, wtLeft - 8, beamTop + wtp, '#94a3b8');
  addText(svg, wtLeft - 12, beamTop + wtp/2, `wₜ=${Math.round(wtp/sc)}`, 'stm-dim-text', 'end');
}

// ── Two-panel drawing ──────────────────────────────────────────
function drawTwoPanel(svg, { beamLeft, beamRight, beamTop, beamBot, lbp, wtp, bw, theta, Thu, Tvu, sc }) {
  // Midpoint of beam
  const midX = beamLeft + bw/2;

  // Node A: top-left CCC
  const Ax = beamLeft + lbp/2;
  const Ay = beamTop + wtp/2;

  // Node B: bottom-right CCC
  const Bx = beamRight - lbp/2;
  const By = beamBot - wtp/2;

  // Node C: top-centre CTT
  const Cx = midX;
  const Cy = beamTop + wtp/2;

  // Node D: bottom-centre CTT
  const Dx = midX;
  const Dy = beamBot - wtp/2;

  // ── Strut A→D (left inclined) ──
  addLine(svg, Ax, Ay, Dx, Dy, '#e05c2a', '8 4', 3);
  addText(svg, (Ax+Dx)/2 - 16, (Ay+Dy)/2, `Cᵤ`, 'stm-label-strut', 'end');

  // ── Strut C→B (right inclined) ──
  addLine(svg, Cx, Cy, Bx, By, '#e05c2a', '8 4', 3);
  addText(svg, (Cx+Bx)/2 + 16, (Cy+By)/2, `Cᵤ`, 'stm-label-strut', 'start');

  // ── Vertical tie D→C ──
  addLine(svg, Dx, Dy, Cx, Cy, '#10b981', null, 2.5);
  addText(svg, midX + 8, (Cy+Dy)/2, `Tᵥᵤ = ${(Tvu/1000).toFixed(0)} kN`, 'stm-label-tie-v', 'start');

  // ── Horizontal tie top A→B ──
  addLine(svg, Ax, Ay, Bx, Ay, '#3b82f6', null, 2.5);
  addText(svg, (Ax+Bx)/2, Ay - 8, `Tₕᵤ = ${(Thu/1000).toFixed(0)} kN`, 'stm-label-tie-h', 'middle');

  // ── Horizontal tie bottom A→B ──
  addLine(svg, Ax, By, Bx, By, '#3b82f6', null, 2.5);
  addText(svg, (Ax+Bx)/2, By + 14, `Tₕᵤ = ${(Thu/1000).toFixed(0)} kN`, 'stm-label-tie-h', 'middle');

  // ── Nodes ──
  const nodes = [
    { x: Ax, y: Ay, lbl: 'A', type: 'CCC', dx: -14, dy: -12 },
    { x: Bx, y: By, lbl: 'B', type: 'CCC', dx:  14, dy:  18 },
    { x: Cx, y: Cy, lbl: 'C', type: 'CTT', dx:   0, dy: -14 },
    { x: Dx, y: Dy, lbl: 'D', type: 'CTT', dx:   0, dy:  16 },
  ];
  nodes.forEach(nd => {
    addCircle(svg, nd.x, nd.y, 7, '#f59e0b', '#b45309');
    addText(svg, nd.x + nd.dx, nd.y + nd.dy, nd.lbl, 'stm-label-node', 'middle');
    addText(svg, nd.x + nd.dx * 1.6, nd.y + nd.dy * 1.8, nd.type, 'stm-dim-text', 'middle');
  });

  // ── Angle arc at node D ──
  drawAngleArc(svg, Dx, Dy, 28, 270, 270 + theta, `θ=${theta.toFixed(1)}°`);

  // ── wt indicator ──
  addBrace(svg, beamLeft - 8, beamTop, beamLeft - 8, beamTop + wtp, '#94a3b8');
  addText(svg, beamLeft - 12, beamTop + wtp/2, `wₜ=${Math.round(wtp/sc)}`, 'stm-dim-text', 'end');
}

// ── SVG primitive helpers ──────────────────────────────────────
function makeSVGEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
  return el;
}

function addRect(svg, x, y, w, h, cls, fill) {
  const el = makeSVGEl('rect', { x, y, width: w, height: h, class: cls });
  if (fill) el.setAttribute('fill', fill);
  svg.appendChild(el);
}

function addLine(svg, x1, y1, x2, y2, stroke, dasharray, sw) {
  const attrs = { x1, y1, x2, y2, stroke: stroke || '#333', 'stroke-width': sw || 1.5 };
  if (dasharray) attrs['stroke-dasharray'] = dasharray;
  attrs.fill = 'none';
  svg.appendChild(makeSVGEl('line', attrs));
}

function addText(svg, x, y, text, cls, anchor) {
  const el = makeSVGEl('text', { x, y, class: cls, 'text-anchor': anchor || 'middle' });
  el.textContent = text;
  svg.appendChild(el);
}

function addCircle(svg, cx, cy, r, fill, stroke) {
  svg.appendChild(makeSVGEl('circle', { cx, cy, r, fill: fill||'#f59e0b', stroke: stroke||'#b45309', 'stroke-width': 1.5 }));
}

function addArrowDown(svg, x, y, len, color) {
  addLine(svg, x, y, x, y+len, color, null, 1.8);
  const tip = `${x},${y+len} ${x-5},${y+len-8} ${x+5},${y+len-8}`;
  const el = makeSVGEl('polygon', { points: tip, fill: color });
  svg.appendChild(el);
}

function addArrowUp(svg, x, y, len, color) {
  addLine(svg, x, y, x, y-len, color, null, 1.8);
  const tip = `${x},${y-len} ${x-5},${y-len+8} ${x+5},${y-len+8}`;
  const el = makeSVGEl('polygon', { points: tip, fill: color });
  svg.appendChild(el);
}

function addDimLine(svg, x1, y, x2, y2, label) {
  const yy = (y + y2) / 2;
  addLine(svg, x1, yy, x2, yy, '#94a3b8', '3 2', 1);
  // end ticks
  addLine(svg, x1, yy-5, x1, yy+5, '#94a3b8', null, 1);
  addLine(svg, x2, yy-5, x2, yy+5, '#94a3b8', null, 1);
  addText(svg, (x1+x2)/2, yy+14, label, 'stm-dim-text', 'middle');
}

function addDimLineV(svg, x, y1, x2, y2, label) {
  const xx = (x+x2)/2;
  addLine(svg, xx, y1, xx, y2, '#94a3b8', '3 2', 1);
  addLine(svg, xx-5, y1, xx+5, y1, '#94a3b8', null, 1);
  addLine(svg, xx-5, y2, xx+5, y2, '#94a3b8', null, 1);
  const el = makeSVGEl('text', { x: xx-8, y: (y1+y2)/2, class: 'stm-dim-text',
    'text-anchor': 'middle', transform: `rotate(-90,${xx-8},${(y1+y2)/2})` });
  el.textContent = label;
  svg.appendChild(el);
}

function addBrace(svg, x, y1, x2, y2, color) {
  // simple vertical bracket
  addLine(svg, x, y1, x2, y1, color, null, 1);
  addLine(svg, x, y2, x2, y2, color, null, 1);
  addLine(svg, (x+x2)/2, y1, (x+x2)/2, y2, color, null, 1);
}

function drawAngleArc(svg, cx, cy, r, startDeg, endDeg, label) {
  const s = rad(startDeg), e = rad(endDeg);
  const x1 = cx + r * Math.cos(s);
  const y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e);
  const y2 = cy + r * Math.sin(e);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
  const el = makeSVGEl('path', { d, class: 'stm-angle-arc' });
  svg.appendChild(el);
  const midA = rad((startDeg + endDeg) / 2);
  addText(svg, cx + (r+12) * Math.cos(midA), cy + (r+12) * Math.sin(midA) + 4, label, 'stm-angle-text', 'middle');
}

// ── Auto-calculate on load with default values ────────────────
window.addEventListener('DOMContentLoaded', () => {
  calculate();
});
