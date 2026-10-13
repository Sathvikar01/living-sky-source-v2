(() => {
"use strict";
const D = document, root = D.documentElement;
const $ = (s, el = D) => el.querySelector(s), $$ = (s, el = D) => [...el.querySelectorAll(s)];
// Read geometry together before animated styles are written. The snapshot lasts
// only for this frame, so scrolling, resizing and spring transforms stay current.
let frameRects = null, frameSizes = null;
const rectOf = (n) => frameRects && frameRects.has(n) ? frameRects.get(n) : n.getBoundingClientRect();
const mq = (q) => { try { return matchMedia(q).matches; } catch (e) { return false; } };
const RM = mq("(prefers-reduced-motion: reduce)");
const FINE = mq("(pointer: fine)") && mq("(hover: hover)");
const SMALL = mq("(max-width: 720px)");
const MOBILE = SMALL || !FINE;
root.classList.add("js");
if (RM) root.classList.add("rm");
if (FINE) root.classList.add("brush");
try {
  const br = navigator.userAgentData && navigator.userAgentData.brands;
  if (br && br.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand))) root.classList.add("lgsvg");
} catch (e) {}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const extA = (l) => (l.external ? ' target="_blank" rel="noopener noreferrer"' : "");

/* ================= procedural brush mask ================= */
(function brushMask() {
  const c = D.createElement("canvas"); c.width = 1400; c.height = 90;
  const g = c.getContext("2d"); if (!g) return;
  g.fillStyle = "#000"; g.fillRect(0, 0, 560, 90);
  for (let y = 0; y < 90; y += 1.5) {
    const edge = 560 + 150 * (0.5 + 0.5 * Math.sin(y * 0.21) * Math.cos(y * 0.07)) + Math.random() * 120;
    const grd = g.createLinearGradient(540, 0, edge, 0);
    const a = 0.75 + Math.random() * 0.25;
    grd.addColorStop(0, `rgba(0,0,0,${a})`); grd.addColorStop(0.82, `rgba(0,0,0,${a * 0.85})`); grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd; g.fillRect(540, y, edge - 540, 1.6);
  }
  try { root.style.setProperty("--brush", `url(${c.toDataURL("image/png")})`); } catch (e) { root.classList.add("rm"); }
})();

/* ================= icons & emblems ================= */
/* One stroke system for every drawn mark: 1.6 units on a 48 grid (0.8 on 24), round caps and joins,
   ink in currentColor, the domain colour as a watercolour wash plus botanical accents. Strokes marked
   .dr draw themselves on when their card is revealed; small parts loop gently (sway, breathe, spin). */
