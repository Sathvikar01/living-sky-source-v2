(() => {
"use strict";
const canvas = document.getElementById("sky");
let gl = null;
try { gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" }); } catch (e) { gl = null; }
if (!gl) { document.body.classList.add("nogl"); return; }

const VS = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }`;

const COMMON = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime, uScroll; uniform vec2 uMouse;
uniform vec3 uZen, uHor, uSunCol, uAmb, uFogCol;
uniform vec2 uSun, uMoon;
uniform float uSunVis, uSunGlow, uMoonVis, uMoonPhase, uNight, uDay, uCloud, uRain, uWet, uFog, uStorm, uFlash, uSnow, uWind, uWindX;
float h11(float n){ return fract(sin(n*127.1)*43758.5453); }
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
const mat2 MR = mat2(1.6,1.2,-1.2,1.6);
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=MR*p; a*=.5; } return s; }
float fbm3(vec2 p){ float s=0., a=.5; for(int i=0;i<3;i++){ s+=a*vn(p); p=MR*p; a*=.5; } return s; }
float n1(float x){ float i=floor(x), f=fract(x); return mix(h11(i),h11(i+1.),f*f*(3.-2.*f)); }
float ridge(float x){ return n1(x)*.55 + n1(x*2.13+3.1)*.27 + n1(x*4.37+7.7)*.12 + n1(x*9.1+1.3)*.06; }
float lum(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }
float ease(float s){ return s*s*(3.-2.*s); }
float horizonY(){ return -0.03 + ease(uScroll)*0.30; }
vec2 sunP(float H, float asp){ return vec2(uSun.x*asp*.5, H + .045 + uSun.y*.42); }
vec2 moonP(float H, float asp){ return vec2(uMoon.x*asp*.5, H + .045 + uMoon.y*.42); }
`;

/* ---------------- pass 1: the landscape ---------------- */
const SCENE = COMMON + `
out vec4 o;
float asp;

vec4 clouds(vec2 p, float H, vec2 sp){
  float h = p.y - H;
  if (h < -0.01) return vec4(0.);
  float z = 1./(h + .22);
  vec2 q = vec2(p.x*z*.9, z*1.6);
  float drift = uTime*(.012 + .05*uWind)*(uWindX >= 0. ? 1. : -1.);
  q.x += drift; 
  vec2 w = vec2(fbm3(q*1.2 + vec2(0., uTime*.004)), fbm3(q*1.2 + vec2(5.2, 1.3)));
  float d = fbm(q*1.5 + w*1.5);
  float cov = mix(.70, .26, uCloud);
  float a = smoothstep(cov, cov + .20 + .1*uCloud, d);
  a *= smoothstep(-.01, .07, h);
  vec2 toSun = normalize(sp - p + 1e-4);
  float d2 = fbm(q*1.5 + w*1.5 + toSun*vec2(.10,-.10));
  float light = clamp((d - d2)*5. + .45, 0., 1.);
  vec3 body = mix(uAmb*.78, vec3(lum(uHor)), .3);
  body = mix(body, vec3(lum(body))*.75, uStorm*.6);
  vec3 lit = uSunCol*1.0 + uHor*.12 + .06;
  vec3 col = mix(body*.8, lit, light*uSunGlow*.8 + .1);
  col = mix(col, col*vec3(.55,.58,.66), uStorm*.7);
  // moonlit rims at night
  vec2 mp = moonP(H, asp);
  col += vec3(.20,.24,.34)*uMoonVis*uNight*exp(-length(p-mp)*3.)*light;
  col += vec3(.75,.78,.95)*uFlash*(.5 + a);
  return vec4(col, a*(.88 + .12*uCloud));
}

vec3 sky(vec2 p, float H, out float starMask){
  float h = max(p.y - H, 0.);
  float g = clamp(h/.62, 0., 1.);
  vec3 c = mix(uHor, uZen, pow(g, .55));
  vec2 sp = sunP(H, asp);
  float ds = length(p - sp);
  c += uSunCol*(exp(-ds*3.)*.42 + exp(-ds*10.)*.55)*uSunGlow;
  float low = 1. - smoothstep(-.05, .30, sp.y - H);
  c += uSunCol*low*.45*exp(-abs(p.y - H)*7.)*exp(-abs(p.x - sp.x)*1.1)*uSunGlow;
  // sun disc
  float disc = smoothstep(.036, .029, ds);
  c = mix(c, uSunCol*1.25 + vec3(.12,.1,.05), disc*uSunVis);
  // moon
  vec2 mp = moonP(H, asp);
  vec2 md = (p - mp)/.028;
  float mr = length(md);
  float mdisc = smoothstep(1.05, .95, mr);
  c += vec3(.55,.6,.75)*exp(-length(p-mp)*14.)*.18*uMoonVis;
  if (mdisc > 0.) {
    float yy = clamp(md.y, -1., 1.);
    float edge = sqrt(max(0., 1. - yy*yy));
    float ph = uMoonPhase < .5 ? uMoonPhase : 1. - uMoonPhase;
    float xs = uMoonPhase < .5 ? md.x : -md.x;
    float term = edge*cos(6.2831853*ph);
    float lit = smoothstep(term - .08, term + .08, xs);
    vec3 surf = vec3(.93,.91,.84)*(.82 + .18*fbm3(md*2.3 + 4.));
    vec3 mc = mix(vec3(.05,.07,.12) + c*.25, surf, lit);
    c = mix(c, mc, mdisc*uMoonVis);
  }
  vec4 cl = clouds(p, H, sp);
  c = mix(c, cl.rgb, cl.a);
  starMask = (1. - cl.a)*(1. - mdisc*uMoonVis)*smoothstep(H + .02, H + .15, p.y);
  return c;
}

/* hills and the far bank */
float farTop(float x, float H){ return H + .035 + ridge(x*2.1 + 1.3)*.11; }
float midTop(float x, float H){ return H + .004 + ridge(x*3.3 + 8.2)*.055 + smoothstep(.55,.85,n1(x*46.))*.011 + smoothstep(.6,.9,n1(x*23.+4.))*.016; }
vec3 landLight(vec3 base){ return base*(uAmb*1.05 + .03); }
vec3 farScene(vec2 p, float H, out float starMask){
  // Hills are opaque: evaluate the frontmost surface before the cloud field.
  // This is the same compositing order, without shading pixels it overwrites.
  float mx = (uMouse.x - .5)*.012;
  float mt = midTop(p.x + mx*.6, H);
  if (p.y < mt) {
    float k = clamp((mt - p.y)/.06, 0., 1.);
    vec3 hc = landLight(mix(vec3(.17,.27,.17), vec3(.12,.2,.12), k));
    hc = mix(hc, uHor*.7, .26);
    hc *= 1. - .25*uWet;
    hc = mix(hc, uFogCol, uFog*.7);
    hc = mix(hc, landLight(vec3(.85,.88,.92)), uSnow*.45*(1.-k));
    starMask = 0.; return hc;
  }
  float ft = farTop(p.x + mx*.3, H);
  if (p.y < ft) {
    float k = clamp((ft - p.y)/.1, 0., 1.);
    vec3 hc = landLight(mix(vec3(.30,.42,.46), vec3(.22,.32,.3), k));
    hc = mix(hc, uHor*.9 + uSunCol*uSunGlow*.08, .52);
    hc = mix(hc, uFogCol, uFog*.85);
    starMask = 0.; return hc;
  }
  return sky(p, H, starMask);
}

/* trees: rain tree (Samanea) and gulmohar */
vec4 leafVor(vec2 x){
  vec2 ip = floor(x), fp = fract(x); float md = 8.; vec2 mr = vec2(0.), mi = vec2(0.);
  for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++){
    vec2 g = vec2(float(i), float(j));
    vec2 o = vec2(h21(ip + g), h21(ip + g + 19.7));
    vec2 r = g + o - fp; float dd = dot(r, r);
    if (dd < md){ md = dd; mr = r; mi = ip + g; }
  }
  return vec4(sqrt(md), h21(mi + 3.3), mr);
}
float sdSeg(vec2 p, vec2 a, vec2 b, float ra, float rb){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h) - mix(ra,rb,h); }
float sdEll(vec2 p, vec2 c, vec2 r){ vec2 q=(p-c)/r; return (length(q)-1.)*min(r.x,r.y); }
// returns (trunk sdf, canopy sdf)
vec2 rainTree(vec2 q, float sw){
  q.x -= sw*max(q.y-.25,0.)*max(q.y-.25,0.)*.25;
  float t = sdSeg(q, vec2(0,0), vec2(-.02,.33), .05, .032);
  t = min(t, sdSeg(q, vec2(-.02,.30), vec2(-.40,.56), .03, .012));
  t = min(t, sdSeg(q, vec2(-.02,.30), vec2(.36,.58), .028, .012));
  t = min(t, sdSeg(q, vec2(-.01,.32), vec2(.05,.63), .022, .01));
  float c = sdEll(q, vec2(0.,.66), vec2(.88,.19));
  c = min(c, sdEll(q, vec2(-.46,.61), vec2(.42,.16)));
  c = min(c, sdEll(q, vec2(.47,.63), vec2(.44,.16)));
  c = min(c, sdEll(q, vec2(-.05,.76), vec2(.56,.15)));
  c += (fbm3(q*8. + 3.) - .5)*.11 + (vn(q*26.) - .5)*.035;
  return vec2(t, c);
}
vec2 gulmohar(vec2 q, float sw){
  q.x -= sw*max(q.y-.2,0.)*max(q.y-.2,0.)*.3;
  float t = sdSeg(q, vec2(0,0), vec2(.03,.28), .045, .03);
  t = min(t, sdSeg(q, vec2(.03,.26), vec2(-.42,.47), .026, .01));
  t = min(t, sdSeg(q, vec2(.03,.26), vec2(.45,.5), .026, .01));
  t = min(t, sdSeg(q, vec2(.03,.27), vec2(.1,.52), .02, .01));
  float c = sdEll(q, vec2(0.,.55), vec2(.82,.13));
  c = min(c, sdEll(q, vec2(-.45,.5), vec2(.38,.12)));
  c = min(c, sdEll(q, vec2(.5,.52), vec2(.4,.12)));
  c = min(c, sdEll(q, vec2(.05,.63), vec2(.5,.11)));
  c += (fbm3(q*9. + 11.) - .5)*.1 + (vn(q*30.) - .5)*.03;
  return vec2(t, c);
}
// composite a tree; kind 0 rain tree, 1 gulmohar
vec3 drawTree(vec3 col, vec2 p, vec2 base, float sc, float kind, float fogK, inout float solid){
  vec2 q = (p - base)/sc;
  if (q.x < -1.1 || q.x > 1.1 || q.y < -.05 || q.y > 1.) return col;
  float sw = (sin(uTime*.9 + base.x*3.)*.5 + .5*sin(uTime*1.7 + base.x))*(.15 + .85*uWind)*.18 + uWindX*uWind*.12;
  vec2 d = kind < .5 ? rainTree(q, sw) : gulmohar(q, sw);
  // leaf clusters: a cellular field gives each clump its own dome, a serrated silhouette and dark gaps
  float lf = 24.*clamp(sc/.3, .5, 1.1);
  vec4 lv = leafVor(q*vec2(lf*.8, lf*1.5) + kind*7.3);
  d.y += (lv.x - .38)*.026;
  float aa = 1.1/(uRes.y*sc);
  float mt = smoothstep(aa, -aa, d.x), mc = smoothstep(aa, -aa, d.y);
  if (mt + mc <= 0.) return col;
  vec3 trunk = landLight(vec3(.13,.09,.07));
  float top = clamp((q.y - .5)/.3, 0., 1.);
  float sunSide = clamp(.5 + .5*sign(uSun.x)*q.x, 0., 1.)*uSunGlow;
  vec3 leaf = kind < .5 ? vec3(.12,.21,.10) : vec3(.13,.22,.09);
  leaf = landLight(leaf*(.75 + .6*top + .35*sunSide) + vec3(.02,.03,0.)*fbm3(q*14.));
  {
    vec2 sd2 = normalize(vec2(sign(uSun.x + 1e-3)*.75, .66));
    float dome = 1. - smoothstep(0., .62, lv.x);
    float lit = dot(-lv.zw/max(length(lv.zw), 1e-3), sd2)*smoothstep(.0, .3, lv.x);
    float gap = smoothstep(.44, .66, lv.x);
    leaf *= (.8 + .22*dome + .24*lit*(.35 + .65*uSunGlow))*(1. - .3*gap)*(.88 + .24*lv.y);
    leaf += uSunCol*uSunGlow*.05*max(lit, 0.)*dome*top;
  }
  if (kind > .5) {
    float fl = smoothstep(.5, .72, fbm3(q*16. + 2.))*smoothstep(-.02, -.06, d.y + .0);
    vec3 flame = landLight(vec3(.92,.30,.14))*(1. + .35*top);
    leaf = mix(leaf, flame, fl*.9*(1. - uSnow*.6));
  }
  leaf = mix(leaf, landLight(vec3(.9,.92,.95)), uSnow*.5*top);
  leaf *= 1. - .2*uWet;
  vec3 tc = mix(trunk, leaf, mc);
  tc = mix(tc, uFogCol, uFog*fogK);
  float m = max(mt, mc);
  solid = max(solid, m);
  return mix(col, tc, m);
}

float bankTop(float x, float s){ return -.215 + s*.36 + ridge(x*1.5 + 20.)*.07; }
float grassTop(float x, float s){ return -.43 + s*.27 + ridge(x*2.3 + 40.)*.04; }

void main(){
  vec2 fc = gl_FragCoord.xy;
  asp = uRes.x/uRes.y;
  vec2 p = (fc - .5*uRes)/uRes.y;
  float s = ease(uScroll);
  float H = horizonY();
  vec2 mo = (uMouse - .5);
  vec2 mouseP = vec2(mo.x*asp, mo.y);
  float star = 0.;
  vec3 col = vec3(0.);
  float bx = p.x - mo.x*.02;
  float bt = bankTop(bx, s);
  float gt = grassTop(p.x, s);
  float solid = 0.;
  // The meadow replaces every underlying layer below gt.
  if (p.y >= gt) {
  // The near bank similarly replaces the sky and lake below bt.
  if (p.y >= bt) {
  if (p.y >= H) {
    col = farScene(p, H, star);
  } else {
    // lake: reflection of the far scene
    float depth = (H - p.y);
    float rip = sin(p.y*220./(depth*4.+.2) + uTime*1.3 + vn(vec2(p.x*9., p.y*60.))*5.)*(.0015 + .004*uWind)*(.4 + depth*6.);
    vec2 rp = vec2(p.x + rip, 2.*H - p.y + depth*.04);
    float sm;
    vec3 refl = farScene(rp, H, sm);
    vec3 deep = landLight(vec3(.05,.10,.12));
    float fres = mix(.9, .55, clamp(depth/.18, 0., 1.));
    col = mix(deep, refl*.86, fres);
    // sun glitter
    vec2 sp = sunP(H, asp);
    float glit = pow(vn(vec2(p.x*90., p.y*420. + uTime*2.)), 9.)*exp(-abs(p.x - sp.x)*7.)*uSunVis*(1. - uCloud*.7);
    col += uSunCol*glit*2.2;
    vec2 mp = moonP(H, asp);
    col += vec3(.8,.82,.9)*pow(vn(vec2(p.x*90., p.y*420. + uTime*1.5)), 10.)*exp(-abs(p.x - mp.x)*9.)*uMoonVis*1.4;
    // ripple lines
    col += (vn(vec2(p.x*3., p.y*180. - uTime*.4)) - .5)*.04*(1. + uWind);
    // rain rings
    if (uRain > .02) {
      vec2 rq = vec2(p.x*26., p.y*70.);
      vec2 ci = floor(rq), cf = fract(rq) - .5;
      float hr = h21(ci);
      float ph = fract(uTime*.9 + hr*7.);
      float rr = length(cf*vec2(1.,.45))*2.;
      float ring = smoothstep(.06, 0., abs(rr - ph*.9))*(1. - ph)*step(hr, uRain);
      col += vec3(.5,.55,.6)*ring*.5*(.4 + uDay*.6);
    }
    col = mix(col, uFogCol, uFog*.55);
  }
  }
  // near bank with trees
  vec2 b1 = vec2(-.29*asp + mo.x*.03, bankTop(-.29*asp, s) - .012);
  vec2 b2 = vec2(.34*asp + mo.x*.03, bankTop(.34*asp, s) - .012);
  if (p.y < bt) {
    float k = clamp((bt - p.y)/.12, 0., 1.);
    vec3 bc = landLight(mix(vec3(.20,.31,.13), vec3(.11,.18,.08), k));
    bc += uSunCol*uSunGlow*.05*(1. - k);
    bc *= 1. - .28*uWet;
    bc = mix(bc, landLight(vec3(.86,.89,.93)), uSnow*.55*(1. - k*.6));
    bc = mix(bc, uFogCol, uFog*.4);
    // reeds along the shore
    col = bc; star = 0.;
  }
  // small rain tree on the far shore
  col = drawTree(col, p, vec2(.06*asp + mo.x*.012, H - .002), .07, 0., .7, solid);
  col = drawTree(col, p, b1, .33 + .04*s, 0., .35, solid);
  col = drawTree(col, p, b2, .27 + .03*s, 1., .35, solid);
  if (solid > .5) star = 0.;
  }

  // foreground meadow with swaying blades that part around the cursor
  if (p.y < gt + .2) {
    if (p.y < gt) {
      float k = clamp((gt - p.y)/.15, 0., 1.);
      vec3 gc = landLight(mix(vec3(.25,.36,.12), vec3(.12,.19,.06), k));
      gc *= 1. - .25*uWet;
      gc = mix(gc, landLight(vec3(.9,.92,.95)), uSnow*.6);
      col = gc; star = 0.;
    }
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      float Dn = 230. - fj*75.;
      float hm = .5 + fj*.38;
      float off = -fj*.03;
      float cx = p.x*Dn;
      float i0 = floor(cx);
      for (int k = -2; k <= 2; k++) {
        float id = i0 + float(k);
        float r1 = h11(id*1.37 + fj*91.), r2 = h11(id*3.11 + fj*17.), r3 = h11(id*7.71 + fj*5.);
        float rx = (id + .2 + .6*r1)/Dn;
        float by = grassTop(rx, s) + off - r3*.02;
        float hh = (.03 + .085*r2*r2 + .02*r3)*hm;
        float t = (p.y - by)/hh;
        if (t < 0. || t > 1.) continue;
        float sway = sin(uTime*(1.1 + r1) + rx*5.)*(.2 + .8*uWind)*.35 + uWindX*uWind*.55 + (r2 - .5)*.5;
        float dx = rx - mouseP.x;
        float near = exp(-dx*dx/.006)*(1. - smoothstep(.05, .32, abs(mouseP.y - (by + hh*.5))));
        sway += sign(dx)*near*1.8;
        float bxx = rx + sway*hh*.42*t*t;
        float w = (.42/Dn + .0006)*(1. - t*.88);
        float dd = abs(p.x - bxx) - w;
        float cov = clamp(.5 - dd*uRes.y, 0., 1.);
        if (cov > 0.) {
          float across = (p.x - bxx)/max(w, 1e-5);
          vec3 tipc = mix(vec3(.34,.46,.14), vec3(.52,.5,.2), r3*.6) + vec3(.06,.05,0.)*r1;
          vec3 bc = mix(vec3(.06,.11,.04), tipc, pow(t, .8));
          float side = sign(p.x - bxx)*sign(uSun.x + 1e-3);
          bc *= .82 + .2*side + .16*(1. - abs(across))*(1. - abs(across));
          bc *= .93 + .1*smoothstep(.15, -.05, abs(across + .35*side));
          bc = landLight(bc*(.62 + .2*fj));
          bc += uSunCol*uSunGlow*.08*t*t;
          bc *= 1. - .22*uWet;
          bc = mix(bc, landLight(vec3(.88,.9,.94)), uSnow*.45*t);
          bc = mix(bc, uFogCol, uFog*.18*(2. - fj)*.5);
          col = mix(col, bc, cov); if (cov > .5) star = 0.;
        }
      }
    }
  }
  // atmospheric haze
  col = mix(col, uFogCol, uFog*.12);
  o = vec4(col, star);
}`;

/* ---------------- pass 2: structure tensor (Sobel) ---------------- */
const POST_HEAD = `#version 300 es
precision highp float;
uniform vec2 uDst;      // size of the target being written
out vec4 o;
`;
const TENSOR = POST_HEAD + `
uniform sampler2D uTex; uniform vec2 uSrcPx; uniform float uEnc;
vec3 S(vec2 uv, float x, float y){ return texture(uTex, uv + vec2(x, y)*uSrcPx).rgb; }
void main(){
  vec2 uv = gl_FragCoord.xy/uDst;
  vec3 gx = (-S(uv,-1.,-1.) - 2.*S(uv,-1.,0.) - S(uv,-1.,1.) + S(uv,1.,-1.) + 2.*S(uv,1.,0.) + S(uv,1.,1.))*.25;
  vec3 gy = (-S(uv,-1.,-1.) - 2.*S(uv,0.,-1.) - S(uv,1.,-1.) + S(uv,-1.,1.) + 2.*S(uv,0.,1.) + S(uv,1.,1.))*.25;
  vec3 t = vec3(dot(gx,gx), dot(gy,gy), dot(gx,gy));
  o = uEnc > .5 ? vec4(sqrt(clamp(t.xy/3., 0., 1.)), clamp(t.z/6. + .5, 0., 1.), 1.) : vec4(t, 1.);
}`;
/* separable gaussian on the tensor; the vertical pass also solves the eigensystem */
const TBLUR = POST_HEAD + `
uniform sampler2D uTex; uniform vec2 uStep; uniform float uEnc, uFinal, uSigma;
vec3 dec(vec4 v){ if (uEnc < .5) return v.xyz; vec2 a = v.xy*v.xy*3.; return vec3(a, (v.z - .5)*6.); }
vec4 enc(vec3 t){ return uEnc > .5 ? vec4(sqrt(clamp(t.xy/3., 0., 1.)), clamp(t.z/6. + .5, 0., 1.), 1.) : vec4(t, 1.); }
void main(){
  vec2 uv = gl_FragCoord.xy/uDst;
  vec3 acc = vec3(0.); float ws = 0.;
  for (int i = -5; i <= 5; i++){
    float fi = float(i); float w = exp(-fi*fi/(2.*uSigma*uSigma));
    acc += dec(texture(uTex, uv + uStep*fi))*w; ws += w;
  }
  vec3 g = acc/ws;
  if (uFinal < .5) { o = enc(g); return; }
  // eigen-analysis: tangent (minor eigenvector) + anisotropy
  float E = g.x, G = g.y, F = g.z;
  float D = sqrt(max((E - G)*(E - G) + 4.*F*F, 0.));
  float l1 = .5*(E + G + D), l2 = .5*(E + G - D);
  vec2 t = vec2(l1 - E, -F);
  float lt = length(t);
  t = lt > 1e-7 ? t/lt : vec2(1., 0.);
  float A = (l1 + l2) > 1e-7 ? (l1 - l2)/(l1 + l2) : 0.;
  float ang2 = 2.*atan(t.y, t.x);
  // doubled-angle encoding interpolates cleanly (t and -t are the same orientation)
  o = vec4(.5 + .5*A*cos(ang2), .5 + .5*A*sin(ang2), A, clamp(sqrt(l1)*3., 0., 1.));
}`;

/* ---------------- pass 3: anisotropic Kuwahara (Kyprianidis, polynomial sector weights) ---------------- */
const KUWA = POST_HEAD + `
uniform sampler2D uTex, uFlow; uniform vec2 uSrcPx; uniform float uRad, uTap, uQ, uHard;
void main(){
  vec2 uv = gl_FragCoord.xy/uDst;
  vec4 fl = texture(uFlow, uv);
  vec2 dv = fl.xy*2. - 1.;
  float A = clamp(length(dv), 0., 1.);
  float phi = .5*atan(dv.y, dv.x + 1e-6);
  float r = uRad;
  float a = r*clamp((1. + A)/1., .1, 2.);
  float b = r*clamp(1./(1. + A), .1, 2.);
  float cp = cos(phi), sp = sin(phi);
  mat2 SR = mat2(.5/a, 0., 0., .5/b)*mat2(cp, -sp, sp, cp);
  int mx = int(min(sqrt(a*a*cp*cp + b*b*sp*sp), 11.));
  int my = int(min(sqrt(a*a*sp*sp + b*b*cp*cp), 11.));
  const float zeta = .33; // controls overlap between neighbouring sectors
  const float zc = .58;   // zero-crossing angle
  float sz = sin(zc); float eta = (zeta + cos(zc))/(sz*sz);
  vec4 m[8]; vec3 s[8];
  vec4 c0 = texture(uTex, uv);
  for (int k = 0; k < 8; k++){ m[k] = vec4(c0.rgb*.125, .125); s[k] = c0.rgb*c0.rgb*.125; }
  vec2 tp = uSrcPx*uTap;
  for (int j = 0; j <= 11; j++){
    if (j > my) break;
    for (int i = -11; i <= 11; i++){
      if (i < -mx) continue; if (i > mx) break;
      if (j == 0 && i <= 0) continue;
      vec2 v = SR*vec2(float(i), float(j));
      float dd = dot(v, v);
      if (dd > .25) continue;
      vec2 off = vec2(float(i), float(j))*tp;
      vec3 ca = texture(uTex, uv + off).rgb, cb = texture(uTex, uv - off).rgb;
      vec3 qa = ca*ca, qb = cb*cb;
      float w[8]; float sum = 0., z, vxx, vyy;
      vxx = zeta - eta*v.x*v.x; vyy = zeta - eta*v.y*v.y;
      z = max(0., v.y + vxx); w[0] = z*z; z = max(0., -v.x + vyy); w[2] = z*z;
      z = max(0., -v.y + vxx); w[4] = z*z; z = max(0., v.x + vyy); w[6] = z*z;
      vec2 u2 = .70710678*vec2(v.x - v.y, v.x + v.y);
      vxx = zeta - eta*u2.x*u2.x; vyy = zeta - eta*u2.y*u2.y;
      z = max(0., u2.y + vxx); w[1] = z*z; z = max(0., -u2.x + vyy); w[3] = z*z;
      z = max(0., -u2.y + vxx); w[5] = z*z; z = max(0., u2.x + vyy); w[7] = z*z;
      for (int k = 0; k < 8; k++) sum += w[k];
      float g = exp(-3.125*dd)/max(sum, 1e-6);
      for (int k = 0; k < 4; k++){
        float wa = w[k]*g, wb = w[k + 4]*g;
        m[k] += vec4(ca*wa, wa); s[k] += qa*wa;
        m[k + 4] += vec4(cb*wa, wa); s[k + 4] += qb*wa;
        m[k + 4] += vec4(ca*wb, wb); s[k + 4] += qa*wb;
        m[k] += vec4(cb*wb, wb); s[k] += qb*wb;
      }
    }
  }
  vec4 res = vec4(0.);
  for (int k = 0; k < 8; k++){
    vec3 mu = m[k].rgb/m[k].w;
    vec3 v3 = abs(s[k]/m[k].w - mu*mu);
    float s2 = v3.r + v3.g + v3.b;
    float w = 1./(1. + pow(uHard*1000.*s2, .5*uQ));
    res += vec4(mu*w, w);
  }
  o = vec4(res.rgb/res.w, c0.a);
}`;

/* ---------------- pass 4: brush strokes, impasto, canvas, weather overlays ---------------- */
/* stroke heights (separate pass so the impasto normals come from clean central differences) */
const HEIGHT_BASE = COMMON + `
out vec4 o;
uniform sampler2D uFlow;
uniform float uScale, uHS;
vec2 procDir(vec2 uv, vec2 p, float H){
  vec2 wq = uv*vec2(3.,5.) + vec2(vn(uv*4.+3.), vn(uv*4.+9.))*1.2;
  float ang = (vn(wq) - .5)*1.4 + (vn(uv*13. + 5.) - .5)*.45;
  ang += (p.y < H ? .25*sin(p.x*9.) : 0.);
  return vec2(cos(ang), sin(ang));
}
// stroke direction: the image's edge flow where it is defined, a painterly procedural flow elsewhere
vec2 flowDir(vec2 uv, float H){
  vec4 f = texture(uFlow, uv);
  vec2 dv = f.xy*2. - 1.;
  float A = length(dv);
  float ph = .5*atan(dv.y, dv.x + 1e-6);
  vec2 t = vec2(cos(ph), sin(ph));
  vec2 pp = (uv*uRes - .5*uRes)/uRes.y;
  vec2 pd = procDir(uv, pp, H);
  if (dot(t, pd) < 0.) t = -t;
  return normalize(mix(pd, t, smoothstep(.05, .32, A)*smoothstep(.01, .06, f.w)) + 1e-5);
}
// one layer of flow-aligned strokes on a jittered grid (css-pixel space)
void strokeLayer(vec2 cp, float cell, float len, float wid, float seed, float H,
                 out float hgt, out float bri, out vec2 cuv, out float cover){
  hgt = 0.; bri = .5; cuv = vec2(-1.); cover = 0.;
  float best = -1.;
  vec2 g0 = floor(cp/cell);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 id = g0 + vec2(float(i), float(j));
    float r1 = h21(id + seed), r2 = h21(id + seed + 17.3), r3 = h21(id + seed + 41.7), r4 = h21(id + seed + 73.1);
    vec2 c = (id + vec2(r1, r2))*cell;
    vec2 cu = clamp(c*uScale/uRes, 0., 1.);
    vec2 d = flowDir(cu, H);
    vec2 q = cp - c;
    float L = len*(.72 + .56*r3), Wd = wid*(.75 + .5*r4);
    float u = dot(q, d), v = dot(q, vec2(-d.y, d.x));
    v -= (r1 - .5)*u*u/L*.5;                       // slight curve
    float su = u/L; if (abs(su) >= 1.) continue;
    float taper = sqrt(1. - su*su)*(1. - .25*smoothstep(-.2, 1., su));
    float ed = abs(v)/(Wd*max(taper, .05)); if (ed >= 1.) continue;
    float pr = r3*.7 + r4*.3;
    float sv = v/Wd;
    float fq = max(1., Wd*uScale/1.45);                           // bristle grooves ~1.5 device px apart, never sub-pixel
    float b1 = vn(vec2(sv*fq + r1*31., su*1.1 + r2*7.));
    float b2 = vn(vec2(sv*fq*1.9 + r2*17., su*2.2 + r3*5.));
    float br = mix(b1, b1*.62 + b2*.38, smoothstep(1.2, 1.9, uScale));
    float prof = 1. - ed*ed;
    float lift = smoothstep(.35, .92, su)*(1. - ed)*.38;         // paint ridge where the brush lifts
    float dry = smoothstep(.55, 1., su)*smoothstep(.35, .75, b1); // dry-brush thinning at the tail
    prof *= sqrt(taper);                                           // thin, low paint at the tips keeps slopes bounded
    float hh = prof*(.55 + .45*br)*(1. - .45*dry) + lift*prof;
    if (hh <= hgt) continue;
    hgt = hh;
    bri = br; cuv = cu; cover = (1. - smoothstep(.75, 1., ed))*(1. - dry*.6);
  }
}
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc/uRes;
  vec2 cp = fc/uScale;
  float H = horizonY();
  vec4 fl = texture(uFlow, uv);
  float detail = smoothstep(.12, .5, length(fl.xy*2. - 1.))*smoothstep(.03, .16, fl.w);
  // stroke field: broad strokes in open areas, fine strokes where the image has structure
  float hC, bC, cC, hF, bF, cF; vec2 uC, uF;
  strokeLayer(cp, 17., 21., 6., 0., H, hC, bC, uC, cC);
  strokeLayer(cp + 3.7, 7.5, 8.5, 2.5, 51., H, hF, bF, uF, cF);
  float hgt = mix(hC, hF, detail);
  float bri = mix(bC, bF, detail);
  // canvas weave (shows through where paint is thin)
  float per = mix(4.6, 2.9, smoothstep(1., 2., uScale));
  vec2 wc = cp/per + vec2(vn(cp*.04), vn(cp*.04 + 7.))*.35;
  vec2 wi = floor(wc), wf = fract(wc);
  float tx = smoothstep(0., .2, wf.y)*smoothstep(1., .8, wf.y)*(.55 + .45*sin(3.14159*wf.x));
  float ty = smoothstep(0., .2, wf.x)*smoothstep(1., .8, wf.x)*(.55 + .45*sin(3.14159*wf.y));
  bool over = mod(wi.x + wi.y, 2.) < 1.;
  float weave = (over ? max(tx, ty*.55) : max(ty, tx*.55))*(.85 + .3*h21(wi));
  float thin = (1. - smoothstep(.05, .7, hgt))*(.45 + .55*smoothstep(1., 1.9, uScale));
  float Ht = hgt*(1. + .35*uWet) + weave*(.02 + .09*thin);
  vec2 so = cC > .5 && detail < .98 ? (uC*uRes - fc)/uScale : vec2(0.);
  o = vec4(Ht/uHS, bri + .4*weave*(.4 + .6*thin)*(.028/.07), clamp(so/96. + .5, 0., 1.));
}`;

// Every pixel covered by a stroke uses the same jitter and flow direction.
// Cache those in full-precision texels once per grid cell, each frame.
const GRID = HEIGHT_BASE.slice(0, HEIGHT_BASE.indexOf('// one layer'))
  .replace('out vec4 o;', 'layout(location=0) out vec4 o; layout(location=1) out vec4 directions;') + `
uniform float uCell, uSeed;
void main(){
  vec2 id = floor(gl_FragCoord.xy) - 1.;
  float r1 = h21(id + uSeed), r2 = h21(id + uSeed + 17.3), r3 = h21(id + uSeed + 41.7), r4 = h21(id + uSeed + 73.1);
  vec2 c = (id + vec2(r1, r2))*uCell;
  vec2 cu = clamp(c*uScale/uRes, 0., 1.);
  o = vec4(r1, r2, r3, r4);
  directions = vec4(flowDir(cu, horizonY()), 0., 1.);
}`;
const HEIGHT = HEIGHT_BASE
  .replace('uniform sampler2D uFlow;', 'uniform sampler2D uFlow, uJitterC, uDirectionC, uJitterF, uDirectionF; uniform bool uCached;')
  .replace('out float hgt, out float bri, out vec2 cuv, out float cover){', 'out float hgt, out float bri, out vec2 cuv, out float cover, sampler2D jitter, sampler2D directions){')
  .replace('float r1 = h21(id + seed), r2 = h21(id + seed + 17.3), r3 = h21(id + seed + 41.7), r4 = h21(id + seed + 73.1);', `
    vec4 randoms = uCached ? texelFetch(jitter, ivec2(id) + 1, 0) : vec4(h21(id + seed), h21(id + seed + 17.3), h21(id + seed + 41.7), h21(id + seed + 73.1));
    float r1 = randoms.x, r2 = randoms.y, r3 = randoms.z, r4 = randoms.w;`)
  .replace('vec2 d = flowDir(cu, H);', 'vec2 d = uCached ? texelFetch(directions, ivec2(id) + 1, 0).xy : flowDir(cu, H);')
  .replace('H, hC, bC, uC, cC);', 'H, hC, bC, uC, cC, uJitterC, uDirectionC);')
  .replace('H, hF, bF, uF, cF);', 'H, hF, bF, uF, cF, uJitterF, uDirectionF);');

const PAINT = COMMON + `
out vec4 o;
uniform sampler2D uTex, uFlow, uScene, uHgt;
uniform float uScale, uHS;
vec2 procDir(vec2 uv, vec2 p, float H){
  vec2 wq = uv*vec2(3.,5.) + vec2(vn(uv*4.+3.), vn(uv*4.+9.))*1.2;
  float ang = (vn(wq) - .5)*1.4 + (vn(uv*13. + 5.) - .5)*.45;
  ang += (p.y < H ? .25*sin(p.x*9.) : 0.);
  return vec2(cos(ang), sin(ang));
}
// stroke direction: the image's edge flow where it is defined, a painterly procedural flow elsewhere
vec2 flowDir(vec2 uv, float H){
  vec4 f = texture(uFlow, uv);
  vec2 dv = f.xy*2. - 1.;
  float A = length(dv);
  float ph = .5*atan(dv.y, dv.x + 1e-6);
  vec2 t = vec2(cos(ph), sin(ph));
  vec2 pp = (uv*uRes - .5*uRes)/uRes.y;
  vec2 pd = procDir(uv, pp, H);
  if (dot(t, pd) < 0.) t = -t;
  return normalize(mix(pd, t, smoothstep(.05, .32, A)*smoothstep(.01, .06, f.w)) + 1e-5);
}
// one layer of flow-aligned strokes on a jittered grid (css-pixel space)
void strokeLayer(vec2 cp, float cell, float len, float wid, float seed, float H,
                 out float hgt, out float bri, out vec2 cuv, out float cover){
  hgt = 0.; bri = .5; cuv = vec2(-1.); cover = 0.;
  float best = -1.;
  vec2 g0 = floor(cp/cell);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 id = g0 + vec2(float(i), float(j));
    float r1 = h21(id + seed), r2 = h21(id + seed + 17.3), r3 = h21(id + seed + 41.7), r4 = h21(id + seed + 73.1);
    vec2 c = (id + vec2(r1, r2))*cell;
    vec2 cu = clamp(c*uScale/uRes, 0., 1.);
    vec2 d = flowDir(cu, H);
    vec2 q = cp - c;
    float L = len*(.72 + .56*r3), Wd = wid*(.75 + .5*r4);
    float u = dot(q, d), v = dot(q, vec2(-d.y, d.x));
    v -= (r1 - .5)*u*u/L*.5;                       // slight curve
    float su = u/L; if (abs(su) >= 1.) continue;
    float taper = sqrt(1. - su*su)*(1. - .25*smoothstep(-.2, 1., su));
    float ed = abs(v)/(Wd*max(taper, .05)); if (ed >= 1.) continue;
    float pr = r3*.7 + r4*.3;
    float sv = v/Wd;
    float fq = max(1., Wd*uScale/1.45);                           // bristle grooves ~1.5 device px apart, never sub-pixel
    float b1 = vn(vec2(sv*fq + r1*31., su*1.1 + r2*7.));
    float b2 = vn(vec2(sv*fq*1.9 + r2*17., su*2.2 + r3*5.));
    float br = mix(b1, b1*.62 + b2*.38, smoothstep(1.2, 1.9, uScale));
    float prof = 1. - ed*ed;
    float lift = smoothstep(.35, .92, su)*(1. - ed)*.38;         // paint ridge where the brush lifts
    float dry = smoothstep(.55, 1., su)*smoothstep(.35, .75, b1); // dry-brush thinning at the tail
    prof *= sqrt(taper);                                           // thin, low paint at the tips keeps slopes bounded
    float hh = prof*(.55 + .45*br)*(1. - .45*dry) + lift*prof;
    if (hh <= hgt) continue;
    hgt = hh;
    bri = br; cuv = cu; cover = (1. - smoothstep(.75, 1., ed))*(1. - dry*.6);
  }
}
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc/uRes;
  float asp = uRes.x/uRes.y;
  vec2 p = (fc - .5*uRes)/uRes.y;
  vec2 cp = fc/uScale;           // css pixels
  float H = horizonY();
  vec2 px = 1./uRes;
  vec4 kf = texture(uTex, uv);
  vec4 fl = texture(uFlow, uv);
  float detail = smoothstep(.12, .5, length(fl.xy*2. - 1.))*smoothstep(.03, .16, fl.w);
  vec4 hc = texture(uHgt, uv);
  // short line-integral smear along the flow: wet paint dragged by the brush
  vec2 dir = flowDir(uv, H);
  vec3 col = kf.rgb*.4;
  float sl = 1.15*uScale*(1. - .55*detail);
  col += texture(uTex, uv + dir*sl*px).rgb*.2 + texture(uTex, uv - dir*sl*px).rgb*.2;
  col += texture(uTex, uv + dir*2.*sl*px).rgb*.1 + texture(uTex, uv - dir*2.*sl*px).rgb*.1;
  // each broad stroke carries the colour it was loaded with
  vec2 so = (hc.zw - .5)*96.;
  if (dot(so, so) > .01) col = mix(col, texture(uTex, uv + so*uScale*px).rgb, .32*(1. - detail));
  col *= .965 + .07*hc.y;
  // impasto: central differences of the stroke-height field (smooth per-pixel normals, no 2x2 derivative blocks)
  float hL = texture(uHgt, uv - vec2(px.x, 0.)).x, hR = texture(uHgt, uv + vec2(px.x, 0.)).x;
  float hD = texture(uHgt, uv - vec2(0., px.y)).x, hU = texture(uHgt, uv + vec2(0., px.y)).x;
  vec2 gr = vec2(hR - hL, hU - hD)*.5*uScale*uHS;
  gr /= 1. + 1.4*length(gr);                       // soft-limit slopes so creases never go black
  vec3 n = normalize(vec3(-gr*1.05, 1.));
  float Ht = hc.x*uHS;
  vec2 sp = sunP(H, asp), mp = moonP(H, asp);
  float sunK = clamp(uSunGlow*1.2, 0., 1.), moonK = uMoonVis*uNight*(1. - sunK);
  vec2 ld = mix(vec2(-.55, .83), normalize(sp - p + 1e-4), sunK);
  ld = normalize(mix(ld, normalize(mp - p + 1e-4), moonK) + 1e-4);
  float elev = mix(.42, .8, smoothstep(-.05, .7, uSun.y)*sunK);
  vec3 Ld = normalize(vec3(ld*sqrt(1. - elev*elev), elev));
  float diff = dot(n, Ld) - Ld.z;
  col *= 1. + diff*(.6 + .25*uDay);
  vec3 Hv = normalize(Ld + vec3(0., 0., 1.));
  float spec = pow(max(dot(n, Hv), 0.), 70.)*(.12*sunK + .06*moonK + .025)*(1. + 1.5*uWet);
  col += mix(vec3(1.), uSunCol, .5*sunK)*spec;
  col *= .95 + .05*smoothstep(.0, .45, Ht);       // grooves between strokes hold a little shadow
  col = mix(col, floor(col*14. + .5)/14., .1);
  vec4 c0 = texture(uScene, uv);
  float star = c0.a;
  // stars
  if (star > .01 && uNight > .01) {
    vec2 sq = (p - vec2(0., H))*vec2(1.,1.);
    for (int l=0;l<2;l++){
      float sc = l==0 ? 70. : 140.;
      vec2 g = sq*sc + float(l)*13.7;
      vec2 ci = floor(g), cf = fract(g) - .5;
      float hs = h21(ci);
      if (hs > (l==0 ? .965 : .93)) {
        vec2 off = vec2(h21(ci+1.), h21(ci+2.)) - .5;
        float d = length(cf - off*.6);
        float tw = .55 + .45*sin(uTime*(1.5 + hs*3.) + hs*60.);
        float b = smoothstep(l==0 ? .16 : .1, 0., d)*tw*(l==0 ? 1. : .6);
        col += vec3(.95,.93,1.)*b*star*uNight;
      }
    }
  }
  // fireflies at night, near the land
  float clearAir = pow(1. - uRain, 3.)*(1. - uSnow);
  if (uNight > .02 && p.y < H + .02) {
    vec2 g = p*vec2(7., 9.) + vec2(uTime*.05, 0.);
    vec2 ci = floor(g);
    for (int k=0;k<4;k++){
      vec2 cc = ci + vec2(float(k%2), float(k/2)) - .5;
      float hf = h21(cc + 3.1);
      vec2 pos = cc + .5 + .38*vec2(sin(uTime*.6 + hf*20.), cos(uTime*.45 + hf*13.));
      float d = length((g - pos)*vec2(1., 1.));
      float blink = smoothstep(.2, 1., sin(uTime*1.6 + hf*40.));
      col += vec3(.85,1.,.38)*exp(-d*d*260.)*blink*uNight*clearAir*1.2;
    }
  }
  // pollen motes by day
  if (uDay > .02) {
    vec2 g = p*11. + vec2(uTime*.06*(.3 + uWind)*sign(uWindX + .001), uTime*.035);
    vec2 ci = floor(g); vec2 cf = fract(g);
    float hp = h21(ci + 7.3);
    vec2 pos = vec2(h21(ci + 1.7), h21(ci + 4.2));
    pos += .12*vec2(sin(uTime*.7 + hp*30.), cos(uTime*.5 + hp*17.));
    float d = length(cf - pos);
    col += vec3(1.,.93,.7)*smoothstep(.03, .0, d)*step(.94, hp)*uDay*clearAir*.5*(1. - uFog*.6)*smoothstep(H + .3, H - .05, p.y);
  }
  // rain streaks angled by wind
  if (uRain > .01) {
    float ra = uWindX*(.08 + .4*uWind);
    mat2 rm = mat2(cos(ra), -sin(ra), sin(ra), cos(ra));
    vec2 rq = rm*p;
    float acc2 = 0.;
    for (int l=0;l<3;l++){
      float k = 1. + float(l)*.75;
      vec2 g = rq*vec2(55.*k, 2.6*k);
      g.y += uTime*(7. + k*2.5);
      vec2 ci = floor(g), cf = fract(g);
      float hr = h21(ci + float(l)*17.);
      float xo = .2 + .6*h21(ci + 5.);
      float len = .3 + .5*uRain;
      float streak = smoothstep(.08, 0., abs(cf.x - xo))*smoothstep(0., len*.4, cf.y)*smoothstep(len, len*.5, cf.y)*step(hr, .25 + uRain*.55);
      acc2 += streak*(1. - float(l)*.25);
    }
    col = mix(col, vec3(.78,.83,.92)*(.45 + .55*uDay) + uFlash*.5, clamp(acc2*.32*min(1., uRain*1.6), 0., .6));
  }
  // snow
  if (uSnow > .01) {
    for (int l=0;l<3;l++){
      float k = 1. + float(l)*.8;
      vec2 g = p*(9.*k);
      g.y += uTime*(.6/k + .2)*1.6;
      g.x += sin(uTime*.7 + g.y*.8)*.35 + uTime*uWindX*uWind*.4;
      vec2 ci = floor(g), cf = fract(g) - .5;
      float hs = h21(ci + float(l)*3.3);
      vec2 off = (vec2(h21(ci+1.), h21(ci+2.)) - .5)*.6;
      float d = length(cf - off);
      col = mix(col, vec3(.96,.97,1.), smoothstep(.09/k + .02, .0, d)*step(hs, uSnow*.8)*.9);
    }
  }
  // lightning flash
  col += vec3(.75,.8,1.)*uFlash*(.18 + .3*smoothstep(H, H + .4, p.y));
  // mist band
  col = mix(col, uFogCol, uFog*.35*exp(-abs(p.y - H + .02)*7.));

  o = vec4(clamp(col, 0., 1.), 1.);
}`;

/* ---------------- pass 5: contrast-adaptive + edge-preserving unsharp sharpen, vignette, grain ---------------- */
const FINAL = POST_HEAD + `
uniform sampler2D uTex; uniform vec2 uSrcPx; uniform float uSharp, uUsm, uTime, uCss;
vec3 T(vec2 uv, float x, float y){ return texture(uTex, uv + vec2(x, y)*uSrcPx).rgb; }
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
void main(){
  vec2 uv = gl_FragCoord.xy/uDst;
  vec3 e = texture(uTex, uv).rgb;
  vec3 a = T(uv,-1.,-1.), b = T(uv,0.,-1.), c = T(uv,1.,-1.), d = T(uv,-1.,0.), f = T(uv,1.,0.), g = T(uv,-1.,1.), h = T(uv,0.,1.), i = T(uv,1.,1.);
  vec3 mn = min(min(min(d, e), min(f, b)), h), mx = max(max(max(d, e), max(f, b)), h);
  vec3 mn2 = min(mn, min(min(a, c), min(g, i))), mx2 = max(mx, max(max(a, c), max(g, i)));
  mn += mn2; mx += mx2;
  vec3 amp = sqrt(clamp(min(mn, 2. - mx)/max(mx, 1e-4), 0., 1.));
  vec3 w = amp*(-1./mix(8., 5., uSharp));
  vec3 col = (b*w + d*w + f*w + h*w + e)/(1. + 4.*w);
  // edge-preserving unsharp mask at a wider radius (bilateral blur, halo-clamped)
  vec3 acc = e; float ws = 1.;
  for (int k = 0; k < 8; k++){
    float an = float(k)*.785398;
    vec3 s = T(uv, 2.2*cos(an), 2.2*sin(an));
    vec3 df = s - e; float wk = exp(-dot(df, df)*90.);
    acc += s*wk; ws += wk;
  }
  vec3 bl = acc/ws;
  col += (e - bl)*uUsm;
  col = clamp(col, mn2 - .025, mx2 + .025);
  vec2 q = uv - .5;
  col *= 1. - .28*dot(q*vec2(1., 1.2), q*vec2(1., 1.2));
  col += (h21(floor(gl_FragCoord.xy/uCss) + fract(uTime*7.)) - .5)*.012;
  o = vec4(clamp(col, 0., 1.), 1.);
}`;

function compile(type, src) {
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(sh); gl.deleteShader(sh); throw new Error(log); }
  return sh;
}
// Gather the exact scene texels into one row before reading them back. This
// replaces one GPU readback per point with a single readback for the batch.
const PROBE = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform ivec2 uPoints[128];
out vec4 o;
void main(){ o = texelFetch(uTex, uPoints[int(gl_FragCoord.x)], 0); }`;
function program(fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "a"); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
let P1, PT, PB, PK, PG, PH, PP, PF, PProbe;
try { P1 = program(SCENE); PT = program(TENSOR); PB = program(TBLUR); PK = program(KUWA); PG = program(GRID); PH = program(HEIGHT); PP = program(PAINT); PF = program(FINAL); PProbe = program(PROBE); }
catch (e) { window.__glError = String(e && e.message || e); document.body.classList.add("nogl"); return; }

const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

/* float targets for the structure tensor when the GPU can render to them; 8-bit encoded otherwise */
const FLOATRT = !!gl.getExtension("EXT_color_buffer_float");
const TQ = (() => { try { return gl.getExtension("EXT_disjoint_timer_query_webgl2"); } catch (e) { return null; } })();

function makeTarget(w, h, fmt) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  if (fmt === "f32") gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
  else if (fmt === "f16") gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const filter = fmt === "f32" ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { t, f, w, h, ok };
}
function freeTarget(T) { if (!T) return; gl.deleteTexture(T.t); gl.deleteFramebuffer(T.f); }

const RM = !!(window.SKY && window.SKY.rm);
const SMALL = (() => { try { return matchMedia("(max-width: 720px)").matches || matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } })();
/* quality ladder: fraction of the full device-pixel resolution, Kuwahara radius cap (taps).
   The floor is 60% of native; anything below native is upscaled through the sharpening pass. */
const LEVELS = [[1.0, 4], [0.88, 4], [0.78, 3.6], [0.68, 3.3], [0.6, 3]];
let level = SMALL || RM ? 1 : 0;
const dprD = () => Math.min(window.devicePixelRatio || 1, 2);
let W = 0, Hh = 0, Wd = 0, Hd = 0, Wt = 0, Ht = 0, renderScale = 1, fmtT = FLOATRT ? "f16" : "rgba8";
let tScene = null, tT1 = null, tT2 = null, tFlow = null, tKuwa = null, tPaint = null, tHgt = null;
let strokeGrids = [], gridReady = false;
function makeStrokeGrid(cell, seed) {
  // Include the negative neighbour and both positive neighbours, including
  // the fine layer's 3.7 CSS-pixel offset at the right/bottom edge.
  const w = Math.ceil((W / renderScale + 3.7) / cell) + 3;
  const h = Math.ceil((Hh / renderScale + 3.7) / cell) + 3;
  const jitter = makeTarget(w, h, "f32"), direction = makeTarget(w, h, "f32");
  gl.bindFramebuffer(gl.FRAMEBUFFER, jitter.f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, direction.t, 0);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  const ok = jitter.ok && direction.ok && gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { cell, seed, jitter, direction, w, h, ok };
}
const fbo = () => tScene && tScene.f;
function resize() {
  if (typeof window.__glForceLevel === "number") level = Math.max(0, Math.min(LEVELS.length - 1, window.__glForceLevel | 0));
  const d = dprD();
  Wd = Math.max(64, Math.round(innerWidth * d)); Hd = Math.max(64, Math.round(innerHeight * d));
  // keep very large panels (4K+) within a sane pixel budget
  const budget = 5.3e6, f0 = Math.min(1, Math.sqrt(budget / (Wd * Hd)));
  const f = LEVELS[level][0] * f0;
  const w = Math.max(64, Math.round(Wd * f)), h = Math.max(64, Math.round(Hd * f));
  renderScale = d * f;
  if (canvas.width !== Wd || canvas.height !== Hd) { canvas.width = Wd; canvas.height = Hd; }
  if (w === W && h === Hh && tScene) return;
  W = w; Hh = h;
  // the orientation field is smooth: build it at half resolution on dense displays
  const ts = renderScale > 1.3 ? 0.5 : 1;
  Wt = Math.max(32, Math.round(w * ts)); Ht = Math.max(32, Math.round(h * ts));
  [tScene, tT1, tT2, tFlow, tKuwa, tPaint, tHgt].forEach(freeTarget);
  tScene = makeTarget(w, h, "rgba8");
  tT1 = makeTarget(Wt, Ht, fmtT); tT2 = makeTarget(Wt, Ht, fmtT);
  if (fmtT === "f16" && (!tT1.ok || !tT2.ok)) { fmtT = "rgba8"; freeTarget(tT1); freeTarget(tT2); tT1 = makeTarget(Wt, Ht, fmtT); tT2 = makeTarget(Wt, Ht, fmtT); }
  tFlow = makeTarget(Wt, Ht, "rgba8");
  tKuwa = makeTarget(w, h, "rgba8"); tPaint = makeTarget(w, h, "rgba8");
  tHgt = makeTarget(w, h, fmtT); if (!tHgt.ok) { freeTarget(tHgt); tHgt = makeTarget(w, h, "rgba8"); }
  strokeGrids.forEach((g) => { freeTarget(g.jitter); freeTarget(g.direction); });
  strokeGrids = FLOATRT ? [makeStrokeGrid(17, 0), makeStrokeGrid(7.5, 51)] : [];
  gridReady = strokeGrids.length === 2 && strokeGrids.every((g) => g.ok);
  if (!gridReady) { strokeGrids.forEach((g) => { freeTarget(g.jitter); freeTarget(g.direction); }); strokeGrids = []; }
}
addEventListener("resize", () => { needResize = true; });
resize();

function setU(P, c) {
  const u = P.u;
  const f = (n, v) => { if (u[n]) gl.uniform1f(u[n], v); };
  const v2 = (n, a, b) => { if (u[n]) gl.uniform2f(u[n], a, b); };
  const v3 = (n, a) => { if (u[n]) gl.uniform3f(u[n], a[0], a[1], a[2]); };
  v2("uRes", W, Hh); f("uTime", c.time); f("uScroll", c.scroll); v2("uMouse", c.mouse[0], c.mouse[1]);
  v3("uZen", c.zen); v3("uHor", c.hor); v3("uSunCol", c.sun); v3("uAmb", c.amb); v3("uFogCol", c.fogc);
  v2("uSun", c.sunX, c.sunY); v2("uMoon", c.moonX, c.moonY);
  f("uSunVis", c.sunVis); f("uSunGlow", c.sunGlow); f("uMoonVis", c.moonVis); f("uMoonPhase", c.moonPhase);
  f("uNight", c.night); f("uDay", c.day); f("uCloud", c.cloud); f("uRain", c.rain); f("uWet", c.wet); f("uFog", c.fog);
  f("uStorm", c.storm); f("uFlash", c.flash); f("uSnow", c.snow); f("uWind", c.wind); f("uWindX", c.windX);
}
function bindTex(P, name, unit, T) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, T.t); if (P.u[name]) gl.uniform1i(P.u[name], unit); }
function target(T, w, h) { gl.bindFramebuffer(gl.FRAMEBUFFER, T ? T.f : null); gl.viewport(0, 0, w, h); }
const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

let needResize = false, slow = 0, lost = false, first = true, acc = 0, nfr = 0, settle = 0, lastDraw = 0, ups = 0;
let gpuMs = 0, gpuN = 0, gpuAcc = 0, qPending = [];
canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; document.body.classList.add("nogl"); });
canvas.addEventListener("webglcontextrestored", () => { location.reload(); });

function renderAll(c) {
  const enc = fmtT === "f16" ? 0 : 1;
  const SK = window.__glSkip | 0;
  gl.bindVertexArray(vao);
  // 1 scene
  target(tScene, W, Hh); gl.useProgram(P1.p); setU(P1, c); if (!(SK & 1)) draw();
  // 2 structure tensor
  target(tT1, Wt, Ht); gl.useProgram(PT.p);
  gl.uniform2f(PT.u.uDst, Wt, Ht); gl.uniform2f(PT.u.uSrcPx, 1 / W, 1 / Hh); gl.uniform1f(PT.u.uEnc, enc);
  bindTex(PT, "uTex", 0, tScene); draw();
  // 3 smooth it (sigma ≈ 2 css px) and solve for the flow
  const sig = Math.max(1.2, 2.0 * renderScale * (Wt / W));
  gl.useProgram(PB.p); gl.uniform2f(PB.u.uDst, Wt, Ht); gl.uniform1f(PB.u.uEnc, enc);   const stp = Math.max(1, sig / 2.2);
  gl.uniform1f(PB.u.uSigma, sig / stp);
  target(tT2, Wt, Ht); gl.uniform2f(PB.u.uStep, stp / Wt, 0); gl.uniform1f(PB.u.uFinal, 0); bindTex(PB, "uTex", 0, tT1); draw();
  target(tFlow, Wt, Ht); gl.uniform2f(PB.u.uStep, 0, stp / Ht); gl.uniform1f(PB.u.uFinal, 1); bindTex(PB, "uTex", 0, tT2); draw();
  // 4 anisotropic Kuwahara, radius ≈ 3.6 css px, capped in taps (sparser taps on dense displays)
  const rpx = 3.6 * renderScale, cap = LEVELS[level][1];
  const taps = Math.min(rpx, cap), tap = Math.max(1, rpx / taps);
  target(tKuwa, W, Hh); gl.useProgram(PK.p);
  gl.uniform2f(PK.u.uDst, W, Hh); gl.uniform2f(PK.u.uSrcPx, 1 / W, 1 / Hh);
  gl.uniform1f(PK.u.uRad, Math.max(1.5, taps)); gl.uniform1f(PK.u.uTap, tap); gl.uniform1f(PK.u.uQ, 8); gl.uniform1f(PK.u.uHard, 8);
  bindTex(PK, "uTex", 0, tScene); bindTex(PK, "uFlow", 1, tFlow); if (!(SK & 2)) draw();
  // 5 stroke-height field (strokes follow the flow; bristles, lift ridges, canvas weave)
  if (gridReady && !(SK & 4)) {
    gl.useProgram(PG.p); setU(PG, c); gl.uniform1f(PG.u.uScale, renderScale);
    bindTex(PG, "uFlow", 1, tFlow);
    for (const g of strokeGrids) {
      target(g.jitter, g.w, g.h);
      gl.uniform1f(PG.u.uCell, g.cell); gl.uniform1f(PG.u.uSeed, g.seed); draw();
    }
  }
  target(tHgt, W, Hh); gl.useProgram(PH.p); setU(PH, c);
  gl.uniform1f(PH.u.uScale, renderScale); gl.uniform1f(PH.u.uHS, 1.6);
  gl.uniform1i(PH.u.uCached, gridReady ? 1 : 0);
  if (gridReady) {
    bindTex(PH, "uJitterC", 0, strokeGrids[0].jitter); bindTex(PH, "uDirectionC", 2, strokeGrids[0].direction);
    bindTex(PH, "uJitterF", 3, strokeGrids[1].jitter); bindTex(PH, "uDirectionF", 4, strokeGrids[1].direction);
  }
  bindTex(PH, "uFlow", 1, tFlow); if (!(SK & 4)) draw();
  // 6 paint: smear + stroke colour + impasto lighting + weather overlays
  target(tPaint, W, Hh); gl.useProgram(PP.p); setU(PP, c);
  gl.uniform1f(PP.u.uScale, renderScale); gl.uniform1f(PP.u.uHS, 1.6);
  bindTex(PP, "uTex", 0, tKuwa); bindTex(PP, "uFlow", 1, tFlow); bindTex(PP, "uScene", 2, tScene); bindTex(PP, "uHgt", 3, tHgt); draw();
  // 6 sharpen to the display buffer (doubles as the sharpened upscale when rendering below native)
  target(null, Wd, Hd); gl.useProgram(PF.p);
  gl.uniform2f(PF.u.uDst, Wd, Hd); gl.uniform2f(PF.u.uSrcPx, 1 / W, 1 / Hh);
  const up = Wd / W;
  gl.uniform1f(PF.u.uSharp, Math.min(1, 0.55 + 0.45 * (up - 1) * 2.5)); gl.uniform1f(PF.u.uUsm, 0.32 + 0.25 * Math.min(1, (up - 1) * 2.5));
  gl.uniform1f(PF.u.uTime, c.time); gl.uniform1f(PF.u.uCss, dprD());
  const dbg = window.__glDbg | 0;
  if (dbg === 3) { gl.uniform1f(PF.u.uSharp, 0); gl.uniform1f(PF.u.uUsm, 0); }
  bindTex(PF, "uTex", 0, dbg === 1 ? tKuwa : dbg === 2 ? tScene : tPaint); draw();
}

function gpuPoll() {
  if (!TQ || !qPending.length) return;
  const q = qPending[0];
  if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return;
  qPending.shift();
  const disjoint = gl.getParameter(TQ.GPU_DISJOINT_EXT);
  if (!disjoint) { const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gpuAcc += ms; gpuN++; }
  gl.deleteQuery(q);
}

window.GLRender = (c, dt, now) => {
  if (lost || document.hidden) return;
  if (RM && now - lastDraw < 66) return;
  const fdt = lastDraw ? now - lastDraw : 16; lastDraw = now;
  if (needResize) { needResize = false; resize(); }
  let q = null;
  if (TQ && qPending.length < 3) { q = gl.createQuery(); gl.beginQuery(TQ.TIME_ELAPSED_EXT, q); }
  renderAll(c);
  if (q) { gl.endQuery(TQ.TIME_ELAPSED_EXT); qPending.push(q); }
  gpuPoll();
  probePoll(); probeIssue();
  if (first) { first = false; canvas.classList.add("on"); if (window.__firstFrame) window.__firstFrame(); return; }
  if (typeof window.__glForceLevel === "number") return;
  /* auto quality, gentler than before: needs a sustained slow average (or a run of very slow frames)
     to step down one level, and steps back up when the GPU timer shows clear headroom */
  settle++; if (settle < 8) return;
  if (fdt > 110) { slow++; if (slow >= 6 && level < LEVELS.length - 1) { level++; needResize = true; settle = 0; slow = 0; acc = 0; nfr = 0; gpuAcc = 0; gpuN = 0; } return; }
  slow = Math.max(0, slow - 1);
  if (settle < 20) return;
  acc += fdt; nfr++;
  if (nfr >= 60) {
    const avg = acc / nfr; acc = 0; nfr = 0;
    const g = gpuN >= 20 ? gpuAcc / gpuN : null; gpuAcc = 0; gpuN = 0;
    if (g != null) gpuMs = g;
    const tooSlow = g != null ? g > 15 && avg > 19 : avg > 24;
    const roomy = g != null ? g < 8.5 : avg < 10;
    if (tooSlow && level < LEVELS.length - 1) { level++; needResize = true; settle = 0; }
    else if (roomy && level > 0 && ups < 3 && !RM) { level--; ups++; needResize = true; settle = 0; }
  }
};
/* async pixel probes (PBO + fence, no pipeline stall) used to pick readable ink colours */
let pbo = gl.createBuffer(), pboCap = 0, probeReq = null, probeWait = null;
const probeTarget = makeTarget(128, 1, "rgba8");
window.GLProbe = (pts, cb) => { if (!lost && !first) probeReq = { pts, cb }; };
function probeIssue() {
  if (!probeReq || probeWait) return;
  const { pts, cb } = probeReq; probeReq = null;
  const bytes = pts.length * 4;
  if (!bytes) { cb([]); return; }
  const coords = pts.map(([x, y]) => [
    Math.max(0, Math.min(W - 1, Math.round((x / innerWidth) * W))),
    Math.max(0, Math.min(Hh - 1, Hh - 1 - Math.round((y / innerHeight) * Hh)))
  ]);
  const gather = probeTarget.ok && pts.length <= 128;
  if (gather) {
    target(probeTarget, 128, 1); gl.bindVertexArray(vao); gl.useProgram(PProbe.p);
    bindTex(PProbe, "uTex", 0, tScene);
    const points = new Int32Array(256); coords.forEach((p, i) => points.set(p, i * 2));
    gl.uniform2iv(PProbe.u.uPoints, points); draw();
  } else gl.bindFramebuffer(gl.FRAMEBUFFER, fbo());
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
  if (bytes > pboCap) { pboCap = Math.max(bytes, 256); gl.bufferData(gl.PIXEL_PACK_BUFFER, pboCap, gl.STREAM_READ); }
  if (gather) gl.readPixels(0, 0, pts.length, 1, gl.RGBA, gl.UNSIGNED_BYTE, 0);
  else coords.forEach(([px, py], i) => gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, i * 4));
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  probeWait = { sync: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), n: pts.length, cb, age: 0 };
  gl.flush();
}
function probePoll() {
  if (!probeWait) return;
  const st = gl.clientWaitSync(probeWait.sync, 0, 0);
  probeWait.age++;
  if (st === gl.TIMEOUT_EXPIRED && probeWait.age < 30) return;
  gl.deleteSync(probeWait.sync);
  if (st === gl.WAIT_FAILED || st === gl.TIMEOUT_EXPIRED) { probeWait = null; return; }
  const out = new Uint8Array(probeWait.n * 4);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  const L = []; for (let i = 0; i < probeWait.n; i++) L.push((0.2126 * out[i * 4] + 0.7152 * out[i * 4 + 1] + 0.0722 * out[i * 4 + 2]) / 255);
  const cb = probeWait.cb; probeWait = null; try { cb(L); } catch (e) {}
}
window.__glInfo = () => ({ level, scale: +renderScale.toFixed(3), W, H: Hh, display: [Wd, Hd], tensor: [Wt, Ht, fmtT], strokeCache: gridReady, gpuMs: +gpuMs.toFixed(2), timer: !!TQ });
})();
