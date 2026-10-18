/* レンガ村の物語　場所ごとの背景イラスト（SVG）
   井戸・パン屋・森・時計台・図書館・中央広場・物語の入口（meadow）を、絵本の挿し絵のように描きます。
   すべて黒い縁取り（story.css の .sbgart のきまり）。画面の下半分はセリフの枠、中央には住人が立つので、
   見せたいものは左右と奥（上半分）に置いています。 */
(function(){
  'use strict';
  const K = '#1d1414';   // 縁取りの色
  const r1 = n => Math.round(n * 10) / 10;

  /* ---------- 部品 ---------- */
  function cloud(x, y, s){ return `<g ${F} transform="translate(${x},${y}) scale(${s})"><path d="M8 22 Q-6 21 -1 10 Q3 1 14 4 Q19 -10 35 -5 Q48 -15 61 -3 Q77 -5 78 9 Q87 20 73 24 Q65 31 53 26 Q41 33 29 27 Q18 32 8 22 Z" fill="#fff"/></g>`; }
  function house(x, y, w, h, roof, wall, opt){
    opt = opt || {};
    const rh = h * 0.7, door = opt.door !== false;
    return `<g ${F} transform="translate(${x},${y})">
      <rect x="0" y="0" width="${w}" height="${h}" fill="${wall}"/><rect class="ns" x="${w*0.72}" y="0" width="${w*0.28}" height="${h}" fill="rgba(60,20,40,.12)"/>
      <path d="M${-w*0.12} 2 L${w/2} ${-rh} L${w*1.12} 2 Z" fill="${roof}"/>
      ${opt.chimney ? `<rect x="${w*0.68}" y="${-rh*0.9}" width="${w*0.13}" height="${rh*0.6}" fill="#b5654a"/>` : ''}
      <rect x="${w*0.14}" y="${h*0.18}" width="${w*0.24}" height="${h*0.26}" fill="#ffe08a"/><path d="M${w*0.26} ${h*0.18} V${h*0.44} M${w*0.14} ${h*0.31} H${w*0.38}" fill="none" stroke="${K}" stroke-width="1.2"/>
      ${door ? `<path d="M${w*0.56} ${h} V${h*0.42} Q${w*0.7} ${h*0.3} ${w*0.84} ${h*0.42} V${h} Z" fill="${opt.doorColor || '#8a5a32'}"/>` : `<rect x="${w*0.6}" y="${h*0.18}" width="${w*0.24}" height="${h*0.26}" fill="#ffe08a"/>`}
      ${opt.flowers ? `<rect x="${w*0.1}" y="${h*0.46}" width="${w*0.32}" height="${h*0.08}" fill="#a0603a"/>${[0.16,0.26,0.36].map((k, i) => `<circle cx="${w*k}" cy="${h*0.45}" r="${w*0.04}" fill="${['#ff6a8a','#ffd000','#ff8a1a'][i]}"/>`).join('')}` : ''}
    </g>`;
  }
  function tree(x, y, s, c){
    c = c || '#00a844';
    return `<g ${F} transform="translate(${x},${y}) scale(${s})"><rect x="-6" y="0" width="12" height="34" fill="#7a4a20"/>
      <circle cx="-16" cy="-6" r="20" fill="${c}"/><circle cx="16" cy="-6" r="20" fill="${c}"/><circle cx="0" cy="-24" r="24" fill="${c}"/>
      <circle class="ns" cx="-8" cy="-30" r="8" fill="rgba(255,255,255,.18)"/></g>`;
  }
  function flower(x, y, c){ return `<g transform="translate(${x},${y})"><path d="M0 0 V14" fill="none" stroke="#2f8a3e" stroke-width="2"/>${[0,72,144,216,288].map(a => `<circle cx="${r1(Math.cos(a*Math.PI/180)*4)}" cy="${r1(Math.sin(a*Math.PI/180)*4)}" r="3.4" fill="${c}"/>`).join('')}<circle cx="0" cy="0" r="2.4" fill="#ffd000"/></g>`; }
  function gear(cx, cy, r, n, fill, holeFill){
    let d = '';
    for(let i = 0; i < n * 2; i++){
      const a0 = (i / (n * 2)) * Math.PI * 2, a1 = ((i + 1) / (n * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.82 : r;
      d += (i ? 'L' : 'M') + r1(cx + Math.cos(a0) * rr) + ' ' + r1(cy + Math.sin(a0) * rr) + 'L' + r1(cx + Math.cos(a1) * rr) + ' ' + r1(cy + Math.sin(a1) * rr);
    }
    return `<path d="${d}Z" fill="${fill}"/><circle cx="${cx}" cy="${cy}" r="${r1(r*0.32)}" fill="${holeFill || '#5a4a3a'}"/>`;
  }
  function books(x, y, w, h, seed){
    let out = '', cx = x, i = seed || 0;
    const cols = ['#e2687e','#5a6ab8','#ffd000','#4f9a4a','#d9534a','#8a5ab8','#3f6fb0','#e8a070'];
    while(cx < x + w - 8){ const bw = 8 + (i * 5) % 7, bh = h * (0.72 + ((i * 13) % 5) * 0.06); if(cx + bw > x + w) break;
      out += `<rect x="${cx}" y="${r1(y + h - bh)}" width="${bw}" height="${r1(bh)}" fill="${cols[i % cols.length]}"/>`; cx += bw + 1; i++; }
    return out;
  }
  // レンガの壁（黒い目地）
  function brickPattern(id, base, light, dark){
    return `<pattern id="${id}" width="40" height="20" patternUnits="userSpaceOnUse"><rect class="ns" width="40" height="20" fill="${base}"/><rect class="ns" x="2" y="2" width="16" height="7" fill="${light}"/><rect class="ns" x="22" y="12" width="16" height="7" fill="${dark}"/>
      <path class="ns" d="M0 0H40M0 10H40M0 20H40M20 0V10M10 10V20M30 10V20" fill="none" stroke="#3a0c04" stroke-width="1.4"/></pattern>`;
  }
  const sky = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const OL = '<filter id="scOl" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="2.1" result="d"/><feFlood flood-color="#1d1414"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  const F = 'filter="url(#scOl)"';   // 外側を太い黒線で縁取る（中の線は細く）
  const wrap = (defs, body) => `<svg class="sbgart" viewBox="0 0 400 800" preserveAspectRatio="xMidYMin slice" aria-hidden="true"><defs>${OL}${defs}</defs>${body}</svg>`;

  /* ---------- 場所 ---------- */
  const ART = {
    // 物語の入口：大きな絵本の門と、その先に広がる村
    meadow(){
      return wrap(sky('scSkyM', '#5cbcfc', '#a8e0fc') + brickPattern('scBrM', '#c8501c', '#dc6a32', '#b04014'),
        `<rect class="ns" width="400" height="800" fill="url(#scSkyM)"/>
        ${cloud(30, 70, 1)}${cloud(280, 110, 0.8)}${cloud(170, 40, 0.6)}
        <path d="M-10 330 Q100 270 210 310 Q310 280 410 320 V800 H-10 Z" fill="#80e070"/>
        ${house(40, 262, 44, 36, '#e2687e', '#fff1d6', {chimney:true})}${house(110, 270, 40, 30, '#5a6ab8', '#f6ecd8')}${house(250, 266, 46, 36, '#ffb020', '#fff7ea', {chimney:true})}${house(318, 274, 40, 30, '#4f9a4a', '#fff1d6')}
        <path d="M-10 400 Q120 350 220 390 Q320 360 410 395 V800 H-10 Z" fill="#58d854"/>
        <path d="M150 800 L185 420 H215 L250 800 Z" fill="url(#scBrM)"/><path d="M150 800 L185 420 H215 L250 800" fill="none" stroke="${K}" stroke-width="2.5"/>
        <g ${F} transform="translate(200,250)">
          <path d="M-150 150 V-60 Q-150 -90 -120 -90 H-6 V150 Z" fill="#3f6fb0"/><path d="M150 150 V-60 Q150 -90 120 -90 H6 V150 Z" fill="#e2687e"/>
          <path d="M-138 150 V-56 Q-138 -78 -116 -78 H-14 V150 Z" fill="#fff7ea"/><path d="M138 150 V-56 Q138 -78 116 -78 H14 V150 Z" fill="#fff7ea"/>
          ${[-60,-40,-20,0,20,40,60,80,100,120].map(y => `<path d="M-128 ${y} H-24 M24 ${y} H128" fill="none" stroke="#d8c3a8" stroke-width="2"/>`).join('')}
          <rect x="-8" y="-96" width="16" height="250" rx="4" fill="#a8743c"/>
          <path d="M-60 -112 Q0 -140 60 -112" fill="none" stroke="${K}" stroke-width="3"/><rect x="-58" y="-132" width="116" height="26" rx="6" fill="#ffd000"/>
          <text x="0" y="-114" text-anchor="middle" font-size="13" font-weight="900" fill="${K}" letter-spacing="1">BRICK VILLAGE</text>
        </g>
        ${[[30,440,'#ff6a8a'],[70,470,'#ffd000'],[330,450,'#8a5ab8'],[365,480,'#ff6a8a'],[300,500,'#ffd000'],[50,520,'#8a5ab8']].map(([x, y, c]) => flower(x, y, c)).join('')}`);
    },
    // 村の井戸：村はずれの石の井戸。水面に文字のような光
    well(){
      return wrap(sky('scSkyW', '#5cbcfc', '#a8e0fc') + brickPattern('scBrW', '#c8501c', '#dc6a32', '#b04014'),
        `<rect class="ns" width="400" height="800" fill="url(#scSkyW)"/>
        ${cloud(250, 60, 0.9)}${cloud(40, 110, 0.7)}
        ${house(10, 230, 50, 40, '#d9534a', '#fff1d6', {chimney:true, flowers:true})}${house(80, 240, 42, 32, '#5a6ab8', '#f3e2c0')}${house(300, 232, 52, 40, '#4f9a4a', '#fff7ea', {flowers:true})}
        ${tree(150, 250, 0.8)}${tree(260, 248, 0.7, '#20b84c')}
        <rect x="-10" y="270" width="420" height="530" fill="#58d854"/>
        <path d="M-10 270 H410" fill="none" stroke="${K}" stroke-width="2"/>
        <path d="M60 800 Q120 560 200 500 Q236 478 268 474" fill="none" stroke="${K}" stroke-width="44" stroke-linecap="round"/>
        <path d="M60 800 Q120 560 200 500 Q236 478 268 474" fill="none" stroke="url(#scBrW)" stroke-width="40" stroke-linecap="round"/>
        <ellipse class="ns" cx="300" cy="482" rx="84" ry="16" fill="rgba(40,60,20,.28)"/>
        <g ${F} transform="translate(300,382)">
          <path d="M-70 -40 L0 -96 L70 -40 Z" fill="#a0603a"/><path d="M-62 -42 L0 -88 L62 -42 Z" fill="#c8794a"/>
          <rect x="-56" y="-44" width="9" height="104" fill="#7a5230"/><rect x="47" y="-44" width="9" height="104" fill="#7a5230"/>
          <rect x="-50" y="-30" width="100" height="6" fill="#7a5230"/><path d="M0 -24 V6" fill="none" stroke="${K}" stroke-width="2"/>
          <path d="M-9 6 H9 L7 22 H-7 Z" fill="#a0703a"/>
          <ellipse cx="0" cy="44" rx="64" ry="16" fill="#3cbcfc"/>
          <path d="M-64 44 V92 Q0 112 64 92 V44 Q0 62 -64 44 Z" fill="#b8b2a6"/>
          ${[[-48,58],[-22,64],[6,66],[34,62],[56,54],[-56,78],[-30,86],[-2,90],[26,88],[52,80]].map(([x, y]) => `<rect x="${x-11}" y="${y-6}" width="22" height="12" rx="3" fill="#cfc8bb"/>`).join('')}
          <path class="ns" d="M-30 40 h10 M-12 46 h14 M10 40 h8 M24 46 h12" stroke="#fff6c8" stroke-width="2.5" stroke-linecap="round"/>
          ${[[-20,8],[18,-2],[0,-14],[30,14]].map(([x, y], i) => `<circle class="ns sparkle" style="--d:${i*0.5}s" cx="${x}" cy="${y}" r="3" fill="#fff6c8"/>`).join('')}
        </g>
        <rect x="20" y="380" width="70" height="40" rx="6" fill="#a0603a"/>${[30,46,62,78].map((x, i) => flower(x, 378, ['#ff6a8a','#ffd000','#8a5ab8','#ff8a1a'][i])).join('')}
        ${[[352,506,'#ff6a8a'],[378,514,'#ffd000'],[20,470,'#8a5ab8']].map(([x, y, c]) => flower(x, y, c)).join('')}`);
    },
    // ニコのパン屋さん：レンガのかまど、パンの棚、カウンター
    bakery(){
      const bread = (x, y, s, k) => k === 0 ? `<ellipse cx="${x}" cy="${y}" rx="${14*s}" ry="${9*s}" fill="#d9944a"/><path d="M${x-7*s} ${y-3*s} q4 -3 8 0 M${x-1*s} ${y-4*s} q4 -3 8 0" fill="none" stroke="${K}" stroke-width="1.2"/>`
        : k === 1 ? `<path d="M${x-16*s} ${y+4*s} Q${x} ${y-14*s} ${x+16*s} ${y+4*s} Q${x} ${y+2*s} ${x-16*s} ${y+4*s} Z" fill="#e8a65a"/>`
        : `<rect x="${x-20*s}" y="${y-5*s}" width="${40*s}" height="${10*s}" rx="${5*s}" fill="#c9843e"/>`;
      return wrap(brickPattern('scBrB', '#b8481c', '#cc5e2c', '#a03c12') + sky('scWallB', '#f8e2c4', '#f1cfa4'),
        `<rect class="ns" width="400" height="800" fill="url(#scWallB)"/>
        ${[0,1,2,3,4,5,6,7,8,9].map(i => `<path class="ns" d="M${i*44} 0 V560" stroke="#e9c49a" stroke-width="2"/>`).join('')}
        <path d="M-10 80 H410" fill="none" stroke="${K}" stroke-width="2"/><rect x="-10" y="60" width="420" height="20" fill="#a8743c"/>
        <g ${F} transform="translate(110,300)">
          <path d="M-100 160 V-10 Q-100 -130 0 -130 Q100 -130 100 -10 V160 Z" fill="url(#scBrB)"/>
          <path d="M-100 160 V-10 Q-100 -130 0 -130 Q100 -130 100 -10 V160 Z" fill="none" stroke="${K}" stroke-width="3"/>
          <path d="M-52 120 V30 Q-52 -24 0 -24 Q52 -24 52 30 V120 Z" fill="#2a1a14"/>
          <path class="ns flame" d="M-30 120 Q-26 70 -8 90 Q-2 50 10 80 Q22 56 30 120 Z" fill="#ff9a2a"/><path class="ns flame" d="M-16 120 Q-10 92 0 104 Q10 88 16 120 Z" fill="#ffd84a"/>
          <rect x="-60" y="112" width="120" height="12" fill="#7a4a20"/>
          ${bread(-20, 106, 0.8, 0)}${bread(18, 106, 0.8, 0)}
        </g>
        <g ${F} transform="translate(250,110)">
          <rect x="0" y="0" width="140" height="300" fill="#a8743c"/><rect x="8" y="8" width="124" height="284" fill="#7a4a2a"/>
          ${[80, 160, 240].map(y => `<rect x="8" y="${y}" width="124" height="8" fill="#a8743c"/>`).join('')}
          ${bread(36, 68, 1, 0)}${bread(96, 68, 1, 1)}${bread(70, 150, 1.2, 2)}${bread(36, 230, 1, 1)}${bread(98, 230, 1, 0)}${bread(40, 282, 0.9, 2)}${bread(100, 282, 0.9, 0)}
        </g>
        <g ${F} transform="translate(200,160)"><rect x="-38" y="-40" width="76" height="56" rx="6" fill="#2f4a3a"/><text x="0" y="-16" text-anchor="middle" font-size="12" font-weight="800" fill="#fff8e0">BREAD</text><text x="0" y="4" text-anchor="middle" font-size="10" font-weight="700" fill="#ffd96a">★ NIKO ★</text></g>
        <path d="M200 0 V60" fill="none" stroke="${K}" stroke-width="2"/><path d="M180 60 H220 L212 80 H188 Z" fill="#ffd96a"/>
        <rect x="-10" y="452" width="420" height="40" fill="#c8915e"/><rect x="-10" y="492" width="420" height="320" fill="#a0683a"/>
        ${[0,1,2,3,4].map(i => `<path d="M${i*90+20} 492 V800" fill="none" stroke="${K}" stroke-width="2"/>`).join('')}
        <rect x="30" y="420" width="70" height="32" rx="4" fill="#fff7ea"/>${bread(50, 432, 0.7, 0)}${bread(80, 434, 0.7, 1)}
        <rect x="300" y="414" width="80" height="38" rx="4" fill="#e2687e"/><rect x="306" y="420" width="68" height="10" fill="#fff1d6"/>`);
    },
    // モックとハルの森：木もれ日の道、小川、古い木の橋、向こう岸の花
    forest(){
      return wrap(sky('scSkyF', '#7ad468', '#b8f0a0'),
        `<rect class="ns" width="400" height="800" fill="url(#scSkyF)"/>
        ${[[30,1.5,'#008830'],[120,1.3,'#00a844'],[290,1.4,'#008830'],[380,1.6,'#00a844'],[200,1.1,'#20b84c']].map(([x, s, c]) => [x, 254 - 34 * s, s, c]).map(([x, y, s, c]) => tree(x, y, s, c)).join('')}
        ${[60,150,240,330].map((x, i) => `<path class="ns beam" style="--d:${i*0.7}s" d="M${x} 0 L${x+40} 0 L${x+90} 470 L${x+30} 470 Z" fill="rgba(255,250,200,.28)"/>`).join('')}
        <rect x="-10" y="252" width="420" height="548" fill="#58d854"/>${[20,70,130,250,330,385].map((x, i) => `<ellipse cx="${x}" cy="256" rx="${26 + (i%3)*6}" ry="12" fill="#00a844"/>`).join('')}<path class="ns" d="M-10 252 H410" fill="none" stroke="${K}" stroke-width="2"/>
        <path d="M-10 380 Q120 350 200 372 Q290 396 410 360 V420 Q290 452 200 430 Q110 410 -10 440 Z" fill="#3cbcfc"/>
        ${[[40,404],[150,392],[250,410],[340,392]].map(([x, y]) => `<path class="ns" d="M${x} ${y} q10 -5 20 0" fill="none" stroke="#dff3ff" stroke-width="2.5" stroke-linecap="round"/>`).join('')}
        <path d="M184 252 L216 252 L230 352 L170 352 Z" fill="#e8c890"/><path d="M146 456 L254 456 L300 560 L100 560 Z" fill="#e8c890"/>
        <path d="M184 252 L170 352 M216 252 L230 352 M146 456 L100 560 M254 456 L300 560" fill="none" stroke="${K}" stroke-width="1.5"/>
        <ellipse class="ns" cx="200" cy="420" rx="56" ry="8" fill="rgba(0,40,90,.25)"/>
        <g ${F}>
          <path d="M170 350 L230 350 L252 458 L148 458 Z" fill="#b8844c"/>
          ${[0,1,2,3,4,5,6,7,8,9].map(i => { const t = i / 9, y = 350 + t * 108, hw = 30 + t * 22; return `<path d="M${r1(200 - hw)} ${r1(y)} H${r1(200 + hw)}" fill="none" stroke="${K}" stroke-width="1.2"/>`; }).join('')}
          ${[-1, 1].map(sd => { const pts = [0, 0.25, 0.5, 0.75, 1].map(t => [200 + sd * (30 + t * 22), 350 + t * 108, 12 + t * 12]);
            return pts.map(([x, y, h]) => `<rect x="${r1(x - 2.5)}" y="${r1(y - h)}" width="5" height="${r1(h)}" fill="#8a5a2a"/>`).join('') +
              `<path d="M${pts.map(([x, y, h]) => `${r1(x)} ${r1(y - h)}`).join(' L')}" fill="none" stroke="#8a5a2a" stroke-width="5" stroke-linecap="round"/>`; }).join('')}
        </g>
        ${[[300,350,'#ff6a8a'],[330,356,'#ffd000'],[360,348,'#ffffff'],[270,354,'#8a5ab8'],[60,470,'#ff6a8a'],[90,480,'#ffd000'],[340,480,'#ffffff']].map(([x, y, c]) => flower(x, y, c)).join('')}
        ${[[30,340],[380,332]].map(([x, y]) => `<g transform="translate(${x},${y})"><rect x="-10" y="-6" width="20" height="10" rx="5" fill="#c84a3a"/><path d="M-8 4 V12 M8 4 V12" fill="none" stroke="${K}" stroke-width="2"/><circle class="ns" cx="-4" cy="-2" r="1.6" fill="#fff"/><circle class="ns" cx="4" cy="-3" r="1.6" fill="#fff"/></g>`).join('')}`);
    },
    // ルークとアリカの時計台（塔の中）：内側から見た文字盤のガラス、時を進める歯車の列（左）、
    // 鐘を打つ歯車の列（右）、振り子とおもり、文字盤へ力を伝える軸、上の鐘。物語のとおり、時計は止まっている
    clock(){
      const IRON = '#3a4048', BRASS = '#d8a838', BRASS2 = '#b8862a';
      // 歯の大きさをそろえた本物らしい歯車（リム・スポーク・軸）
      const wheel = (cx, cy, r, rot, spokes) => {
        const n = Math.max(8, Math.round(r / 2.4)); let d = '';
        for(let i = 0; i < n; i++){
          const a = rot + i / n * Math.PI * 2, w = Math.PI / n;
          const p = [[a - w * 0.55, r * 0.86], [a - w * 0.3, r], [a + w * 0.3, r], [a + w * 0.55, r * 0.86]];
          d += (i ? 'L' : 'M') + p.map(([t, rr]) => r1(cx + Math.cos(t) * rr) + ' ' + r1(cy + Math.sin(t) * rr)).join(' L');
        }
        const sp = spokes || (r > 20 ? 5 : 0);
        return `<path d="${d}Z" fill="${BRASS}"/>` + (sp ? `<circle cx="${cx}" cy="${cy}" r="${r1(r * 0.7)}" fill="#5a4a3a"/>` +
          Array.from({length:sp}, (_, k) => { const t = rot + k / sp * Math.PI * 2; return `<path d="M${r1(cx + Math.cos(t - 0.12) * r * 0.2)} ${r1(cy + Math.sin(t - 0.12) * r * 0.2)} L${r1(cx + Math.cos(t - 0.06) * r * 0.74)} ${r1(cy + Math.sin(t - 0.06) * r * 0.74)} L${r1(cx + Math.cos(t + 0.06) * r * 0.74)} ${r1(cy + Math.sin(t + 0.06) * r * 0.74)} L${r1(cx + Math.cos(t + 0.12) * r * 0.2)} ${r1(cy + Math.sin(t + 0.12) * r * 0.2)} Z" fill="${BRASS2}"/>`; }).join('') : '') +
          `<circle cx="${cx}" cy="${cy}" r="${r1(Math.max(3, r * 0.2))}" fill="${BRASS2}"/><circle cx="${cx}" cy="${cy}" r="2.2" fill="${IRON}"/>`;
      };
      // かみ合う位置（2つの歯車の中心の距離 ＝ 半径の和 × 0.9）
      const next = (x, y, r0, r, deg) => [r1(x + Math.cos(deg * Math.PI / 180) * (r0 + r) * 0.9), r1(y + Math.sin(deg * Math.PI / 180) * (r0 + r) * 0.9)];
      const G1 = [52, 364], g1 = 44, [g2x, g2y] = next(...G1, g1, 24, -58), [g3x, g3y] = next(g2x, g2y, 24, 16, -8), [ex, ey] = next(g3x, g3y, 16, 14, -104);
      const S1 = [338, 372], s1 = 40, [s2x, s2y] = next(...S1, s1, 22, -128);
      const stone = `<pattern id="scStone" width="60" height="34" patternUnits="userSpaceOnUse"><rect class="ns" width="60" height="34" fill="#8a7a6a"/><rect class="ns" x="2" y="2" width="26" height="13" rx="2" fill="#968676"/><rect class="ns" x="32" y="19" width="26" height="13" rx="2" fill="#7e6e60"/>
        <path class="ns" d="M0 0H60M0 17H60M30 0V17M15 17V34M45 17V34" fill="none" stroke="#4a3e34" stroke-width="1.4"/></pattern>`;
      const glow = `<radialGradient id="scDial" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff8d8"/><stop offset=".8" stop-color="#ffe7a0"/><stop offset="1" stop-color="#f0c868"/></radialGradient>`;
      const DX = 200, DY = 128, DR = 78;
      return wrap(stone + glow,
        `<rect class="ns" width="400" height="800" fill="url(#scStone)"/>
        <path class="ns" d="M${DX - 60} ${DY + 40} L40 470 H360 L${DX + 60} ${DY + 40} Z" fill="rgba(255,230,150,.16)"/>
        <!-- 天井の梁と柱 -->
        <g ${F}><rect x="-10" y="18" width="420" height="16" fill="#7a4a2a"/><rect x="-10" y="226" width="420" height="12" fill="#7a4a2a"/>
          <rect x="4" y="18" width="14" height="420" fill="#6a3e22"/><rect x="382" y="18" width="14" height="420" fill="#6a3e22"/>
          <path d="M18 34 L60 34 L18 76 Z M382 34 L340 34 L382 76 Z" fill="#7a4a2a"/></g>
        <!-- 床 -->
        <rect x="-10" y="434" width="420" height="380" fill="#6a4a32"/>${[0, 1, 2, 3, 4].map(i => `<path d="M-10 ${462 + i * 30} H410" fill="none" stroke="${K}" stroke-width="1.6"/>`).join('')}
        <path d="M-10 434 H410" fill="none" stroke="${K}" stroke-width="2.5"/>
        <rect x="18" y="434" width="30" height="10" fill="#1d1414"/>
        <!-- 内側から見た文字盤（すりガラスに外の光。数字は裏返し） -->
        <g ${F}><circle cx="${DX}" cy="${DY}" r="${DR + 8}" fill="${IRON}"/><circle cx="${DX}" cy="${DY}" r="${DR}" fill="url(#scDial)"/></g>
        <g transform="translate(${DX},${DY}) scale(-1,1)">
          ${Array.from({length:12}, (_, i) => { const t = i / 12 * Math.PI * 2 - Math.PI / 2; return `<path class="ns" d="M${r1(Math.cos(t) * 24)} ${r1(Math.sin(t) * 24)} L${r1(Math.cos(t) * DR)} ${r1(Math.sin(t) * DR)}" stroke="${IRON}" stroke-width="2.4"/>
            <text x="${r1(Math.cos(t) * 60)}" y="${r1(Math.sin(t) * 60 + 5)}" text-anchor="middle" font-size="13" font-weight="900" fill="#b08a48" opacity=".55">${['XII','I','II','III','IIII','V','VI','VII','VIII','IX','X','XI'][i]}</text>`; }).join('')}
          <circle class="ns" r="24" fill="none" stroke="${IRON}" stroke-width="2.4"/><circle class="ns" r="${DR - 14}" fill="none" stroke="${IRON}" stroke-width="1.6"/>
          <path class="ns" d="M0 0 L-3 -62 L0 -70 L3 -62 Z" fill="rgba(30,30,40,.55)"/><path class="ns" d="M0 0 L32 26 L38 32 L28 30 Z" fill="rgba(30,30,40,.55)"/>
        </g>
        <!-- 文字盤の中心の歯車箱と、動力を伝える軸 -->
        <path d="M${g2x} ${g2y} V${DY} H${DX}" fill="none" stroke="${K}" stroke-width="7" stroke-linejoin="round"/><path d="M${g2x} ${g2y} V${DY} H${DX}" fill="none" stroke="#9aa2aa" stroke-width="3.5" stroke-linejoin="round"/>
        <g ${F}><rect x="${g2x - 9}" y="${DY - 9}" width="18" height="18" rx="3" fill="${IRON}"/><circle cx="${DX}" cy="${DY}" r="15" fill="${IRON}"/>${wheel(DX - 5, DY - 3, 8, 0.2, 0)}${wheel(DX + 7, DY + 5, 6, 0.5, 0)}</g>
        <!-- 左：時を進める歯車の列（鋳鉄のわく、大きな車・二番車・三番車・がんぎ車、アンクル、振り子、おもり） -->
        <g ${F}>
          <path d="M10 430 L22 290 H${ex + 22} L${ex + 34} 430 Z" fill="none" stroke="${IRON}" stroke-width="7"/>
          <rect x="6" y="424" width="${ex + 40}" height="10" fill="${IRON}"/>
          <rect x="${G1[0] - 34}" y="${G1[1] - 12}" width="68" height="24" rx="6" fill="#8a6a4a"/>
          ${wheel(...G1, g1, 0.1)}${wheel(g2x, g2y, 24, 0.3)}${wheel(g3x, g3y, 16, 0.05)}
          ${(() => { let d = ''; const n = 15, r = 14; for(let i = 0; i < n; i++){ const t = i / n * Math.PI * 2; d += (i ? 'L' : 'M') + `${r1(ex + Math.cos(t) * r * 0.7)} ${r1(ey + Math.sin(t) * r * 0.7)} L${r1(ex + Math.cos(t + 0.32) * r)} ${r1(ey + Math.sin(t + 0.32) * r)}`; } return `<path d="${d}Z" fill="${BRASS}"/><circle cx="${ex}" cy="${ey}" r="3" fill="${IRON}"/>`; })()}
          <path d="M${ex - 18} ${ey + 4} L${ex} ${ey - 20} L${ex + 18} ${ey + 4}" fill="none" stroke="${IRON}" stroke-width="5" stroke-linejoin="round"/>
          <path d="M${ex} ${ey - 20} V${ey + 118}" fill="none" stroke="#9aa2aa" stroke-width="3"/>
          <circle cx="${ex}" cy="${ey + 132}" r="16" fill="${BRASS}"/><circle class="ns" cx="${ex - 5}" cy="${ey + 126}" r="5" fill="rgba(255,255,255,.4)"/>
          <path d="M${G1[0] - 19} ${G1[1] + 8} V438" fill="none" stroke="#c8b898" stroke-width="2.5"/>
        </g>
        <!-- 右：鐘を打つ歯車の列と、鐘へのレバー -->
        <g ${F}>
          <path d="M${s2x - 30} 430 L${s2x - 22} 300 H392 V430 Z" fill="none" stroke="${IRON}" stroke-width="7"/>
          <rect x="${s2x - 34}" y="424" width="${400 - s2x + 34}" height="10" fill="${IRON}"/>
          ${wheel(...S1, s1, 0.4)}${wheel(s2x, s2y, 22, 0.2)}
          <rect x="${s2x - 3}" y="${s2y - 52}" width="6" height="40" fill="#9aa2aa"/><path d="M${s2x - 18} ${s2y - 54} h36 v10 h-36 Z" fill="#a8a8b8"/>
          ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<circle cx="${r1(S1[0] + Math.cos(i * 0.7) * 30)}" cy="${r1(S1[1] + Math.sin(i * 0.7) * 30)}" r="2.6" fill="${IRON}"/>`).join('')}
          <path d="M${S1[0] + 18} ${S1[1] - 26} L360 190 L344 96" fill="none" stroke="${IRON}" stroke-width="4" stroke-linejoin="round"/>
        </g>
        <!-- 鐘 -->
        <g ${F}><rect x="296" y="34" width="70" height="10" fill="#7a4a2a"/><path d="M308 96 Q308 52 331 46 Q354 52 354 96 L362 104 H300 Z" fill="#e0b040"/><circle cx="331" cy="108" r="6" fill="#a87a2a"/><circle cx="344" cy="96" r="5" fill="${IRON}"/></g>
        `);
    },
    // リリィとヌールの図書館：高い本棚、アーチの窓、書見台の古い絵本
    library(){
      const shelf = (x, w) => `<rect x="${x}" y="40" width="${w}" height="420" fill="#7a4a2a"/><rect x="${x+8}" y="48" width="${w-16}" height="404" fill="#4a2c1a"/>
        ${[0,1,2,3,4].map(r => `${books(x + 10, 52 + r*80, w - 20, 66, r*3 + x)}<rect x="${x+8}" y="${118 + r*80}" width="${w-16}" height="8" fill="#7a4a2a"/>`).join('')}`;
      return wrap(sky('scWallL', '#f6e2bc', '#e8c99a') + sky('scWinL', '#cfe9ff', '#fff7d8'),
        `<rect class="ns" width="400" height="800" fill="url(#scWallL)"/>
        ${shelf(-6, 120)}${shelf(286, 120)}
        <path d="M140 300 V120 Q140 60 200 60 Q260 60 260 120 V300 Z" fill="url(#scWinL)"/>
        <path d="M200 60 V300 M140 180 H260" fill="none" stroke="${K}" stroke-width="8"/><path d="M200 60 V300 M140 180 H260" fill="none" stroke="#a8743c" stroke-width="4"/>
        <path d="M140 300 V120 Q140 60 200 60 Q260 60 260 120 V300 Z" fill="none" stroke="${K}" stroke-width="3"/>
        <path class="ns" d="M140 300 L60 470 H340 L260 300 Z" fill="rgba(255,248,210,.35)"/>
        <rect x="130" y="300" width="140" height="10" fill="#a8743c"/>
        <g ${F} transform="translate(200,400)"><path d="M-12 0 L12 0 L18 70 H-18 Z" fill="#8a5a32"/><path d="M-46 0 L46 0 L36 -18 L-36 -18 Z" fill="#a8743c"/>
          <path d="M-40 -18 Q-20 -30 0 -20 Q20 -30 40 -18 L40 -14 Q20 -26 0 -16 Q-20 -26 -40 -14 Z" fill="#fff7ea"/><path d="M0 -20 V-16" fill="none" stroke="${K}" stroke-width="1.5"/></g>
        <g ${F} transform="translate(118,250) rotate(8)"><rect x="-4" y="0" width="6" height="220" fill="#a8743c"/><rect x="26" y="0" width="6" height="220" fill="#a8743c"/>${[20,50,80,110,140,170,200].map(y => `<rect x="-2" y="${y}" width="32" height="5" fill="#a8743c"/>`).join('')}</g>
        <rect x="-10" y="460" width="420" height="340" fill="#8a5a3a"/>${[0,1,2,3,4,5].map(i => `<path d="M-10 ${485 + i*30} H410" fill="none" stroke="${K}" stroke-width="2"/>`).join('')}
        <g ${F} transform="translate(330,470)"><rect x="-8" y="-24" width="16" height="24" fill="#fff7ea"/><path class="ns flame" d="M0 -40 Q-6 -30 0 -24 Q6 -30 0 -40 Z" fill="#ffb020"/></g>`);
    },
    // 中央広場：噴水、旗のガーランド、まわりの家、奥に時計台と絵本の門
    plaza(){
      const flags = Array.from({length:13}, (_, i) => { const x = i * 34 - 6, y = 120 + Math.sin(i / 12 * Math.PI) * 26; return `<path d="M${r1(x)} ${r1(y)} l12 0 l-6 14 Z" fill="${['#e8101e','#ffd000','#1e5aff','#10c050','#ff6a8a'][i % 5]}"/>`; }).join('');
      return wrap(sky('scSkyP', '#5cbcfc', '#a8e0fc') + brickPattern('scBrP', '#c8501c', '#dc6a32', '#b04014'),
        `<rect class="ns" width="400" height="800" fill="url(#scSkyP)"/>
        ${cloud(40, 40, 0.8)}${cloud(300, 30, 0.7)}
        <g ${F} transform="translate(200,150)"><rect x="-22" y="-70" width="44" height="182" fill="#f3e2c0"/><path d="M-9 112 V84 Q0 74 9 84 V112 Z" fill="#8a5a32"/><rect x="-7" y="10" width="14" height="18" fill="#ffe08a"/><rect x="-30" y="108" width="60" height="6" fill="#b8b2a6"/><path d="M-30 -66 L0 -110 L30 -66 Z" fill="#5a6ab8"/>
          <circle cx="0" cy="-40" r="15" fill="#fffdf0"/><path d="M0 -40 V-50 M0 -40 L7 -36" fill="none" stroke="${K}" stroke-width="2"/></g>
        ${house(-20, 190, 70, 70, '#e2687e', '#fff1d6', {chimney:true, flowers:true})}${house(60, 210, 54, 52, '#ffb020', '#f6ecd8')}${house(280, 206, 56, 56, '#4f9a4a', '#fff7ea', {flowers:true})}${house(342, 186, 70, 74, '#3f6fb0', '#fff1d6', {chimney:true})}
        <path d="M-10 120 Q200 170 410 120" fill="none" stroke="${K}" stroke-width="1.5"/>${flags}
        <rect x="-10" y="262" width="420" height="540" fill="url(#scBrP)"/><path d="M-10 262 H410" fill="none" stroke="${K}" stroke-width="2"/>
        <g ${F} transform="translate(200,330)">
          <ellipse cx="0" cy="40" rx="120" ry="30" fill="#b8b2a6"/><ellipse cx="0" cy="34" rx="104" ry="22" fill="#3cbcfc"/>
          <rect x="-10" y="-30" width="20" height="64" fill="#cfc8bb"/><ellipse cx="0" cy="-30" rx="34" ry="9" fill="#cfc8bb"/>
        </g>
        <g class="fount" transform="translate(200,330)">
          ${[0, 1, 2].map(i => `<ellipse class="ns ripple" style="--d:${i * 0.8}s" cx="0" cy="34" rx="30" ry="7" fill="none" stroke="#e8f8ff" stroke-width="2"/>`).join('')}
          <path class="ns plume" d="M0 -32 V-98" stroke="#9ad8fc" stroke-width="9" stroke-linecap="round"/><path class="ns plume" d="M0 -32 V-98" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
          ${[-1, 1].map(sd => [[64, 30], [44, 18], [86, 34]].map(([w, h], k) => { const d = `M0 -96 Q${sd * w * 0.55} ${-124 + k * 6} ${sd * w} ${h}`;
            return `<path class="ns jet" style="--d:${(k * 0.17).toFixed(2)}s" d="${d}" fill="none" stroke="#9ad8fc" stroke-width="5" stroke-linecap="round"/><path class="ns jet" style="--d:${(k * 0.17).toFixed(2)}s" d="${d}" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>`; }).join('')).join('')}
          ${[-1, 1].map(sd => `<path class="ns jet small" d="M${sd * 30} -30 Q${sd * 50} -44 ${sd * 62} 28" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>`).join('')}
          ${[[-86,34],[-64,30],[-44,18],[44,18],[64,30],[86,34],[-62,28],[62,28]].map(([x, y], i) => `<circle class="ns splash" style="--d:${(i * 0.13).toFixed(2)}s" cx="${x}" cy="${y}" r="3" fill="#ffffff"/>`).join('')}
          ${[[-14,-112],[10,-118],[-4,-126],[18,-104],[-22,-100]].map(([x, y], i) => `<circle class="ns spray" style="--d:${(i * 0.21).toFixed(2)}s" cx="${x}" cy="${y}" r="2.4" fill="#ffffff"/>`).join('')}
        </g>
        ${[[40,300],[360,300]].map(([x, y]) => `<g ${F} transform="translate(${x},${y})"><rect x="-3" y="-60" width="6" height="70" fill="#3a3a4a"/><circle cx="0" cy="-64" r="10" fill="#ffe08a"/></g>`).join('')}
        ${[[60,420,'#ff6a8a'],[80,430,'#ffd000'],[320,424,'#8a5ab8'],[344,432,'#ff6a8a']].map(([x, y, c]) => flower(x, y, c)).join('')}`);
    }
  };
  window.IWScenes = {has: bg => !!ART[bg], art: bg => ART[bg] ? ART[bg]() : ''};
})();