const ICON = {
  GitHub: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>',
  LinkedIn: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.5 0h3.83v1.5h.06c.53-1 1.84-2.05 3.79-2.05 4.05 0 4.8 2.67 4.8 6.13v5.42h-4v-4.8c0-1.15-.02-2.62-1.6-2.62-1.6 0-1.84 1.25-1.84 2.54v4.88h-4v-11Z"/></svg>',
  Email: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.6 5.4h14.8a2.1 2.1 0 0 1 2.1 2.1v9a2.1 2.1 0 0 1-2.1 2.1H4.6a2.1 2.1 0 0 1-2.1-2.1v-9a2.1 2.1 0 0 1 2.1-2.1Z"/><path d="m3.3 6.7 7.3 5.8a2.3 2.3 0 0 0 2.8 0l7.3-5.8"/><path d="M16.2 16.9c.1-1.7 1.3-2.8 3.1-2.9-.1 1.7-1.3 2.8-3.1 2.9Z" fill="currentColor" stroke="none" opacity=".75"/></svg>',
  X: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.2h1.7L7.4 4.73H5.58L16.67 19.2Z"/></svg>',
  Close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6.4 6.9c3.7 3.2 7.4 6.9 11.1 10.5"/><path d="M17.5 6.5c-3.5 3.7-7.2 7.4-11 10.9"/></svg>',
};
const DOMAIN_COLOR = { ai: "#7fd1ae", product: "#f0b44c", systems: "#6fa8c7", xr: "#b996ea", graphics: "#ec7f62", toolkit: "#6FA8C7", simulation: "#ef5b3a" };
const f1 = (v) => (Math.round(v * 10) / 10).toString();
/* a soft irregular watercolour blob (deterministic) */
function blob(cx, cy, r, seed, n = 7) {
  let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const P = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd() * 0.4, rr = r * (0.82 + rnd() * 0.3); P.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92]); }
  let d = `M${f1(P[0][0])} ${f1(P[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d + "Z";
}
const dr = (d, i = 0, extra = "") => `<path class="dr" pathLength="1" style="--i:${i}" d="${d}" ${extra}/>`;
/* a leaf with a midrib, base at (x,y), pointing along angle (deg, 0 = up), swaying from its base */
const leafP = (len, w) => `M0 0C${f1(w)} ${f1(-len * 0.28)} ${f1(w * 0.85)} ${f1(-len * 0.8)} 0 ${f1(-len)}C${f1(-w * 0.85)} ${f1(-len * 0.8)} ${f1(-w)} ${f1(-len * 0.28)} 0 0Z`;
const leaf = (x, y, len, ang, a, delay = 0, op = 0.9) => `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${ang})"><g class="sway" style="--sd:${delay}s"><path d="${leafP(len, len * 0.36)}" fill="${a}" fill-opacity="${op}" stroke="none"/><path d="M0 -.6V${f1(-len * 0.78)}" stroke="#0d1410" stroke-opacity=".35" stroke-width=".7"/></g></g>`;
function emblem(p) {
  const a = DOMAIN_COLOR[p.domain] || "#f3bf55";
  const seed = [...p.id].reduce((s, c) => s + c.charCodeAt(0), 0);
  const wash = (cx, cy, r) => `<g class="wash"><path d="${blob(cx, cy, r, seed)}" fill="${a}" fill-opacity=".2" stroke="none"/><path d="${blob(cx + 2.5, cy + 2, r * 0.62, seed + 7)}" fill="${a}" fill-opacity=".16" stroke="none"/></g>`;
  const S = (inner) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  switch (p.id) {
    case "triage": return S(wash(24, 25, 15) +
      dr("M24 6.5C29 9 33.8 9.7 38.5 9.9C38.8 22.2 34.4 34.6 24 41.5C13.6 34.6 9.2 22.2 9.5 9.9C14.2 9.7 19 9 24 6.5Z", 0) +
      dr("M24 36.5C24 31 24 27 24 22.5", 1) + dr("M24 27.5C21.6 24.6 18.8 22.6 15.8 20", 2) + dr("M24 27.5C26.4 24.6 29.2 22.6 32.2 20", 2) + dr("M24 22.5V16.8", 3) +
      leaf(15.8, 20, 6.2, -52, a, 0) + leaf(32.2, 20, 6.2, 52, a, -1.8) +
      `<circle class="breathe" cx="24" cy="14.6" r="2.3" fill="${a}" stroke="none"/>` + dr("M17.5 32.5h3.6M26.9 32.5h3.6", 4, `stroke-opacity=".55"`));
    case "evidence": return S(wash(22, 24, 14) +
      dr("M11 8.5h14.8l6.2 6.2V37a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V10.5a2 2 0 0 1 2-2Z", 0) + dr("M25.8 8.5v6.2H32", 1) +
      dr("M13.6 17.2h8.2M13.6 21.6h10.4M13.6 26h5.6", 2, `stroke-opacity=".6"`) +
      `<g class="bob"><path d="M37.2 30.6a7.6 7.6 0 1 1-15.2 0a7.6 7.6 0 1 1 15.2 0Z" fill="${a}" fill-opacity=".18" stroke="none"/>` +
      dr("M37.2 30.6a7.6 7.6 0 1 1-15.2 0a7.6 7.6 0 1 1 15.2 0Z", 3) + dr("M35.2 36.2 41.6 42.6", 4, `stroke-width="2.6"`) +
      dr("M25.4 34c2-3.6 5-5.6 8.6-6.3M28.2 32.1l-.7-2.5M30.8 30.1l-.3-2.3M28.9 31.5l2.3.5", 5, `stroke="${a}" stroke-width="1.2"`) +
      `<path d="M32.6 26.4a5 5 0 0 1 2.6 2.6" stroke="#fff" stroke-opacity=".6" stroke-width="1"/></g>`);
    case "cardsense": return S(wash(22, 29, 14) +
      `<g transform="rotate(-9 20 23)" opacity=".6">${dr("M8 15h22a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V18a3 3 0 0 1 3-3Z", 0)}</g>` +
      `<path d="M14 21.5h24a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3v-12a3 3 0 0 1 3-3Z" fill="${a}" fill-opacity=".16" stroke="none"/>` +
      dr("M14 21.5h24a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3v-12a3 3 0 0 1 3-3Z", 1) + dr("M11 27h30", 2, `stroke-opacity=".7"`) +
      dr("M15.6 31h5.2v4.2h-5.2Z", 3, `stroke-width="1.2"`) + dr("M24.5 34.6c2.4-.2 3.9-2.3 6.2-2.6", 3, `stroke="${a}" stroke-width="1.3"`) +
      dr("M34 21.5c-.2-4.2.6-7.8 2.8-10.8", 4, `stroke="${a}"`) + leaf(36.8, 10.7, 6.4, 38, a, 0) + leaf(34.3, 16.2, 5.2, -58, a, -2.2));
    case "sunroom": {
      let rays = ""; for (let i = 0; i < 8; i++) { const t = (i / 8) * Math.PI * 2; rays += `M${f1(24 + Math.cos(t) * 4.8)} ${f1(26 + Math.sin(t) * 4.8)}L${f1(24 + Math.cos(t) * 6.7)} ${f1(26 + Math.sin(t) * 6.7)}`; }
      return S(wash(24, 26, 15) +
        dr("M21.2 14.6C16.4 19 13.4 24 12.6 29.6", 1, `stroke-opacity=".75"`) + dr("M26.8 14.6C31.6 19 34.6 24 35.4 29.6", 1, `stroke-opacity=".75"`) + dr("M16.4 35C21.2 37.2 26.8 37.2 31.6 35", 2, `stroke-opacity=".75"`) +
        leaf(14.2, 23, 4.4, -70, a, -1) + leaf(33.8, 23, 4.4, 70, a, -3) + leaf(24, 36.6, 4.2, 180, a, -2) +
        [[24, 11], [12.6, 33.6], [35.4, 33.6]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4.2" fill="${a}" fill-opacity=".32" stroke="none"/>` + dr(`M${x + 4.2} ${y}a4.2 4.2 0 1 1-8.4 0a4.2 4.2 0 1 1 8.4 0Z`, 0)).join("") +
        `<circle class="breathe" cx="24" cy="11" r="6.6" stroke="${a}" stroke-opacity=".55" stroke-width="1"/>` +
        `<circle cx="24" cy="26" r="3" fill="${a}" stroke="none"/><path class="spin" d="${rays}" stroke="${a}" stroke-width="1.3"/>`);
    }
    case "singularity": {
      let pet = "", dots = "";
      for (let i = 0; i < 5; i++) {
        const t = -Math.PI / 2 + (i * 2 * Math.PI) / 5, c = Math.cos(t), s = Math.sin(t), nx = -s, ny = c;
        const tip = [24 + 16 * c, 24 + 16 * s], b1 = [24 + 5 * c + 4.2 * nx, 24 + 5 * s + 4.2 * ny], b2 = [24 + 5 * c - 4.2 * nx, 24 + 5 * s - 4.2 * ny];
        const q1 = [24 + 13 * c + 5.4 * nx, 24 + 13 * s + 5.4 * ny], q2 = [24 + 13 * c - 5.4 * nx, 24 + 13 * s - 5.4 * ny];
        const d = `M${f1(b1[0])} ${f1(b1[1])}C${f1(q1[0])} ${f1(q1[1])} ${f1(tip[0] + 1.5 * nx)} ${f1(tip[1] + 1.5 * ny)} ${f1(tip[0])} ${f1(tip[1])}C${f1(tip[0] - 1.5 * nx)} ${f1(tip[1] - 1.5 * ny)} ${f1(q2[0])} ${f1(q2[1])} ${f1(b2[0])} ${f1(b2[1])}`;
        pet += `<path d="${d}Z" fill="${a}" fill-opacity="${(0.14 + 0.06 * i).toFixed(2)}" stroke="none"/>` + dr(d, i);
        dots += `<circle class="breathe" style="--sd:${(-i * 0.7).toFixed(1)}s" cx="${f1(tip[0])}" cy="${f1(tip[1])}" r="1.9" fill="${a}" stroke="none"/>`;
      }
      return S(wash(24, 24, 15) + `<g class="spin" style="animation-duration:60s;transform-box:view-box;transform-origin:24px 24px">${pet}${dots}</g><circle class="breathe" cx="24" cy="24" r="4.4" fill="${a}" stroke="none"/><circle cx="24" cy="24" r="4.4"/>`);
    }
    case "eternal": return S(wash(24, 21, 14) +
      `<circle class="breathe" cx="24" cy="17" r="11" stroke="${a}" stroke-opacity=".5" stroke-width="1"/><circle cx="24" cy="17" r="8.6" fill="#10131c" fill-opacity=".6" stroke="none"/>` +
      dr("M32.6 17a8.6 8.6 0 1 1-17.2 0a8.6 8.6 0 1 1 17.2 0Z", 0, `stroke="${a}"`) + `<path d="M18.6 12.4a7 7 0 0 1 4.2-3" stroke="#fff" stroke-opacity=".55" stroke-width="1"/>` +
      dr("M11.5 42 32.6 20.6", 1) + dr("M36.5 42 15.4 20.6", 1) + dr("M14.4 35.6l4 4M33.6 35.6l-4 4", 2) +
      dr("M6 43.2h36", 3, `stroke-opacity=".55"`) + dr("M8.6 43.2c.4-2 1.3-3.2 2.6-3.8M10.6 43.2c.1-1.3.6-2.2 1.4-2.7M39.4 43.2c-.4-2-1.3-3.2-2.6-3.8M37.4 43.2c-.1-1.3-.6-2.2-1.4-2.7", 4, `stroke="${a}" stroke-width="1.2"`) +
      `<path class="breathe" d="M24 27.6l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z" fill="${a}" stroke="none"/>`);
    case "sketch": return S(`<g class="wash"><path d="M24 7c8.8 0 14.5 7.6 14.5 17S32.8 41 24 41Z" fill="${a}" fill-opacity=".3" stroke="none"/><path d="${blob(29, 26, 8, seed)}" fill="${a}" fill-opacity=".14" stroke="none"/></g>` +
      dr("M24 7C15.2 7 9.5 14.6 9.5 24S15.2 41 24 41", 0) + dr("M24 7c8.8 0 14.5 7.6 14.5 17S32.8 41 24 41", 0) +
      dr("M12.6 18.4l4.8-4.8M11.4 24.4l8-8M11.9 30l8.6-8.6M13.8 34.6l7.6-7.6M17.4 37.6l4.6-4.6", 1, `stroke-opacity=".5" stroke-width="1"`) +
      dr("M24 7v34", 2, `stroke-opacity=".45" stroke-width="1"`) +
      `<circle cx="17.6" cy="21.4" r="1.5" fill="currentColor" stroke="none"/><circle cx="30.4" cy="21.4" r="1.5" fill="currentColor" stroke="none"/>` +
      dr("M19.4 31c3 2.1 6.2 2.1 9.2 0", 3) + `<path class="scan" d="M24 4.5v39" stroke="${a}" stroke-opacity=".75" stroke-width="1.2"/>`);
    case "skills": {
      const L = [[16.6, 38.6, 6.4, -64], [18.6, 36.6, 6.2, 34], [19.6, 33.8, 6, -66], [21.4, 31.6, 5.8, 32], [21.8, 28.6, 5.4, -68], [23.2, 26.4, 5.2, 30], [23.4, 23.4, 4.6, -70], [24.4, 21.2, 4.4, 28], [24.6, 18.2, 3.8, -72], [25.6, 16, 3.6, 24]];
      return S(wash(24, 26, 15) +
        dr("M13.6 42.4C19.8 34.6 23 26.4 24.6 18.2C25.6 12.8 29.6 9.2 33.6 10.6C36.6 11.7 36.7 15.7 33.7 16.5C31.5 17.1 30.3 14.7 31.9 13.6", 0) +
        L.map(([x, y, l, ang], i) => leaf(x, y, l, ang, a, (-i * 0.45).toFixed(2), 0.55 + (i % 3) * 0.15)).join("") +
        [[36.5, 22], [38.4, 26.6], [35, 30.6], [39.6, 33], [31.2, 34.4], [36.2, 37.8], [40.4, 40.2], [30.4, 40.4], [34.4, 43]].map(([x, y], i) => `<circle class="breathe" style="--sd:${(-i * 0.4).toFixed(1)}s" cx="${x}" cy="${y}" r="1.25" fill="${a}" stroke="none" opacity=".85"/>`).join(""));
    }
    case "fire": return S(wash(24, 26, 15) +
      dr("M41 30.5V40H7V12h34v10.5", 0) + dr("M7 26.2h11.6M27.4 12v8", 1, `stroke-opacity=".55"`) +
      `<g class="flick"><path d="M17.2 38.4c-4.2 0-6.6-3-6.1-6.4.4-2.6 2.4-4.1 3.2-6.9 1.6 1.6 2 3.2 1.8 4.6 1.4-1.4 2.4-3.6 2-6.2 3.2 2 6.6 5.6 6.4 9.6-.2 3-3 5.3-7.3 5.3Z" fill="${a}" fill-opacity=".55" stroke="${a}" stroke-width="1.3"/><path d="M17.4 37.6c-1.7 0-2.6-1.2-2.3-2.6.2-1 1-1.7 1.3-2.8 1.6 1 2.9 2.4 2.8 3.8-.1 1-.8 1.6-1.8 1.6Z" fill="#fff3c4" fill-opacity=".8" stroke="none"/></g>` +
      `<path class="flow" pathLength="1" d="M24.6 33.4C28.6 33.4 30.6 29.6 33.4 27.4S38.4 26.3 44 26.3" stroke="${a}" stroke-width="1.6"/>` + dr("M41.2 23.6l3 2.7-3 2.7", 3, `stroke="${a}"`));
    default: return S(wash(24, 24, 14) + `<circle cx="24" cy="24" r="6" fill="${a}" stroke="none"/>`);
  }
}
/* small animated sky glyph for the readout pill */
function skyGlyph(phase, cond) {
  const night = phase === "night" || phase === "blue" || phase === "dusk";
  const low = phase === "dawn" || phase === "sunset" || phase === "golden";
  let rays = ""; for (let i = 0; i < 8; i++) { const t = (i / 8) * Math.PI * 2; rays += `M${f1(10 + Math.cos(t) * 5.6)} ${f1(9 + Math.sin(t) * 5.6)}L${f1(10 + Math.cos(t) * 7.4)} ${f1(9 + Math.sin(t) * 7.4)}`; }
  let body = night
    ? `<path d="M13.6 12.6A6 6 0 1 1 8.2 3.4a4.8 4.8 0 0 0 5.4 9.2Z" fill="currentColor" stroke="none"/><path class="breathe" d="M15.6 3.2l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5Z" fill="currentColor" stroke="none"/>`
    : low
      ? `<clipPath id="skc"><rect x="0" y="-4" width="20" height="16"/></clipPath><g clip-path="url(#skc)"><circle cx="10" cy="12" r="4.4" fill="currentColor" stroke="none"/><path class="spin" style="transform-origin:10px 12px;transform-box:view-box" d="${rays.replace(/ 9/g, " 12")}" stroke="currentColor" stroke-width="1.4"/></g><path d="M2 12.6h16" stroke="currentColor" stroke-width="1.4"/>`
      : `<circle cx="10" cy="9" r="3.8" fill="currentColor" stroke="none"/><path class="spin" style="transform-origin:10px 9px;transform-box:view-box" d="${rays}" stroke="currentColor" stroke-width="1.4"/>`;
  const cloud = `<path d="M6.2 17.6h8.6a3.3 3.3 0 0 0 .3-6.6 4.6 4.6 0 0 0-8.8 1.4 2.6 2.6 0 0 0-.1 5.2Z" fill="var(--glass2)" stroke="var(--ink)" stroke-width="1.3"/>`;
  if (cond === "cloudy") body += cloud;
  else if (cond === "drizzle" || cond === "rain") body += cloud + `<path class="flow" pathLength="1" d="M7.4 19.6l-.8 2M10.6 19.6l-.8 2M13.8 19.6l-.8 2" stroke="var(--ink)" stroke-width="1.3"/>`;
  else if (cond === "storm") body += cloud + `<path class="breathe" d="M10.8 17.4l-2.2 3.4h2.4l-1.4 3" stroke="currentColor" stroke-width="1.4" fill="none"/>`;
  else if (cond === "fog") body += `<path d="M3 14.6h14M5 17.6h11M3.6 20.6h12" stroke="var(--ink)" stroke-width="1.3" stroke-opacity=".8"/>`;
  else if (cond === "snow") body += cloud + `<circle cx="7.6" cy="20.6" r=".9" fill="var(--ink)"/><circle cx="11" cy="21.6" r=".9" fill="var(--ink)"/><circle cx="14.2" cy="20.4" r=".9" fill="var(--ink)"/>`;
  return `<svg viewBox="0 0 20 22" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/* ================= render content ================= */
const SHOWN = PROJECTS.filter((p) => p.id !== "toolkit");
const KIT = PROJECTS.find((p) => p.id === "toolkit");
const metricsDef = [
  { v: 15, txt: "15", l: "partitions" },
  { v: 22413, txt: "22,413", l: "chunks", fmt: (x) => Math.round(x).toLocaleString("en-US") },
  { v: 0.39, txt: "0.39", u: "ms", l: "P50 retrieval", d: 2 },
  { v: 0.8908, txt: "0.8908", l: "Recall@10", d: 4 },
  { v: 0.5371, txt: "0.5371", l: "MRR@10", d: 4 },
];
const statusHTML = (p) => p.status.map((s) => `<span class="status ${esc(s.kind)}">${esc(s.label)}</span>`).join("");
const [first, ...rest] = PERSON.name.split(" ");

$("#scroller").innerHTML = `
<section id="hero" aria-label="Introduction"><div class="wrap">
  <p class="greet rv" id="greet" style="--rd:.15s"><span id="greet-a">Hello</span><b id="greet-b"></b></p>
  <h1 class="name"><span class="sr">${esc(PERSON.name)}</span><span class="rv" aria-hidden="true" style="--rd:.3s">${esc(first)}</span><span class="rv" aria-hidden="true" style="--rd:.55s">${esc(rest.join(" "))}</span></h1>
  <div class="hero-card glass refract rv" style="--rd:.8s">
    <p class="role">${esc(PERSON.role)}</p>
    <p class="statement">${esc(ABOUT.statement)}</p>
    <p class="place">${esc(PERSON.place)}</p>
    <div class="btns">${LANDING_LINKS.map((l, i) => `<a class="btn glass jelly${i === 0 ? " primary" : ""}" href="${esc(l.href)}"${extA(l)}>${ICON[l.label] || ""}${esc(l.label)}</a>`).join("")}</div>
  </div>
</div><div class="scrollhint" aria-hidden="true"><i></i>Scroll</div></section>

<section id="about" aria-labelledby="h-about"><div class="wrap">
  <p class="kicker rv">01 · About</p>
  <h2 class="sec rv" id="h-about">About</h2>
  <div class="about-grid">
    <div class="glass panel lead refract rv">${ABOUT.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    ${ABOUT.education.map((e) => `<div class="glass panel edu rv" style="--rd:.15s">
      <div class="yrs"><span>${esc(e.years)}</span>${e.current ? '<span class="now">Now</span>' : ""}</div>
      <h3>${esc(e.place)}</h3><p class="stage">${esc(e.stage)}</p><p class="loc">${esc(e.location)}</p>
      <ul class="chips">${e.coursework.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>`).join("")}
  </div>
  <div class="hl">${ABOUT.highlights.map((h, i) => `<div class="glass jelly rv" style="--rd:${(i * 0.09).toFixed(2)}s"><b>${esc(h.lead)}</b><span>${esc(h.detail)}</span></div>`).join("")}</div>
  <p class="closing rv">${esc(ABOUT.closing)}</p>
</div></section>

<section id="anvaya" aria-labelledby="h-anvaya"><div class="wrap">
  <p class="kicker rv">02 · Featured</p>
  <article class="glass feat refract rv">
    <div class="feat-top"><span>${esc(EXPERIENCE.org)}</span><span>${esc(EXPERIENCE.year)}</span></div>
    <h3 id="h-anvaya">${esc(EXPERIENCE.name)}</h3>
    <div class="narr">${EXPERIENCE.narrative.map((n) => `<p>${esc(n)}</p>`).join("")}</div>
    <div class="metrics" id="metrics">${metricsDef.map((m, i) => `<div class="metric glass jelly"><b data-i="${i}">${esc(m.txt)}${m.u ? `<small>${esc(m.u)}</small>` : ""}</b><span>${esc(m.l)}</span></div>`).join("")}</div>
    <div class="creek" id="creek"><svg class="bed" aria-hidden="true"></svg>
      <ol class="nodes">${PIPELINE.map((s, i) => `<li><span class="node glass">${String(i + 1).padStart(2, "0")}</span><span class="lbl">${esc(s)}</span></li>`).join("")}</ol></div>
    <div class="feat-foot"><ul class="chips mono">${EXPERIENCE.stack.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      <a class="btn glass jelly" href="${esc(EXPERIENCE.repo)}" target="_blank" rel="noopener noreferrer">${ICON.GitHub}Repository</a></div>
  </article>
</div></section>

<section id="projects" aria-labelledby="h-projects"><div class="wrap">
  <p class="kicker rv">03 · Projects</p>
  <h2 class="sec rv" id="h-projects">Projects</h2>
  <div class="grid">${SHOWN.map((p, i) => `
    <article class="card glass jelly rv" style="--rd:${((i % 3) * 0.1).toFixed(2)}s" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.name)} — open details">
      <div class="top"><span class="emblem" style="color:var(--ink)">${emblem(p)}</span>
        <span class="meta"><span>${esc(p.year)}</span>${statusHTML(p)}</span></div>
      <h3>${esc(p.name)}</h3><p>${esc(p.summary)}</p>
      <div class="links">${p.repo ? `<a href="${esc(p.repo)}" target="_blank" rel="noopener noreferrer">Repo ↗</a>` : ""}${p.demo ? `<a href="${esc(p.demo)}" target="_blank" rel="noopener noreferrer">Demo ↗</a>` : ""}<span class="more">Open +</span></div>
    </article>`).join("")}</div>
</div></section>

<section id="toolkit" aria-labelledby="h-toolkit"><div class="wrap">
  <p class="kicker rv">04 · ${esc(KIT.name)}</p>
  <h2 class="sec rv" id="h-toolkit">${esc(KIT.name)}</h2>
  <p class="kit-intro rv">${esc(KIT.summary)}</p>
  <div class="stones">${KIT.points.map((pt, i) => { const [h, items = ""] = pt.split(" — "); const list = items.replace(/\.$/, "").split(", ");
    return `<div class="stone glass refract rv" style="--rd:${(i * 0.12).toFixed(2)}s"><h3>${esc(h)}</h3><ul class="chips">${list.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`; }).join("")}</div>
  <p class="kitstatus rv">${KIT.status.map((s) => esc(s.label)).join(" · ")}</p>
</div></section>

<section id="contact" aria-labelledby="h-contact"><div class="wrap">
  <p class="kicker rv">05 · Contact</p>
  <div class="contact-grid">
    <div><h2 class="farewell rv" id="h-contact">Contact</h2><p class="greet rv" id="farewell-sub" style="--rd:.2s">${esc(PERSON.name)} · ${esc(PERSON.place)}</p></div>
    <ul class="lines glass refract rv">${CONTACT_LINES.map((l) => `<li><span class="k">${esc(l.label)}</span><a href="${esc(l.href)}"${extA(l)}>${esc(l.value)}</a>${l.copy ? `<button class="chipbtn copy jelly" data-copy="${esc(l.copy)}">Copy</button>` : l.external ? '<span class="ext" aria-hidden="true">↗</span>' : "<span></span>"}</li>`).join("")}</ul>
  </div>
  <div class="foot-note"><span>© ${new Date().getFullYear()} ${esc(PERSON.name)}</span><span id="credit">Sky painted live · weather: Open-Meteo</span></div>
</div></section>`;

/* raindrops on big glass panels */
$$(".panel, .feat, .hero-card, .lines, .card, .stone, .r-panel").forEach((el) => {
  const d = D.createElement("span"); d.className = "drops"; d.setAttribute("aria-hidden", "true");
  const n = el.classList.contains("card") || el.classList.contains("stone") ? 4 : 7;
  let s = "";
  for (let i = 0; i < n; i++) s += `<i style="--x:${(4 + Math.random() * 92).toFixed(1)}%;--s:${(4 + Math.random() * 6).toFixed(1)}px;--d:${(3.5 + Math.random() * 5).toFixed(2)}s;--dl:${(-Math.random() * 8).toFixed(2)}s"></i>`;
  d.innerHTML = s; el.appendChild(d);
});

/* ================= astronomy (NOAA sun, SunCalc-style moon) ================= */
const RAD = Math.PI / 180, DEG = 180 / Math.PI;
function solar(ms, lat, lon) {
  const jd = ms / 86400000 + 2440587.5, jc = (jd - 2451545) / 36525;
  const L0 = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
  const M = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const C = Math.sin(M * RAD) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * jc) + Math.sin(3 * M * RAD) * 0.000289;
  const om = 125.04 - 1934.136 * jc;
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * RAD);
  const eps0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(om * RAD);
  const dec = Math.asin(Math.sin(eps * RAD) * Math.sin(lam * RAD));
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqt = 4 * DEG * (y * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) - 0.5 * y * y * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD));
  const d = new Date(ms);
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  let tst = (mins + eqt + 4 * lon) % 1440; if (tst < 0) tst += 1440;
  const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;
  const la = lat * RAD;
  let cz = Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha * RAD);
  cz = clamp(cz, -1, 1);
  const zen = Math.acos(cz);
  let el = 90 - zen * DEG;
  if (el > -0.575 && el < 85) { const te = Math.tan(el * RAD); el += (el > 5 ? 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5 : 1735 + el * (-518.2 + el * (103.4 + el * (-12.79 + el * 0.711)))) / 3600; }
  else if (el <= -0.575) el += (-20.774 / Math.tan(el * RAD)) / 3600;
  let az;
  const den = Math.cos(la) * Math.sin(zen);
  if (Math.abs(den) > 1e-6) {
    let a = (Math.sin(la) * Math.cos(zen) - Math.sin(dec)) / den; a = clamp(a, -1, 1);
    az = ha > 0 ? (Math.acos(a) * DEG + 180) % 360 : (540 - Math.acos(a) * DEG) % 360;
  } else az = lat > 0 ? 180 : 0;
  return { el, az, ha, solarHour: tst / 60 };
}
function moon(ms, lat, lon) {
  const d = ms / 86400000 + 2440587.5 - 2451545, e = RAD * 23.4397;
  const L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F), dist = 385001 - 20905 * Math.cos(M);
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const lw = RAD * -lon, phi = RAD * lat;
  const H = RAD * (280.16 + 360.9856235 * d) - lw - ra;
  const h = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azS = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  // sun (for phase)
  const Ms = RAD * (357.5291 + 0.98560028 * d);
  const Cs = RAD * (1.9148 * Math.sin(Ms) + 0.02 * Math.sin(2 * Ms) + 0.0003 * Math.sin(3 * Ms));
  const Ls = Ms + Cs + RAD * 102.9372 + Math.PI;
  const sdec = Math.asin(Math.sin(e) * Math.sin(Ls)), sra = Math.atan2(Math.sin(Ls) * Math.cos(e), Math.cos(Ls));
  const sdist = 149598000;
  const ph = Math.acos(clamp(Math.sin(sdec) * Math.sin(dec) + Math.cos(sdec) * Math.cos(dec) * Math.cos(sra - ra), -1, 1));
  const inc = Math.atan2(sdist * Math.sin(ph), dist - sdist * Math.cos(ph));
  const ang = Math.atan2(Math.cos(sdec) * Math.sin(sra - ra), Math.sin(sdec) * Math.cos(dec) - Math.cos(sdec) * Math.sin(dec) * Math.cos(sra - ra));
  return { el: h * DEG, az: (azS * DEG + 180 + 360) % 360, phase: 0.5 + (0.5 * inc * (ang < 0 ? -1 : 1)) / Math.PI, frac: (1 + Math.cos(inc)) / 2 };
}
function phaseOf(el, rising, solarHour) {
  if (el < -12) return "night";
  if (el < -4) return "blue";
  if (rising) { if (el < 6) return "dawn"; return Math.abs(solarHour - 12) < 1.4 ? "midday" : "morning"; }
  if (el < -0.8) return "dusk";
  if (el < 2) return "sunset";
  if (el < 10) return "golden";
  return Math.abs(solarHour - 12) < 1.4 ? "midday" : "afternoon";
}
const PHASE_NAME = { night: "Night", blue: "Blue hour", dawn: "Dawn", morning: "Morning", midday: "Midday", afternoon: "Afternoon", golden: "Golden hour", sunset: "Sunset", dusk: "Dusk" };
const PHASE_PRESET = { night: [-26, 110], blue: [-8, 95], dawn: [2, -78], morning: [26, -52], midday: [72, 10], afternoon: [34, 50], golden: [6, 68], sunset: [0.8, 74], dusk: [-2.6, 80] };
const COND_NAME = { clear: "Clear", cloudy: "Cloudy", drizzle: "Drizzle", rain: "Rain", storm: "Storm", fog: "Fog", snow: "Snow" };
const COND_PRESET = {
  clear: { cloud: 0.12, rain: 0, wet: 0, fog: 0.02, storm: 0, snow: 0 },
  cloudy: { cloud: 0.82, rain: 0, wet: 0, fog: 0.08, storm: 0, snow: 0 },
  drizzle: { cloud: 0.8, rain: 0.28, wet: 0.5, fog: 0.18, storm: 0, snow: 0 },
  rain: { cloud: 0.92, rain: 0.72, wet: 0.85, fog: 0.22, storm: 0, snow: 0 },
  storm: { cloud: 1, rain: 1, wet: 1, fog: 0.25, storm: 1, snow: 0 },
  fog: { cloud: 0.45, rain: 0, wet: 0.2, fog: 0.88, storm: 0, snow: 0 },
  snow: { cloud: 0.85, rain: 0, wet: 0, fog: 0.3, storm: 0, snow: 0.85 },
};
function wmo(code) {
  const c = code | 0;
  if (c === 0) return ["clear", "Clear"];
  if (c === 1) return ["clear", "Mainly clear"];
  if (c === 2) return ["cloudy", "Partly cloudy"];
  if (c === 3) return ["cloudy", "Overcast"];
  if (c === 45 || c === 48) return ["fog", "Fog"];
  if (c >= 51 && c <= 57) return ["drizzle", c >= 56 ? "Freezing drizzle" : "Drizzle"];
  if (c >= 61 && c <= 67) return ["rain", c >= 66 ? "Freezing rain" : c === 61 ? "Light rain" : c === 65 ? "Heavy rain" : "Rain"];
  if (c >= 71 && c <= 77) return ["snow", c === 77 ? "Snow grains" : "Snow"];
  if (c >= 80 && c <= 82) return ["rain", "Showers"];
  if (c === 85 || c === 86) return ["snow", "Snow showers"];
  if (c >= 95) return ["storm", "Thunderstorm"];
  return ["cloudy", "Cloudy"];
}

/* ================= palette ================= */
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const PAL = [ // el, zenith, horizon, sun, ambient(land light)
  [-18, "#03050d", "#0a1122", "#000000", "#141c34"],
  [-12, "#071130", "#17234a", "#1a1430", "#1b2546"],
  [-7, "#142a62", "#4c5891", "#5a3a6a", "#323f6c"],
  [-3, "#273f7f", "#c27a7e", "#ff6a3c", "#5e5577"],
  [0, "#35518f", "#ee8f5f", "#ff7a3a", "#8e6872"],
  [3, "#4568a8", "#ffae68", "#ffa04a", "#c58c6c"],
  [8, "#4f84cc", "#ffd49c", "#ffc77a", "#e2bc93"],
  [18, "#4a8ae0", "#bddbf2", "#fff0d0", "#efe5cf"],
  [45, "#3b7fdc", "#a9d3f3", "#fffaee", "#fbf7ec"],
  [90, "#3478d8", "#a3cff2", "#ffffff", "#ffffff"],
].map((r) => [r[0], hex(r[1]), hex(r[2]), hex(r[3]), hex(r[4])]);
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function palette(el, rising, w) {
  let i = 0; while (i < PAL.length - 2 && el > PAL[i + 1][0]) i++;
  const a = PAL[i], b = PAL[i + 1], t = clamp((el - a[0]) / (b[0] - a[0]), 0, 1);
  let zen = mix3(a[1], b[1], t), hor = mix3(a[2], b[2], t), sun = mix3(a[3], b[3], t), amb = mix3(a[4], b[4], t);
  if (rising && el > -8 && el < 8) { const k = 1 - Math.abs(el) / 8; hor = mix3(hor, [0.96, 0.66, 0.7], 0.3 * k); }
  const grey = (c, k, f) => { const L = lum(c); return mix3(c, [L * f, L * f * 1.02, L * f * 1.07], k); };
  const k = clamp(w.cloud * 0.5 + w.rain * 0.25 + w.storm * 0.3 + w.fog * 0.3, 0, 0.95);
  const dark = 1 - 0.12 * w.cloud - 0.22 * w.rain - 0.42 * w.storm;
  zen = grey(zen, k, 1.05).map((x) => x * dark); hor = grey(hor, k * 0.9, 1.1).map((x) => x * dark);
  amb = grey(amb, k * 0.6, 1).map((x) => x * (1 - 0.1 * w.cloud - 0.2 * w.rain - 0.35 * w.storm));
  if (w.snow > 0) { zen = mix3(zen, [lum(zen) * 1.1 + 0.05, lum(zen) * 1.12 + 0.06, lum(zen) * 1.2 + 0.08], w.snow * 0.5); }
  const fogc = mix3(hor, [lum(hor) + 0.08, lum(hor) + 0.09, lum(hor) + 0.12], 0.6);
  return { zen, hor, sun, amb, fogc };
}

/* ================= sky state ================= */
const S = { lat: 12.97, lon: 77.59, city: null, country: null, tz: null, offset: null, src: "default", viewAz: 180, wx: null, wxAt: 0, rise: null, set: null, override: { phase: null, cond: null } };
const KEYS = ["sunX", "sunY", "moonX", "moonY", "sunVis", "sunGlow", "moonVis", "moonPhase", "night", "day", "cloud", "rain", "wet", "fog", "storm", "snow", "wind", "windX"];
const tgt = { zen: [0.2, 0.3, 0.6], hor: [0.9, 0.6, 0.4], sun: [1, 0.8, 0.5], amb: [0.7, 0.6, 0.5], fogc: [0.7, 0.7, 0.75] };
KEYS.forEach((k) => (tgt[k] = 0));
Object.assign(tgt, { cloud: 0.25, wind: 0.2, windX: 1, moonPhase: 0.5 });
const cur = JSON.parse(JSON.stringify(tgt));
cur.flash = 0; cur.time = 0; cur.scroll = 0; cur.mouse = [0.5, 0.3]; cur.rm = RM;
window.SKY = cur;
let liveNow = { phase: "morning", cond: null, condLabel: "—", el: 0 };

function computeTargets(snap) {
  const now = Date.now();
  const sun = solar(now, S.lat, S.lon), mn = moon(now, S.lat, S.lon);
  const rising = sun.ha < 0;
  let el = sun.el, az = sun.az, isRising = rising;
  let phase = phaseOf(sun.el, rising, sun.solarHour);
  liveNow.phase = phase; liveNow.el = sun.el;
  const ov = S.override;
  let azDelta = ((az - S.viewAz + 540) % 360) - 180;
  let mEl = mn.el, mDelta = ((mn.az - S.viewAz + 540) % 360) - 180, mPhase = mn.phase;
  if (ov.phase) {
    phase = ov.phase; [el, azDelta] = PHASE_PRESET[ov.phase]; isRising = azDelta < 0;
    if (["night", "blue", "dusk"].includes(ov.phase) && (mEl < 12 || Math.abs(mDelta) > 120)) { mEl = 34; mDelta = -38; }
    if (mn.frac < 0.2) mPhase = 0.38;
  }
  // weather
  let w;
  const condKey = ov.cond || liveNow.cond;
  if (ov.cond) w = { ...COND_PRESET[ov.cond], wind: 0.35, windX: tgt.windX || 1 };
  else if (S.wx) {
    const c = S.wx, [key] = wmo(c.weather_code);
    const code = c.weather_code | 0;
    const rainAmt = key === "drizzle" ? 0.28 : key === "storm" ? 0.95 : key === "rain" ? ({ 61: 0.42, 63: 0.68, 65: 0.95, 80: 0.5, 81: 0.75, 82: 1 }[code] || 0.6) : 0;
    const snowAmt = key === "snow" ? ({ 71: 0.4, 73: 0.65, 75: 0.9, 77: 0.3, 85: 0.6, 86: 0.9 }[code] || 0.6) : 0;
    const vis = c.visibility == null ? 20000 : c.visibility;
    const fogAmt = Math.max(key === "fog" ? 0.85 : 0, clamp((10000 - vis) / 9000, 0, 1) * 0.85, rainAmt * 0.2);
    let cloud = clamp((c.cloud_cover || 0) / 100, 0, 1);
    if (key === "rain" || key === "drizzle" || key === "snow") cloud = Math.max(cloud, 0.75);
    if (key === "storm") cloud = 1;
    const toAz = ((c.wind_direction_10m || 0) + 180) % 360;
    w = { cloud, rain: rainAmt, snow: snowAmt, fog: fogAmt, storm: key === "storm" ? 1 : 0, wet: rainAmt > 0 ? 0.4 + rainAmt * 0.6 : (c.precipitation > 0 ? 0.3 : 0),
      wind: clamp((c.wind_speed_10m || 0) / 40, 0.05, 1), windX: Math.sin((toAz - S.viewAz) * RAD) || 0.3 };
  } else w = { cloud: 0.28, rain: 0, snow: 0, fog: 0.04, storm: 0, wet: 0, wind: 0.2, windX: 0.6 };
  liveNow.condKey = condKey;
  const pal = palette(el, isRising, w);
  Object.assign(tgt, pal, w);
  tgt.sunX = azDelta / 110; tgt.sunY = el / 90; tgt.moonX = mDelta / 110; tgt.moonY = mEl / 90;
  tgt.sunVis = smooth(-1.5, 1.5, el) * (1 - w.cloud * 0.8) * (1 - w.fog * 0.6);
  tgt.sunGlow = smooth(-9, 3, el) * (1 - w.cloud * 0.65) * (1 - w.storm * 0.8);
  tgt.night = 1 - smooth(-14, -4, el);
  tgt.day = smooth(2, 16, el);
  tgt.moonVis = smooth(-2, 3, mEl) * (1 - 0.75 * smooth(0, 20, el)) * (1 - w.cloud * 0.75);
  tgt.moonPhase = mPhase;
  if (snap) { Object.keys(tgt).forEach((k) => (cur[k] = Array.isArray(tgt[k]) ? tgt[k].slice() : tgt[k])); }
  return { phase, sun, mn };
}

/* uniforms lerp over ~4s */
function stepSky(dt) {
  const a = 1 - Math.exp(-dt / 1.25);
  for (const k in tgt) {
    const v = tgt[k];
    if (Array.isArray(v)) for (let i = 0; i < 3; i++) cur[k][i] += (v[i] - cur[k][i]) * a;
    else if (k === "sunX" || k === "moonX") { cur[k] += (v - cur[k]) * a; }
    else cur[k] += (v - cur[k]) * a;
  }
}

/* ================= theme (contrast follows the painted sky) ================= */
let themeT = 0;
function applyTheme() {
  const L = lum(mix3(cur.zen, cur.hor, 0.55)) * (1 - 0.25 * cur.storm);
  const t = smooth(0.34, 0.56, L);
  themeT = t;
  const ink = mix3([0.965, 0.945, 0.905], [0.075, 0.105, 0.095], t);
  const rgb = (c, a) => `rgba(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0},${a})`;
  const st = root.style;
  st.setProperty("--ink", rgb(ink, 1)); st.setProperty("--ink2", rgb(ink, t > .5 ? 0.84 : 0.78)); st.setProperty("--ink3", rgb(ink, 0.52));
  const gDark = [0.05, 0.07, 0.14], gLight = [1, 0.99, 0.97];
  const gc = mix3(gDark, gLight, t);
  st.setProperty("--glass", rgba(gc, lerp(0.36, 0.52, t))); st.setProperty("--glass2", rgba(gc, lerp(0.2, 0.38, t)));
  st.setProperty("--glass-brd", t > 0.5 ? "rgba(255,255,255,.45)" : "rgba(255,255,255,.16)");
  st.setProperty("--chip", t > 0.5 ? "rgba(255,255,255,.42)" : "rgba(255,255,255,.10)");
  st.setProperty("--shade", t > 0.5 ? "rgba(255,250,240,.75)" : "rgba(0,0,0,.55)");
  st.setProperty("--accent", t > 0.5 ? "#d24a22" : "#ef6a3f");
  st.setProperty("--accent2", t > 0.5 ? "#a8521a" : "#f3bf55");
  st.setProperty("--zen", rgb(cur.zen, 1)); st.setProperty("--hor", rgb(cur.hor, 1));
  st.setProperty("--land", rgb(mix3([0.13, 0.2, 0.1], cur.amb, 0.25).map((x, i) => x * (0.4 + 0.6 * cur.amb[i])), 1));
  root.style.setProperty("--veil", String(lerp(0.75, 0.0, t)));
  function rgba(c, a) { return rgb(c, a.toFixed(3)); }
}

/* free-standing text: light or dark ink depending on what part of the painting is behind it */
const FREE = () => $$(".sec,.kicker,.closing,.farewell,.greet,.name,.kit-intro,.kitstatus,.foot-note,.scrollhint").filter((n) => !n.closest(".glass"));
setInterval(() => { freeEls = []; }, 2000);
let freeEls = [];
function inkByRegion() {
  if (!freeEls.length) freeEls = FREE();
  const s0 = cur.scroll, e = s0 * s0 * (3 - 2 * s0);
  const Hz = D.body.classList.contains("nogl") ? -0.06 : -0.03 + e * 0.3 + 0.07;                       // horizon + far hills (scene units)
  const landL = lerp(lum(cur.amb) * 0.24, lum(cur.fogc), cur.fog * 0.6) + cur.snow * 0.35 * lum(cur.amb);
  const skyL = lum(mix3(cur.zen, cur.hor, 0.55)) * (1 - 0.25 * cur.storm);
  const vis = [], pts = [];
  for (const n of freeEls) {
    const r = rectOf(n);
    if (r.bottom < -40 || r.top > innerHeight + 40) continue;
    vis.push([n, r]);
    const w = Math.min(r.width, 700), cy = clamp(r.top + r.height * 0.5, 1, innerHeight - 1);
    for (const fx of [0.08, 0.35, 0.65, 0.92]) pts.push([clamp(r.left + w * fx, 1, innerWidth - 1), cy]);
  }
  const decide = (probe) => { vis.forEach(([n, r], i) => {
    let L;
    if (probe) { const a = probe.slice(i * 4, i * 4 + 4); L = a.reduce((x, y) => x + y, 0) / 4; }
    else { const py = 0.5 - (r.top + r.height * 0.5) / innerHeight; L = py > Hz ? skyL : landL; }
    const want = L > 0.47 ? "dark" : "light";
    if (n.dataset.ink !== want && (!n.dataset.ink || Math.abs(L - 0.47) > 0.04)) n.dataset.ink = want;
  }); };
  if (window.GLProbe && pts.length && !D.body.classList.contains("nogl") && el("sky").classList.contains("on")) window.GLProbe(pts, decide);
  else decide(null);
}

/* ================= clock & readout ================= */
const pad = (n) => String(n).padStart(2, "0");
function offsetSec() {
  if (S.offset != null) return S.offset;
  if (S.src === "default") return 19800;
  if (S.src === "geo") return -new Date().getTimezoneOffset() * 60;
  return null;
}
function localParts(ms) {
  const off = offsetSec();
  if (off != null) { const d = new Date(ms + off * 1000); return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds() }; }
  if (S.tz) {
    try {
      const f = new Intl.DateTimeFormat("en-GB", { timeZone: S.tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms));
      const g = (t) => +f.find((p) => p.type === t).value; return { h: g("hour"), m: g("minute"), s: g("second") };
    } catch (e) {}
  }
  const d = new Date(ms); return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() };
}
const fmt = (p, sec) => `${pad(p.h)}:${pad(p.m)}${sec ? ":" + pad(p.s) : ""}`;
function localSunTimes() {
  // scan the local day for −0.833° crossings (works offline)
  const off = offsetSec() ?? Math.round(S.lon / 15) * 3600;
  const now = Date.now(), lp = new Date(now + off * 1000);
  const start = Date.UTC(lp.getUTCFullYear(), lp.getUTCMonth(), lp.getUTCDate()) - off * 1000;
  let prev = solar(start, S.lat, S.lon).el + 0.833, rise = null, set = null;
  for (let m = 5; m <= 1440; m += 5) {
    const ms = start + m * 60000, e = solar(ms, S.lat, S.lon).el + 0.833;
    if (prev < 0 && e >= 0 && rise == null) rise = ms - 5 * 60000 * (e / (e - prev));
    if (prev >= 0 && e < 0 && set == null) set = ms - 5 * 60000 * (e / (e - prev));
    prev = e;
  }
  const f = (ms) => (ms == null ? "—" : fmt(localParts(ms)));
  return [f(rise), f(set)];
}
const el = (id) => D.getElementById(id);
const setTxt = (id, t) => { const n = el(id); if (n && n.textContent !== t) n.textContent = t; };
function greeting(h) { return h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : h >= 17 && h < 22 ? "Good evening" : "Still up?"; }
const CLAUSE = { clear: "clear skies where you are", cloudy: "it's cloudy where you are", drizzle: "it's drizzling where you are", rain: "it's raining where you are", storm: "there's a storm where you are", fog: "it's foggy where you are", snow: "it's snowing where you are" };
function updateReadout() {
  const info = computeTargets(false);
  const lp = localParts(Date.now());
  const place = S.city ? S.city : "Your sky";
  setTxt("r-city", place); setTxt("rp-city", S.city ? (S.country ? `${S.city}, ${S.country}` : S.city) : "Your sky");
  setTxt("r-time", fmt(lp)); setTxt("rp-time", fmt(lp, true));
  const ph = PHASE_NAME[info.phase];
  setTxt("r-phase", ph); setTxt("rp-phase", ph + (S.override.phase ? " · painted" : ""));
  const c = S.wx;
  const condLabel = S.override.cond ? COND_NAME[S.override.cond] + " · painted" : c ? wmo(c.weather_code)[1] : "—";
  setTxt("rp-cond", condLabel);
  const ok = (v) => c && typeof v === "number" && isFinite(v);
  setTxt("r-temp", ok(c && c.temperature_2m) ? `${Math.round(c.temperature_2m)}°C` : "—°");
  setTxt("rp-temp", ok(c && c.temperature_2m) ? `${c.temperature_2m.toFixed(1)} °C` : "—");
  setTxt("rp-feels", ok(c && c.apparent_temperature) ? `${c.apparent_temperature.toFixed(1)} °C` : "—");
  setTxt("rp-wind", ok(c && c.wind_speed_10m) ? `${Math.round(c.wind_speed_10m)} km/h` : "—");
  setTxt("rp-hum", ok(c && c.relative_humidity_2m) ? `${Math.round(c.relative_humidity_2m)}%` : "—");
  const [lr, ls] = S.rise ? [S.rise, S.set] : localSunTimes();
  setTxt("rp-rise", lr); setTxt("rp-set", ls);
  setTxt("rp-src", (S.wx ? "Weather: Open-Meteo · " : "Weather offline · ") + (S.src === "geo" ? "precise location" : S.src === "ip" ? "approximate location" : "default location") + " · sun & moon computed locally");
  // greeting
  setTxt("greet-a", greeting(lp.h));
  const ck = liveNow.cond;
  setTxt("greet-b", ck ? ` — ${CLAUSE[ck]}.` : "");
  const fw = { night: ["Good night", "stars"], blue: ["Enjoy the", "blue hour"], dawn: ["Enjoy the", "dawn"], morning: ["Have a good", "morning"], midday: ["Have a good", "day"], afternoon: ["Enjoy the", "afternoon"], golden: ["Enjoy the", "golden hour"], sunset: ["Enjoy the", "sunset"], dusk: ["Have a good", "evening"] }[info.phase];
  const fh = el("h-contact");
  if (fh) { const html = info.phase === "night" ? `Good night — <em>sleep well.</em>` : `${fw[0]} <em>${fw[1]}.</em>`; if (fh.dataset.h !== html) { fh.dataset.h = html; fh.innerHTML = html; } }
  // picker state
  $$("#pk-phase button").forEach((b) => b.classList.toggle("on", b.dataset.v === S.override.phase));
  $$("#pk-cond button").forEach((b) => b.classList.toggle("on", b.dataset.v === S.override.cond));
  D.body.classList.toggle("raining", cur.rain > 0.15 || (tgt.rain > 0.15));
  const gk = info.phase + "|" + (liveNow.condKey || "");
  const sk = el("r-sky"); if (sk && sk.dataset.k !== gk) { sk.dataset.k = gk; sk.innerHTML = skyGlyph(info.phase, liveNow.condKey); }
}

/* ================= data chain ================= */
function fetchJSON(url, ms = 8000) {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), ms);
  return fetch(url, ctl ? { signal: ctl.signal, cache: "no-store" } : {}).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).finally(() => clearTimeout(t));
}
function getGeo() {
  return new Promise((res) => {
    let done = false; const fin = (v) => { if (!done) { done = true; clearTimeout(tm); res(v); } };
    const tm = setTimeout(() => fin(null), 3000);
    try {
      if (!navigator.geolocation) return fin(null);
      const pol = D.permissionsPolicy || D.featurePolicy;
      if (pol && typeof pol.allowsFeature === "function" && !pol.allowsFeature("geolocation")) return fin(null);
      navigator.geolocation.getCurrentPosition((p) => fin({ lat: p.coords.latitude, lon: p.coords.longitude }), () => fin(null), { timeout: 3000, maximumAge: 600000, enableHighAccuracy: false });
    } catch (e) { fin(null); }
  });
}
const km = (a, b, c, d) => { const R = 6371, x = (c - a) * RAD, y = (d - b) * RAD; const h = Math.sin(x / 2) ** 2 + Math.cos(a * RAD) * Math.cos(c * RAD) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
async function locate() {
  const ipP = fetchJSON("https://get.geojs.io/v1/ip/geo.json", 6000).catch(() => null);
  const g = await getGeo();
  const ip = await ipP;
  const ipOk = ip && isFinite(parseFloat(ip.latitude)) && isFinite(parseFloat(ip.longitude));
  if (g) {
    Object.assign(S, { lat: g.lat, lon: g.lon, src: "geo" });
    if (ipOk && km(g.lat, g.lon, +ip.latitude, +ip.longitude) < 150) Object.assign(S, { city: ip.city || null, country: ip.country || null, tz: ip.timezone || null });
    else S.city = null;
  } else if (ipOk) {
    Object.assign(S, { lat: +ip.latitude, lon: +ip.longitude, city: ip.city || null, country: ip.country || null, tz: ip.timezone || null, src: "ip" });
  } else Object.assign(S, { lat: 12.97, lon: 77.59, city: "Bengaluru", country: "India", tz: "Asia/Kolkata", src: "default" });
  S.viewAz = S.lat >= 0 ? 180 : 0;
}
async function weather(retry = true) {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${S.lat.toFixed(3)}&longitude=${S.lon.toFixed(3)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,visibility&daily=sunrise,sunset&timezone=auto`;
  try {
    const j = await fetchJSON(u, 9000);
    if (!j || !j.current) throw new Error("no current");
    S.wx = j.current; S.wxAt = Date.now();
    if (typeof j.utc_offset_seconds === "number") S.offset = j.utc_offset_seconds;
    if (j.timezone && !S.tz) S.tz = j.timezone;
    if (j.daily && j.daily.sunrise && j.daily.sunrise[0]) { S.rise = String(j.daily.sunrise[0]).slice(11, 16); S.set = String(j.daily.sunset[0]).slice(11, 16); }
    liveNow.cond = wmo(S.wx.weather_code)[0];
    updateReadout();
  } catch (e) {
    if (retry) setTimeout(() => weather(false), 5000);
  }
}
(async () => {
  try { await locate(); } catch (e) {}
  updateReadout();
  weather(true);
  setInterval(() => weather(true), 10 * 60 * 1000);
})();

/* ================= picker ================= */
el("pk-phase").innerHTML = Object.entries(PHASE_NAME).map(([k, v]) => `<button data-v="${k}">${v}</button>`).join("");
el("pk-cond").innerHTML = Object.entries(COND_NAME).map(([k, v]) => `<button data-v="${k}">${v}</button>`).join("");
el("pk-phase").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; S.override.phase = S.override.phase === b.dataset.v ? null : b.dataset.v; updateReadout(); });
el("pk-cond").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; S.override.cond = S.override.cond === b.dataset.v ? null : b.dataset.v; updateReadout(); });
el("pk-live").addEventListener("click", () => { S.override.phase = S.override.cond = null; updateReadout(); });
const pill = el("pill"), rpanel = el("rpanel");
pill.addEventListener("click", () => { const open = pill.getAttribute("aria-expanded") !== "true"; pill.setAttribute("aria-expanded", open); rpanel.hidden = !open; });
D.addEventListener("click", (e) => { if (!rpanel.hidden && !e.target.closest("#readout")) { rpanel.hidden = true; pill.setAttribute("aria-expanded", "false"); } });
window.__sky = { set: (phase, cond) => { S.override.phase = phase || null; S.override.cond = cond || null; computeTargets(true); updateReadout(); applyTheme(); }, state: S, cur, tgt };

