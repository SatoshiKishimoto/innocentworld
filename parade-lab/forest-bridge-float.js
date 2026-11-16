/* innocent world ARパレード 試作フロート：モックとハルの森の古い橋 ― 約束よりも大切なもの
   既存のフロート（index.html の forestFloat など）と同じ形 {g, wheels, pts, people, len, update} を返す独立した部品。
   three.js r128 のグローバル THREE だけを使う。既存のパレードのコードには触れない。
   座標：フロートの足元が y=0。+z が進む向き（観客から見て左）、+x が観客の側。
   住人の絵は公式画像（characters2/mock.png, hal.png）をそのまま使い、板の変形で動かす（外見は描き起こさない）。 */
(function(global){
'use strict';
const T = global.THREE;

/* ============ 乱数・ノイズ ============ */
function rng(seed){ let s = seed >>> 0 || 1; return ()=>{ s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; }; }
function hash(x, y, s){ let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vnoise(x, y, s, p){
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf*xf*(3 - 2*xf), v = yf*yf*(3 - 2*yf);
  const w = n => p ? ((n % p) + p) % p : n;
  const a = hash(w(xi), w(yi), s), b = hash(w(xi+1), w(yi), s), c = hash(w(xi), w(yi+1), s), d = hash(w(xi+1), w(yi+1), s);
  return a + (b - a)*u + (c - a)*v + (a - b - c + d)*u*v;
}
// p を渡すと、その周期でつながる（テクスチャを継ぎ目なく並べるため）
function fbm(x, y, s, oct, p){ let t = 0, a = 0.5, f = 1, n = 0; for(let i=0;i<(oct||4);i++){ t += a*vnoise(x*f, y*f, s + i*17, p ? p*f : 0); n += a; f *= 2; a *= 0.5; } return t / n; }
const clamp = (v, a, b)=>Math.max(a, Math.min(b, v));
const sstep = (a, b, x)=>{ const t = clamp((x - a)/(b - a), 0, 1); return t*t*(3 - 2*t); };
const lerp = (a, b, t)=>a + (b - a)*t;

/* ============ テクスチャ（すべてその場で描く。外部の画像は使わない） ============ */
function cnv(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTex(c, srgb, rep){
  const t = new T.CanvasTexture(c);
  if(srgb) t.encoding = T.sRGBEncoding;
  t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
  if(rep) t.repeat.set(rep[0], rep[1]);
  return t;
}
// 高さの配列から法線マップを作る（凹凸の陰影）
function normalFrom(hf, w, h, k){
  const c = cnv(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), d = img.data;
  for(let j=0;j<h;j++) for(let i=0;i<w;i++){
    const l = hf[j*w + ((i - 1 + w) % w)], r = hf[j*w + ((i + 1) % w)];
    const u = hf[((j - 1 + h) % h)*w + i], b = hf[((j + 1) % h)*w + i];
    let nx = (l - r)*k, ny = (u - b)*k, nz = 1; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    const o = (j*w + i)*4; d[o] = (nx*0.5 + 0.5)*255; d[o+1] = (ny*0.5 + 0.5)*255; d[o+2] = (nz*0.5 + 0.5)*255; d[o+3] = 255;
  }
  x.putImageData(img, 0, 0); return c;
}
function pixelTex(w, h, fn, nk){
  const c = cnv(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), d = img.data, hf = new Float32Array(w*h), out = [0,0,0,0];
  for(let j=0;j<h;j++) for(let i=0;i<w;i++){
    fn(i/w, j/h, out); const o = (j*w + i)*4;
    d[o] = out[0]; d[o+1] = out[1]; d[o+2] = out[2]; d[o+3] = 255; hf[j*w + i] = out[3];
  }
  x.putImageData(img, 0, 0);
  return {map:c, normal:normalFrom(hf, w, h, nk || 2)};
}
function mixc(a, b, t, out){ out[0] = lerp(a[0], b[0], t); out[1] = lerp(a[1], b[1], t); out[2] = lerp(a[2], b[2], t); }
const _c3 = [0,0,0];

let TX = null;
function textures(){
  if(TX) return TX;
  TX = {};
  // 木目：板や手すり、車体の木部
  TX.wood = pixelTex(256, 256, (u, v, o)=>{
    const warp = fbm(u*3, v*1.2, 3, 3, 3)*1.6;
    const ring = 0.5 + 0.5*Math.sin((u*14 + warp*3)*Math.PI*2);
    const fine = fbm(u*40, v*3, 9, 2, 40);
    const t = clamp(ring*0.65 + fine*0.45 - 0.1, 0, 1);
    mixc([196,140,88], [120,74,40], t, o); const k = 0.9 + fine*0.2; o[0] *= k; o[1] *= k; o[2] *= k;
    o[3] = ring*0.6 + fine*0.4;
  }, 3);
  // 樹皮：縦の深い割れ目
  TX.bark = pixelTex(128, 256, (u, v, o)=>{
    const warp = fbm(u*3, v*2, 21, 3, 3);
    const f = Math.abs(Math.sin((u*7 + warp*1.4)*Math.PI*2));
    const crev = Math.pow(f, 0.35);
    const n = fbm(u*16, v*10, 23, 3, 16);
    mixc([62,40,26], [168,122,80], crev*0.75 + n*0.25, o);
    o[3] = crev*0.8 + n*0.2;
  }, 5);
  // 石：苔の混じった丸い石
  TX.stone = pixelTex(128, 128, (u, v, o)=>{
    const n = fbm(u*5, v*5, 31, 5, 5), r = 1 - Math.abs(fbm(u*9, v*9, 33, 3, 9)*2 - 1);
    mixc([112,108,100], [188,180,164], n, o);
    const moss = sstep(0.58, 0.72, fbm(u*4, v*4, 35, 3, 4));
    mixc(o, [72,118,58], moss*0.8, o);
    const cr = sstep(0.9, 0.97, r); o[0] *= 1 - cr*0.5; o[1] *= 1 - cr*0.5; o[2] *= 1 - cr*0.5;
    o[3] = n*0.7 - cr*0.4 + moss*0.2;
  }, 4);
  // 地面：苔と草
  TX.ground = pixelTex(256, 256, (u, v, o)=>{
    const n = fbm(u*6, v*6, 41, 4, 6), g = fbm(u*30, v*30, 43, 2, 30);
    mixc([62,110,48], [128,170,72], n, o);
    const fleck = sstep(0.72, 0.8, g); mixc(o, [196,206,112], fleck*0.5, o);
    const dark = sstep(0.62, 0.3, n); o[0] *= 1 - dark*0.25; o[1] *= 1 - dark*0.2; o[2] *= 1 - dark*0.25;
    o[3] = n*0.5 + g*0.5;
  }, 3);
  // 葉の茂み：重なった葉を1枚ずつ描く
  {
    const W = 256, c = cnv(W, W), x = c.getContext('2d'), hc = cnv(W, W), hx = hc.getContext('2d'), R = rng(7);
    x.fillStyle = '#2f6a34'; x.fillRect(0, 0, W, W); hx.fillStyle = '#000'; hx.fillRect(0, 0, W, W);
    const leaf = (ctx, cx, cy, s, a, fill)=>{ ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s*0.62, -s*0.1, 0, s); ctx.quadraticCurveTo(-s*0.62, -s*0.1, 0, -s); ctx.fillStyle = fill; ctx.fill(); ctx.restore(); };
    const greens = ['#3f8a3c','#57a44a','#2f7a3a','#6bb456','#4c9a46','#86c464'];
    for(let k=0;k<620;k++){
      const cx = R()*W, cy = R()*W, s = 9 + R()*12, a = R()*Math.PI*2, col = greens[(R()*greens.length)|0];
      for(const [dx, dy] of [[0,0],[W,0],[-W,0],[0,W],[0,-W]]){   // 端でつながるように描く
        if(cx + dx < -s || cx + dx > W + s || cy + dy < -s || cy + dy > W + s) continue;
        leaf(x, cx + dx, cy + dy, s, a, col);
        const g = hx.createRadialGradient(cx + dx, cy + dy, 0, cx + dx, cy + dy, s); g.addColorStop(0, '#fff'); g.addColorStop(1, '#333');
        leaf(hx, cx + dx, cy + dy, s, a, g);
        x.strokeStyle = 'rgba(20,50,20,.35)'; x.lineWidth = 0.8; x.save(); x.translate(cx + dx, cy + dy); x.rotate(a); x.beginPath(); x.moveTo(0, -s*0.8); x.lineTo(0, s*0.8); x.stroke(); x.restore();
      }
    }
    const hd = hx.getImageData(0, 0, W, W).data, hf = new Float32Array(W*W);
    for(let i=0;i<W*W;i++) hf[i] = hd[i*4]/255;
    TX.leaf = {map:c, normal:normalFrom(hf, W, W, 4)};
  }
  // 茂みのふちの葉（透明な背景に葉の房を描く）。茂みの輪郭をやわらかくする
  {
    const W = 128, c = cnv(W, W), x = c.getContext('2d'), R = rng(29);
    const greens = ['#4f9a46','#6bb456','#3f8a3c','#86c464','#5aa64e'];
    for(let k=0;k<26;k++){
      const a = R()*Math.PI*2, r = R()*W*0.3, cx = W/2 + Math.cos(a)*r, cy = W/2 + Math.sin(a)*r, s = 10 + R()*12, ang = R()*Math.PI*2;
      x.save(); x.translate(cx, cy); x.rotate(ang); x.beginPath(); x.moveTo(0, -s); x.quadraticCurveTo(s*0.6, -s*0.1, 0, s); x.quadraticCurveTo(-s*0.6, -s*0.1, 0, -s);
      x.fillStyle = greens[(R()*greens.length)|0]; x.fill(); x.strokeStyle = 'rgba(20,50,20,.35)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(0, -s*0.8); x.lineTo(0, s*0.8); x.stroke(); x.restore();
    }
    TX.leafCard = c;
  }
  // 車体の側面：スウェーデンの伝統的な花の絵付け（独自の図案）。彫った額縁の凹凸つき
  {
    const W = 1024, H = 256, c = cnv(W, H), x = c.getContext('2d'), hc = cnv(W, H), hx = hc.getContext('2d'), R = rng(11);
    const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1d4a3c'); bg.addColorStop(1, '#143629');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    for(let k=0;k<1800;k++){ x.fillStyle = `rgba(${R()<.5?255:0},${R()<.5?255:0},${R()<.5?220:0},${0.02 + R()*0.03})`; x.fillRect(R()*W, R()*H, 2 + R()*14, 1 + R()*2); }   // 筆のかすれ
    hx.fillStyle = '#404040'; hx.fillRect(0, 0, W, H);
    const PW = W/4;
    const rr = (ctx, X, Y, w, h, r)=>{ ctx.beginPath(); ctx.moveTo(X + r, Y); ctx.arcTo(X + w, Y, X + w, Y + h, r); ctx.arcTo(X + w, Y + h, X, Y + h, r); ctx.arcTo(X, Y + h, X, Y, r); ctx.arcTo(X, Y, X + w, Y, r); ctx.closePath(); };
    const petal = (cx, cy, len, wid, a, fill)=>{ x.save(); x.translate(cx, cy); x.rotate(a); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(wid, -len*0.3, wid*0.8, -len*0.9, 0, -len); x.bezierCurveTo(-wid*0.8, -len*0.9, -wid, -len*0.3, 0, 0); x.fillStyle = fill; x.fill(); x.restore(); };
    for(let p=0;p<4;p++){
      const X = p*PW, cx = X + PW/2;
      // 額縁（盛り上がった木の枠）
      hx.lineWidth = 10; hx.strokeStyle = '#d0d0d0'; rr(hx, X + 12, 14, PW - 24, H - 28, 22); hx.stroke();
      hx.lineWidth = 3; hx.strokeStyle = '#ffffff'; rr(hx, X + 12, 14, PW - 24, H - 28, 22); hx.stroke();
      x.lineWidth = 7; x.strokeStyle = '#c99a3a'; rr(x, X + 12, 14, PW - 24, H - 28, 22); x.stroke();
      x.lineWidth = 2; x.strokeStyle = '#f3dfa0'; rr(x, X + 16, 18, PW - 32, H - 36, 19); x.stroke();
      x.lineWidth = 1.5; x.strokeStyle = 'rgba(243,223,160,.6)'; rr(x, X + 26, 28, PW - 52, H - 56, 14); x.stroke();
      // 茎とつる
      x.strokeStyle = '#7fa860'; x.lineWidth = 4; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx, H - 40); x.bezierCurveTo(cx - 6, H - 90, cx + 8, 110, cx, 82); x.stroke();
      [-1, 1].forEach(s=>{
        x.beginPath(); x.moveTo(cx, H - 70); x.bezierCurveTo(cx + s*30, H - 80, cx + s*70, H - 120, cx + s*62, 110); x.stroke();
        x.beginPath(); x.moveTo(cx + s*62, 110); x.bezierCurveTo(cx + s*58, 92, cx + s*40, 96, cx + s*44, 108); x.stroke();   // 渦巻き
        x.beginPath(); x.moveTo(cx, H - 56); x.bezierCurveTo(cx + s*22, H - 50, cx + s*44, H - 48, cx + s*82, H - 62); x.stroke();
        // 葉
        [[cx + s*26, H - 96, 26, 9, s*1.1], [cx + s*48, H - 118, 22, 8, s*0.5], [cx + s*70, H - 60, 20, 7, s*1.9], [cx + s*14, H - 130, 18, 6, s*0.9]].forEach(([a, b, l, w, r])=>petal(a, b, l, w, r, '#5e9a6a'));
        // ロゼット（まるい花）
        const rx = cx + s*62, ry = 104;
        for(let k=0;k<8;k++) petal(rx, ry, 18, 7, k*Math.PI/4, k % 2 ? '#e8b23c' : '#f2e2b8');
        x.beginPath(); x.arc(rx, ry, 6, 0, Math.PI*2); x.fillStyle = '#c8402e'; x.fill();
        // 小さな赤い実
        [[cx + s*84, H - 66], [cx + s*90, H - 74], [cx + s*80, H - 78]].forEach(([a, b])=>{ x.beginPath(); x.arc(a, b, 4, 0, Math.PI*2); x.fillStyle = '#d24a3a'; x.fill(); });
      });
      // まん中のチューリップ
      [[0, '#d23c34', 30], [-0.5, '#e8664a', 22], [0.5, '#e8664a', 22]].forEach(([a, f, l])=>petal(cx, 84, l, 14, a, f));
      petal(cx, 84, 18, 8, 0, '#f6c75a');
      // 点描の飾り
      for(let k=0;k<14;k++){ const a = k/14*Math.PI*2; x.beginPath(); x.arc(cx + Math.cos(a)*46, 84 + Math.sin(a)*40, 2, 0, Math.PI*2); x.fillStyle = 'rgba(243,223,160,.75)'; x.fill(); }
      // 下の青い小花
      [-40, 40].forEach(dx=>{ for(let k=0;k<5;k++) petal(cx + dx, H - 44, 10, 5, k*Math.PI*0.4, '#6f8fc8'); x.beginPath(); x.arc(cx + dx, H - 44, 3, 0, Math.PI*2); x.fillStyle = '#f3dfa0'; x.fill(); });
    }
    const hd = hx.getImageData(0, 0, W, H).data, hf = new Float32Array(W*H);
    for(let i=0;i<W*H;i++) hf[i] = hd[i*4]/255;
    TX.panel = {map:c, normal:normalFrom(hf, W, H, 5)};
  }
  // 車体上部の帯：葉の渦巻きを彫った木
  {
    const W = 512, H = 96, R = rng(19);
    const hc = cnv(W, H), hx = hc.getContext('2d');
    hx.fillStyle = '#303030'; hx.fillRect(0, 0, W, H);
    hx.lineCap = 'round';
    for(let k=0;k<4;k++){
      const X = k*W/4;
      hx.strokeStyle = '#cfcfcf'; hx.lineWidth = 9;
      hx.beginPath(); hx.moveTo(X, H*0.62); hx.bezierCurveTo(X + 40, H*0.1, X + 88, H*0.1, X + 96, H*0.5); hx.bezierCurveTo(X + 100, H*0.78, X + 70, H*0.8, X + 70, H*0.55); hx.stroke();
      hx.beginPath(); hx.moveTo(X + 64, H*0.38); hx.bezierCurveTo(X + 90, H*0.95, X + 118, H*0.9, X + 128, H*0.62); hx.stroke();
      hx.fillStyle = '#e8e8e8'; [[X + 30, H*0.7], [X + 110, H*0.3]].forEach(([a, b])=>{ hx.beginPath(); hx.ellipse(a, b, 11, 6, 0.6, 0, Math.PI*2); hx.fill(); });
    }
    hx.fillStyle = '#d8d8d8'; hx.fillRect(0, 0, W, 7); hx.fillRect(0, H - 7, W, 7);
    const hd = hx.getImageData(0, 0, W, H).data, hf = new Float32Array(W*H);
    const c = cnv(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), d = img.data;
    for(let j=0;j<H;j++) for(let i=0;i<W;i++){
      const k = j*W + i, hh = hd[k*4]/255; hf[k] = hh;
      const g = fbm(i/W*12, j/H*2, 51, 3, 12), ring = 0.5 + 0.5*Math.sin((i/W*30 + g*4)*Math.PI*2);
      mixc([176,120,70], [118,72,40], ring*0.6 + g*0.3, _c3);
      const lit = 0.72 + hh*0.42;
      d[k*4] = _c3[0]*lit; d[k*4+1] = _c3[1]*lit; d[k*4+2] = _c3[2]*lit; d[k*4+3] = 255;
    }
    x.putImageData(img, 0, 0);
    TX.fascia = {map:c, normal:normalFrom(hf, W, H, 6)};
  }
  // 金のなわ飾りの法線（ねじれ）
  {
    const W = 64, H = 32, hf = new Float32Array(W*H);
    for(let j=0;j<H;j++) for(let i=0;i<W;i++) hf[j*W + i] = 0.5 + 0.5*Math.sin(((i/W)*4 + (j/H))*Math.PI*2);
    TX.rope = {normal:normalFrom(hf, W, H, 3)};
  }
  // 光の粒
  TX.spark = (()=>{ const c = cnv(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; })();
  TX.glow = (()=>{ const c = cnv(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,214,140,.95)'); g.addColorStop(0.35, 'rgba(255,170,70,.35)'); g.addColorStop(1, 'rgba(255,140,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; })();
  TX.shadow = (()=>{ const c = cnv(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; })();
  // 赤いきのこの傘（白い水玉）
  TX.mush = (()=>{ const c = cnv(128, 64), x = c.getContext('2d'); x.fillStyle = '#c8302a'; x.fillRect(0, 0, 128, 64);
    const R = rng(5); for(let k=0;k<16;k++){ x.beginPath(); x.arc(R()*128, 8 + R()*44, 3 + R()*5, 0, Math.PI*2); x.fillStyle = '#fff3e0'; x.fill(); } return c; })();
  return TX;
}

/* 夜景を映りこませる環境マップ（金具や水のつやのため）。renderer があるときだけ作る */
const _envCache = new WeakMap();
function envMapFor(renderer){
  if(!renderer || !T.PMREMGenerator) return null;
  if(_envCache.has(renderer)) return _envCache.get(renderer);
  const W = 256, H = 128, c = cnv(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a1030'); g.addColorStop(0.45, '#2a2a58'); g.addColorStop(0.55, '#7a5a48'); g.addColorStop(1, '#201812');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const R = rng(3);
  for(let k=0;k<26;k++){ const px = R()*W, py = H*0.42 + R()*H*0.18, r = 2 + R()*7; const gg = x.createRadialGradient(px, py, 0, px, py, r*3); gg.addColorStop(0, 'rgba(255,224,160,1)'); gg.addColorStop(1, 'rgba(255,170,80,0)'); x.fillStyle = gg; x.fillRect(px - r*3, py - r*3, r*6, r*6); }
  const tex = new T.CanvasTexture(c); tex.mapping = T.EquirectangularReflectionMapping; tex.encoding = T.sRGBEncoding;
  const pm = new T.PMREMGenerator(renderer); const env = pm.fromEquirectangular(tex).texture; pm.dispose(); tex.dispose();
  _envCache.set(renderer, env); return env;
}

/* ============ 形を作る道具 ============ */
// 角の丸い長方形の外周（外向きの法線と、周回の長さつき）
function perimeter(hw, hl, r, seg){
  const pts = [];
  const corners = [[hw - r, hl - r, 0], [-(hw - r), hl - r, Math.PI/2], [-(hw - r), -(hl - r), Math.PI], [hw - r, -(hl - r), Math.PI*1.5]];
  corners.forEach(([cx, cz, a0])=>{ for(let k=0;k<=seg;k++){ const a = a0 + k/seg*Math.PI/2; pts.push({x:cx + Math.cos(a)*r, z:cz + Math.sin(a)*r, nx:Math.cos(a), nz:Math.sin(a)}); } });
  // 長い辺の途中にも点を足す（なめらかな面と、絵付けのつながりのため）
  const out = [];
  for(let i=0;i<pts.length;i++){
    const a = pts[i], b = pts[(i + 1) % pts.length]; out.push(a);
    const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.floor(L/0.25);
    for(let k=1;k<n;k++){ const t = k/n; out.push({x:lerp(a.x, b.x, t), z:lerp(a.z, b.z, t), nx:a.nx, nz:a.nz}); }
  }
  let s = 0; out.forEach((p, i)=>{ if(i) s += Math.hypot(p.x - out[i-1].x, p.z - out[i-1].z); p.s = s; });
  out.total = s + Math.hypot(out[0].x - out[out.length-1].x, out[0].z - out[out.length-1].z);
  return out;
}
// 外周に沿って断面の形を引き伸ばす（車体の木部・金のふち）。prof：[外へのずれ, 高さ]
function sweep(path, prof, uLen){
  const n = path.length + 1, m = prof.length, pos = [], uv = [], idx = [];
  const vl = [0]; for(let j=1;j<m;j++) vl.push(vl[j-1] + Math.hypot(prof[j][0] - prof[j-1][0], prof[j][1] - prof[j-1][1]));
  for(let i=0;i<n;i++){
    const p = path[i % path.length], s = i === path.length ? path.total : p.s;
    for(let j=0;j<m;j++){ pos.push(p.x + p.nx*prof[j][0], prof[j][1], p.z + p.nz*prof[j][0]); uv.push(s/uLen, vl[j]/vl[m-1]); }
  }
  for(let i=0;i<n-1;i++) for(let j=0;j<m-1;j++){ const a = i*m + j, b = (i+1)*m + j; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // 継ぎ目（最初と最後の列）の法線をそろえる
  const nr = g.attributes.normal; for(let j=0;j<m;j++){ const a = j, b = (n-1)*m + j; const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), L = Math.hypot(x, y, z) || 1; nr.setXYZ(a, x/L, y/L, z/L); nr.setXYZ(b, x/L, y/L, z/L); }
  return g;
}
// 太さの変わる管（幹・枝・根）
function taperTube(curve, seg, rad, rs, r0, r1, wob){
  const pos = [], uv = [], idx = [], fr = curve.computeFrenetFrames(seg, false), p = new T.Vector3();
  for(let i=0;i<=seg;i++){
    const t = i/seg; curve.getPointAt(t, p);
    const r = lerp(r0, r1, Math.pow(t, 0.8));
    const N = fr.normals[i], B = fr.binormals[i];
    for(let j=0;j<=rs;j++){
      const a = j/rs*Math.PI*2, w = 1 + (wob||0)*(vnoise(Math.cos(a)*2 + 3, t*6, 61) - 0.5);
      const cx = Math.cos(a)*r*w, cy = Math.sin(a)*r*w;
      pos.push(p.x + N.x*cx + B.x*cy, p.y + N.y*cx + B.y*cy, p.z + N.z*cx + B.z*cy); uv.push(j/rs*2, t*curve.getLength()*1.2);
    }
  }
  for(let i=0;i<seg;i++) for(let j=0;j<rs;j++){ const a = i*(rs+1) + j, b = (i+1)*(rs+1) + j; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function vcol(g, c){ const n = g.attributes.position.count, a = new Float32Array(n*3); for(let i=0;i<n;i++){ a[i*3] = c.r; a[i*3+1] = c.g; a[i*3+2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; }
// 動かない部品を材質ごとに1つにまとめて、描く回数を減らす
function bakeStatic(group){
  const buckets = new Map(), rm = [];
  group.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(group.matrixWorld).invert();
  group.traverse(o=>{
    if(!o.isMesh || o.userData.dynamic || o.isInstancedMesh) return;
    let p = o.parent, dyn = false; while(p && p !== group){ if(p.userData.dynamic) dyn = true; p = p.parent; } if(dyn) return;
    const key = o.material.uuid; if(!buckets.has(key)) buckets.set(key, {mat:o.material, list:[]});
    buckets.get(key).list.push(o); rm.push(o);
  });
  rm.forEach(o=>o.parent.remove(o));
  buckets.forEach(({mat, list})=>{
    const needColor = !!mat.vertexColors, parts = [];
    let total = 0;
    list.forEach(o=>{
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if(!g.attributes.uv) g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2), 2));
      if(needColor && !g.attributes.color) vcol(g, new T.Color(1, 1, 1));
      if(!g.attributes.normal) g.computeVertexNormals();
      parts.push(g); total += g.attributes.position.count;
    });
    const P = new Float32Array(total*3), Nn = new Float32Array(total*3), U = new Float32Array(total*2), C = needColor ? new Float32Array(total*3) : null;
    let off = 0;
    parts.forEach(g=>{ const n = g.attributes.position.count; P.set(g.attributes.position.array, off*3); Nn.set(g.attributes.normal.array, off*3); U.set(g.attributes.uv.array, off*2); if(C) C.set(g.attributes.color.array, off*3); off += n; g.dispose(); });
    const G = new T.BufferGeometry();
    G.setAttribute('position', new T.BufferAttribute(P, 3)); G.setAttribute('normal', new T.BufferAttribute(Nn, 3)); G.setAttribute('uv', new T.BufferAttribute(U, 2)); if(C) G.setAttribute('color', new T.BufferAttribute(C, 3));
    G.computeBoundingSphere();
    group.add(new T.Mesh(G, mat));
  });
}

/* ============ フロート本体 ============ */
const LEN = 5.0, WID = 2.3, HW = WID/2, HL = LEN/2, RC = 0.5;
const YD = 0.975;            // 舞台（地面）の基準の高さ
const ZC = x=>0.2 + 0.07*Math.sin(x*1.7 + 0.4);    // 川の中心線（x方向に流れる）。橋はフロートのまん中で川をまたぐ
const RIVER_W = 0.62;

// 地形の高さ（YD からの差）。川・手前の丘・奥の草地
function groundH(x, z){
  let h = 0.11;
  h += 0.4*Math.exp(-((x + 0.62)**2/0.24 + (z - 2.08)**2/0.28));             // 向こう岸の丘（大きな木）
  h += 0.14*Math.exp(-((x + 0.75)**2/0.3 + (z + 2.0)**2/0.4));               // 奥の草地
  h += 0.07*Math.exp(-((x + 1.0)**2/0.05 + (z - 0.2)**2/0.4));               // 川の源の岩場
  h += 0.2*sstep(-0.35, -1.05, x)*(0.7 + 0.3*Math.sin(z*2.1 + 1));          // 奥のふちが高く、手前が低い（舞台の奥行き）
  h += (fbm(x*2.2 + 9, z*2.2, 71, 3) - 0.5)*0.05;
  const dz = (z - ZC(x))/RIVER_W;
  if(Math.abs(dz) < 1){ const b = (1 - dz*dz)**2; h -= 0.19*b; }
  return h;
}
// 縁からの距離（角の丸い長方形の内側）
function insideDist(x, z, hw, hl, r){
  const qx = Math.abs(x) - (hw - r), qz = Math.abs(z) - (hl - r);
  const out = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
  return -out;
}
function surfaceY(x, z){
  const d = insideDist(x, z, HW + 0.04, HL + 0.04, RC + 0.04), h = groundH(x, z);
  const e = sstep(0, 0.14, d);
  return YD + lerp(Math.min(0.035, h), h, e);
}
const WATER = YD + 0.018;

function createForestBridgeFloat(opts){
  opts = opts || {};
  const Q = opts.quality === 'low' ? 0 : 1;
  const tx = textures();
  const env = envMapFor(opts.renderer);
  const g = new T.Group(); g.name = 'forestBridgeFloat';
  const base = opts.base || '';
  const disposables = [];
  const mk = (o)=>{ const m = new T.MeshStandardMaterial(o); if(env && o.envMapIntensity !== 0) m.envMap = env; disposables.push(m); return m; };
  const tex = (c, srgb, rep)=>{ const t = toTex(c, srgb, rep); disposables.push(t); return t; };

  /* ---- 材質 ---- */
  const M = {};
  M.toe   = mk({color:0x5a3a24, map:tex(tx.wood.map, true, [6, 1]), normalMap:tex(tx.wood.normal, false, [6, 1]), roughness:0.55, metalness:0.0, envMapIntensity:0.35});
  M.panel = mk({color:0xffffff, map:tex(tx.panel.map, true), normalMap:tex(tx.panel.normal, false), roughness:0.48, metalness:0.0, envMapIntensity:0.5});
  M.gold  = mk({color:0xd8a640, normalMap:tex(tx.rope.normal, false, [40, 1]), roughness:0.32, metalness:0.85, emissive:0x3a2208, emissiveIntensity:0.6, envMapIntensity:1.2});
  M.goldPlain = mk({color:0xd8a640, roughness:0.3, metalness:0.85, emissive:0x3a2208, emissiveIntensity:0.6, envMapIntensity:1.2});
  M.fascia = mk({color:0xffffff, map:tex(tx.fascia.map, true, [1, 1]), normalMap:tex(tx.fascia.normal, false, [1, 1]), roughness:0.5, envMapIntensity:0.45});
  M.deck  = mk({color:0x2a1c12, roughness:0.9, envMapIntensity:0});
  M.ground = mk({color:0xffffff, map:tex(tx.ground.map, true, [3, 6]), normalMap:tex(tx.ground.normal, false, [3, 6]), vertexColors:true, roughness:0.92, envMapIntensity:0.15});
  M.rock  = mk({color:0xffffff, map:tex(tx.stone.map, true, [1, 1]), normalMap:tex(tx.stone.normal, false, [1, 1]), vertexColors:true, roughness:0.85, envMapIntensity:0.25});
  M.stone = mk({color:0xffffff, map:tex(tx.stone.map, true, [1, 1]), normalMap:tex(tx.stone.normal, false, [1, 1]), roughness:0.8, envMapIntensity:0.3});
  M.bark  = mk({color:0xffffff, map:tex(tx.bark.map, true, [1, 1]), normalMap:tex(tx.bark.normal, false, [1, 1]), roughness:0.85, envMapIntensity:0.2});
  M.leafCard = mk({color:0xffffff, map:tex(tx.leafCard, true), alphaTest:0.5, side:T.DoubleSide, roughness:0.75, envMapIntensity:0.2});
  M.leaf  = mk({color:0xffffff, map:tex(tx.leaf.map, true, [2, 2]), normalMap:tex(tx.leaf.normal, false, [2, 2]), vertexColors:true, roughness:0.7, envMapIntensity:0.25});
  M.plank = mk({color:0xc0905e, map:tex(tx.wood.map, true, [1, 0.4]), normalMap:tex(tx.wood.normal, false, [1, 0.4]), roughness:0.7, envMapIntensity:0.3, emissive:0x2a1406, emissiveIntensity:1});
  // 橋板が風で波打つ（頂点を少しだけ上下に動かす。部品をまとめたあとでも板ごとに動く）
  const plankU = {uTime:{value:0}, uWind:{value:0}};
  M.plank.onBeforeCompile = sh=>{ sh.uniforms.uTime = plankU.uTime; sh.uniforms.uWind = plankU.uWind;
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n float bw = sin(position.z*5.5 + uTime*4.2); float env = 1.0 - pow(abs(position.z)/1.15, 2.0); transformed.y += bw*uWind*0.022*max(env, 0.0); transformed.x += cos(position.z*3.0 + uTime*2.7)*uWind*0.012*max(env, 0.0);'); };
  M.post  = mk({color:0x8a6040, map:tex(tx.wood.map, true, [0.5, 2]), normalMap:tex(tx.wood.normal, false, [0.5, 2]), roughness:0.75, envMapIntensity:0.3});
  M.rope  = mk({color:0xd8c08a, normalMap:tex(tx.rope.normal, false, [30, 1]), roughness:0.9, envMapIntensity:0.1});
  M.brass = mk({color:0x9a6a2a, roughness:0.35, metalness:0.9, envMapIntensity:1.1});
  M.fern  = mk({color:0xffffff, roughness:0.75, side:T.DoubleSide, envMapIntensity:0.15});
  M.vine  = mk({color:0x3f7a3a, roughness:0.7, envMapIntensity:0.2});
  M.flower = mk({color:0xffffff, vertexColors:true, roughness:0.55, emissive:0x000000, envMapIntensity:0.2, side:T.DoubleSide});
  M.mushStem = mk({color:0xf3e6cc, roughness:0.6, envMapIntensity:0.2});
  M.mushCap = mk({color:0xffffff, map:tex(tx.mush, true), roughness:0.45, envMapIntensity:0.4});
  M.grass = mk({color:0xffffff, roughness:0.8, side:T.DoubleSide, envMapIntensity:0.1});
  const glassMats = [];
  const glass = ()=>{ const m = mk({color:0xffe2a8, emissive:0xffb24a, emissiveIntensity:1.6, roughness:0.25, metalness:0, envMapIntensity:0.6}); glassMats.push(m); return m; };
  const sparkTex = tex(tx.spark, false), glowTexture = tex(tx.glow, false), shadowTex = tex(tx.shadow, false);
  const add = (parent, geo, mat, p, r, s)=>{ const o = new T.Mesh(geo, mat); if(p) o.position.set(p[0], p[1], p[2]); if(r) o.rotation.set(r[0], r[1], r[2]); if(s) o.scale.set(s[0], s[1], s[2]); parent.add(o); return o; };
  const glows = [];
  const glowAt = (parent, size, p, k)=>{ const s = new T.Sprite(new T.SpriteMaterial({map:glowTexture, blending:T.AdditiveBlending, depthWrite:false, transparent:true})); s.scale.set(size, size, 1); s.position.set(p[0], p[1], p[2]); parent.add(s); disposables.push(s.material); glows.push({s, base:size, k:k||1}); return s; };

  const bulbPts = [], bulbKind = [];   // 電球：位置と種類（0=ふち 1=なわ飾り 2=手すり 3=木）
  const addBulb = (x, y, z, k)=>{ bulbPts.push(x, y, z); bulbKind.push(k); };

  /* ---- 1. 車体：彫刻のある木の台座と、花の絵付けの側面（車輪は裾で隠す） ---- */
  const body = new T.Group(); g.add(body);
  const path = perimeter(HW, HL, RC, 10);
  const uPanel = path.total / Math.round(path.total / 0.78) * 4;   // 絵付けの1枚がおよそ78cmになり、周回でちょうどつながる
  add(body, sweep(path, [[0.0, 0.015], [0.07, 0.03], [0.085, 0.07], [0.07, 0.11], [0.02, 0.13], [0.0, 0.16]], 1.2), M.toe);
  add(body, sweep(path, [[0.0, 0.16], [0.03, 0.3], [0.035, 0.45], [0.015, 0.6], [-0.005, 0.63]], uPanel), M.panel);
  { const prof = []; for(let k=0;k<=8;k++){ const a = -Math.PI/2 + k/8*Math.PI; prof.push([0.0 + Math.cos(a)*0.045, 0.672 + Math.sin(a)*0.045]); } add(body, sweep(path, prof, 0.25), M.gold); }
  add(body, sweep(path, [[-0.005, 0.715], [0.04, 0.76], [0.085, 0.84], [0.11, 0.905]], 1.6), M.fascia);
  { const prof = [[0.11, 0.905], [0.135, 0.92], [0.14, 0.945], [0.125, 0.968], [0.09, 0.978], [0.03, 0.98]]; add(body, sweep(path, prof, 0.6), M.goldPlain); }
  { const sh = new T.Shape(); const pp = perimeter(HW + 0.05, HL + 0.05, RC + 0.05, 8); pp.forEach((p, i)=>i ? sh.lineTo(p.x, -p.z) : sh.moveTo(p.x, -p.z));
    const cap = new T.ShapeGeometry(sh); cap.rotateX(-Math.PI/2); add(body, cap, M.deck, [0, YD - 0.02, 0]); }
  // 電球：上のふちと金のなわ飾り
  { const ring = (d, y, step, k)=>{ const n = Math.round(path.total/step); let j = 0; for(let i=0;i<n;i++){ const s = i/n*path.total; while(j < path.length - 1 && path[j+1].s < s) j++; const a = path[j], b = path[(j+1) % path.length], L = (b.s || path.total) - a.s, t = L > 0 ? (s - a.s)/L : 0;
      const x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t), nx = lerp(a.nx, b.nx, t), nz = lerp(a.nz, b.nz, t), nl = Math.hypot(nx, nz); addBulb(x + nx/nl*d, y, z + nz/nl*d, k); } };
    ring(0.145, 0.94, 0.085, 0); ring(0.05, 0.672, 0.11, 1); }
  // 絵付けの板の区切りに金の柱（縦の電球つき）
  const pathAt = (sv)=>{ let j = 0; while(j < path.length - 1 && path[j+1].s < sv) j++; const a = path[j], b = path[(j+1) % path.length], L = (b.s || path.total) - a.s, t = L > 0 ? (sv - a.s)/L : 0;
    const nx = lerp(a.nx, b.nx, t), nz = lerp(a.nz, b.nz, t), nl = Math.hypot(nx, nz) || 1; return {x:lerp(a.x, b.x, t), z:lerp(a.z, b.z, t), nx:nx/nl, nz:nz/nl}; };
  { const nP = Math.round(path.total/0.78), colG = new T.CylinderGeometry(0.026, 0.03, 0.44, 10, 1, false, -Math.PI/2, Math.PI), capG = new T.SphereGeometry(0.04, 12, 8, 0, Math.PI*2, 0, Math.PI/2);
    for(let k=0;k<nP;k++){ const q = pathAt((k + 0.0)/nP*path.total), ry = Math.atan2(q.nx, q.nz);
      const px = q.x + q.nx*0.035, pz = q.z + q.nz*0.035;
      add(body, colG, M.goldPlain, [px, 0.39, pz], [0, ry, 0]);
      add(body, capG, M.goldPlain, [px, 0.61, pz], [0, ry, 0], [1, 0.7, 1]);
      add(body, capG, M.goldPlain, [px, 0.17, pz], [Math.PI, ry, 0], [1, 0.7, 1]);
      for(let i=0;i<5;i++) addBulb(px + q.nx*0.03, 0.22 + i*0.085, pz + q.nz*0.03, 1);
    } }
  // 角の柱飾り（金の玉と小さなランタン）
  const cornerLan = [];
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz])=>{
    const c = Math.SQRT1_2, px = sx*(HW - RC + (RC + 0.12)*c), pz = sz*(HL - RC + (RC + 0.12)*c);
    add(body, new T.CylinderGeometry(0.035, 0.05, 0.5, 12), M.goldPlain, [px, 0.42, pz]);
    add(body, new T.SphereGeometry(0.07, 16, 10), M.goldPlain, [px, 0.72, pz]);
    // 腕木に下がるランタン
    const arm = new T.Group(); arm.position.set(px, 0.98, pz); body.add(arm);
    add(arm, new T.CylinderGeometry(0.012, 0.012, 0.42, 6), M.brass, [0, 0.21, 0]);
    add(arm, new T.TorusGeometry(0.06, 0.008, 6, 16, Math.PI), M.brass, [sx*0.0, 0.42, 0], [0, Math.atan2(sz, sx)*0 + (sx*sz > 0 ? Math.PI/4 : -Math.PI/4), 0]);
    const L = lanternMesh(M, glass(), 0.6); L.position.set(0, 0.28, 0); arm.add(L); cornerLan.push(L);
    glowAt(arm, 0.55, [0, 0.33, 0], 0.7);
  });
  // 前と後ろの飾り：木を彫った葉の紋章と、金の縁の円盤
  const crest = (zs)=>{
    const cg = new T.Group(); cg.position.set(0, 0.5, zs*(HL + 0.04)); cg.rotation.y = zs > 0 ? 0 : Math.PI; body.add(cg);
    const leafShape = new T.Shape(); leafShape.moveTo(0, -0.36); leafShape.bezierCurveTo(0.42, -0.2, 0.46, 0.25, 0, 0.42); leafShape.bezierCurveTo(-0.46, 0.25, -0.42, -0.2, 0, -0.36);
    const lg = new T.ExtrudeGeometry(leafShape, {depth:0.05, bevelEnabled:true, bevelThickness:0.025, bevelSize:0.025, bevelSegments:3, curveSegments:18});
    add(cg, lg, M.fascia, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
    add(cg, new T.TorusGeometry(0.17, 0.022, 8, 32), M.goldPlain, [0, 0.03, 0.09]);
    const disc = add(cg, new T.CircleGeometry(0.16, 32), M.panel, [0, 0.03, 0.085]); disc.material = M.panel;
    [-1, 1].forEach(s=>add(cg, new T.TorusGeometry(0.09, 0.016, 6, 16, Math.PI*1.4), M.goldPlain, [s*0.24, -0.2, 0.07], [0, 0, s > 0 ? 0.6 : 2.5]));
    for(let k=0;k<12;k++){ const a = k/12*Math.PI*2; addBulb(Math.cos(a)*0.2*(zs > 0 ? 1 : -1), 0.53 + Math.sin(a)*0.2, zs*(HL + 0.14), 1); }
  };
  crest(1); crest(-1);

  /* ---- 2. 地形：高低差のある森の地面（川の溝・丘・草地）。木の下と橋の下は暗くして影を描く ---- */
  {
    const NX = Q ? 46 : 28, NZ = Q ? 92 : 56, hw = HW + 0.04, hl = HL + 0.04, r = RC + 0.04;
    const pos = [], col = [], uv = [], idx = [];
    const cMoss = new T.Color(0x5a8a40), cGrass = new T.Color(0x86b45a), cSoil = new T.Color(0x5a4430), cWet = new T.Color(0x34402a), cStone = new T.Color(0x8a867a), tmp = new T.Color();
    for(let j=0;j<=NZ;j++) for(let i=0;i<=NX;i++){
      let x = -hw + i/NX*2*hw, z = -hl + j/NZ*2*hl;
      const d = insideDist(x, z, hw, hl, r);
      if(d < 0){ const qx = Math.sign(x)*(hw - r), qz = Math.sign(z)*(hl - r), ax = x - qx, az = z - qz, L = Math.hypot(ax, az) || 1; x = qx + ax/L*r; z = qz + az/L*r; }
      const y = surfaceY(x, z), h = y - YD;
      pos.push(x, y, z); uv.push(x*0.5 + 0.5, z*0.5 + 0.5);
      const dz = Math.abs(z - ZC(x))/RIVER_W;
      tmp.copy(cMoss).lerp(cGrass, clamp(fbm(x*3, z*3, 81, 3)*1.4 - 0.2, 0, 1));
      tmp.lerp(cSoil, sstep(0.75, 0.45, dz)*0.8); tmp.lerp(cWet, sstep(0.45, 0.2, dz));
      const slope = Math.abs(groundH(x + 0.03, z) - groundH(x - 0.03, z)) + Math.abs(groundH(x, z + 0.03) - groundH(x, z - 0.03));
      tmp.lerp(cStone, sstep(0.03, 0.07, slope)*0.6);
      let ao = 1;   // 木の下・橋の下・岩の陰
      ao -= 0.35*Math.exp(-((x + 0.45)**2 + (z - 1.85)**2)/0.25);
      ao -= 0.25*Math.exp(-((x + 0.8)**2 + (z + 1.95)**2)/0.12);
      ao -= 0.3*Math.exp(-((x + 0.05)**2/0.12 + (z - 0.5)**2/0.5))*(h < 0.06 ? 1 : 0.3);
      tmp.multiplyScalar(ao*(0.85 + 0.3*clamp(h*2, 0, 0.5)));
      col.push(tmp.r, tmp.g, tmp.b);
    }
    for(let j=0;j<NZ;j++) for(let i=0;i<NX;i++){ const a = j*(NX+1) + i, b = a + NX + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tg.setAttribute('color', new T.Float32BufferAttribute(col, 3)); tg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
    add(g, tg, M.ground);
    // 縁のすき間をふさぐ帯
    const ep = perimeter(hw, hl, r, 8), sp = [], si = [];
    ep.forEach(p=>{ const y = surfaceY(p.x*0.999, p.z*0.999); sp.push(p.x, y, p.z, p.x, YD - 0.03, p.z); });
    for(let i=0;i<ep.length;i++){ const a = i*2, b = ((i + 1) % ep.length)*2; si.push(a, b, a + 1, b, b + 1, a + 1); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); sg.setIndex(si); sg.computeVertexNormals(); vcol(sg, new T.Color(0x3a3020));
    add(g, sg, M.ground);
  }

  /* ---- 3. 川と水面（流れる波・光の反射）、手前の縁からこぼれる小さな滝 ---- */
  const water = {};
  {
    const NX = 40, NW = 8, pos = [], uv = [], idx = [];
    const x0 = -0.98, x1 = HW + 0.13;
    for(let i=0;i<=NX;i++){ const x = lerp(x0, x1, i/NX); for(let j=0;j<=NW;j++){ const z = ZC(x) + (j/NW - 0.5)*RIVER_W*1.25; pos.push(x, WATER, z); uv.push((x - x0), j/NW); } }
    for(let i=0;i<NX;i++) for(let j=0;j<NW;j++){ const a = i*(NW+1) + j, b = (i+1)*(NW+1) + j; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); wg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); wg.setIndex(idx); wg.computeVertexNormals();
    water.uni = {uTime:{value:0}, uGlow:{value:0.6}, uNight:{value:1}};
    const wm = new T.ShaderMaterial({
      uniforms:water.uni, transparent:true, depthWrite:false,
      vertexShader:`varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader:`uniform float uTime, uGlow, uNight; varying vec2 vUv; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec2 p = vec2(vUv.x*5. - uTime*0.55, vUv.y*3.);
          float r = n(p*2.) * .6 + n(p*5. + 3.) * .4;
          float band = smoothstep(.62, .9, n(vec2(vUv.x*9. - uTime*1.1, vUv.y*6.)));
          vec3 deep = mix(vec3(.03,.12,.16), vec3(.05,.3,.36), uNight < .5 ? 1. : .35);
          vec3 c = mix(deep, deep*2.4, r);
          vec3 V = normalize(cameraPosition - vW); float fr = pow(1. - clamp(V.y, 0., 1.), 3.);
          c += vec3(.35,.45,.6)*fr*.5;
          c += vec3(1., .78, .45)*band*(.35 + uGlow*.65);
          float edge = smoothstep(0., .14, vUv.y)*smoothstep(1., .86, vUv.y);
          float spark = step(.985, h(floor(vec2(vUv.x*60. - uTime*6., vUv.y*14.))) )*(.5 + .5*sin(uTime*9. + vUv.x*40.));
          c += vec3(1., .9, .7)*spark*.9;
          gl_FragColor = vec4(c, .86*edge + .1);
        }`
    });
    disposables.push(wm);
    const wmesh = add(g, wg, wm); wmesh.renderOrder = 2; wmesh.userData.dynamic = true;
    // 小さな滝：ふちを越えて下の水盤へ
    const zc = ZC(HW), FW = 0.5, fall = new T.CatmullRomCurve3([V3(HW + 0.12, WATER, 0), V3(HW + 0.2, WATER - 0.03, 0), V3(HW + 0.25, WATER - 0.2, 0), V3(HW + 0.27, 0.62, 0), V3(HW + 0.28, 0.47, 0)]);
    const fp = [], fu = [], fi = [], FN = 16;
    for(let i=0;i<=FN;i++){ const p = fall.getPointAt(i/FN); for(let j=0;j<=4;j++){ const w = (j/4 - 0.5)*FW*(1 - i/FN*0.15); fp.push(p.x, p.y, zc + w); fu.push(j/4, i/FN); } }
    for(let i=0;i<FN;i++) for(let j=0;j<4;j++){ const a = i*5 + j, b = (i+1)*5 + j; fi.push(a, b, a + 1, b, b + 1, a + 1); }
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.Float32BufferAttribute(fp, 3)); fg.setAttribute('uv', new T.Float32BufferAttribute(fu, 2)); fg.setIndex(fi);
    water.fall = {uTime:water.uni.uTime};
    const fm = new T.ShaderMaterial({uniforms:water.fall, transparent:true, depthWrite:false, side:T.DoubleSide, blending:T.AdditiveBlending,
      vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader:`uniform float uTime; varying vec2 vUv; float h(float x){ return fract(sin(x*91.7)*437.5); }
        void main(){ float col = floor(vUv.x*22.); float s = fract(vUv.y*2.5 - uTime*1.8 + h(col)*3.); float streak = smoothstep(.0,.25,s)*smoothstep(1.,.5,s);
          float side = smoothstep(0.,.18,vUv.x)*smoothstep(1.,.82,vUv.x); float a = (.25 + streak*.55)*side*(1. - vUv.y*.3);
          gl_FragColor = vec4(vec3(.6,.82,.95)*a + vec3(1.,.85,.6)*a*.25, 1.); }`});
    disposables.push(fm);
    const fmesh = add(g, fg, fm); fmesh.renderOrder = 3; fmesh.userData.dynamic = true;
    // 水盤（貝のような石の器）
    const bowl = new T.SphereGeometry(0.2, 24, 10, 0, Math.PI*2, Math.PI*0.5, Math.PI*0.5);
    add(g, bowl, M.stone, [HW + 0.26, 0.5, zc], [0, 0, 0], [0.9, 0.55, 1.75]);
    add(g, new T.TorusGeometry(0.2, 0.025, 8, 32), M.goldPlain, [HW + 0.26, 0.5, zc], [Math.PI/2, 0, 0], [0.9, 1.75, 1]);
    const pool = add(g, new T.CircleGeometry(0.18, 24), wm, [HW + 0.26, 0.49, zc], [-Math.PI/2, 0, 0], [0.9, 1.75, 1]); pool.userData.dynamic = true;
    water.foam = glowAt(g, 0.5, [HW + 0.27, 0.53, zc], 0.4); water.foam.material.color.set(0xbfe6ff);
    // 川の源：奥のふちの岩場
    const R = rng(23);
    for(let k=0;k<9;k++){
      const rx = -0.95 + R()*0.28, rz = ZC(-0.95) + (R() - 0.5)*0.85, s = 0.07 + R()*0.11;
      const rg = new T.IcosahedronGeometry(1, 1), p = rg.attributes.position;
      for(let i=0;i<p.count;i++){ const v = V3(p.getX(i), p.getY(i), p.getZ(i)), n = 0.75 + 0.5*vnoise(v.x*2 + k, v.y*2 + v.z*2, 91); p.setXYZ(i, v.x*n, v.y*n*0.7, v.z*n); }
      rg.computeVertexNormals();
      add(g, rg, M.stone, [rx, surfaceY(rx, rz) + s*0.3, rz], [R()*3, R()*3, R()*3], [s, s, s]);
    }
  }

  /* ---- 4. 古い木の橋：フロートのまん中の舞台。板・桁・柱・木の手すり・ロープ。風で揺れる ---- */
  const bridge = new T.Group(); bridge.userData.dynamic = true; g.add(bridge);
  const BX = 0.06, BW = 0.76, BZ0 = -0.92, BZ1 = 1.3, ARCH = 0.36;     // 手前（観客から見て右）の岸 → 向こう岸
  const bankY0 = surfaceY(BX, BZ0), bankY1 = surfaceY(BX, BZ1);
  const deckY = z=>{ const t = (z - BZ0)/(BZ1 - BZ0); return lerp(bankY0, bankY1, t) + Math.sin(t*Math.PI)*ARCH + 0.03; };
  const BC = (BZ0 + BZ1)/2;
  bridge.position.set(BX, 0, BC);
  const ropes = [];
  {
    const NP = 26, R = rng(41), RB = rng(77);
    const pg = new T.BoxGeometry(BW, 0.04, 0.074);
    for(let i=0;i<NP;i++){
      const z = lerp(BZ0 + 0.04, BZ1 - 0.04, i/(NP - 1)), y = deckY(z), dy = (deckY(z + 0.01) - deckY(z - 0.01))/0.02;
      add(bridge, pg, M.plank, [(R() - 0.5)*0.035, y, z - BC], [-Math.atan(dy) + (R() - 0.5)*0.05, (R() - 0.5)*0.06, (R() - 0.5)*0.04], [0.9 + R()*0.14, 1, 1]);
    }
    // 板の下の桁（弓なりの2本）と、岸の石の土台
    [-1, 1].forEach(s=>{
      const pts = []; for(let k=0;k<=12;k++){ const z = lerp(BZ0 - 0.05, BZ1 + 0.05, k/12); pts.push(V3(s*BW*0.42, deckY(z) - 0.055, z - BC)); }
      add(bridge, taperTube(new T.CatmullRomCurve3(pts), 30, 6, 6, 0.04, 0.04, 0), M.post);
    });
    [BZ0, BZ1].forEach(z=>{ add(bridge, new T.BoxGeometry(BW + 0.16, 0.16, 0.22), M.stone, [0, surfaceY(BX, z) - 0.03, z - BC], [0, 0, 0]); });
    // 柱・手すり・ロープ
    const posts = 7;
    [-1, 1].forEach(s=>{
      const tops = [];
      for(let k=0;k<posts;k++){
        const z = lerp(BZ0 + 0.03, BZ1 - 0.03, k/(posts - 1)), end = k === 0 || k === posts - 1;
        const hgt = end ? 0.66 : 0.48, r0 = end ? 0.05 : 0.032, y = deckY(z) - 0.06;
        add(bridge, new T.CylinderGeometry(r0*0.9, r0, hgt + 0.06, 10), M.post, [s*BW*0.5, y + (hgt + 0.06)/2, z - BC], [(RB() - 0.5)*0.06, 0, s*RB()*0.05]);
        if(end) add(bridge, new T.SphereGeometry(r0*1.15, 10, 8), M.post, [s*BW*0.5, y + hgt + 0.09, z - BC]);
        tops.push(V3(s*BW*0.5, y + 0.5, z - BC));
        add(bridge, new T.TorusGeometry(0.034, 0.01, 6, 12), M.rope, [s*BW*0.5, y + 0.28, z - BC], [Math.PI/2, 0, 0]);   // 結び目
      }
      // 木の手すり（柱の上をつなぐ）と、その上の温かい電球
      const rail = new T.CatmullRomCurve3(tops);
      add(bridge, taperTube(rail, 40, 6, 8, 0.026, 0.026, 0), M.post);
      for(let k=0;k<34;k++){ const p = rail.getPointAt(k/33); addBulb(p.x + BX, p.y + 0.035, p.z + BC, 2); }
      // 足元の電球（板のふち）
      for(let k=0;k<30;k++){ const z = lerp(BZ0 + 0.05, BZ1 - 0.05, k/29); addBulb(BX + s*(BW*0.5 - 0.02), deckY(z) + 0.035, z, 4); }
      // たるんだロープ：柱と柱のあいだ。橋とは別に、風でゆらゆら揺れる
      for(let k=0;k<posts - 1;k++){
        const a = tops[k].clone(), b = tops[k+1].clone(); a.y -= 0.24; b.y -= 0.24;
        const mid = a.clone().lerp(b, 0.5);
        const rg = new T.Group(); rg.position.copy(mid); rg.userData.dynamic = true; bridge.add(rg);
        const la = a.clone().sub(mid), lb = b.clone().sub(mid), lm = V3(0, -0.075, 0);
        add(rg, taperTube(new T.QuadraticBezierCurve3(la, lm, lb), 14, 5, 5, 0.012, 0.012, 0), M.rope);
        ropes.push({rg, axis:lb.clone().sub(la).normalize(), ph:k*0.9 + (s > 0 ? 0 : 2)});
      }
    });
  }
  bakeStatic(bridge);   // 橋は全体で揺れるので、部品は材質ごとに1つにまとめる（ロープは別に揺れる）
  // 4本の親柱の上にランタン（橋を温かく照らす）
  [[-1, BZ0], [1, BZ0], [-1, BZ1], [1, BZ1]].forEach(([s, z])=>{
    const zz = z + (z < 0 ? 0.03 : -0.03), y = deckY(zz) - 0.06 + 0.66 + 0.2;
    const L = lanternMesh(M, glass(), 0.9); L.position.set(s*BW*0.5, y, zz - BC); bridge.add(L);
    glowAt(bridge, 0.75, [s*BW*0.5, y + 0.04, zz - BC], 1.1);
  });
  // 橋の足元にこぼれる光（床に落ちる温かい光）
  const bridgePool = (()=>{ const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({map:glowTexture, transparent:true, depthWrite:false, blending:T.AdditiveBlending, opacity:0.5}));
    m.rotation.x = -Math.PI/2; m.scale.set(1.6, 3.0, 1); m.position.set(BX, WATER + 0.004, BC); m.userData.dynamic = true; m.renderOrder = 3; g.add(m); disposables.push(m.material); return m; })();

  // 二人の足もとの温かい光（距離が縮まると広がる）
  const pairPool = (()=>{ const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({map:glowTexture, transparent:true, depthWrite:false, blending:T.AdditiveBlending, opacity:0, color:0xffc070}));
    m.rotation.x = -Math.PI/2; m.userData.dynamic = true; m.renderOrder = 4; g.add(m); disposables.push(m.material); return m; })();

  /* ---- 5. 木：ねじれた幹と、花の咲く茂み。茂みは遠くでは粗い形に切りかえる（LOD） ---- */
  const canopies = [];
  const tree = (x, z, s, seed, flowers, tall)=>{   // tall：幹の高さの倍率（茂みを頭より上に持ち上げる）
    tall = tall || 1;
    const R = rng(seed), tg = new T.Group(), y0 = surfaceY(x, z) - 0.03;
    tg.position.set(x, y0, z); g.add(tg);
    const lean = (R() - 0.5)*0.25;
    const trunk = new T.CatmullRomCurve3([V3(0, 0, 0), V3(lean*0.4*s, 0.35*s*tall, 0.05*s), V3(lean*s - 0.05*s, 0.75*s*tall, -0.04*s), V3(lean*1.2*s, 1.05*s*tall, 0.03*s)]);
    add(tg, taperTube(trunk, 18, 12, 10, 0.12*s, 0.055*s, 0.35), M.bark);
    for(let k=0;k<4;k++){   // 根
      const a = k/4*Math.PI*2 + R(), c = new T.CatmullRomCurve3([V3(0, 0.18*s, 0), V3(Math.cos(a)*0.14*s, 0.06*s, Math.sin(a)*0.14*s), V3(Math.cos(a)*0.28*s, -0.02, Math.sin(a)*0.28*s)]);
      add(tg, taperTube(c, 8, 6, 6, 0.07*s, 0.015*s, 0.2), M.bark);
    }
    const branchEnds = [];
    for(let k=0;k<3;k++){   // 枝
      const a = k/3*Math.PI*2 + R()*0.8, st = trunk.getPointAt(0.62 + k*0.1), en = st.clone().add(V3(Math.cos(a)*0.38*s, 0.28*s, Math.sin(a)*0.38*s));
      const c = new T.CatmullRomCurve3([st, st.clone().lerp(en, 0.5).add(V3(0, 0.1*s, 0)), en]);
      add(tg, taperTube(c, 10, 6, 6, 0.045*s, 0.015*s, 0.2), M.bark); branchEnds.push(en);
    }
    const top = trunk.getPointAt(1);
    const cg = new T.Group(); cg.position.copy(top); cg.userData.dynamic = true; tg.add(cg);
    const lod = new T.LOD(); cg.add(lod);
    const blobs = [];
    const nb = 6;
    for(let k=0;k<nb;k++){ const a = k/nb*Math.PI*2 + R(), rr = (k ? 0.32 : 0) * s; blobs.push([Math.cos(a)*rr, (k ? -0.02 + R()*0.18 : 0.22)*s, Math.sin(a)*rr, (0.36 + R()*0.12)*s*(k ? 1 : 1.15)]); }
    const leafCols = [new T.Color(0x9ad07a), new T.Color(0x5aa050), new T.Color(0x2f6a34)];
    const makeLevel = (det)=>{
      const grp = new T.Group();
      blobs.forEach(([bx, by, bz, br], k)=>{
        const geo = new T.IcosahedronGeometry(1, det), p = geo.attributes.position, cc = new Float32Array(p.count*3), cl = new T.Color();
        for(let i=0;i<p.count;i++){
          const v = V3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
          const n = 0.82 + 0.36*fbm(v.x*1.8 + k*3, v.y*1.8 + v.z*1.8, 101 + seed, 3);
          p.setXYZ(i, v.x*n, v.y*n*0.82, v.z*n);
          const t = clamp(v.y*0.5 + 0.5 + (fbm(v.x*3 + 5, v.z*3, 103, 2) - 0.5)*0.4, 0, 1);
          cl.copy(leafCols[2]).lerp(leafCols[1], sstep(0.1, 0.6, t)).lerp(leafCols[0], sstep(0.6, 1, t)*0.8);
          cc[i*3] = cl.r; cc[i*3+1] = cl.g; cc[i*3+2] = cl.b;
        }
        geo.setAttribute('color', new T.BufferAttribute(cc, 3));
        // 法線は球の向きのまま（角ばらず、なめらかに見える）
        const nn = new Float32Array(p.count*3); for(let i=0;i<p.count;i++){ const v = V3(p.getX(i), p.getY(i)/0.82, p.getZ(i)).normalize(); nn[i*3] = v.x; nn[i*3+1] = v.y; nn[i*3+2] = v.z; }
        geo.setAttribute('normal', new T.BufferAttribute(nn, 3));
        const m = new T.Mesh(geo, M.leaf); m.position.set(bx, by, bz); m.scale.setScalar(br); grp.add(m);
      });
      bakeStatic(grp);
      return grp;
    };
    lod.addLevel(makeLevel(s > 1.1 && Q ? 3 : 2), 0); lod.addLevel(makeLevel(1), 14);
    // 茂みのふちに葉の房を重ねて、輪郭をふんわりさせる
    { const NC = Math.round((Q ? 46 : 24)*blobs.length*s*s/1.69*1.0), cards = new T.InstancedMesh(CARD_GEO(), M.leafCard, NC), d = new T.Object3D(), cc = new T.Color();
      for(let k=0;k<NC;k++){ const b = blobs[k % blobs.length], v = V3(R()*2 - 1, R()*1.6 - 0.5, R()*2 - 1).normalize();
        d.position.set(b[0] + v.x*b[3]*0.96, b[1] + v.y*b[3]*0.8, b[2] + v.z*b[3]*0.96); d.lookAt(d.position.clone().add(v)); d.rotateZ(R()*6); const sc = (0.22 + R()*0.16)*s; d.scale.set(sc, sc, sc); d.updateMatrix();
        cards.setMatrixAt(k, d.matrix); cards.setColorAt(k, cc.setHSL(0.27 + R()*0.06, 0.45, 0.42 + R()*0.22)); }
      cg.add(cards); }
    canopies.push({cg, ph:R()*6, s});
    // 茂みに咲く小さな花
    if(flowers){
      const fl = flowerGeo(), cols = [0xff9ab8, 0xfff2f2, 0xffd84a, 0xf2a0d8], inst = new T.InstancedMesh(fl, M.flower, flowers), d = new T.Object3D(), cc = new T.Color();
      for(let k=0;k<flowers;k++){
        const b = blobs[(R()*blobs.length)|0], v = V3(R() - 0.5, R()*0.9 + 0.1, R() - 0.5).normalize();
        d.position.set(b[0] + v.x*b[3]*0.98, b[1] + v.y*b[3]*0.82, b[2] + v.z*b[3]*0.98);
        d.lookAt(d.position.clone().add(v)); d.rotateX(Math.PI/2); d.scale.setScalar(0.7 + R()*0.6); d.updateMatrix(); inst.setMatrixAt(k, d.matrix);
        inst.setColorAt(k, cc.set(cols[(R()*cols.length)|0]));
      }
      cg.add(inst);
    }
    return {tg, top, branchEnds, trunk};
  };
  const hero = tree(-0.66, 2.1, 1.25, 9, Q ? 70 : 34);
  // 二人の後ろ（観客と反対の側）の木：幹を高くして茂みを頭より上へ、立ち位置からずらす。代わりに低い茂みで森らしさを保つ
  tree(-0.92, -2.42, 0.86, 13, Q ? 30 : 14, 1.75);
  tree(-1.02, 1.72, 0.5, 17, Q ? 14 : 6, 1.0);
  // 大きな木の枝に下がるランタンと、茂みの中の電球
  const treeLans = [];
  hero.branchEnds.slice(0, 2).forEach((e, k)=>{
    const wp = e.clone().add(hero.tg.position);
    const ch = add(g, new T.CylinderGeometry(0.006, 0.006, 0.22, 4), M.brass, [wp.x, wp.y - 0.11, wp.z]);
    const L = lanternMesh(M, glass(), 0.95); L.position.set(wp.x, wp.y - 0.34, wp.z); L.userData.dynamic = true; g.add(L); treeLans.push(L);
    glowAt(g, 0.8, [wp.x, wp.y - 0.3, wp.z], 1.2);
  });
  { const R = rng(55); for(let k=0;k<(Q ? 46 : 24);k++){ const a = R()*Math.PI*2, rr = 0.45 + R()*0.35; const p = hero.top.clone().add(hero.tg.position).add(V3(Math.cos(a)*rr*1.3, -0.15 + R()*0.55, Math.sin(a)*rr*1.3)); addBulb(p.x, p.y, p.z, 3); } }

  /* ---- 6. 草花・きのこ・小石・シダ ---- */
  const avoid = (x, z)=>{   // 住人の通り道・橋・川は避ける
    if(Math.abs(z - ZC(x)) < RIVER_W*0.62) return true;
    if(Math.abs(x - BX) < 0.55 && z > BZ0 - 0.25 && z < BZ1 + 0.2) return true;
    if(x > -0.4 && x < 1.1 && z > -2.45 && z < -0.25) return true;
    return insideDist(x, z, HW, HL, RC) < 0.06;
  };
  const bloom = [];   // 向こう岸に咲く花（演出Cでひらく）
  {
    const R = rng(61), d = new T.Object3D(), cc = new T.Color();
    const NF = Q ? 140 : 70, fl = flowerGeo(), inst = new T.InstancedMesh(fl, M.flower, NF), cols = [0xffe24a, 0xff7a9a, 0xffffff, 0x8ab4ff, 0xff9a3a];
    let k = 0, guard = 0;
    while(k < NF && guard++ < 4000){
      const x = (R()*2 - 1)*HW, z = (R()*2 - 1)*HL; if(avoid(x, z)) continue;
      const far = z > ZC(x) + RIVER_W*0.6;
      if(!far && R() < 0.45) continue;
      const y = surfaceY(x, z) + 0.06 + R()*0.05;
      d.position.set(x, y, z); d.rotation.set(-0.2 + R()*0.4, R()*6, -0.2 + R()*0.4); const s = 0.8 + R()*0.7; d.scale.setScalar(s); d.updateMatrix();
      inst.setMatrixAt(k, d.matrix); inst.setColorAt(k, cc.set(cols[(R()*cols.length)|0]));
      if(far) bloom.push({k, m:d.matrix.clone(), s, x, z, y});
      k++;
    }
    inst.count = k; inst.userData.dynamic = true; g.add(inst);
    bloom.inst = inst;
    // 茎（細い緑の線）
    const sp = [], R2 = rng(62);
    for(let i=0;i<k;i++){ inst.getMatrixAt(i, d.matrix); d.matrix.decompose(d.position, d.quaternion, d.scale); sp.push(d.position.x, d.position.y, d.position.z, d.position.x + (R2() - 0.5)*0.02, d.position.y - 0.08, d.position.z); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    const sl = new T.LineSegments(sg, new T.LineBasicMaterial({color:0x3f8a3c})); g.add(sl); disposables.push(sl.material);
    // 草の束
    const blade = new T.ConeGeometry(0.012, 0.16, 3, 1, true); blade.translate(0, 0.08, 0);
    const NG = Q ? 220 : 110, gi = new T.InstancedMesh(blade, M.grass, NG);
    let gk = 0; guard = 0;
    while(gk < NG && guard++ < 5000){
      const x = (R()*2 - 1)*HW, z = (R()*2 - 1)*HL; if(Math.abs(z - ZC(x)) < RIVER_W*0.42 || insideDist(x, z, HW, HL, RC) < 0.05) continue;
      if(Math.abs(x - BX) < 0.46 && z > BZ0 - 0.1 && z < BZ1 + 0.1) continue;
      d.position.set(x, surfaceY(x, z) - 0.01, z); d.rotation.set((R() - 0.5)*0.5, R()*6, (R() - 0.5)*0.5); d.scale.set(1, 0.6 + R()*0.9, 1); d.updateMatrix();
      gi.setMatrixAt(gk, d.matrix); gi.setColorAt(gk, cc.setHSL(0.26 + R()*0.06, 0.5, 0.3 + R()*0.18)); gk++;
    }
    gi.count = gk; g.add(gi);
    // きのこ
    [[0.7, 1.75, 1.1], [0.5, 2.15, 0.8], [-0.62, -1.45, 1.0], [-0.78, -1.1, 0.7], [-1.0, 1.25, 0.9], [-0.62, 1.42, 0.7]].forEach(([x, z, s])=>{
      const y = surfaceY(x, z);
      add(g, new T.CylinderGeometry(0.022*s, 0.03*s, 0.11*s, 10), M.mushStem, [x, y + 0.05*s, z]);
      add(g, new T.SphereGeometry(0.075*s, 16, 8, 0, Math.PI*2, 0, Math.PI*0.5), M.mushCap, [x, y + 0.1*s, z], [0, R()*3, 0], [1, 0.75, 1]);
    });
    // 小石
    const pg = new T.DodecahedronGeometry(1, 0), pi = new T.InstancedMesh(pg, M.stone, 40); let pk = 0; guard = 0;
    while(pk < 40 && guard++ < 3000){ const x = (R()*2 - 1)*HW, z = (R()*2 - 1)*HL; const dz = Math.abs(z - ZC(x))/RIVER_W; if(dz < 0.35 || dz > 0.9 || insideDist(x, z, HW, HL, RC) < 0.05) continue;
      const s = 0.02 + R()*0.035; d.position.set(x, surfaceY(x, z) + s*0.3, z); d.rotation.set(R()*3, R()*3, R()*3); d.scale.set(s, s*0.7, s); d.updateMatrix(); pi.setMatrixAt(pk++, d.matrix); }
    pi.count = pk; g.add(pi);
    // 大きな岩（丘のふもと）
    [[0.62, 1.48, 0.12], [-0.98, 2.1, 0.12], [-0.95, -1.75, 0.1], [-1.0, -1.25, 0.11]].forEach(([x, z, s], k)=>{
      const rg = new T.IcosahedronGeometry(1, 2), p = rg.attributes.position;
      for(let i=0;i<p.count;i++){ const v = V3(p.getX(i), p.getY(i), p.getZ(i)), n = 0.8 + 0.4*fbm(v.x + k*5, v.y + v.z, 111, 3); p.setXYZ(i, v.x*n, v.y*n*0.75, v.z*n); }
      rg.computeVertexNormals(); add(g, rg, M.stone, [x, surfaceY(x, z) + s*0.2, z], [0, k, 0], [s, s, s]);
    });
  }
  /* ---- 6b. ふちからあふれる自然：岩の段・大きな木の根・シダ（台の四角い輪郭をくずす） ---- */
  {
    const R = rng(131);
    const rock = (x, y, z, sx, sy, sz, seed)=>{
      const rg = new T.IcosahedronGeometry(1, 2), p = rg.attributes.position;
      for(let i=0;i<p.count;i++){ const v = V3(p.getX(i), p.getY(i), p.getZ(i)), n = 0.78 + 0.42*fbm(v.x*1.3 + seed, v.y*1.3 + v.z*1.3, 141, 3); p.setXYZ(i, v.x*n, v.y*n, v.z*n); }
      rg.computeVertexNormals();
      // 上を向いた面は苔におおわれる
      const nr = rg.attributes.normal, cc = new Float32Array(p.count*3), cm = new T.Color(0x6a9a4a), cs = new T.Color(0xc8b8a0), cl = new T.Color();
      for(let i=0;i<p.count;i++){ const up = nr.getY(i) + (fbm(p.getX(i)*3 + seed, p.getZ(i)*3, 151, 2) - 0.5)*0.6; cl.copy(cs).lerp(cm, sstep(0.1, 0.5, up)); cc[i*3] = cl.r; cc[i*3+1] = cl.g; cc[i*3+2] = cl.b; }
      rg.setAttribute('color', new T.BufferAttribute(cc, 3));
      return add(g, rg, M.rock, [x, y, z], [R()*0.6, R()*6, R()*0.6], [sx, sy, sz]);
    };
    // 観客側・前寄り：台のふちから裾まで、苔むした岩が段になってこぼれる
    [[HW - 0.06, 1.0, 1.62, 0.24, 0.14, 0.28], [HW + 0.02, 0.92, 1.8, 0.17, 0.13, 0.18], [HW - 0.08, 1.03, 1.95, 0.16, 0.1, 0.15]]
      .forEach(([x, y, z, a, b, c], k)=>rock(x, y, z, a, b, c, k*3.1));
    // 観客側・後ろ寄り：小さな岩の段
    [[HW - 0.05, 0.99, -2.22, 0.18, 0.11, 0.2], [HW + 0.02, 0.93, -2.08, 0.12, 0.1, 0.13]].forEach(([x, y, z, a, b, c], k)=>rock(x, y, z, a, b, c, 20 + k*2.3));
    // 大きな木の根が、前のふちを越えて垂れ下がる
    const tb = hero.tg.position;
    [[-0.68, -0.07, 0], [0.22, 0.09, 1]].forEach(([ex, k, i])=>{
      const sx = tb.x + (ex > tb.x ? 0.1 : -0.1);
      const pts = [V3(sx, tb.y + 0.14, tb.z + 0.04), V3(lerp(sx, ex, 0.35) + k, surfaceY(lerp(sx, ex, 0.35), lerp(tb.z, HL, 0.45)) + 0.03, lerp(tb.z, HL, 0.45)),
        V3(lerp(sx, ex, 0.75) - k*0.6, YD + 0.06, HL - 0.06), V3(ex, YD + 0.03, HL + 0.13), V3(ex + k*0.6, 0.86, HL + 0.17), V3(ex + k*1.3, 0.74, HL + 0.12), V3(ex + k*1.1, 0.6, HL + 0.07)];
      const c = new T.CatmullRomCurve3(pts);
      add(g, taperTube(c, 30, 9, 9, 0.095 - i*0.015, 0.02, 0.45), M.bark);
      // 細い根
      [0.42, 0.66].forEach((u, j)=>{ const a = c.getPointAt(u), dir = (j ? 1 : -1)*(i ? 1 : -1);
        const cc = new T.CatmullRomCurve3([a, a.clone().add(V3(dir*0.12, -0.01, 0.06)), a.clone().add(V3(dir*0.2, -0.04, 0.1))]);
        add(g, taperTube(cc, 8, 5, 5, 0.03, 0.006, 0.3), M.bark); });
    });
    // シダ：ふちから外へ垂れる葉
    const fernG = (()=>{ const sh = new T.Shape(); sh.moveTo(0, 0);
      const n = 9; for(let k=0;k<=n;k++){ const y = k/n*0.34, w = 0.05*Math.sin(k/n*Math.PI)*(1 - k/n*0.3); sh.lineTo(w, y - 0.012); sh.lineTo(w*0.25, y + 0.01); }
      for(let k=n;k>=0;k--){ const y = k/n*0.34, w = 0.05*Math.sin(k/n*Math.PI)*(1 - k/n*0.3); sh.lineTo(-w*0.25, y + 0.01); sh.lineTo(-w, y - 0.012); }
      const fg = new T.ShapeGeometry(sh, 2), p = fg.attributes.position;
      for(let i=0;i<p.count;i++){ const y = p.getY(i); p.setZ(i, -y*y*1.6); }   // 先が垂れる
      fg.computeVertexNormals(); return fg; })();
    const NFern = Q ? 46 : 24, fi = new T.InstancedMesh(fernG, M.fern, NFern), d = new T.Object3D(), cc = new T.Color();
    for(let k=0;k<NFern;k++){
      const q = pathAt(R()*path.total);
      if(q.nx > 0.7 && Math.abs(q.z - ZC(HW)) < 0.4) { k--; continue; }   // 滝のところは空ける
      d.position.set(q.x - q.nx*0.02, YD + 0.03, q.z - q.nz*0.02);
      // 葉の長さの向き(y)を外向き・少し上に、垂れる向き(-z)を下にそろえる
      const tw = (R() - 0.5)*0.9, ox = q.nx*Math.cos(tw) - q.nz*Math.sin(tw), oz = q.nx*Math.sin(tw) + q.nz*Math.cos(tw);
      const yA = V3(ox, 0.35 + R()*0.3, oz).normalize(), xA = V3(-oz, 0, ox).normalize(), zA = V3().crossVectors(xA, yA);
      d.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(xA, yA, zA)); const sc = 0.8 + R()*0.7; d.scale.set(sc, sc, sc); d.updateMatrix();
      fi.setMatrixAt(k, d.matrix); fi.setColorAt(k, cc.setHSL(0.28 + R()*0.06, 0.5, 0.3 + R()*0.14));
    }
    g.add(fi);
  }

  /* ---- 7. 側面の飾り：花とツタの垂れ飾り、葉 ---- */
  {
    const R = rng(71), leafG = leafGeo(), NL = Q ? 520 : 260, li = new T.InstancedMesh(leafG, M.vine, NL), fl = flowerGeo(), NF = Q ? 90 : 46, fi = new T.InstancedMesh(fl, M.flower, NF);
    const d = new T.Object3D(), cc = new T.Color(); let lk = 0, fk = 0;
    const swagN = Math.round(path.total/0.62), at = s=>{ let j = 0; while(j < path.length - 1 && path[j+1].s < s) j++; const a = path[j], b = path[(j+1) % path.length], L = (b.s || path.total) - a.s, t = L > 0 ? (s - a.s)/L : 0; return {x:lerp(a.x, b.x, t), z:lerp(a.z, b.z, t), nx:lerp(a.nx, b.nx, t), nz:lerp(a.nz, b.nz, t)}; };
    for(let k=0;k<swagN;k++){
      const s0 = k/swagN*path.total, s1 = (k + 1)/swagN*path.total, pts = [];
      for(let i=0;i<=10;i++){ const t = i/10, p = at(lerp(s0, s1, t)), nl = Math.hypot(p.nx, p.nz), sag = Math.sin(t*Math.PI)*0.13, d0 = 0.115 - sag*0.35;
        pts.push(V3(p.x + p.nx/nl*d0, 0.9 - sag, p.z + p.nz/nl*d0)); }
      const c = new T.CatmullRomCurve3(pts);
      add(g, taperTube(c, 14, 4, 4, 0.012, 0.012, 0), M.vine);
      for(let i=0;i<12 && lk < NL;i++){ const t = (i + 0.5)/12, p = c.getPointAt(t), tn = c.getTangentAt(t);
        d.position.copy(p); d.lookAt(p.clone().add(tn)); d.rotateZ((i % 2 ? 1 : -1)*1.1 + (R() - 0.5)*0.6); d.rotateX(0.6); d.scale.setScalar(0.85 + R()*0.5); d.updateMatrix(); li.setMatrixAt(lk, d.matrix); li.setColorAt(lk, cc.setHSL(0.27 + R()*0.07, 0.45, 0.28 + R()*0.15)); lk++; }
      // 垂れ飾りの付け根に花
      const p = pts[0], nl = 1;
      for(let i=0;i<2 && fk < NF;i++){ d.position.set(p.x + (R() - 0.5)*0.05, p.y + 0.02 + (R() - 0.5)*0.04, p.z + (R() - 0.5)*0.05); d.lookAt(d.position.x + (p.x)*2, d.position.y + 0.5, d.position.z + p.z*2); d.rotateX(Math.PI/2); d.scale.setScalar(1.3 + R()*0.6); d.updateMatrix(); fi.setMatrixAt(fk, d.matrix); fi.setColorAt(fk, cc.set([0xff8aa8, 0xffe24a, 0xffffff][(R()*3)|0])); fk++; }
      // 垂れ飾りの一番下に電球
      addBulb(pts[5].x, pts[5].y - 0.02, pts[5].z, 1);
    }
    li.count = lk; fi.count = fk; g.add(li); g.add(fi);
  }

  /* ---- 8. 電球（LED風の光）・ほたる・風に舞う葉 ---- */
  const bulbsObj = (()=>{
    const n = bulbKind.length, geo = new T.BufferGeometry(), c = new Float32Array(n*3);
    geo.setAttribute('position', new T.Float32BufferAttribute(bulbPts, 3)); geo.setAttribute('color', new T.BufferAttribute(c, 3));
    const core = new T.Points(geo, new T.PointsMaterial({size:0.06, map:sparkTex, vertexColors:true, transparent:true, blending:T.AdditiveBlending, depthWrite:false}));
    const halo = new T.Points(geo, new T.PointsMaterial({size:0.2, map:sparkTex, vertexColors:true, transparent:true, opacity:0.4, blending:T.AdditiveBlending, depthWrite:false}));
    core.frustumCulled = halo.frustumCulled = false; g.add(halo); g.add(core); disposables.push(core.material, halo.material, geo);
    const PAL = [new T.Color(0xffd27a), new T.Color(0xfff2d0), new T.Color(0xffb04a), new T.Color(0xffe9a8)], WARM = new T.Color(0xffc870);
    const tmp = new T.Color();
    return {core, halo, update(t, k, on){
      for(let i=0;i<n;i++){
        const x = bulbPts[i*3], y = bulbPts[i*3+1], z = bulbPts[i*3+2], kind = bulbKind[i];
        const wave = 0.5 + 0.5*Math.sin(z*2.2 - t*2.4 + kind);
        tmp.copy(kind === 2 || kind === 4 ? WARM : PAL[(i + kind) % PAL.length]);
        let b = (kind === 3 ? 0.55 + 0.45*Math.sin(t*3 + i*1.7) : 0.75 + 0.35*wave) * on;
        if(kind === 3) b *= 0.55 + k*0.6;
        if(kind === 2 || kind === 4) b = (1.05 + 0.15*Math.sin(t*3 + i*0.7))*(0.85 + k*0.35)*on;   // 橋の手すりと足元：いつも温かく明るい
        if(kind === 0 || kind === 1) b *= 0.78;                                                    // 車体の電球は少し控えめに（視線を橋へ）
        if(((i*13 + Math.floor(t*6)) % 37) === 0) b *= 1.7;
        c[i*3] = tmp.r*b; c[i*3+1] = tmp.g*b; c[i*3+2] = tmp.b*b;
      }
      geo.attributes.color.needsUpdate = true;
    }};
  })();
  const flies = (()=>{
    const n = Q ? 46 : 24, geo = new T.BufferGeometry(), p = new Float32Array(n*3), c = new Float32Array(n*3), seed = [], R = rng(81);
    for(let i=0;i<n;i++) seed.push({x:(R()*2 - 1)*HW*0.9, z:(R()*2 - 1)*HL*0.9, y:0.15 + R()*0.7, ph:R()*10, sp:0.3 + R()*0.6});
    geo.setAttribute('position', new T.BufferAttribute(p, 3)); geo.setAttribute('color', new T.BufferAttribute(c, 3));
    const pts = new T.Points(geo, new T.PointsMaterial({size:0.07, map:sparkTex, vertexColors:true, transparent:true, blending:T.AdditiveBlending, depthWrite:false}));
    pts.frustumCulled = false; g.add(pts); disposables.push(pts.material, geo);
    return {update(t, k){ for(let i=0;i<n;i++){ const s = seed[i], a = t*s.sp + s.ph;
      p[i*3] = s.x + Math.sin(a)*0.12; p[i*3+1] = YD + s.y + Math.sin(a*1.7)*0.08 + k*0.25*Math.sin(a*0.3 + i); p[i*3+2] = s.z + Math.cos(a*0.8)*0.12;
      const b = Math.max(0, Math.sin(t*2.2 + s.ph*3))*(0.35 + k*0.9); c[i*3] = 0.9*b; c[i*3+1] = 1.0*b; c[i*3+2] = 0.45*b; }
      geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true; }};
  })();
  const blown = (()=>{   // 風に舞う葉（演出Aの突風）
    const n = Q ? 26 : 14, R = rng(91), list = [], lg = leafGeo(), lm = mk({color:0x6aaa4a, roughness:0.7, side:T.DoubleSide, envMapIntensity:0});
    for(let i=0;i<n;i++){ const m = new T.Mesh(lg, lm); m.scale.setScalar(1.6); m.visible = false; g.add(m); list.push({m, ph:R(), y:0.2 + R()*0.9, x:(R()*2 - 1)*HW, sp:0.6 + R()*0.6}); }
    return {update(t, w){ list.forEach(o=>{ o.m.visible = w > 0.15; if(!o.m.visible) return;
      const u = ((t*o.sp*0.35 + o.ph) % 1); o.m.position.set(o.x + Math.sin(t*2 + o.ph*9)*0.1, YD + o.y + Math.sin(u*9)*0.12, HL*1.3 - u*LEN*1.6);
      o.m.rotation.set(t*3 + o.ph*7, t*2.3, t*1.7); o.m.material.opacity = 1; }); }};
  })();

  /* ---- 9. 照明（夜）：ランタンの温かい光を2つだけ。軽量モードでは使わない ---- */
  const lights = [];
  if(Q){
    // 橋の上（観客側の少し上）から手すり・ロープ・足元を照らす光と、住人を照らす光
    const l1 = new T.PointLight(0xffb868, 1.5, 3.4, 2); l1.position.set(BX + 0.75, YD + 1.15, BC); g.add(l1); lights.push({l:l1, base:1.5});
    const l2 = new T.PointLight(0xffc878, 1.1, 3.2, 2); l2.position.set(1.0, YD + 1.25, -1.45); g.add(l2); lights.push({l:l2, base:1.1});
  }

  /* ---- 10. 住人：公式画像をそのまま使う平面キャラクター ----
     ・絵はいつも観客（カメラ）の方を向く。裏側は見せない。
     ・物語の中で「ふり向く」ときも左右反転しない。気持ちは、位置・かたむき・はずみ・ふるえ・記号（汗や！）・照明で見せる。
     ・左右反転は、カメラがフロートの反対側へ回ったときだけ（向きの意味を保つため）。そのときも板を細くせず、絵を重ねて入れ替える。
     台本（direct）が決めるのは：pos（立つ場所）・lz（+z＝橋の方へのかたむき）・nod（うなずき）・squash（つぶれ／ふるえ）・
     bob（はずみ）・sway（風）・emo（記号）・tint（色味）。 */
  const chars = {};
  const EMO = {};
  // 記号（漫符）の絵：線と形だけで描く
  (()=>{
    const mk = (draw)=>{ const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.lineCap = x.lineJoin = 'round'; draw(x); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; disposables.push(t); return t; };
    const outline = (x, path, fill, stroke)=>{ x.fillStyle = fill; x.strokeStyle = stroke || '#ffffff'; x.lineWidth = 9; path(); x.stroke(); path(); x.fill(); };
    EMO.sweat = mk(x=>{ [[44, 30, 1], [86, 58, 0.7]].forEach(([cx, cy, s])=>outline(x, ()=>{ x.beginPath(); x.moveTo(cx, cy - 26*s); x.bezierCurveTo(cx + 22*s, cy + 4*s, cx + 18*s, cy + 30*s, cx, cy + 30*s); x.bezierCurveTo(cx - 18*s, cy + 30*s, cx - 22*s, cy + 4*s, cx, cy - 26*s); }, '#7fc8ff')); });
    EMO.shiver = mk(x=>{ x.strokeStyle = '#ffffff'; x.lineWidth = 12; [[30, 1], [64, 0.8], [98, 1]].forEach(([cx, s])=>{ x.beginPath(); x.moveTo(cx - 8, 40); x.lineTo(cx + 8, 56); x.lineTo(cx - 8, 72); x.lineTo(cx + 8, 88); x.stroke(); }); x.strokeStyle = '#4a7bd0'; x.lineWidth = 5; [[30, 1], [64, 0.8], [98, 1]].forEach(([cx])=>{ x.beginPath(); x.moveTo(cx - 8, 40); x.lineTo(cx + 8, 56); x.lineTo(cx - 8, 72); x.lineTo(cx + 8, 88); x.stroke(); }); });
    EMO.bang = mk(x=>{ x.save(); x.translate(64, 64); x.fillStyle = '#fff6c8'; x.beginPath(); for(let i=0;i<16;i++){ const r = i % 2 ? 34 : 58, a = i/16*Math.PI*2; x.lineTo(Math.cos(a)*r, Math.sin(a)*r); } x.closePath(); x.fill(); x.strokeStyle = '#ffb02e'; x.lineWidth = 5; x.stroke();
      x.fillStyle = '#e8541e'; x.beginPath(); x.roundRect ? x.roundRect(-8, -34, 16, 42, 7) : x.rect(-8, -34, 16, 42); x.fill(); x.beginPath(); x.arc(0, 22, 9, 0, Math.PI*2); x.fill(); x.restore(); });
    EMO.dots = mk(x=>{ x.fillStyle = 'rgba(255,255,255,0.92)'; x.beginPath(); x.ellipse(64, 64, 58, 36, 0, 0, Math.PI*2); x.fill(); x.beginPath(); x.moveTo(40, 92); x.lineTo(30, 116); x.lineTo(58, 98); x.fill(); x.fillStyle = '#5a5f78'; [40, 64, 88].forEach(cx=>{ x.beginPath(); x.arc(cx, 64, 7, 0, Math.PI*2); x.fill(); }); });
    EMO.heart = mk(x=>outline(x, ()=>{ x.beginPath(); x.moveTo(64, 104); x.bezierCurveTo(10, 66, 22, 18, 64, 42); x.bezierCurveTo(106, 18, 118, 66, 64, 104); }, '#ff7a9c'));
    EMO.note = mk(x=>{ const d = (col, w)=>{ x.strokeStyle = col; x.fillStyle = col; x.lineWidth = w; x.beginPath(); x.ellipse(42, 92, 17, 13, -0.4, 0, Math.PI*2); x.fill(); x.stroke(); x.beginPath(); x.ellipse(92, 80, 17, 13, -0.4, 0, Math.PI*2); x.fill(); x.stroke();
      x.lineWidth = w*0.6 + 4; x.beginPath(); x.moveTo(56, 88); x.lineTo(56, 26); x.lineTo(106, 14); x.lineTo(106, 76); x.stroke(); }; d('#ffffff', 10); d('#ffb02e', 3); });
    EMO.spark = mk(x=>{ const star = (cx, cy, r, col)=>{ x.fillStyle = col; x.beginPath(); for(let i=0;i<8;i++){ const rr = i % 2 ? r*0.3 : r, a = i/8*Math.PI*2 - Math.PI/2; x.lineTo(cx + Math.cos(a)*rr, cy + Math.sin(a)*rr); } x.closePath(); x.fill(); };
      star(56, 60, 46, '#ffffff'); star(56, 60, 38, '#ffd94a'); star(100, 26, 20, '#ffffff'); star(100, 26, 15, '#ffd94a'); star(104, 100, 14, '#ffffff'); star(104, 100, 10, '#ffd94a'); });
  })();
  const mkChar = (key, h, a, o)=>{
    const loader = new T.TextureLoader(), t = loader.load(base + (o.src || ('characters2/' + key + '.png'))); t.encoding = T.sRGBEncoding; t.anisotropy = 4; disposables.push(t);
    const SX = 6, SY = 12, geo = new T.PlaneGeometry(h*a, h, SX, SY); geo.translate(0, h/2, 0);
    // 2枚の板：ふだんの絵（mesh）と左右反転した絵（meshM）。反転が必要なときだけ、重ねて入れ替える（板を細くして裏返す見え方にしない）
    const mat = new T.MeshBasicMaterial({map:t, transparent:true, alphaTest:0.05, side:T.FrontSide, color:0xffffff, depthWrite:true}); disposables.push(mat, geo);
    const matM = mat.clone(); matM.opacity = 0; disposables.push(matM);
    const mesh = new T.Mesh(geo, mat), meshM = new T.Mesh(geo, matM); mesh.renderOrder = 5; meshM.renderOrder = 6; meshM.scale.x = -1; meshM.visible = false;
    const holder = new T.Group(); holder.userData.dynamic = true; holder.add(mesh, meshM); g.add(holder);
    const sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({map:shadowTex, transparent:true, depthWrite:false})); sh.rotation.x = -Math.PI/2; sh.scale.set(h*a*0.75, h*0.32, 1); holder.add(sh); disposables.push(sh.material);
    const rim = new T.Sprite(new T.SpriteMaterial({map:glowTexture, blending:T.AdditiveBlending, depthWrite:false, transparent:true, opacity:0.35})); rim.scale.set(h*1.3, h*1.3, 1); rim.position.y = h*0.5; holder.add(rim); disposables.push(rim.material);
    // 記号（汗・ふるえ・！・…・ハート・音符・きらきら）
    const emo = new T.Sprite(new T.SpriteMaterial({map:EMO.spark, transparent:true, depthWrite:false, depthTest:true, opacity:0})); emo.renderOrder = 9; emo.visible = false; holder.add(emo); disposables.push(emo.material);
    const basePos = Float32Array.from(geo.attributes.position.array);
    const C = {key, h, a, mesh, meshM, holder, geo, basePos, sh, rim, emo, pos:V3(0, 0, 0), side:1, mir:0, lz:0, nod:0, squash:0, bob:0, sway:0,
               emoKind:null, emoK:0, emoT:0, emoSide:1, tint:[1, 1, 1], glow:0, artFacesLeft:!!o.artFacesLeft};
    chars[key] = C; return C;
  };
  // 絵の向き：ハルの絵は左向き、モックは正面。ハルは観客側から見て「橋（+z）の方」を向く絵になる
  const mock = mkChar('mock', 1.6, 270/382, {});
  // ハルは、羽の先まで描かれた公式三面図の斜め向き（左向き）を使う（characters2/hal.png は羽の先が画像の端で切れているため）
  const hal = mkChar('hal', 1.2, 385/409, {artFacesLeft:true, src:'parade-lab/assets/hal_full.png'});

  /* ---- 演出の台本：A ためらい → B 気づき → C 一緒にいる（24秒でくり返す）
     二人とも最初から最後まで、橋の手前の同じ岸にいる。橋を渡らせる場面は作らない。
     気持ちは「動き（位置・距離・かたむき・はずみ・ふるえ）」と「舞台（橋の揺れ・風）」と「照明」で見せる。記号は小さく、短く、補助として使う。 ---- */
  const LOOP = 24;
  const P = {
    halA:V3(BX + 0.2, 0, BZ0 - 0.14), halStep:V3(BX + 0.16, 0, BZ0 + 0.06),        // 橋のたもと → 片足を橋へ
    // 二人は観客から見てほぼ同じ奥行き（x）に立ち、左右（z）の距離で気持ちの近さを見せる（反対側から見ても重なりにくい）
    halBack:V3(BX + 0.3, 0, BZ0 - 0.46),                                          // 橋が大きく揺れて、二歩とびのく（片足の位置から約0.5m）
    halNear:V3(BX + 0.3, 0, BZ0 - 0.5),                                           // B：最後に、モックの方へ自分から寄る
    // モックは初め離れて立ち（二人の間 約1.1m）、Bで二段階に近づく（約0.8m → 約0.6m）。最後は寄りそう距離
    mockA:V3(BX - 0.04, 0, BZ0 - 1.44), mockB1:V3(BX + 0.14, 0, BZ0 - 1.2), mockB2:V3(BX + 0.22, 0, BZ0 - 1.12),
    halC:V3(0.8, 0, -1.02), mockC:V3(0.74, 0, -1.86)   // 橋のたもとの、観客に近い川辺。橋のまん中は隠さない
  };
  const ease = t=>t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2;
  const seg = (t, a, b)=>ease(clamp((t - a)/(b - a), 0, 1));
  const win = (t, a, b, f)=>clamp(Math.min((t - a)/f, (b - t)/f), 0, 1);           // a〜b の間だけ 1（前後 f 秒で出入り）
  const pulse = (t, a, b)=>seg(t, a, (a + b)/2) - seg(t, (a + b)/2, b);              // a〜b で 0→1→0
  const story = {phase:'A', wind:0, glow:0.4, bloom:0, fear:0, notice:0, shake:0, pair:0, pairPos:V3(0, 0, 0)};
  function emote(C, kind, k, side){ if(k > 0.001){ C.emoKind = kind; C.emoK = Math.max(C.emoK, k); if(side) C.emoSide = side; } }
  function direct(time, forced){
    let t = time % LOOP; if(forced === 'A') t = 1.0 + (time % 7); else if(forced === 'B') t = 8 + (time % 6); else if(forced === 'C') t = 14 + (time % 7);
    story.phase = t < 8 ? 'A' : t < 14 ? 'B' : t < 21 ? 'C' : 'R';
    [hal, mock].forEach(C=>{ C.emoK = 0; C.emoKind = null; C.lz = 0; C.bob = 0; C.squash = 0; C.nod = 0; C.glow = 0; });
    // 風：Aで強まり、Bで弱まり、Cでおさまる。橋の大揺れ（shake）は、ハルが片足をのせた瞬間の突風
    story.wind = sstep(0.8, 2.6, t)*(1 - sstep(8.5, 12.5, t)) * (0.75 + 0.25*Math.sin(t*2.3));
    story.shake = sstep(3.7, 4.0, t)*(1 - sstep(5.6, 7.4, t));
    story.glow = 0.4 + 0.6*seg(t, 16.0, 18.0) - 0.6*seg(t, 21.5, 23.8);
    story.bloom = seg(t, 16.5, 19.0) - seg(t, 22.5, 23.9);
    const fear = sstep(3.8, 4.2, t)*(1 - sstep(11.6, 13.0, t));                     // こわさ：橋の光が青白く暗くなる
    story.fear = fear; story.notice = seg(t, 11.6, 12.4)*(1 - seg(t, 13.6, 14.6));  // 気づき：二人のまわりが温かくなる
    const toC = seg(t, 14.2, 16.6), back = seg(t, 21.2, 23.8);

    /* 位置 */
    const hp = P.halA.clone()
      .lerp(P.halStep, seg(t, 2.6, 3.5))                                            // 勇気を出して、片足を橋へ
      .lerp(P.halA, seg(t, 4.0, 4.35))                                              // 橋が揺れて、とびのく（一歩目）
      .lerp(P.halBack, seg(t, 4.7, 5.15))                                           // 二歩目
      .lerp(P.halNear, seg(t, 12.0, 12.7));                                         // B：モックの方へ自分から寄る
    hp.lerp(P.halC, toC); hp.lerp(P.halA, back);
    const mp = P.mockA.clone().lerp(P.mockB1, seg(t, 8.4, 9.4)).lerp(P.mockB2, seg(t, 10.6, 11.6));   // B：二段階で、ゆっくりハルに近づく
    mp.lerp(P.mockC, toC); mp.lerp(P.mockA, back);
    hal.pos.copy(hp); mock.pos.copy(mp);

    /* A ためらい（0〜8秒）：橋の揺れと、ハルのあとずさりが主役 */
    // モック：「行こう」と橋の方へ身を乗り出し、2回はずむ
    const urge = seg(t, 1.2, 2.0)*(1 - seg(t, 3.9, 4.6));
    mock.lz += urge*0.15; mock.bob += (t > 1.6 && t < 3.2) ? Math.abs(Math.sin((t - 1.6)*Math.PI/0.8))*0.05 : 0;
    mock.lz -= pulse(t, 3.9, 4.8)*0.06;                                              // 橋が揺れて、モックも思わず身を引く
    // ハル：橋をじっと見る → そっと片足 → 突風で橋が大きく揺れる → 二歩とびのき、身をすくめてふるえる
    hal.lz += seg(t, 1.6, 2.6)*0.12*(1 - seg(t, 3.9, 4.1));                          // のぞき込む
    hal.lz += seg(t, 2.6, 3.5)*0.08*(1 - seg(t, 3.9, 4.1));                          // 片足をのせて、前のめり
    hal.bob += pulse(t, 4.0, 4.4)*0.2 + pulse(t, 4.7, 5.15)*0.12;                    // 大きく一回、小さく一回とびのく
    hal.lz -= seg(t, 3.95, 4.15)*0.26*(1 - seg(t, 5.4, 6.6)*0.6);                    // 体ごと橋からのけぞる
    hal.squash += fear*(0.04*Math.sin(t*40)*(1 - sstep(7.0, 9.0, t)*0.6) + 0.07*(1 - seg(t, 12.4, 13.2)));   // 小さく丸まって、ふるえる
    emote(hal, 'sweat', win(t, 4.3, 6.2, 0.25)*0.85, -1);

    /* B 気づき（8〜14秒）：二人の距離が縮まっていく */
    // モックは橋から目を離し、ハルの方へ体を向けて（かたむき）、二段階でゆっくり近づく
    mock.lz += seg(t, 8.0, 8.6)*0.08*(1 - toC);                                     // ハルのいる側（+z）へ体を向ける
    // 立ち止まって、ハルの様子を見る（1回目の接近のあと）→ もう一歩
    // ハル：最初は丸まったまま。モックが近づくと、少しずつ体を起こし、モックの方へかたむく
    hal.lz -= seg(t, 9.4, 10.4)*0.1*(1 - toC);                                      // モックの方（-z）へ、そっと体を向ける
    hal.squash -= seg(t, 9.6, 10.6)*0.025*(1 - toC);
    // モックがすぐそばで、ゆっくり身をかがめて（うなずき）「こわかったね」
    const nodT = t - 11.8; mock.nod = (nodT > 0 && nodT < 1.8) ? Math.max(0, Math.sin(nodT*Math.PI*2/0.9))*0.85 : 0;
    mock.squash += win(t, 11.7, 13.4, 0.4)*0.04;                                     // 目線を合わせるように、少し低く
    emote(mock, 'bang', win(t, 11.55, 12.05, 0.1)*0.7, 1);                           // 気づきの「！」は小さく一瞬だけ
    // ハル：自分からモックへ寄り、うれしくて小さく2回はねる。背がのびる
    hal.lz -= seg(t, 12.0, 12.6)*0.06*(1 - toC);
    hal.bob += (t > 12.7 && t < 13.7) ? Math.abs(Math.sin((t - 12.7)*Math.PI/0.5))*0.06 : 0;
    hal.squash -= seg(t, 12.7, 13.2)*0.03*(1 - toC);
    mock.glow = story.notice*0.7; hal.glow = story.notice*0.5;

    /* C 一緒にいる（14〜21秒）：川辺に並び、観客の方を向いたまま、息を合わせてはずむ */
    const walking = (t > 14.2 && t < 16.6) || (t > 21.2 && t < 23.8);
    const wk = walking ? Math.abs(Math.sin(t*9)) : 0;
    hal.bob += wk*0.05; mock.bob += wk*0.04 + ((t > 8.4 && t < 9.4) || (t > 10.6 && t < 11.6) ? Math.abs(Math.sin(t*7))*0.03 : 0);
    const joy = sstep(17.4, 18.0, t)*(1 - sstep(20.6, 21.2, t));
    const jb = joy*Math.abs(Math.sin((t - 17.4)*Math.PI/0.55));
    hal.bob += jb*0.09; mock.bob += jb*0.06; hal.squash += joy*0.035*Math.cos((t - 17.4)*Math.PI/0.55*2);
    const close = toC*(1 - back);
    hal.lz -= close*0.07; mock.lz += close*0.09;                                     // 二人とも相手の方へ寄りかかる
    emote(hal, 'heart', win(t, 18.2, 19.8, 0.3)*0.75, 1);
    hal.glow = Math.max(hal.glow, joy*0.6); mock.glow = Math.max(mock.glow, joy*0.6);
    // 二人の足もとの温かい光：距離が縮まるほど大きく明るく（B〜C）
    const gap = Math.hypot(hal.pos.x - mock.pos.x, hal.pos.z - mock.pos.z);
    story.pair = clamp((1.1 - gap)/0.7, 0, 1)*Math.max(story.notice, close)*(1 - back*0.8);
    story.pairPos.set((hal.pos.x + mock.pos.x)/2, 0, (hal.pos.z + mock.pos.z)/2);
    // 色味：こわい場面のハルは少し青白く、Cでは二人とも温かく
    const warm = joy*0.06 + story.notice*0.05;
    hal.tint = [1 - fear*0.12 + warm, 1 - fear*0.05 + warm*0.6, 1 + fear*0.02];
    mock.tint = [1 + warm, 1 + warm*0.7, 1 - story.notice*0.03];
    // 待機中の呼吸と、木の体のモックが風にそよぐ動き
    hal.squash += Math.sin(time*2.3)*0.012; mock.squash += Math.sin(time*1.9 + 1)*0.01;
    mock.sway = Math.sin(time*2.6)*story.wind*0.05 + Math.sin(time*1.1)*0.01 + story.shake*Math.sin(time*7)*0.03;
    hal.sway = 0;
    [hal, mock].forEach(C=>{ C.emoT = t; });
    return t;
  }

  const camLocal = V3(0, 0, 0), wv = V3(0, 0, 0), _inv = new T.Matrix4();
  function poseChar(C, cam, dt){
    const y = surfaceY(C.pos.x, C.pos.z) + 0.005;
    C.holder.position.set(C.pos.x, y, C.pos.z);
    // 板をカメラの方へ向ける（縦軸だけ回す）。板の +x が画面の右になる
    let rx = 1, rz = 0;
    if(cam){
      g.updateMatrixWorld(); _inv.copy(g.matrixWorld).invert();
      cam.getWorldPosition(wv); camLocal.copy(wv).applyMatrix4(_inv);
      const dx = camLocal.x - C.pos.x, dz = camLocal.z - C.pos.z, L = Math.hypot(dx, dz) || 1;
      const ry = Math.atan2(dx, dz); C.mesh.rotation.y = C.meshM.rotation.y = ry;
      rx = dz/L; rz = -dx/L;                                                     // 画面の右向き（フロートの座標）
      // 観客がどちら側にいるか：+1 なら、橋（+z）が画面の左に見える。境目で行ったり来たりしないよう余裕を持たせる
      const s = -rz;                                                             // 画面の右が -z なら +1
      if(s > 0.25) C.side = 1; else if(s < -0.25) C.side = -1;
    }
    // ハルだけ：反対側から見たときは左右反転して、橋の方を向いたままにする。入れ替えは 0.3 秒の重ね合わせ
    const want = C.artFacesLeft && C.side < 0 ? 1 : 0;
    C.mir += clamp(want - C.mir, -dt/0.3, dt/0.3);
    const m = C.mir;
    C.mesh.material.opacity = clamp(1 - m, 0, 1); C.meshM.material.opacity = clamp(m, 0, 1);
    C.mesh.visible = m < 0.999; C.meshM.visible = m > 0.001;
    C.meshM.position.set(rz*0.0, 0, 0);
    // 変形：+z 方向へのかたむき lz を、画面の左右に直す（+z が画面の左なら、左へかたむく）
    const zScreen = -C.side;                                                     // +z は画面の左(-1)／右(+1)
    const p = C.geo.attributes.position, b = C.basePos, h = C.h, w = C.h*C.a, sq = 1 + C.squash;
    // 反転して見せている板は x が逆になるので、かたむきの向きも逆にする（重ね合わせ中は、多く見えている方に合わせる）
    const flip = m > 0.5 ? -1 : 1;
    const leanX = C.lz*zScreen*flip, swayX = (C.sway || 0)*(-zScreen)*flip;     // sway は風（-z へ）
    for(let i=0;i<p.count;i++){
      const x0 = b[i*3], y0 = b[i*3+1], v = y0/h;
      let x = x0 + x0*(sq - 1)*0.6, yy = y0/sq;
      x += (leanX + swayX)*h*v*v;
      if(C.nod > 0 && v > 0.45){ const k = (v - 0.45)/0.55; yy -= C.nod*k*k*h*0.07; x += Math.sign(leanX || 1)*C.nod*k*k*h*0.03; }
      p.setXY(i, x, yy);
    }
    p.needsUpdate = true;
    C.mesh.position.y = C.meshM.position.y = C.bob*h;
    const sk = 1 - C.bob*1.5; C.sh.scale.set(w*0.8*sk, h*0.3*sk, 1);
    // 記号：頭の上、絵の前の側（ハル）／体を寄せる側（モック）。ぽんと出て、ゆれながら消える
    const e = C.emo;
    if(C.emoKind && C.emoK > 0.01){
      if(e.material.map !== EMO[C.emoKind]){ e.material.map = EMO[C.emoKind]; e.material.needsUpdate = true; }
      const k = C.emoK, pop = 1 + 0.25*Math.max(0, 1 - k*3)*0 + 0.12*Math.sin(Math.min(1, k)*Math.PI);
      // 画面の左右のどちら寄りに出すか：emoSide=-1 は絵の前の側、+1 は相手（もう一人）の側
      const toOther = (C.artFacesLeft ? -1 : 1)*zScreen;                       // ハルから見てモックは -z、モックから見てハルは +z
      const sideScreen = C.artFacesLeft ? (C.emoSide < 0 ? (m > 0.5 ? 1 : -1) : toOther)*0.55 : toOther*0.45;
      const lift = C.emoKind === 'note' || C.emoKind === 'heart' ? (C.emoT*0.35 % 1)*0.12 : 0;
      const shake = C.emoKind === 'shiver' ? Math.sin(C.emoT*40)*0.01 : 0;
      const sz = h*(C.emoKind === 'bang' ? 0.22 : 0.17)*pop*(0.6 + 0.4*k);   // 記号は補助：小さめ
      e.position.set((rx*sideScreen*w*0.62) + rx*shake, h*(1.0 + lift) + C.bob*h, (rz*sideScreen*w*0.62) + rz*shake);
      e.scale.set(sz, sz, 1); e.material.opacity = Math.min(0.9, k); e.visible = true;
    } else { e.visible = false; }
  }

  /* ---- まとめ：動かない部品を1つにまとめる ---- */
  bakeStatic(g);

  /* ---- 毎フレームの更新（既存のパレードと同じ呼び方：update(t, dt, cheer)） ---- */
  let night = 1, forced = null;
  const self = {
    g, wheels:[], pts:[], people:[], len:LEN, noLightUp:true, story,
    // 見せたい範囲（フロートの座標）：橋と二人の場面／二人のまわり。試作ページのカメラ合わせに使う
    focus:{bridge:new T.Box3(V3(BX - 0.55, YD - 0.05, BZ0 - 1.8), V3(BX + 0.95, YD + 1.75, BZ1 + 0.1)), stage:new T.Box3(V3(-0.2, YD, -2.7), V3(1.1, YD + 1.8, 0.2))},
    loop:LOOP,
    setCamera(c){ opts.camera = c; },
    setNight(on){ night = on ? 1 : 0; water.uni.uNight.value = night; },
    setScene(s){ forced = s || null; },
    update(t, dt, cheer){
      dt = dt || 0.016;
      const tt = direct(t, forced);
      const w = story.wind, k = story.glow, cam = opts.camera || global.camera;
      // 橋：風で左右にゆれ、板が波打つ
      // 橋：いつもわずかに、風が吹くと目に見えて揺れる（危険に見えるほどは揺らさない）
      const sk = story.shake;
      bridge.rotation.z = Math.sin(t*1.9)*0.005 + Math.sin(t*3.1)*w*0.02 + Math.sin(t*6.3)*sk*0.035;   // 突風：橋が大きく左右に揺れる（こわさ）。壊れそうには見せない
      bridge.rotation.x = Math.sin(t*1.3)*w*0.004 + Math.sin(t*4.7)*sk*0.008;
      plankU.uTime.value = t; plankU.uWind.value = 0.15 + w + sk*1.4;
      ropes.forEach(r=>{ r.rg.quaternion.setFromAxisAngle(r.axis, Math.sin(t*2.6 + r.ph)*(0.08 + w*0.42) + Math.sin(t*5.2 + r.ph)*sk*0.5); });
      bridgePool.material.opacity = (0.28 + k*0.3)*(night ? 1 : 0)*(1 - story.fear*0.5);
      pairPool.position.set(story.pairPos.x, surfaceY(story.pairPos.x, story.pairPos.z) + 0.012, story.pairPos.z); pairPool.material.opacity = story.pair*(night ? 0.55 : 0.25); pairPool.scale.set(0.9 + story.pair*0.6, 1.2 + story.pair*0.9, 1);
      // 木：茂みがゆれる
      canopies.forEach(c=>{ c.cg.rotation.z = Math.sin(t*1.1 + c.ph)*0.015 + Math.sin(t*2.6 + c.ph)*w*0.05; c.cg.rotation.x = Math.sin(t*0.9 + c.ph)*0.01 + w*0.03; });
      treeLans.forEach((L, i)=>{ L.rotation.z = Math.sin(t*1.7 + i)*0.05 + Math.sin(t*3.1 + i)*w*0.18; });
      // ランタン：Cで温かく輝く
      const flick = 0.92 + 0.08*Math.sin(t*13) * Math.sin(t*7.3);
      glassMats.forEach(m=>{ m.emissiveIntensity = (0.5 + k*1.9)*flick*(night ? 1 : 0.35); });
      glows.forEach(o=>{ const s = o.base*(0.55 + k*0.75*o.k)*(night ? 1 : 0.4); o.s.scale.set(s, s, 1); o.s.material.opacity = night ? 0.9 : 0.4; });
      const fe = story.fear, no = story.notice, shk = story.shake*(0.5 + 0.5*Math.sin(t*23)*Math.sin(t*9));
      lights.forEach((o, i)=>{ o.l.intensity = o.base*(0.35 + k*1.1)*flick*(night ? 1 : 0.2)*(1 - fe*0.45*(i === 0 ? 1 : 0.5) - shk*0.35*(i === 0 ? 1 : 0) + no*0.9*(i === 1 ? 1 : 0));
        if(i === 0) o.l.color.setRGB(1 - fe*0.4, 0.72 + fe*0.08, 0.41 + fe*0.5); else o.l.color.setRGB(1, 0.78 + no*0.1, 0.47 - no*0.05); });
      water.uni.uTime.value = t; water.uni.uGlow.value = k;
      // 向こう岸の花がひらく
      if(bloom.length){
        const d = new T.Object3D(), b = 0.35 + 0.65*story.bloom;
        bloom.forEach((o, i)=>{ const s = o.s*(b + 0.08*Math.sin(t*2 + i)); d.position.set(o.x, o.y, o.z); d.rotation.set(0, i, 0); d.scale.setScalar(s); d.updateMatrix(); bloom.inst.setMatrixAt(o.k, d.matrix); });
        bloom.inst.instanceMatrix.needsUpdate = true;
        M.flower.emissive.setRGB(0.12*story.bloom*night, 0.08*story.bloom*night, 0.03*story.bloom*night);
      }
      bulbsObj.update(t, k, night ? 1 : 0.25);
      flies.update(t, night ? k : 0);
      blown.update(t, w);
      // 住人
      poseChar(hal, cam, dt); poseChar(mock, cam, dt);
      const tint = night ? 0.8 + k*0.18 : 1;
      [hal, mock].forEach(C=>{ const c = C.tint; [C.mesh, C.meshM].forEach(ms=>ms.material.color.setRGB(Math.min(1.15, tint*c[0]), Math.min(1.15, tint*0.97*c[1]), Math.min(1.15, tint*0.92*c[2])));
        C.rim.material.opacity = night ? 0.18 + k*0.3 + C.glow*0.45 : C.glow*0.25; C.rim.material.color.setRGB(1, 0.92 + 0.08*(1 - C.glow), 0.8 + 0.2*(1 - C.glow)); });
      if(cheer > 0){ hal.mesh.position.y += Math.sin(cheer*Math.PI)*0.15; mock.mesh.position.y += Math.sin(cheer*Math.PI)*0.12; }
      return tt;
    },
    dispose(){ g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); disposables.forEach(d=>d.dispose && d.dispose()); }
  };
  self.setNight(opts.night !== false);
  return self;
}

/* ---- 小物の形 ---- */
function V3(x, y, z){ return new T.Vector3(x || 0, y || 0, z || 0); }
let _flowerGeo = null, _leafGeo = null, _cardGeo = null;
function CARD_GEO(){ return _cardGeo || (_cardGeo = new T.PlaneGeometry(1, 1)); }
function flowerGeo(){
  if(_flowerGeo) return _flowerGeo;
  const parts = [], s = new T.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.012, 0.01, 0.014, 0.03, 0, 0.038); s.bezierCurveTo(-0.014, 0.03, -0.012, 0.01, 0, 0);
  for(let k=0;k<5;k++){ const pg = new T.ShapeGeometry(s, 4); pg.rotateX(-Math.PI/2 + 0.35); pg.rotateY(k/5*Math.PI*2); parts.push(pg.toNonIndexed()); }
  const c = new T.SphereGeometry(0.009, 5, 3).toNonIndexed(); c.translate(0, 0.006, 0);
  let n = 0; parts.forEach(p=>n += p.attributes.position.count); n += c.attributes.position.count;
  const P = new Float32Array(n*3), C = new Float32Array(n*3), Nn = new Float32Array(n*3); let o = 0;
  const put = (g, r, gg, b)=>{ g.computeVertexNormals(); const cnt = g.attributes.position.count; P.set(g.attributes.position.array, o*3); Nn.set(g.attributes.normal.array, o*3); for(let i=0;i<cnt;i++){ C[(o+i)*3] = r; C[(o+i)*3+1] = gg; C[(o+i)*3+2] = b; } o += cnt; };
  parts.forEach(p=>put(p, 1, 1, 1)); put(c, 1.0, 0.82, 0.25);
  const G = new T.BufferGeometry(); G.setAttribute('position', new T.BufferAttribute(P, 3)); G.setAttribute('normal', new T.BufferAttribute(Nn, 3)); G.setAttribute('color', new T.BufferAttribute(C, 3));
  _flowerGeo = G; return G;
}
function leafGeo(){
  if(_leafGeo) return _leafGeo;
  const s = new T.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.018, 0.012, 0.016, 0.04, 0, 0.055); s.bezierCurveTo(-0.016, 0.04, -0.018, 0.012, 0, 0);
  _leafGeo = new T.ShapeGeometry(s, 4); return _leafGeo;
}
function lanternMesh(M, glassMat, s){
  const L = new T.Group(); L.scale.setScalar(s);
  const add = (geo, m, p, r)=>{ const o = new T.Mesh(geo, m); o.position.set(p[0], p[1], p[2]); if(r) o.rotation.set(r[0], r[1], r[2]); L.add(o); return o; };
  add(new T.CylinderGeometry(0.045, 0.05, 0.13, 12), glassMat, [0, 0, 0]);
  add(new T.ConeGeometry(0.07, 0.06, 12), M.brass, [0, 0.095, 0]);
  add(new T.CylinderGeometry(0.06, 0.06, 0.012, 12), M.brass, [0, 0.068, 0]);
  add(new T.CylinderGeometry(0.055, 0.045, 0.02, 12), M.brass, [0, -0.072, 0]);
  add(new T.TorusGeometry(0.02, 0.005, 6, 12), M.brass, [0, 0.14, 0]);
  for(let k=0;k<4;k++){ const a = k/4*Math.PI*2 + Math.PI/4; add(new T.BoxGeometry(0.008, 0.13, 0.008), M.brass, [Math.cos(a)*0.05, 0, Math.sin(a)*0.05]); }
  bakeStatic(L);
  L.userData.dynamic = true;
  return L;
}

global.IWForestBridge = {create:createForestBridgeFloat, LEN, WID};
})(window);
