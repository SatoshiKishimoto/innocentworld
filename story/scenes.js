/* レンガ村の物語　場所ごとの背景イラスト（SVG）
   井戸・パン屋・森・時計台・図書館・中央広場・物語の入口（meadow）を、絵本の挿し絵のように描きます。
   すべて黒い縁取り（story.css の .sbgart のきまり）。画面の下半分はセリフの枠、中央には住人が立つので、
   見せたいものは左右と奥（上半分）に置いています。 */
(function(){
  'use strict';
  const K = '#1d1414';   // 縁取りの色
  const r1 = n => Math.round(n * 10) / 10;

  /* ---------- 部品 ---------- */
  function cloud(x, y, s){ return `<g transform="translate(${x},${y}) scale(${s})"><path d="M0 20 Q-4 4 14 4 Q18 -10 36 -4 Q50 -14 62 0 Q80 0 76 20 Z" fill="#fff"/></g>`; }
  function house(x, y, w, h, roof, wall, opt){
    opt = opt || {};
    const rh = h * 0.7, door = opt.door !== false;
    return `<g transform="translate(${x},${y})">
      <rect x="0" y="0" width="${w}" height="${h}" fill="${wall}"/>
      <path d="M${-w*0.12} 2 L${w/2} ${-rh} L${w*1.12} 2 Z" fill="${roof}"/>
      ${opt.chimney ? `<rect x="${w*0.68}" y="${-rh*0.9}" width="${w*0.13}" height="${rh*0.6}" fill="#b5654a"/>` : ''}
      <rect x="${w*0.14}" y="${h*0.18}" width="${w*0.24}" height="${h*0.26}" fill="#ffe08a"/><path d="M${w*0.26} ${h*0.18} V${h*0.44} M${w*0.14} ${h*0.31} H${w*0.38}" fill="none" stroke="${K}" stroke-width="1.2"/>
      ${door ? `<path d="M${w*0.56} ${h} V${h*0.42} Q${w*0.7} ${h*0.3} ${w*0.84} ${h*0.42} V${h} Z" fill="${opt.doorColor || '#8a5a32'}"/>` : `<rect x="${w*0.6}" y="${h*0.18}" width="${w*0.24}" height="${h*0.26}" fill="#ffe08a"/>`}
      ${opt.flowers ? `<rect x="${w*0.1}" y="${h*0.46}" width="${w*0.32}" height="${h*0.08}" fill="#a0603a"/>${[0.16,0.26,0.36].map((k, i) => `<circle cx="${w*k}" cy="${h*0.45}" r="${w*0.04}" fill="${['#ff6a8a','#ffd000','#ff8a1a'][i]}"/>`).join('')}` : ''}
    </g>`;
  }
  function tree(x, y, s, c){
    c = c || '#3f9a48';
    return `<g transform="translate(${x},${y}) scale(${s})"><rect x="-6" y="0" width="12" height="34" fill="#7a4a20"/>
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
      <path class="ns" d="M0 0H40M0 10H40M0 20H40M20 0V10M10 10V20M30 10V20" fill="none" stroke="${K}" stroke-width="1.6"/></pattern>`;
  }
  const sky = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const wrap = (defs, body) => `<svg class="sbgart" viewBox="0 0 400 800" preserveAspectRatio="xMidYMin slice" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;

  /* ---------- 場所 ---------- */
  const ART = {
    // 物語の入口：大きな絵本の門と、その先に広がる村
    meadow(){
      return wrap(sky('scSkyM', '#7fc6ff', '#dff3ff') + brickPattern('scBrM', '#e08a5a', '#e99a68', '#d4784a'),
        `<rect class="ns" width="400" height="800" fill="url(#scSkyM)"/>
        ${cloud(30, 70, 1)}${cloud(280, 110, 0.8)}${cloud(170, 40, 0.6)}
        <path d="M-10 330 Q100 270 210 310 Q310 280 410 320 V800 H-10 Z" fill="#9fdc78"/>
        ${house(40, 262, 44, 36, '#e2687e', '#fff1d6', {chimney:true})}${house(110, 270, 40, 30, '#5a6ab8', '#f6ecd8')}${house(250, 266, 46, 36, '#ffb020', '#fff7ea', {chimney:true})}${house(318, 274, 40, 30, '#4f9a4a', '#fff1d6')}
        <path d="M-10 400 Q120 350 220 390 Q320 360 410 395 V800 H-10 Z" fill="#7cc860"/>
        <path d="M150 800 L185 420 H215 L250 800 Z" fill="url(#scBrM)"/><path d="M150 800 L185 420 H215 L250 800" fill="none" stroke="${K}" stroke-width="2.5"/>
        <g transform="translate(200,250)">
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
      return wrap(sky('scSkyW', '#8ec9f0', '#e8f5ff') + brickPattern('scBrW', '#d98a5a', '#e39a6a', '#cc7a4c'),
        `<rect class="ns" width="400" height="800" fill="url(#scSkyW)"/>
        ${cloud(250, 60, 0.9)}${cloud(40, 110, 0.7)}
        ${house(10, 230, 50, 40, '#d9534a', '#fff1d6', {chimney:true, flowers:true})}${house(80, 240, 42, 32, '#5a6ab8', '#f3e2c0')}${house(300, 232, 52, 40, '#4f9a4a', '#fff7ea', {flowers:true})}
        ${tree(150, 250, 0.8)}${tree(260, 248, 0.7, '#4fae58')}
        <rect x="-10" y="290" width="420" height="510" fill="#8fd06a"/>
        <path d="M-10 290 H410" fill="none" stroke="${K}" stroke-width="2"/>
        <path d="M60 800 Q120 520 210 420 Q240 390 280 380" fill="none" stroke="${K}" stroke-width="44" stroke-linecap="round"/>
        <path d="M60 800 Q120 520 210 420 Q240 390 280 380" fill="none" stroke="url(#scBrW)" stroke-width="40" stroke-linecap="round"/>
        <g transform="translate(300,330)">
          <path d="M-70 -40 L0 -96 L70 -40 Z" fill="#a0603a"/><path d="M-62 -42 L0 -88 L62 -42 Z" fill="#c8794a"/>
          <rect x="-56" y="-44" width="9" height="104" fill="#7a5230"/><rect x="47" y="-44" width="9" height="104" fill="#7a5230"/>
          <rect x="-50" y="-30" width="100" height="6" fill="#7a5230"/><path d="M0 -24 V6" fill="none" stroke="${K}" stroke-width="2"/>
          <path d="M-9 6 H9 L7 22 H-7 Z" fill="#a0703a"/>
          <ellipse cx="0" cy="44" rx="64" ry="16" fill="#5aa8e8"/>
          <path d="M-64 44 V92 Q0 112 64 92 V44 Q0 62 -64 44 Z" fill="#b8b2a6"/>
          ${[[-48,58],[-22,64],[6,66],[34,62],[56,54],[-56,78],[-30,86],[-2,90],[26,88],[52,80]].map(([x, y]) => `<rect x="${x-11}" y="${y-6}" width="22" height="12" rx="3" fill="#cfc8bb"/>`).join('')}
          <path class="ns" d="M-30 40 h10 M-12 46 h14 M10 40 h8 M24 46 h12" stroke="#fff6c8" stroke-width="2.5" stroke-linecap="round"/>
          ${[[-20,8],[18,-2],[0,-14],[30,14]].map(([x, y], i) => `<circle class="ns sparkle" style="--d:${i*0.5}s" cx="${x}" cy="${y}" r="3" fill="#fff6c8"/>`).join('')}
        </g>
        <rect x="20" y="380" width="70" height="40" rx="6" fill="#a0603a"/>${[30,46,62,78].map((x, i) => flower(x, 378, ['#ff6a8a','#ffd000','#8a5ab8','#ff8a1a'][i])).join('')}
        ${[[340,450,'#ff6a8a'],[370,470,'#ffd000'],[20,470,'#8a5ab8']].map(([x, y, c]) => flower(x, y, c)).join('')}`);
    },
    // ニコのパン屋さん：レンガのかまど、パンの棚、カウンター
    bakery(){
      const bread = (x, y, s, k) => k === 0 ? `<ellipse cx="${x}" cy="${y}" rx="${14*s}" ry="${9*s}" fill="#d9944a"/><path d="M${x-7*s} ${y-3*s} q4 -3 8 0 M${x-1*s} ${y-4*s} q4 -3 8 0" fill="none" stroke="${K}" stroke-width="1.2"/>`
        : k === 1 ? `<path d="M${x-16*s} ${y+4*s} Q${x} ${y-14*s} ${x+16*s} ${y+4*s} Q${x} ${y+2*s} ${x-16*s} ${y+4*s} Z" fill="#e8a65a"/>`
        : `<rect x="${x-20*s}" y="${y-5*s}" width="${40*s}" height="${10*s}" rx="${5*s}" fill="#c9843e"/>`;
      return wrap(brickPattern('scBrB', '#c8704a', '#d27f56', '#b9643f') + sky('scWallB', '#f8e2c4', '#f1cfa4'),
        `<rect class="ns" width="400" height="800" fill="url(#scWallB)"/>
        ${[0,1,2,3,4,5,6,7,8,9].map(i => `<path class="ns" d="M${i*44} 0 V560" stroke="#e9c49a" stroke-width="2"/>`).join('')}
        <path d="M-10 80 H410" fill="none" stroke="${K}" stroke-width="2"/><rect x="-10" y="60" width="420" height="20" fill="#a8743c"/>
        <g transform="translate(110,300)">
          <path d="M-100 160 V-10 Q-100 -130 0 -130 Q100 -130 100 -10 V160 Z" fill="url(#scBrB)"/>
          <path d="M-100 160 V-10 Q-100 -130 0 -130 Q100 -130 100 -10 V160 Z" fill="none" stroke="${K}" stroke-width="3"/>
          <path d="M-52 120 V30 Q-52 -24 0 -24 Q52 -24 52 30 V120 Z" fill="#2a1a14"/>
          <path class="ns flame" d="M-30 120 Q-26 70 -8 90 Q-2 50 10 80 Q22 56 30 120 Z" fill="#ff9a2a"/><path class="ns flame" d="M-16 120 Q-10 92 0 104 Q10 88 16 120 Z" fill="#ffd84a"/>
          <rect x="-60" y="112" width="120" height="12" fill="#7a4a20"/>
          ${bread(-20, 106, 0.8, 0)}${bread(18, 106, 0.8, 0)}
        </g>
        <g transform="translate(250,110)">
          <rect x="0" y="0" width="140" height="300" fill="#a8743c"/><rect x="8" y="8" width="124" height="284" fill="#7a4a2a"/>
          ${[80, 160, 240].map(y => `<rect x="8" y="${y}" width="124" height="8" fill="#a8743c"/>`).join('')}
          ${bread(36, 68, 1, 0)}${bread(96, 68, 1, 1)}${bread(70, 150, 1.2, 2)}${bread(36, 230, 1, 1)}${bread(98, 230, 1, 0)}${bread(40, 282, 0.9, 2)}${bread(100, 282, 0.9, 0)}
        </g>
        <g transform="translate(200,160)"><rect x="-38" y="-40" width="76" height="56" rx="6" fill="#2f4a3a"/><text x="0" y="-16" text-anchor="middle" font-size="12" font-weight="800" fill="#fff8e0">BREAD</text><text x="0" y="4" text-anchor="middle" font-size="10" font-weight="700" fill="#ffd96a">★ NIKO ★</text></g>
        <path d="M200 0 V60" fill="none" stroke="${K}" stroke-width="2"/><path d="M180 60 H220 L212 80 H188 Z" fill="#ffd96a"/>
        <rect x="-10" y="452" width="420" height="40" fill="#c8915e"/><rect x="-10" y="492" width="420" height="320" fill="#a0683a"/>
        ${[0,1,2,3,4].map(i => `<path d="M${i*90+20} 492 V800" fill="none" stroke="${K}" stroke-width="2"/>`).join('')}
        <rect x="30" y="420" width="70" height="32" rx="4" fill="#fff7ea"/>${bread(50, 432, 0.7, 0)}${bread(80, 434, 0.7, 1)}
        <rect x="300" y="414" width="80" height="38" rx="4" fill="#e2687e"/><rect x="306" y="420" width="68" height="10" fill="#fff1d6"/>`);
    },
    // モックとハルの森：木もれ日の道、小川、古い木の橋、向こう岸の花
    forest(){
      return wrap(sky('scSkyF', '#bfe6a0', '#e8f8d0'),
        `<rect class="ns" width="400" height="800" fill="url(#scSkyF)"/>
        ${[[30,200,1.5,'#2f7a38'],[120,180,1.3,'#3f8a48'],[290,190,1.4,'#2f7a38'],[380,210,1.6,'#3f8a48'],[200,170,1.1,'#4f9a4a']].map(([x, y, s, c]) => tree(x, y, s, c)).join('')}
        ${[60,150,240,330].map((x, i) => `<path class="ns beam" style="--d:${i*0.7}s" d="M${x} 0 L${x+40} 0 L${x+90} 470 L${x+30} 470 Z" fill="rgba(255,250,200,.28)"/>`).join('')}
        <rect x="-10" y="300" width="420" height="500" fill="#7cc860"/><path d="M-10 300 H410" fill="none" stroke="${K}" stroke-width="2"/>
        <path d="M-10 380 Q120 350 200 372 Q290 396 410 360 V420 Q290 452 200 430 Q110 410 -10 440 Z" fill="#5aa8e8"/>
        ${[[40,404],[150,392],[250,410],[340,392]].map(([x, y]) => `<path class="ns" d="M${x} ${y} q10 -5 20 0" fill="none" stroke="#dff3ff" stroke-width="2.5" stroke-linecap="round"/>`).join('')}
        <g transform="translate(200,402)">
          <path d="M-120 -22 Q0 -60 120 -22 L120 -10 Q0 -48 -120 -10 Z" fill="#a8743c"/>
          ${[-100,-70,-40,-10,20,50,80,110].map(x => `<path d="M${x} ${r1(-16 - (1 - (x/120)**2) * 30)} V${r1(-4 - (1 - (x/120)**2) * 30)}" fill="none" stroke="${K}" stroke-width="1.5"/>`).join('')}
          <path d="M-120 -22 Q0 -60 120 -22" fill="none" stroke="${K}" stroke-width="2.5"/>
          <path d="M-110 -22 V-62 M110 -22 V-62 M-110 -62 Q0 -96 110 -62" fill="none" stroke="#7a4a20" stroke-width="5"/>
          <path d="M-110 -22 V-62 M110 -22 V-62" fill="none" stroke="${K}" stroke-width="1.5"/>
        </g>
        ${[[300,350,'#ff6a8a'],[330,356,'#ffd000'],[360,348,'#ffffff'],[270,354,'#8a5ab8'],[60,470,'#ff6a8a'],[90,480,'#ffd000'],[340,480,'#ffffff']].map(([x, y, c]) => flower(x, y, c)).join('')}
        ${[[30,340],[380,332]].map(([x, y]) => `<g transform="translate(${x},${y})"><rect x="-10" y="-6" width="20" height="10" rx="5" fill="#c84a3a"/><path d="M-8 4 V12 M8 4 V12" fill="none" stroke="${K}" stroke-width="2"/><circle class="ns" cx="-4" cy="-2" r="1.6" fill="#fff"/><circle class="ns" cx="4" cy="-3" r="1.6" fill="#fff"/></g>`).join('')}`);
    },
    // ルークとアリカの時計台：大きな文字盤、歯車、鐘、はしご
    clock(){
      return wrap(sky('scWallC', '#c9b49a', '#a8906e') + brickPattern('scBrC', '#b9875a', '#c49464', '#a87a4e'),
        `<rect class="ns" width="400" height="800" fill="url(#scBrC)"/>
        <rect x="-10" y="40" width="420" height="16" fill="#7a4a2a"/><rect x="-10" y="430" width="420" height="16" fill="#7a4a2a"/>
        <rect x="40" y="40" width="16" height="400" fill="#7a4a2a"/><rect x="344" y="40" width="16" height="400" fill="#7a4a2a"/>
        <g transform="translate(200,200)">
          <circle cx="0" cy="0" r="120" fill="#c89a3a"/><circle cx="0" cy="0" r="106" fill="#fffbe8"/>
          ${Array.from({length:12}, (_, i) => { const a = i / 12 * Math.PI * 2 - Math.PI / 2; return `<text x="${r1(Math.cos(a)*86)}" y="${r1(Math.sin(a)*86 + 6)}" text-anchor="middle" font-size="16" font-weight="900" fill="${K}">${['XII','I','II','III','IIII','V','VI','VII','VIII','IX','X','XI'][i]}</text>`; }).join('')}
          <path d="M0 0 L-4 -70 L0 -78 L4 -70 Z" fill="${K}"/><path d="M0 0 L46 30 L52 36 L42 34 Z" fill="${K}"/><circle cx="0" cy="0" r="7" fill="#c89a3a"/>
        </g>
        <g class="spin1">${gear(70, 120, 34, 10, '#c8a050')}</g><g class="spin2">${gear(338, 100, 26, 8, '#a8a8b8')}</g><g class="spin1">${gear(350, 330, 40, 12, '#c8a050')}</g><g class="spin2">${gear(54, 340, 28, 9, '#a8a8b8')}</g>
        <g transform="translate(200,30)"><path d="M-26 0 Q-26 -30 0 -32 Q26 -30 26 0 L32 10 H-32 Z" fill="#e0b040"/><circle cx="0" cy="16" r="6" fill="#a87a2a"/></g>
        <g transform="translate(300,446)">${[0,1,2,3,4,5,6].map(i => `<rect x="${i*14}" y="${-i*12}" width="80" height="12" fill="#8a5a32"/>`).join('')}</g>
        <rect x="-10" y="446" width="420" height="360" fill="#6a4a32"/>${[0,1,2,3,4,5].map(i => `<path d="M-10 ${470 + i*30} H410" fill="none" stroke="${K}" stroke-width="2"/>`).join('')}`);
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
        <g transform="translate(200,400)"><path d="M-12 0 L12 0 L18 70 H-18 Z" fill="#8a5a32"/><path d="M-46 0 L46 0 L36 -18 L-36 -18 Z" fill="#a8743c"/>
          <path d="M-40 -18 Q-20 -30 0 -20 Q20 -30 40 -18 L40 -14 Q20 -26 0 -16 Q-20 -26 -40 -14 Z" fill="#fff7ea"/><path d="M0 -20 V-16" fill="none" stroke="${K}" stroke-width="1.5"/></g>
        <g transform="translate(118,250) rotate(8)"><rect x="-4" y="0" width="6" height="220" fill="#a8743c"/><rect x="26" y="0" width="6" height="220" fill="#a8743c"/>${[20,50,80,110,140,170,200].map(y => `<rect x="-2" y="${y}" width="32" height="5" fill="#a8743c"/>`).join('')}</g>
        <rect x="-10" y="460" width="420" height="340" fill="#8a5a3a"/>${[0,1,2,3,4,5].map(i => `<path d="M-10 ${485 + i*30} H410" fill="none" stroke="${K}" stroke-width="2"/>`).join('')}
        <g transform="translate(330,470)"><rect x="-8" y="-24" width="16" height="24" fill="#fff7ea"/><path class="ns flame" d="M0 -40 Q-6 -30 0 -24 Q6 -30 0 -40 Z" fill="#ffb020"/></g>`);
    },
    // 中央広場：噴水、旗のガーランド、まわりの家、奥に時計台と絵本の門
    plaza(){
      const flags = Array.from({length:13}, (_, i) => { const x = i * 34 - 6, y = 120 + Math.sin(i / 12 * Math.PI) * 26; return `<path d="M${r1(x)} ${r1(y)} l12 0 l-6 14 Z" fill="${['#e8101e','#ffd000','#1e5aff','#10c050','#ff6a8a'][i % 5]}"/>`; }).join('');
      return wrap(sky('scSkyP', '#7fc6ff', '#e6f6ff') + brickPattern('scBrP', '#e08a5a', '#e99a68', '#d4784a'),
        `<rect class="ns" width="400" height="800" fill="url(#scSkyP)"/>
        ${cloud(40, 40, 0.8)}${cloud(300, 30, 0.7)}
        <g transform="translate(200,150)"><rect x="-22" y="-70" width="44" height="150" fill="#f3e2c0"/><path d="M-30 -66 L0 -110 L30 -66 Z" fill="#5a6ab8"/>
          <circle cx="0" cy="-40" r="15" fill="#fffdf0"/><path d="M0 -40 V-50 M0 -40 L7 -36" fill="none" stroke="${K}" stroke-width="2"/></g>
        ${house(-20, 190, 70, 70, '#e2687e', '#fff1d6', {chimney:true, flowers:true})}${house(60, 210, 54, 52, '#ffb020', '#f6ecd8')}${house(280, 206, 56, 56, '#4f9a4a', '#fff7ea', {flowers:true})}${house(342, 186, 70, 74, '#3f6fb0', '#fff1d6', {chimney:true})}
        <path d="M-10 120 Q200 170 410 120" fill="none" stroke="${K}" stroke-width="1.5"/>${flags}
        <rect x="-10" y="262" width="420" height="540" fill="url(#scBrP)"/><path d="M-10 262 H410" fill="none" stroke="${K}" stroke-width="2"/>
        <g transform="translate(200,330)">
          <ellipse cx="0" cy="40" rx="120" ry="30" fill="#b8b2a6"/><ellipse cx="0" cy="34" rx="104" ry="22" fill="#5aa8e8"/>
          <rect x="-10" y="-30" width="20" height="64" fill="#cfc8bb"/><ellipse cx="0" cy="-30" rx="34" ry="9" fill="#cfc8bb"/>
          <path class="ns water" d="M0 -40 Q-30 -70 -50 20 M0 -40 Q30 -70 50 20 M0 -40 Q-10 -80 -22 10 M0 -40 Q10 -80 22 10" fill="none" stroke="#bfe4ff" stroke-width="4" stroke-linecap="round"/>
        </g>
        ${[[40,300],[360,300]].map(([x, y]) => `<g transform="translate(${x},${y})"><rect x="-3" y="-60" width="6" height="70" fill="#3a3a4a"/><circle cx="0" cy="-64" r="10" fill="#ffe08a"/></g>`).join('')}
        ${[[60,420,'#ff6a8a'],[80,430,'#ffd000'],[320,424,'#8a5ab8'],[344,432,'#ff6a8a']].map(([x, y, c]) => flower(x, y, c)).join('')}`);
    }
  };
  window.IWScenes = {has: bg => !!ART[bg], art: bg => ART[bg] ? ART[bg]() : ''};
})();