/* ================= scrolling ================= */
// Native scrolling runs on the browser's compositor, independently of the
// expensive painted landscape. Section links retain native smooth scrolling.
const scroller = el("scroller"), progB = $("#nav .prog b");
let sy = window.scrollY, docH = 1;
function measure() { docH = Math.max(1, D.documentElement.scrollHeight - innerHeight); }
try { new ResizeObserver(measure).observe(scroller); } catch (e) { setInterval(measure, 1000); }
addEventListener("resize", () => { measure(); layoutCreek(); });
measure();
const go = (id) => { const t = el(id); if (!t) return; const top = t.getBoundingClientRect().top + scrollY; scrollTo({ top, behavior: RM ? "auto" : "smooth" }); };
$$("#nav a").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); go(a.dataset.go); }));
const secIds = ["hero", "about", "anvaya", "projects", "toolkit", "contact"];
const sections = secIds.map((id) => el(id));
const navLinks = $$("#nav a");
let activeSec = "";

/* ================= reveal ================= */
const rvs = $$(".rv");
rvs.forEach((n) => n.addEventListener("animationend", (e) => { if (e.animationName === "wipe") n.classList.add("done"); }));
let revealT = 0, metricsDone = false;
function revealCheck() {
  const H = innerHeight;
  for (const n of rvs) {
    if (n.classList.contains("in")) continue;
    const r = rectOf(n);
    if (r.top < H * 0.92 && r.bottom > 0) { n.classList.add("in"); if (RM) n.classList.add("done"); }
  }
  if (!metricsDone) { const m = el("metrics"); if (m && rectOf(m).top < H * 0.85) { metricsDone = true; countUp(); } }
}
function countUp() {
  if (RM) return;
  const bs = $$("#metrics b"), t0 = performance.now();
  const f = (now) => {
    const k = clamp((now - t0) / 1600, 0, 1), e = 1 - Math.pow(1 - k, 3);
    bs.forEach((b) => { const m = metricsDef[+b.dataset.i]; const v = m.v * e; const txt = m.fmt ? m.fmt(v) : m.d ? v.toFixed(m.d) : String(Math.round(v)); b.firstChild.nodeValue = k >= 1 ? m.txt : txt; });
    if (k < 1) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}

/* ================= creek (pipeline) ================= */
const creek = el("creek"), bed = $("svg.bed", creek);
let creekPath = null, creekLen = 0, motes = [], nodes = $$(".node", creek);
function layoutCreek() {
  if (!creek) return;
  const cr = creek.getBoundingClientRect();
  const pts = nodes.map((n) => { const r = n.getBoundingClientRect(); return [r.left - cr.left + r.width / 2, r.top - cr.top + r.height / 2]; });
  if (!pts.length || cr.width < 10) return;
  const P = [[pts[0][0] - 60, pts[0][1] + 10], ...pts, [pts[pts.length - 1][0] + 60, pts[pts.length - 1][1] - 10]];
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const wob = (i % 2 ? 1 : -1) * 14;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6 + wob], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6 + wob];
    d += ` C${c1.map((v) => v.toFixed(1))} ${c2.map((v) => v.toFixed(1))} ${p2.map((v) => v.toFixed(1))}`;
  }
  bed.setAttribute("viewBox", `0 0 ${cr.width} ${cr.height}`);
  bed.innerHTML = `<defs><linearGradient id="cg" x1="0" x2="1"><stop offset="0" stop-color="var(--accent2)" stop-opacity=".2"/><stop offset=".5" stop-color="var(--accent2)"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".6"/></linearGradient>
    <filter id="cglow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>
    <path d="${d}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="16" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="rgba(160,210,240,.18)" stroke-width="7" stroke-linecap="round"/>
    <path class="flow" d="${d}" fill="none" stroke="url(#cg)" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="3 22"/>
    <path class="flow2" d="${d}" fill="none" stroke="url(#cg)" stroke-width="6" stroke-linecap="round" stroke-dasharray="40 260" filter="url(#cglow)" opacity=".8"/>
    <g class="motes"></g>`;
  creekPath = $("path.flow", bed); creekLen = creekPath.getTotalLength();
  const g = $("g.motes", bed); motes = [];
  for (let i = 0; i < 16; i++) { const c = D.createElementNS("http://www.w3.org/2000/svg", "circle"); c.setAttribute("r", (1.2 + Math.random() * 2.2).toFixed(1)); c.setAttribute("fill", i % 3 ? "var(--accent2)" : "#fff"); g.appendChild(c); motes.push({ c, o: Math.random(), sp: 0.035 + Math.random() * 0.05, j: (Math.random() - 0.5) * 8 }); }
  // node positions as fraction along the path (sampled)
  nodeFrac = pts.map((p) => { let best = 0, bd = 1e9; for (let s = 0; s <= 200; s++) { const q = creekPath.getPointAtLength((s / 200) * creekLen); const dd = (q.x - p[0]) ** 2 + (q.y - p[1]) ** 2; if (dd < bd) { bd = dd; best = s / 200; } } return best; });
}
let nodeFrac = [];
function creekTick(t) {
  if (!creekPath) return;
  const r = rectOf(creek); if (r.bottom < 0 || r.top > innerHeight) return;
  const sp = RM ? 0.15 : 1;
  const fl = $("path.flow", bed), f2 = $("path.flow2", bed);
  fl.style.strokeDashoffset = String(-(t * 40 * sp) % 25);
  f2.style.strokeDashoffset = String(-(t * 160 * sp) % 300);
  const lead = ((t * 0.12 * sp) % 1);
  motes.forEach((m) => { const f = (m.o + t * m.sp * sp) % 1; const q = creekPath.getPointAtLength(f * creekLen); m.c.setAttribute("cx", q.x.toFixed(1)); m.c.setAttribute("cy", (q.y + Math.sin(t * 2 + m.o * 9) * m.j * 0.4).toFixed(1)); m.c.setAttribute("opacity", (0.35 + 0.65 * Math.sin(f * Math.PI)).toFixed(2)); });
  nodes.forEach((n, i) => { const d = Math.abs(lead - (nodeFrac[i] || 0)); n.classList.toggle("lit", d < 0.06); });
}

