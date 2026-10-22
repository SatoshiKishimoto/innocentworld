/* =========================================================
   自分の部屋（夜）：物語の導入と帰還で共通の絵
   ・同じ視点・同じ家具の配置：左に本棚、奥に窓（レースのカーテン越しに月と星）、右にベッド、手前の机にランプと絵本
   ・絵本の状態：locked（留め金つきで閉じている）／unlocking（留め金が外れる）／closed（閉じている）／
                 opening（ひらいてページがめくれる）／open（ひらいている）／glow（ページが光る）／none（なし）
   ・レースのカーテン：closed（閉じている＝月と星が透けて見える）／opening（いま開く）／open（開いている）
   ・窓の外の住人（帰還）：friends＝住人IDの配列、leaving＝星になって帰っていく
   ・机の上の記念の品：memento＝{html}（アイテムの絵）
   iPhone の Safari でも同じに見えるよう、SVG の要素には CSS の filter を使わず、動きは opacity と transform だけにしています
   ========================================================= */
(function(){
  'use strict';
  const INK = '#3a2418';            // 線の色（黒ではなく、こげ茶でやわらかく）
  const st = (w) => `stroke="${INK}" stroke-width="${w || 1.6}" stroke-linejoin="round" stroke-linecap="round"`;
  const star4 = r => `M0 ${-r} L${r * .3} ${-r * .3} L${r} 0 L${r * .3} ${r * .3} L0 ${r} L${-r * .3} ${r * .3} L${-r} 0 L${-r * .3} ${-r * .3} Z`;

  function defs(){
    return `<defs>
      <linearGradient id="rmWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#232a62"/><stop offset=".55" stop-color="#34306e"/><stop offset="1" stop-color="#2a2552"/></linearGradient>
      <pattern id="rmPaper" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M17 6 l2 4 4 1-4 1-2 4-2-4-4-1 4-1z" fill="rgba(255,236,190,.035)"/></pattern>
      <linearGradient id="rmSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1240"/><stop offset=".7" stop-color="#253a8a"/><stop offset="1" stop-color="#4a5aa8"/></linearGradient>
      <radialGradient id="rmMoonGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(255,246,200,.55)"/><stop offset="1" stop-color="rgba(255,246,200,0)"/></radialGradient>
      <linearGradient id="rmWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b47a46"/><stop offset="1" stop-color="#7e4e28"/></linearGradient>
      <linearGradient id="rmWoodD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5632"/><stop offset="1" stop-color="#5a341a"/></linearGradient>
      <linearGradient id="rmFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4028"/><stop offset="1" stop-color="#3e2414"/></linearGradient>
      <radialGradient id="rmLamp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(255,214,130,.62)"/><stop offset=".45" stop-color="rgba(255,190,110,.22)"/><stop offset="1" stop-color="rgba(255,190,110,0)"/></radialGradient>
      <radialGradient id="rmBookGlow" cx="50%" cy="60%" r="55%"><stop offset="0" stop-color="rgba(255,248,210,.95)"/><stop offset=".5" stop-color="rgba(255,226,150,.45)"/><stop offset="1" stop-color="rgba(255,226,150,0)"/></radialGradient>
      <linearGradient id="rmDrape" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8506a"/><stop offset=".5" stop-color="#d9708a"/><stop offset="1" stop-color="#a84460"/></linearGradient>
      <pattern id="rmLace" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="rgba(250,246,240,.13)"/><circle cx="15" cy="15" r="7" fill="none" stroke="rgba(255,255,255,.32)" stroke-width=".8"/><path d="M15 9 l1.4 4.6 4.6 1.4-4.6 1.4-1.4 4.6-1.4-4.6-4.6-1.4 4.6-1.4z" fill="rgba(255,255,255,.22)"/><circle cx="0" cy="0" r="2.4" fill="none" stroke="rgba(255,255,255,.25)" stroke-width=".7"/><circle cx="30" cy="30" r="2.4" fill="none" stroke="rgba(255,255,255,.25)" stroke-width=".7"/></pattern>
      <linearGradient id="rmCover" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6a5a"/><stop offset="1" stop-color="#1c4238"/></linearGradient>
      <linearGradient id="rmPage" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f4e8cf"/><stop offset=".85" stop-color="#fff8e8"/><stop offset="1" stop-color="#e2d2b2"/></linearGradient>
      <linearGradient id="rmQuilt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a74c8"/><stop offset="1" stop-color="#3a4e9a"/></linearGradient>
      <clipPath id="rmWin"><path d="M128 300 V150 Q128 86 200 86 Q272 86 272 150 V300 Z"/></clipPath>
      <filter id="rmTone" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values=".86"/><feColorMatrix type="matrix" values="1.02 .03 0 0 .012  .02 .99 .01 0 .006  0 .02 .9 0 0  0 0 0 1 0"/><feComponentTransfer><feFuncR type="linear" slope=".95" intercept=".03"/><feFuncG type="linear" slope=".95" intercept=".025"/><feFuncB type="linear" slope=".95" intercept=".01"/></feComponentTransfer></filter>
      <filter id="rmGlowF" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 .97  0 0 0 0 .82  0 0 0 1 0"/><feGaussianBlur stdDeviation="2.5"/></filter>
    </defs>`;
  }

  /* 窓：夜空・月・星（レースのカーテン越しにも見える） */
  function windowSky(){
    const stars = [[150,120],[176,168],[214,108],[262,182],[188,214],[232,236],[160,250],[250,140],[206,160],[146,200]]
      .map(([x, y], i) => `<g transform="translate(${x} ${y})"><path class="rtw" style="animation-delay:${(i * .41).toFixed(2)}s" d="${star4(i % 3 ? 2.6 : 3.8)}" fill="#fff6cf"/></g>`).join('');
    return `<g clip-path="url(#rmWin)">
      <rect x="120" y="80" width="160" height="230" fill="url(#rmSky)"/>
      <circle cx="238" cy="132" r="44" fill="url(#rmMoonGlow)"/>
      <path d="M238 110 a22 22 0 1 0 18 34 a18 18 0 1 1 -18 -34 z" fill="#fff3c4"/>
      ${stars}
      <path d="M120 280 Q150 262 182 272 Q214 284 246 266 Q266 258 280 266 V310 H120 Z" fill="#1d2a5c"/>
      <path d="M120 292 Q160 280 200 290 Q240 300 280 286 V310 H120 Z" fill="#16204a"/>
      ${[[150,276],[170,282],[236,272],[256,276]].map(([x, y]) => `<rect x="${x}" y="${y}" width="3" height="4" fill="#ffd77a"/>`).join('')}
    </g>`;
  }

  /* 窓の外の住人（帰還）。leaving：まわりで星がまたたき、光に包まれて薄れ、星になってのぼる */
  function windowFriends(o, noShift){
    const ids = (o.friends || []).slice(0, 3); if(!ids.length || o.lace === 'closed') return '';
    const n = ids.length, Wn = o.win || [128, 80, 272, 294], ww = Wn[2] - Wn[0];
    const w = ww * (n === 1 ? .76 : n === 2 ? .64 : .49), gap = (ww - w * n) / (n + 1) + (n > 1 ? w * .12 : 0);
    const xs = ids.map((_, i) => n === 1 ? Wn[0] + (ww - w) / 2 : Wn[0] + (ww - (w * n - w * .24 * (n - 1))) / 2 + i * w * .76);
    const y = Wn[3] - 140 + (o.win ? -2 : 0);
    const tone = (window.IW_ART || {}).characterTone ? ' filter="url(#rmTone)"' : '';   // Safari でも効くよう、SVG のフィルターで色味を調整
    const imgs = ids.map((id, i) => `<image class="wave ${i % 2 ? 'r' : 'l'}"${tone} href="${o.img(id)}" x="${xs[i].toFixed(1)}" y="${o.win ? y : 212}" width="${w.toFixed(1)}" height="140" preserveAspectRatio="xMidYMax meet"/>`).join('');
    const leaving = !!o.leaving;
    const sparks = leaving ? Array.from({length:18}, (_, i) => { const x = 132 + ((i * 41) % 140), y = 214 + ((i * 29) % 100), d = ((i * .13) % 1.3).toFixed(2), r = 6 + (i % 3) * 3;
      return `<g transform="translate(${x} ${y})"><path class="ns spk" style="animation-delay:${d}s" d="${star4(r)}" fill="#fff6c8"/></g>`; }).join('') : '';
    const rise = leaving ? Array.from({length:22}, (_, i) => { const x = 134 + ((i * 37) % 132), y = 230 + ((i * 53) % 70), d = (1.3 + (i % 7) * .22).toFixed(2);
      return `<g transform="translate(${x} ${y})"><path class="ns rise r${i % 5}" style="animation-delay:${d}s" d="${star4(i % 3 ? 4.5 : 6.5)}" fill="#fff6c8"/></g>`; }).join('') : '';
    const cls = o.lace === 'opening' ? 'friendsIn' : leaving ? 'friendsOut' : '';
    return `<g clip-path="url(#${noShift === 0 ? 'rmWin0' : 'rmWin'})"><g class="${cls}">${imgs}</g>${leaving ? `<g class="friendsGlow" filter="url(#rmGlowF)">${imgs}</g>${sparks}${rise}` : ''}</g>`;
  }

  /* レースのカーテン（薄くて、閉じていても月と星が透けて見える）と、両わきの厚手のカーテン */
  function curtains(lace){
    const cls = lace === 'closed' ? 'closed' : lace === 'opening' ? 'opening' : '';
    const hem = (x0, x1) => { let d = ''; for(let x = x0; x < x1; x += 10) d += ` Q${x + 5} 312 ${x + 10} 304`; return d; };
    const laceL = `<g class="lace l ${cls}"><path d="M128 86 H200 V304 L128 304 Z" fill="url(#rmLace)"/><path d="M128 304${hem(128, 200)}" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.4"/>
      ${[140, 158, 176, 192].map(x => `<path d="M${x} 90 Q${x + 3} 200 ${x - 2} 302" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2"/>`).join('')}</g>`;
    const laceR = `<g class="lace r ${cls}"><path d="M200 86 H272 V304 L200 304 Z" fill="url(#rmLace)"/><path d="M200 304${hem(200, 272)}" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.4"/>
      ${[208, 224, 242, 260].map(x => `<path d="M${x} 90 Q${x - 3} 200 ${x + 2} 302" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2"/>`).join('')}</g>`;
    const drape = side => { const x = side < 0 ? 96 : 304, dir = side;
      return `<path d="M${x} 66 Q${x - dir * 30} 66 ${x - dir * 34} 72 Q${x - dir * 18} 190 ${x - dir * 30} 250 Q${x - dir * 14} 300 ${x - dir * 26} 360 L${x} 360 Z" fill="url(#rmDrape)" ${st(1.4)}/>
        <path d="M${x - dir * 22} 236 Q${x - dir * 8} 246 ${x} 240" fill="none" stroke="#f4c86a" stroke-width="4" stroke-linecap="round"/>`; };
    return `<g clip-path="url(#rmWin)">${laceL}${laceR}</g>
      <path d="M200 86 V300 M128 196 H272" fill="none" stroke="#6a3e22" stroke-width="5"/>
      <path d="M128 300 V150 Q128 86 200 86 Q272 86 272 150 V300 Z" fill="none" stroke="#8a5a32" stroke-width="9"/><path d="M128 300 V150 Q128 86 200 86 Q272 86 272 150 V300 Z" fill="none" ${st(1.4)}/>
      <rect x="116" y="298" width="168" height="12" rx="4" fill="url(#rmWood)" ${st(1.4)}/>
      <rect x="78" y="58" width="244" height="8" rx="4" fill="#c89a5a" ${st(1.2)}/>
      ${drape(-1)}${drape(1)}`;
  }

  function bookshelf(){
    const books = Array.from({length:21}, (_, i) => { const row = Math.floor(i / 7), k = i % 7, x = 14 + k * 11, h = 50 + ((i * 7) % 4) * 6, c = ['#c8506a','#4a62b0','#e8b030','#3f8a5a','#b84a3a','#7a52a8','#d97a3a'][(i + row) % 7];
      return `<rect x="${x}" y="${262 + row * 92 + (66 - h)}" width="10" height="${h}" rx="1.5" fill="${c}" ${st(1)}/><rect x="${x + 2}" y="${262 + row * 92 + (66 - h) + 8}" width="6" height="2" fill="rgba(255,236,170,.7)"/>`; }).join('');
    return `<g><rect x="4" y="222" width="94" height="360" rx="4" fill="url(#rmWoodD)" ${st()}/><rect x="10" y="230" width="82" height="344" fill="#3e2414"/>
      ${[0, 1, 2, 3].map(r => `<rect x="10" y="${326 + r * 92}" width="82" height="7" fill="#8a5632" ${st(1)}/>`).join('')}${books}</g>`;
  }

  function bed(){
    return `<g>
      <path d="M318 360 Q318 318 360 318 Q402 318 402 360 V470 H318 Z" fill="url(#rmWood)" ${st()}/>
      <path d="M330 362 Q330 332 360 332 Q392 332 392 362 V470 H330 Z" fill="#6a4026"/>
      <ellipse cx="368" cy="420" rx="34" ry="14" fill="#f6efe2" ${st(1.2)}/>
      <path d="M306 446 Q340 430 404 438 V600 H300 Q296 520 306 446 Z" fill="url(#rmQuilt)" ${st()}/>
      ${[[316,470],[350,462],[384,466],[326,520],[364,512],[340,566],[384,560]].map(([x, y], i) => `<g transform="translate(${x} ${y})"><path d="${star4(i % 2 ? 5 : 7)}" fill="#ffe08a" opacity=".85"/></g>`).join('')}
      <path d="M300 600 Q296 520 306 446" fill="none" stroke="#2a3a7a" stroke-width="3"/>
    </g>`;
  }

  /* 絵本（ブックスタンドに立てて置く）。表紙の絵は飾りだけ（正式なロゴ画像をいただいたら、そのまま表紙にのせる） */
  function book(state){
    if(state === 'none') return '';
    const stand = `<path d="M150 446 L200 436 L250 446" fill="none" stroke="#5a341a" stroke-width="5" stroke-linecap="round"/>`;
    if(state === 'locked' || state === 'unlocking' || state === 'closed'){
      const lock = state === 'closed' ? '' : `<g class="rclasp ${state === 'unlocking' ? 'open' : ''}">
          <path d="M262 368 H240 Q234 368 234 374 V392 Q234 398 240 398 H262" fill="#7a4a24" ${st(1.4)}/>
          <g transform="translate(236 383)"><rect x="-13" y="-15" width="26" height="30" rx="5" fill="#f2c45a" ${st(1.4)}/><rect x="-9" y="-11" width="18" height="22" rx="3" fill="none" stroke="#b8862a" stroke-width="1.2"/>
            <circle cx="0" cy="-2" r="3.2" fill="#3a2418"/><path d="M-1.6 0 L1.6 0 L2.4 7 L-2.4 7 Z" fill="#3a2418"/></g></g>`;
      return `<g class="rbook">${stand}
        <rect x="150" y="300" width="104" height="142" rx="6" fill="#5a2a1a" ${st()}/>
        <rect x="146" y="296" width="104" height="142" rx="6" fill="url(#rmCover)" ${st()}/>
        <rect x="156" y="306" width="84" height="122" rx="4" fill="none" stroke="#e8c46a" stroke-width="2"/>
        <rect x="160" y="310" width="76" height="114" rx="3" fill="none" stroke="#e8c46a" stroke-width=".8" opacity=".7"/>
        ${[[160,310],[236,310],[160,424],[236,424]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="${star4(5)}" fill="#f2c45a"/></g>`).join('')}
        <g transform="translate(198 360)"><circle r="26" fill="rgba(255,226,140,.16)" stroke="#e8c46a" stroke-width="1.6"/>
          <path d="M-14 8 V-4 L0 -16 L14 -4 V8 Z" fill="#c8643c" ${st(1.2)}/><path d="M-17 -2 L0 -18 L17 -2" fill="none" stroke="#e8c46a" stroke-width="2.4" stroke-linejoin="round"/>
          <rect x="-4" y="-1" width="8" height="9" rx="4" fill="#3a2418"/><g transform="translate(0 -26)"><path d="${star4(6)}" fill="#fff3c4"/></g></g>
        ${(window.IW_ART || {}).logo ? `<image href="${window.IW_ART.logo}" x="156" y="396" width="84" height="24" preserveAspectRatio="xMidYMid meet"/>` : `<path d="M168 404 H228 M176 412 H220" stroke="#e8c46a" stroke-width="2" stroke-linecap="round" opacity=".8"/>`}
        ${lock}</g>`;
    }
    // ひらいた絵本：左のページに村の絵、右のページに文
    const village = `<g transform="translate(152 330)">
        <rect x="0" y="0" width="86" height="72" rx="3" fill="#bfe3ff"/><path d="M0 52 Q30 40 86 48 V72 H0 Z" fill="#7ccc6a"/>
        <g class="rvmill" transform="translate(66 34)"><rect x="-4" y="0" width="8" height="18" fill="#fff6e6" ${st(1)}/><g class="rblades"><path d="M0 0 L-2 -16 L2 -16 Z M0 0 L16 -2 L16 2 Z M0 0 L2 16 L-2 16 Z M0 0 L-16 2 L-16 -2 Z" fill="#fff" ${st(.8)}/></g></g>
        ${[[10,36,'#e2687e'],[30,40,'#f2b23a'],[44,34,'#5a74c8']].map(([x, y, c]) => `<path d="M${x} ${y + 14} V${y + 4} L${x + 7} ${y - 3} L${x + 14} ${y + 4} V${y + 14} Z" fill="#f6e2c4" ${st(.8)}/><path d="M${x - 1} ${y + 5} L${x + 7} ${y - 4} L${x + 15} ${y + 5}" fill="${c}" ${st(.8)}/><rect class="rwinlight" x="${x + 5}" y="${y + 6}" width="4" height="4" fill="#ffd77a"/>`).join('')}
        <g transform="translate(26 14)"><rect x="-4" y="-2" width="8" height="22" fill="#e8c8a0" ${st(.8)}/><circle cx="0" cy="2" r="4" fill="#fff" ${st(.6)}/><path class="rhand" d="M0 2 V-1" stroke="#3a2418" stroke-width="1"/></g>
      </g>`;
    const glow = state === 'glow';
    return `<g class="rbook">${stand}
      ${glow ? `<ellipse class="rbglow" cx="200" cy="372" rx="150" ry="120" fill="url(#rmBookGlow)"/>` : ''}
      <path d="M200 324 Q176 314 142 318 V440 Q176 436 200 446 Z" fill="url(#rmPage)" ${st()}/>
      <path d="M200 324 Q224 314 258 318 V440 Q224 436 200 446 Z" fill="url(#rmPage)" ${st()}/>
      ${village}
      ${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${210} ${342 + i * 14} H${246 - (i % 2) * 8}" stroke="#b8a888" stroke-width="2" stroke-linecap="round"/>`).join('')}
      <path d="M200 324 V446" stroke="#c8b48c" stroke-width="1.6"/>
      ${state === 'opening' ? `<path class="rflip" d="M200 324 Q224 314 258 318 V440 Q224 436 200 446 Z" fill="#fff8e8" ${st(1.2)}/>` : ''}
      ${glow ? Array.from({length:10}, (_, i) => `<g transform="translate(${160 + (i * 29) % 84} ${330 + (i * 37) % 100})"><path class="rmote" style="animation-delay:${(i * .27).toFixed(2)}s" d="${star4(i % 3 ? 3 : 5)}" fill="#fff6c8"/></g>`).join('') : ''}
    </g>`;
  }

  function desk(o){
    return `<g>
      <ellipse class="ns" cx="128" cy="400" rx="130" ry="110" fill="url(#rmLamp)"/>
      <rect x="84" y="446" width="232" height="18" rx="4" fill="url(#rmWood)" ${st()}/>
      <rect x="92" y="464" width="216" height="26" fill="#7a4a26" ${st(1.4)}/><rect x="182" y="470" width="36" height="12" rx="3" fill="#5a341a"/><circle cx="200" cy="476" r="2.4" fill="#e8c46a"/>
      <rect x="96" y="490" width="12" height="112" fill="url(#rmWoodD)" ${st(1.4)}/><rect x="292" y="490" width="12" height="112" fill="url(#rmWoodD)" ${st(1.4)}/>
      <g><ellipse cx="116" cy="446" rx="18" ry="4" fill="#4a2c16"/><path d="M116 446 V404" stroke="#4a2c16" stroke-width="4"/>
        <path d="M94 406 L138 406 L128 376 L104 376 Z" fill="#ffd27a" ${st(1.4)}/><path d="M100 400 H132" stroke="#f0a84a" stroke-width="2"/></g>
    </g>`;
  }

  /* 部屋の絵ぜんたい。o = {book, lace, friends, leaving, memento, mementoAt, img} */
  /* 正式なイラスト（story/art/manifest.js の IW_ART）。どれも 1200×2400 の同じキャンバスで、viewBox 400×800 にぴったり重ねる */
  const ART = () => window.IW_ART || {};
  const layer = (href, cls) => href ? `<image ${cls ? `class="${cls}" ` : ''}href="${href}" x="0" y="0" width="400" height="800" preserveAspectRatio="none"/>` : '';
  // 窓の開口（400×800 の目安の座標で [左, 上, 右, 下]）。画像の窓に合わせて manifest の room.window で変えられる
  const winRect = () => ((ART().room || {}).window) || [128, 80, 272, 294];
  function winClip(){ const [x1, y1, x2, y2] = winRect(), r = (x2 - x1) / 2; return `<clipPath id="rmWin0"><path d="M${x1} ${y2} V${y1 + r} A${r} ${r} 0 0 1 ${x2} ${y1 + r} V${y2} Z"/></clipPath>`; }
  function laceImg(lace){
    const R = ART().room || {}; if(!R.laceLeft && !R.laceRight) return null;
    const cls = lace === 'closed' ? 'closed' : lace === 'opening' ? 'opening' : '', [x1, , x2] = winRect();
    return `<g class="lace l ${cls}" style="transform-origin:${x1}px 0">${layer(R.laceLeft)}</g><g class="lace r ${cls}" style="transform-origin:${x2}px 0">${layer(R.laceRight)}</g>`;
  }
  /* 正式ロゴ：表紙の余白（manifest の book.logoAt）に、原本の縦横比のまま縮小して載せる（加工はしない） */
  function logoImg(B){
    const L = ART().logo, at = B.logoAt; if(!L || !at) return '';
    return `<image href="${L}" x="${at[0]}" y="${at[1]}" width="${at[2] - at[0]}" height="${at[3] - at[1]}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  function bookImg(state){
    const B = ART().book || {}; if(state === 'none') return '';
    if(/^(locked|unlocking|closed)$/.test(state) && B.closed)
      return `<g class="rbook">${layer(B.closed)}${logoImg(B)}${state !== 'closed' && B.clasp ? `<g class="rclasp ${state === 'unlocking' ? 'open' : ''}">${layer(B.clasp)}</g>` : ''}</g>`;
    if(/^(opening|open|glow)$/.test(state) && B.open){
      const glow = state === 'glow';
      return `<g class="rbook">${glow ? `<ellipse class="rbglow" cx="200" cy="372" rx="150" ry="120" fill="url(#rmBookGlow)"/>` : ''}${layer(B.open, state === 'opening' ? 'rbookfade' : '')}
        ${glow ? Array.from({length:10}, (_, i) => `<g transform="translate(${160 + (i * 29) % 84} ${330 + (i * 37) % 100})"><path class="rmote" style="animation-delay:${(i * .27).toFixed(2)}s" d="${star4(i % 3 ? 3 : 5)}" fill="#fff6c8"/></g>`).join('') : ''}</g>`;
    }
    return null;
  }
  function art(o){
    o = Object.assign({book:'closed', lace:'closed', friends:[], img: id => '../characters2/' + id + '.png'}, o || {});
    const R = ART().room || {};
    // 1) 部屋のぜんたい（画像があれば画像。なければアプリが描く仮の絵）
    const base = R.base ? layer(R.base) : `<rect width="400" height="800" fill="url(#rmWall)"/><rect width="400" height="800" fill="url(#rmPaper)"/>
      <rect y="584" width="400" height="216" fill="url(#rmFloor)"/>${[612, 648, 690, 740].map(y => `<path d="M0 ${y} H400" stroke="rgba(0,0,0,.22)" stroke-width="2"/>`).join('')}
      <path d="M0 584 H400" stroke="#2a1a10" stroke-width="3"/>
      <ellipse cx="200" cy="640" rx="150" ry="26" fill="#7a3a4a" opacity=".55"/>`;
    // 2) 窓：夜空 → 窓の外の住人 → レースのカーテン → 窓わく（画像の窓は、ガイドの窓の位置に合わせて描く）
    const lace = laceImg(o.lace);
    const win = R.base
      ? `${windowFriends(Object.assign({win: winRect()}, o), 0)}${lace !== null ? `<g clip-path="url(#rmWin0)">${lace}</g>` : ''}${layer(R.frame)}`
      : `<g transform="translate(0 -6)">${windowSky()}${windowFriends(o)}${curtains(o.lace)}</g>`;
    const furniture = R.base ? '' : `${bookshelf()}${bed()}${desk(o)}`;
    const bk = bookImg(o.book);
    return `<svg class="sbgart sroom" viewBox="0 0 400 800" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${defs()}
      ${winClip()}
      ${base}${win}${furniture}${bk !== null ? bk : book(o.book)}
      ${o.memento ? `<g class="rmemento" transform="translate(${o.mementoAt || R.mementoAt || '282 418'})">${o.memento}</g>` : ''}
    </svg>`;
  }
  window.IWRoom = {art};
})();