/* ================= project sheet (FLIP) ================= */
const layer = el("sheet-layer");
let openSheet = null;
function openProject(card) {
  if (openSheet) return;
  const p = PROJECTS.find((x) => x.id === card.dataset.id); if (!p) return;
  const sh = D.createElement("div");
  sh.className = "sheet glass"; sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true"); sh.setAttribute("aria-label", p.name);
  sh.innerHTML = `<button class="x glass jelly" aria-label="Close">${ICON.Close}</button><div class="inner">
    <div class="head"><span class="emblem">${emblem(p)}</span><span class="meta"><span>${esc(p.year)}</span>${statusHTML(p)}</span></div>
    <h3>${esc(p.name)}</h3><p class="sum">${esc(p.summary)}</p>
    <ol>${p.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
    <ul class="chips mono">${p.stack.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    <div class="foot">${p.repo ? `<a class="btn glass jelly" href="${esc(p.repo)}" target="_blank" rel="noopener noreferrer">${ICON.GitHub}Repository</a>` : ""}${p.demo ? `<a class="btn primary jelly" href="${esc(p.demo)}" target="_blank" rel="noopener noreferrer">Live demo ↗</a>` : ""}</div></div>`;
  sh.style.visibility = "hidden"; layer.appendChild(sh);
  const drops = card.querySelector(".drops"); if (drops) sh.appendChild(drops.cloneNode(true));
  const w = sh.offsetWidth, h = sh.offsetHeight;
  const left = (innerWidth - w) / 2, top = Math.max(20, (innerHeight - h) / 2);
  Object.assign(sh.style, { left: left + "px", top: top + "px" });
  const r = card.getBoundingClientRect();
  sh.style.transform = `translate(${r.left - left}px,${r.top - top}px) scale(${r.width / w},${r.height / h})`;
  sh.style.visibility = "";
  card.style.opacity = "0";
  layer.classList.add("open"); root.style.overflow = "hidden";
  sh.getBoundingClientRect();
  sh.style.transition = RM ? "none" : "transform .62s cubic-bezier(.2,.9,.25,1)";
  sh.style.transform = "none";
  setTimeout(() => sh.classList.add("shown"), RM ? 0 : 120);
  openSheet = { sh, card };
  setTimeout(scanGlass, 20);
  $(".x", sh).addEventListener("click", closeProject);
  setTimeout(() => $(".x", sh).focus({ preventScroll: true }), 60);
}
function closeProject() {
  if (!openSheet) return;
  const { sh, card } = openSheet; openSheet = null;
  sh.classList.remove("shown");
  const r = card.getBoundingClientRect(), sr = sh.getBoundingClientRect();
  const left = parseFloat(sh.style.left), top = parseFloat(sh.style.top);
  sh.style.transform = `translate(${r.left - left}px,${r.top - top}px) scale(${r.width / sr.width},${r.height / sr.height})`;
  layer.classList.remove("open"); root.style.overflow = "";
  const done = () => { const ls = lensState.get(sh); if (ls) { const n = D.getElementById(ls.id); if (n) n.remove(); } if (lensRO) lensRO.unobserve(sh); sh.remove(); card.style.opacity = ""; card.focus({ preventScroll: true }); };
  if (RM) done(); else { sh.addEventListener("transitionend", done, { once: true }); setTimeout(() => sh.isConnected && done(), 900); }
}
$$(".card").forEach((c) => {
  c.addEventListener("click", (e) => { if (e.target.closest("a")) return; openProject(c); });
  c.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !e.target.closest("a")) { e.preventDefault(); openProject(c); } });
});
$(".scrim", layer).addEventListener("click", closeProject);
D.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (openSheet) closeProject(); else if (!rpanel.hidden) { rpanel.hidden = true; pill.setAttribute("aria-expanded", "false"); } } });

/* ================= copy ================= */
const toast = el("toast"); let toastT;
function say(t) { toast.textContent = t; toast.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove("on"), 1800); }
async function copyText(t) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true; } } catch (e) {}
  try {
    const ta = D.createElement("textarea"); ta.value = t; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    D.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length);
    const ok = D.execCommand && D.execCommand("copy"); ta.remove(); return !!ok;
  } catch (e) { return false; }
}
$$("[data-copy]").forEach((b) => b.addEventListener("click", async () => { const ok = await copyText(b.dataset.copy); b.textContent = ok ? "Copied" : "Copy"; say(ok ? "Email copied" : b.dataset.copy); setTimeout(() => (b.textContent = "Copy"), 1600); }));

/* ================= liquid glass: per-element lens, light-aware rim, spring morph ================= */
const glassEls = () => $$(".glass");
let G = glassEls();
// Lighting variables belong to an empty decoration, rather than the whole
// pane: pointer updates no longer invalidate all of the text/chip descendants.
const glassLights = new WeakMap();
function glassLight(g) {
  let light = glassLights.get(g);
  if (!light || light.parentElement !== g) {
    light = D.createElement("span"); light.className = "glass-light";
    light.setAttribute("aria-hidden", "true"); g.appendChild(light);
    glassLights.set(g, light);
  }
  return light;
}
G.forEach(glassLight);
let mx = innerWidth * 0.5, my = innerHeight * 0.3, moved = true;
const LENS = root.classList.contains("lgsvg") && !mq("(prefers-reduced-transparency: reduce)");
const lgDefs = $("#lgdefs defs");
const lensState = new WeakMap();
let lensSeq = 0;
function radiusOf(g, w, h) {
  const cs = getComputedStyle(g), v = cs.borderTopLeftRadius || "0";
  let r = parseFloat(v) || 0;
  if (/%/.test(v)) r = (r / 100) * Math.min(w, h);
  if (g.classList.contains("stone")) r = Math.min(w, h) * 0.42;
  return Math.max(0, Math.min(r, w / 2, h / 2));
}
/* displacement map: rounded-rect SDF → convex bevel (strong inward pull at the rim, flat clear centre)
   plus a faint radial term so the whole pane magnifies slightly. R/G = 0.5 + offset/scale. */
function lensMap(w, h, r) {
  const big = w * h > 260000;
  const bez = Math.max(9, Math.min(big ? 34 : 26, Math.min(w, h) * 0.36));
  const bend = bez * (big ? 1.25 : 1.35);
  const mag = Math.min(big ? 0.018 : 0.045, (big ? 4 : 3) / (0.5 * Math.max(w, h)));   // ≤3–4 px of magnification at the far edge
  const maxD = bend + mag * Math.hypot(w, h) * 0.5 + 1;
  const scale = 2 * maxD;
  const k = Math.min(1, Math.max(0.25, Math.sqrt(160000 / (w * h))));   // map resolution (smooth, so it can be coarse)
  const mw = Math.max(8, Math.round(w * k)), mh = Math.max(8, Math.round(h * k));
  const c = D.createElement("canvas"); c.width = mw; c.height = mh;
  const g = c.getContext("2d"); const img = g.createImageData(mw, mh), px = img.data;
  const hw = w / 2, hh = h / 2;
  for (let j = 0; j < mh; j++) {
    const y = ((j + 0.5) / mh) * h - hh;
    for (let i = 0; i < mw; i++) {
      const x = ((i + 0.5) / mw) * w - hw;
      const qx = Math.abs(x) - (hw - r), qy = Math.abs(y) - (hh - r);
      let sd, nx, ny;
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; sd = l - r; nx = qx / l; ny = qy / l; }
      else if (qx > qy) { sd = qx - r; nx = 1; ny = 0; }
      else { sd = qy - r; nx = 0; ny = 1; }
      nx *= Math.sign(x) || 1; ny *= Math.sign(y) || 1;
      const t = Math.min(1, Math.max(0, -sd / bez));
      const prof = Math.pow(1 - t, 2.6);                   // derivative of a squircle-ish dome, normalised
      let dx = -nx * bend * prof - x * mag, dy = -ny * bend * prof - y * mag;
      const o = (j * mw + i) * 4;
      px[o] = Math.round(Math.min(255, Math.max(0, (0.5 + dx / scale) * 255)));
      px[o + 1] = Math.round(Math.min(255, Math.max(0, (0.5 + dy / scale) * 255)));
      px[o + 2] = 128; px[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return { url: c.toDataURL("image/png"), scale, big };
}
function buildLens(g) {
  const w = Math.round(g.offsetWidth), h = Math.round(g.offsetHeight);
  if (w < 8 || h < 8) return;
  let st = lensState.get(g);
  if (st && st.w === w && st.h === h) return;
  const r = radiusOf(g, w, h);
  const m = lensMap(w, h, r);
  const id = st ? st.id : "lg" + lensSeq++;
  const textHeavy = g.matches(".panel,.feat,.lines,.hero-card,.r-panel,.sheet");
  const blur = textHeavy ? 4.5 : m.big ? 3.5 : 2;
  const S = m.scale.toFixed(1), sat = textHeavy ? 1.55 : 1.75;
  const ca = !m.big;   // chromatic split only on panes small enough for it to stay cheap
  const disp = ca
    ? `<feDisplacementMap in="b" in2="m" scale="${S}" xChannelSelector="R" yChannelSelector="G" result="dr"/>
       <feDisplacementMap in="b" in2="m" scale="${(m.scale * 0.955).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="dg"/>
       <feDisplacementMap in="b" in2="m" scale="${(m.scale * 0.91).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="db"/>
       <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="cr"/>
       <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="cg"/>
       <feColorMatrix in="db" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="cb"/>
       <feComposite in="cr" in2="cg" operator="arithmetic" k2="1" k3="1" result="rg"/>
       <feComposite in="rg" in2="cb" operator="arithmetic" k2="1" k3="1" result="d"/>`
    : `<feDisplacementMap in="b" in2="m" scale="${S}" xChannelSelector="R" yChannelSelector="G" result="d"/>`;
  const f = `<filter id="${id}" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" edgeMode="duplicate" result="b"/>
    <feImage href="${m.url}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/>
    ${disp}
    <feColorMatrix in="d" type="saturate" values="${sat}"/>
  </filter>`;
  let node = st && D.getElementById(id);
  if (node) node.outerHTML = f; else lgDefs.insertAdjacentHTML("beforeend", f);
  lensState.set(g, { id, w, h });
  const v = `url(#${id})`;
  g.style.webkitBackdropFilter = v; g.style.backdropFilter = v;
  g.classList.add("lg-on");
}
let lensQ = new Set(), lensT = 0;
const lensRO = LENS && typeof ResizeObserver !== "undefined" ? new ResizeObserver((es) => { es.forEach((e) => lensQ.add(e.target)); clearTimeout(lensT); lensT = setTimeout(flushLens, 140); }) : null;
function flushLens() { lensQ.forEach((g) => { try { buildLens(g); } catch (e) {} }); lensQ.clear(); }
const observed = new WeakSet();
function scanGlass() {
  G = glassEls();
  G.forEach(glassLight);
  if (!LENS) return;
  for (const g of G) {
    if (observed.has(g)) continue;
    if (g.classList.contains("primary") || (g.parentElement && g.parentElement.closest(".glass"))) { observed.add(g); continue; }
    observed.add(g); lensQ.add(g); if (lensRO) lensRO.observe(g);
  }
  flushLens();
}
setInterval(scanGlass, 1500);

/* light for the rim: the painted sun (or moon), blended with the cursor */
function lightSource() {
  const s0 = cur.scroll, e = s0 * s0 * (3 - 2 * s0), H = -0.03 + e * 0.3;
  const useMoon = cur.sunGlow < 0.25 && cur.moonVis > 0.2;
  const X = useMoon ? cur.moonX : cur.sunX, Y = useMoon ? cur.moonY : cur.sunY;
  const k = useMoon ? cur.moonVis * 0.6 : clamp(cur.sunGlow * 1.2, 0, 1);
  return { x: innerWidth * 0.5 * (1 + X), y: innerHeight * (0.5 - (H + 0.045 + Y * 0.42)), k };
}
function rim() {
  const L = lightSource(), kInt = 0.7 + 0.3 * Math.max(L.k, cur.day);
  for (const g of G) {
    const r = rectOf(g);
    if (r.bottom < -50 || r.top > innerHeight + 50) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let sx = L.x - cx, sy2 = L.y - cy; const sl = Math.hypot(sx, sy2) || 1; sx /= sl; sy2 /= sl;
    let ux = mx - cx, uy = my - cy; const ul = Math.hypot(ux, uy) || 1; const near = Math.exp(-ul / 520); ux /= ul; uy /= ul;
    // default key light from the top-left; the sun pulls it round; a nearby cursor pulls it further
    let lx = -0.7, ly = -0.7;
    lx = lerp(lx, sx, 0.75 * L.k); ly = lerp(ly, sy2, 0.75 * L.k);
    lx = lerp(lx, ux, 0.55 * near); ly = lerp(ly, uy, 0.55 * near);
    const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;
    const ang = (Math.atan2(lx, -ly) * DEG + 360) % 360;
    const st = glassLight(g).style;
    st.setProperty("--mx", (mx - r.left).toFixed(0) + "px"); st.setProperty("--my", (my - r.top).toFixed(0) + "px");
    st.setProperty("--la", ang.toFixed(1) + "deg");
    st.setProperty("--rimk", kInt.toFixed(2));
    // Direct shadow values keep the identical rim/shadow rendering without
    // inheriting frequently changing --lx/--ly through every child in the card.
    const x = lx.toFixed(3), y = ly.toFixed(3), k = kInt.toFixed(2);
    g.style.boxShadow = `inset calc(${x} * -1.4px) calc(${y} * -1.4px) 0 -.4px rgba(255,255,255,calc(.42 * ${k})),
      inset calc(${x} * 1.2px) calc(${y} * 1.2px) 0 -.4px rgba(255,255,255,calc(.14 * ${k})),
      inset 1px 0 0 -.3px rgba(255,90,70,.10),inset -1px 0 0 -.3px rgba(80,160,255,.12),
      inset 0 0 0 1px var(--glass-brd),inset 0 0 26px rgba(255,255,255,.06),
      inset 0 -16px 30px -18px rgba(0,0,0,.2),0 1px 2px rgba(0,0,0,.10),0 22px 50px -26px rgba(0,0,0,.5)`;
  }
}

/* spring morph for interactive glass: grows by a few px, leans toward the pointer, squashes on press */
const springs = new Map();
const SPRINGY = ".jelly,#nav";
function spr(elm) { let s = springs.get(elm); if (!s) { s = { el: elm, sx: 1, sy: 1, tx: 0, ty: 0, vsx: 0, vsy: 0, vtx: 0, vty: 0, hover: false, press: false }; springs.set(elm, s); } return s; }
if (!RM) {
  D.addEventListener("pointerover", (e) => { const t = e.target.closest && e.target.closest(SPRINGY); if (t && e.pointerType !== "touch") spr(t).hover = true; });
  D.addEventListener("pointerout", (e) => { const t = e.target.closest && e.target.closest(SPRINGY); if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) { const s = spr(t); s.hover = false; s.press = false; } });
  D.addEventListener("pointerdown", (e) => { const t = e.target.closest && e.target.closest(SPRINGY); if (t) { const s = spr(t); s.press = true; s.vsx += 0.6; s.vsy -= 0.8; } });
  addEventListener("pointerup", () => springs.forEach((s) => { if (s.press) { s.press = false; s.vsy += 1.2; s.vsx -= 0.7; } }));
  addEventListener("pointercancel", () => springs.forEach((s) => (s.press = false)));
}
function springTick(dt) {
  if (!springs.size) return;
  const K = 380, C = 17, h = Math.min(dt, 1 / 30);
  springs.forEach((s, elm) => {
    const size = frameSizes && frameSizes.get(elm);
    const w = (size ? size[0] : elm.offsetWidth) || 1, ht = (size ? size[1] : elm.offsetHeight) || 1;
    let tsx = 1, tsy = 1, ttx = 0, tty = 0;
    if (s.hover || s.press) {
      const r = rectOf(elm);
      const dx = clamp((mx - (r.left + r.width / 2)) / (r.width / 2), -1, 1), dy = clamp((my - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
      const grow = Math.min(0.045, 7 / Math.max(w, ht));
      tsx = 1 + grow + Math.abs(dx) * Math.min(0.02, 4 / w); tsy = 1 + grow + Math.abs(dy) * Math.min(0.02, 4 / ht);
      ttx = dx * Math.min(5, w * 0.02); tty = dy * Math.min(4, ht * 0.03);
      if (s.press) { tsx = 1 + Math.min(0.06, 10 / w); tsy = 1 - Math.min(0.08, 7 / ht); }
    }
    s.vsx += (K * (tsx - s.sx) - C * s.vsx) * h; s.sx += s.vsx * h;
    s.vsy += (K * (tsy - s.sy) - C * s.vsy) * h; s.sy += s.vsy * h;
    s.vtx += (K * (ttx - s.tx) - C * s.vtx) * h; s.tx += s.vtx * h;
    s.vty += (K * (tty - s.ty) - C * s.vty) * h; s.ty += s.vty * h;
    const rest = !s.hover && !s.press && Math.abs(s.sx - 1) + Math.abs(s.sy - 1) < 1e-3 && Math.abs(s.tx) + Math.abs(s.ty) < 0.05 && Math.abs(s.vsx) + Math.abs(s.vsy) + Math.abs(s.vtx) + Math.abs(s.vty) < 0.02;
    if (rest) { elm.style.scale = ""; elm.style.translate = ""; springs.delete(elm); return; }
    elm.style.scale = `${s.sx.toFixed(4)} ${s.sy.toFixed(4)}`;
    elm.style.translate = `${s.tx.toFixed(2)}px ${s.ty.toFixed(2)}px`;
  });
}

/* ================= brush cursor: oriented tip, wet-paint trail, ring/magnifier, click splash ================= */
const trail = el("trail"), tctx = trail.getContext("2d");
let DPRc = 1;
function sizeTrail() { DPRc = Math.min(devicePixelRatio || 1, 2); trail.width = Math.round(innerWidth * DPRc); trail.height = Math.round(innerHeight * DPRc); tctx.setTransform(DPRc, 0, 0, DPRc, 0, 0); }
sizeTrail(); addEventListener("resize", sizeTrail);
const C = { on: false, x: mx, y: my, px: mx, py: my, vx: 0, vy: 0, ang: -0.6, sp: 0, m: 0, mv: 0, mode: 0, R: 18, Rt: 18, pts: [], drops: [], rings: [], last: 0, inside: false, dirty: true, press: 0 };
const paintRGB = () => {
  // a pigment pulled from the current sky: horizon glow by day, sun at golden hours, moonlit blue at night
  const warm = mix3(cur.hor, cur.sun, 0.45 * cur.sunGlow);
  let c = mix3(warm, mix3([0.55, 0.68, 0.98], cur.zen, 0.3), cur.night * 0.8);
  const L = lum(c), sat = 1.55;
  c = c.map((x) => clamp(L + (x - L) * sat, 0, 1));
  const tl = lum(c); if (tl < 0.32) c = c.map((x) => clamp(x + (0.32 - tl), 0, 1));
  return c;
};
const rgbS = (c, a) => `rgba(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0},${a})`;
const TRAIL_MS = 1100;
if (FINE) {
  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") { C.on = false; return; }
    const now = performance.now();
    C.on = true; C.inside = true;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      const x = ev.clientX, y = ev.clientY, lp = C.pts[C.pts.length - 1];
      if (!lp || Math.hypot(x - lp.x, y - lp.y) > 2.2) C.pts.push({ x, y, t: now, c: paintRGB(), w: 0 });
    }
    if (C.pts.length > 140) C.pts.splice(0, C.pts.length - 140);
  }, { passive: true });
  D.addEventListener("pointerleave", () => { C.inside = false; });
  D.documentElement.addEventListener("mouseleave", () => { C.inside = false; });
  addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || RM) return;
    const c = paintRGB(), n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, v = 90 + Math.random() * 240;
      C.drops.push({ x: e.clientX, y: e.clientY, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, r: 1.4 + Math.random() * 2.8, t: 0, life: 0.5 + Math.random() * 0.45, c });
    }
    C.rings.push({ x: e.clientX, y: e.clientY, t: 0, c });
    C.press = 1;
  }, { passive: true });
  D.addEventListener("pointerover", (e) => {
    const t = e.target.closest && e.target.closest("a,button,.card,[role=button],[data-copy]");
    C.mode = t ? (t.classList.contains("card") ? 2 : 1) : 0;
    C.Rt = C.mode === 2 ? 26 : 17;
  });
}
function strokeRibbon(P, now) {
  // variable-width wet ribbon; width follows speed, fades and dries with age
  const n = P.length; if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], p = P[i];
    let tx = b.x - a.x, ty = b.y - a.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const age = clamp((now - p.t) / TRAIL_MS, 0, 1);
    const head = i / (n - 1);
    const w = (1.2 + 5.2 * Math.pow(head, 0.8)) * (1 - age * 0.75) * (0.8 + 0.4 * Math.sin(i * 0.9 + p.t * 0.01) * 0.25);
    L.push([p.x - ty * w, p.y + tx * w]); R.push([p.x + ty * w, p.y - tx * w]);
  }
  tctx.beginPath(); tctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) { const m0 = L[i - 1], m1 = L[i]; tctx.quadraticCurveTo(m0[0], m0[1], (m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2); }
  tctx.lineTo(L[n - 1][0], L[n - 1][1]); tctx.lineTo(R[n - 1][0], R[n - 1][1]);
  for (let i = n - 2; i >= 0; i--) { const m0 = R[i + 1], m1 = R[i]; tctx.quadraticCurveTo(m0[0], m0[1], (m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2); }
  tctx.closePath();
}
function drawTrail(now, dt) {
  if (!FINE) return;
  const ctx = tctx;
  // cursor kinematics
  const ox = C.x, oy = C.y;
  C.x = mx; C.y = my;
  const ivx = (C.x - ox) / Math.max(dt, 1 / 240), ivy = (C.y - oy) / Math.max(dt, 1 / 240);
  const a = 1 - Math.exp(-dt * 18); C.vx += (ivx - C.vx) * a; C.vy += (ivy - C.vy) * a;
  const spd = Math.hypot(C.vx, C.vy);
  C.sp += (Math.min(1, spd / 1800) - C.sp) * (1 - Math.exp(-dt * 12));
  if (spd > 40) { const ta = Math.atan2(C.vy, C.vx); let d = ta - C.ang; d = Math.atan2(Math.sin(d), Math.cos(d)); C.ang += d * (1 - Math.exp(-dt * 14)); }
  const mt = C.mode ? 1 : 0; C.mv += ((mt - C.m) * 260 - C.mv * 22) * Math.min(dt, 1 / 30); C.m += C.mv * Math.min(dt, 1 / 30);
  C.R += (C.Rt - C.R) * (1 - Math.exp(-dt * 14));
  C.press = Math.max(0, C.press - dt * 4);
  C.pts = C.pts.filter((p) => now - p.t < TRAIL_MS);
  C.drops = C.drops.filter((d) => d.t < d.life); C.rings = C.rings.filter((r) => r.t < 0.55);
  const idle = !C.pts.length && !C.drops.length && !C.rings.length;
  if (!C.on) { if (C.dirty) { ctx.clearRect(0, 0, innerWidth, innerHeight); C.dirty = false; } return; }
  ctx.clearRect(0, 0, innerWidth, innerHeight); C.dirty = true;
  const pc = paintRGB();
  const darkInk = themeT > 0.5;
  // wet trail
  if (!RM && C.pts.length > 1) {
    const P = C.pts.concat([{ x: C.x, y: C.y, t: now, c: pc }]);
    ctx.save();
    // body: older segments are drier (darker, less saturated, more transparent)
    const g = ctx.createLinearGradient(P[0].x, P[0].y, C.x, C.y);
    const c0 = P[0].c, dry = c0.map((x) => x * 0.72 + lum(c0) * 0.1);
    g.addColorStop(0, rgbS(dry, 0)); g.addColorStop(0.45, rgbS(mix3(dry, pc, 0.5), 0.28)); g.addColorStop(1, rgbS(pc, 0.62));
    strokeRibbon(P, now); ctx.fillStyle = g; ctx.fill();
    // wet edge: pigment pools at the rim of a drying stroke
    ctx.lineWidth = 1; ctx.strokeStyle = rgbS(pc.map((x) => x * 0.55), 0.22); ctx.stroke();
    // gloss: a thin highlight riding along the fresh part
    const n = P.length, k0 = Math.max(0, n - 18);
    ctx.beginPath(); ctx.moveTo(P[k0].x - 1.2, P[k0].y - 1.6);
    for (let i = k0 + 1; i < n; i++) ctx.lineTo(P[i].x - 1.2, P[i].y - 1.6);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 1.1; ctx.strokeStyle = "rgba(255,255,255,.38)"; ctx.stroke();
    ctx.restore();
  }
  // splash
  for (const d of C.drops) {
    d.t += dt; d.vy += 520 * dt; d.vx *= Math.exp(-dt * 3); d.vy *= Math.exp(-dt * 2);
    d.x += d.vx * dt; d.y += d.vy * dt;
    const k = 1 - d.t / d.life, sp2 = Math.hypot(d.vx, d.vy);
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(Math.atan2(d.vy, d.vx));
    if (k <= 0) { ctx.restore(); continue; }
    ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0.01, d.r * (1 + sp2 / 260)), Math.max(0.01, d.r * k), 0, 0, Math.PI * 2);
    ctx.fillStyle = rgbS(d.c, 0.85 * k); ctx.fill(); ctx.restore();
  }
  for (const r of C.rings) {
    r.t += dt; const k = Math.min(1, r.t / 0.55);
    ctx.beginPath(); ctx.arc(r.x, r.y, 6 + 30 * (1 - Math.pow(1 - k, 3)), 0, Math.PI * 2);
    ctx.lineWidth = 2.2 * (1 - k); ctx.strokeStyle = rgbS(r.c, 0.7 * (1 - k)); ctx.stroke();
  }
  if (!C.inside) return;
  // tip ↔ ring morph
  const m = clamp(C.m, -0.15, 1.15), mm = clamp(m, 0, 1);
  ctx.save(); ctx.translate(C.x, C.y);
  const outline = darkInk ? "rgba(20,26,24,.85)" : "rgba(255,255,255,.92)";
  if (mm < 0.98) {
    ctx.save();
    const s = 1 - mm;
    ctx.globalAlpha = s;
    ctx.rotate(C.ang);
    const st = 1 + C.sp * 1.6, sq = 1 / Math.sqrt(st);
    const len = 15 * st * (1 - 0.15 * C.press), wid = 5.4 * sq * (1 + 0.4 * C.press);
    // brush tip: the hot spot sits at the pointer; the belly trails behind it
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-len * 0.18, -wid * 1.05, -len * 0.75, -wid * 1.1, -len, -wid * 0.35);
    ctx.quadraticCurveTo(-len * 1.08, 0, -len, wid * 0.35);
    ctx.bezierCurveTo(-len * 0.75, wid * 1.1, -len * 0.18, wid * 1.05, 0, 0);
    ctx.closePath();
    ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1.5;
    const gg = ctx.createLinearGradient(0, -wid, 0, wid);
    gg.addColorStop(0, rgbS(pc.map((x) => Math.min(1, x * 1.18 + 0.06)), 1)); gg.addColorStop(0.55, rgbS(pc, 1)); gg.addColorStop(1, rgbS(pc.map((x) => x * 0.7), 1));
    ctx.fillStyle = gg; ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 1.2; ctx.strokeStyle = outline; ctx.stroke();
    // bristle streaks
    ctx.lineWidth = 0.7; ctx.strokeStyle = "rgba(0,0,0,.22)";
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-len * 0.12, i * wid * 0.22); ctx.quadraticCurveTo(-len * 0.55, i * wid * 0.62, -len * 0.92, i * wid * 0.3); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-len * 0.2, -wid * 0.5); ctx.quadraticCurveTo(-len * 0.55, -wid * 0.85, -len * 0.82, -wid * 0.5);
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.restore();
  }
  if (mm > 0.02) {
    const R = C.R * (0.5 + 0.5 * m) * (1 - 0.12 * C.press);
    ctx.globalAlpha = mm;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = rgbS(pc, 0.12); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = outline; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R - 3, Math.PI * 1.05, Math.PI * 1.45);
    ctx.lineWidth = 1.4; ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.lineWidth = 3.2; ctx.strokeStyle = rgbS(pc, 0.35); ctx.stroke();
    if (C.mode === 2) {   // magnifier handle for cards
      const hx = Math.cos(Math.PI / 4) * R, hy = Math.sin(Math.PI / 4) * R;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 9 * mm, hy + 9 * mm); ctx.lineCap = "round"; ctx.lineWidth = 3.4; ctx.strokeStyle = outline; ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = rgbS(pc, 0.9); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fillStyle = rgbS(pc, 1); ctx.fill();
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
/* pointer position feeds the grass, the glass rim and the cursor */
addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; moved = true; }, { passive: true });
addEventListener("pointerdown", (e) => { mx = e.clientX; my = e.clientY; moved = true; }, { passive: true });

/* ================= intro ================= */
const intro = el("intro"); const t0 = performance.now();
let introGone = false;
function hideIntro() { if (introGone) return; introGone = true; intro.classList.add("gone"); setTimeout(() => { intro.remove(); }, 900); }
setTimeout(hideIntro, 2000);
window.__firstFrame = () => setTimeout(hideIntro, Math.max(0, 900 - (performance.now() - t0)));

/* ================= main loop ================= */
computeTargets(true); applyTheme(); updateReadout();
setInterval(updateReadout, 1000);
let rimT = 0, last = performance.now(), simT = 0, nextFlash = performance.now() + 4000, themeAcc = 0, flashSeq = [];
function readFrameGeometry(revealDue, themeDue, rimDue) {
  const pending = new Set();
  if (revealDue) {
    rvs.forEach((n) => { if (!n.classList.contains("in")) pending.add(n); });
    sections.forEach((n) => { if (n) pending.add(n); });
    if (!metricsDone && el("metrics")) pending.add(el("metrics"));
  }
  if (themeDue) {
    if (!freeEls.length) freeEls = FREE();
    freeEls.forEach((n) => pending.add(n));
  }
  if (rimDue) G.forEach((n) => pending.add(n));
  if (creekPath) pending.add(creek);
  frameSizes = new Map();
  springs.forEach((s, n) => {
    frameSizes.set(n, [n.offsetWidth, n.offsetHeight]);
    if (s.hover || s.press) pending.add(n);
  });
  frameRects = new Map();
  pending.forEach((n) => frameRects.set(n, n.getBoundingClientRect()));
}
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.1); last = now;
  simT += dt * (RM ? 0.25 : 1);
  stepSky(dt);
  // lightning
  if (cur.storm > 0.5 && now > nextFlash && !RM) { nextFlash = now + 3000 + Math.random() * 7000; const b = now; flashSeq = [[b, 1], [b + 90, 0.15], [b + 160, 0.8], [b + 420, 0]]; }
  let f = 0; for (const [ts, v] of flashSeq) if (now >= ts) f = v; cur.flash += (f - cur.flash) * (f > cur.flash ? 1 : 1 - Math.exp(-dt * 7));
  // scroll
  const target = window.scrollY;
  const scrolling = Math.abs(target - sy) > 0.5;
  sy = target;
  const prog = clamp(sy / docH, 0, 1);
  cur.scroll = window.__forceScroll != null ? window.__forceScroll : prog; cur.time = simT;
  cur.mouse[0] += (mx / innerWidth - cur.mouse[0]) * (1 - Math.exp(-dt * 6));
  cur.mouse[1] += (1 - my / innerHeight - cur.mouse[1]) * (1 - Math.exp(-dt * 6));
  if (progB) progB.style.transform = `scaleX(${prog.toFixed(4)})`;
  revealT += dt; themeAcc += dt; rimT += dt;
  const revealDue = revealT > 0.09, themeDue = themeAcc > 0.25;
  const rimDue = moved || scrolling || rimT > 0.2;
  readFrameGeometry(revealDue, themeDue, rimDue);
  if (revealDue) { revealT = 0; revealCheck();
    let a = secIds[0]; sections.forEach((s, i) => { if (s && rectOf(s).top < innerHeight * 0.45) a = secIds[i]; });
    if (a !== activeSec) { activeSec = a; navLinks.forEach((n) => n.classList.toggle("on", n.dataset.go === a && a !== "hero")); }
  }
  if (themeDue) { themeAcc = 0; applyTheme(); inkByRegion(); }
  if (rimDue) { rim(); moved = false; rimT = 0; }
  try { springTick(dt); } catch (e) {}
  try { drawTrail(now, dt); } catch (e) {}
  creekTick(simT);
  frameRects = null; frameSizes = null;
  if (window.GLRender) { try { window.GLRender(cur, dt, now); } catch (e) { window.GLRender = null; D.body.classList.add("nogl"); } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setTimeout(layoutCreek, 50);
setTimeout(scanGlass, 30);
if (D.fonts && D.fonts.ready) D.fonts.ready.then(() => { measure(); layoutCreek(); });
})();
