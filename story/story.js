/* =========================================================
   レンガ村の物語（スマホ側）
   ・住民登録／住民票／復元コード
   ・入口のひみつのことば → 村の地図 → 施設のひみつのことば → 物語 → エンディング（ARは別画面）
   ・ことばの判定と物語本文は Google Apps Script（story/config.js の api）から受け取ります。
     このファイルには、正解のことばも物語本文も入っていません。
   ========================================================= */
(function(){
  'use strict';
  const CFG = window.STORY_CONFIG || {};
  // テスト用：自分のパソコン（localhost）で開いたときだけ ?api= で接続先を変えられる
  const API = (() => { try{ const q = new URLSearchParams(location.search).get('api'); if(q && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return q; }catch(e){} return CFG.api || ''; })();
  const AR_URL = CFG.arUrl || '../index.html';
  const KEY = 'iw_story_v2';
  const $ = id => document.getElementById(id);
  const app = $('app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* ---------- スマホ内の保存（控え） ---------- */
  function emptyState(){ return {points:{}, flags:{}, items:{}, done:{}, introSeen:{}}; }
  function fresh(){ return {rid:'', token:'', recovery:'', resident:null, state:emptyState(), outbox:[], defs:null, day:null, today:'', visits:[], returning:false, unlocked:null, map:null, stories:{}, intro:null}; }
  let L = load();
  function load(){ try{ const v = JSON.parse(localStorage.getItem(KEY)); if(v && typeof v === 'object') return Object.assign(fresh(), v); }catch(e){} return fresh(); }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(L)); }catch(e){} }
  const defs = () => L.defs || {items:{}, points:{}, characters:{}, regfields:[]};

  /* ---------- 通信 ---------- */
  let busyN = 0;
  function loading(on){
    busyN += on ? 1 : -1;
    let el = $('svLoading');
    if(busyN > 0 && !el){ el = document.createElement('div'); el.id = 'svLoading'; el.className = 'sloading'; el.innerHTML = '<div><span></span>通信しています…</div>'; document.body.appendChild(el); }
    if(busyN <= 0 && el){ busyN = 0; el.remove(); }
  }
  async function api(action, data, opt){
    opt = opt || {};
    if(!API) throw Object.assign(new Error('noapi'), {code:'noapi'});
    const body = Object.assign({action}, data || {});
    const authed = !['config', 'register', 'restore'].includes(action);
    let sent = [];
    if(authed){ body.rid = L.rid; body.token = L.token; sent = L.outbox.slice(0, 200); body.events = sent; body.state = L.state; }
    if(!opt.quiet) loading(true);
    try{
      for(let tryNo = 0; ; tryNo++){
        try{
          const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 25000);
          // Content-Type を付けない（text/plain）＝ GAS が対応していない事前確認（CORS preflight）を起こさない
          const r = await fetch(API, {method:'POST', body:JSON.stringify(body), signal:ctl.signal, redirect:'follow'});
          clearTimeout(timer);
          const j = await r.json();
          if(j.ok && sent.length){ L.outbox = L.outbox.slice(sent.length); save(); }
          if(j.error === 'auth') onAuthLost();
          return j;
        }catch(e){
          if(tryNo >= 1) throw Object.assign(new Error('network'), {code:'network'});
          await new Promise(r => setTimeout(r, 1200));
        }
      }
    } finally { if(!opt.quiet) loading(false); }
  }
  function push(ev){ L.outbox.push(Object.assign({at:stamp(), date:L.today, event:L.day && L.day.event}, ev)); save(); }
  function stamp(){ const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }
  let syncT = 0;
  function syncSoon(){ clearTimeout(syncT); syncT = setTimeout(() => { if(L.rid && L.outbox.length) api('sync', {}, {quiet:true}).catch(() => {}); }, 1500); }
  window.addEventListener('online', syncSoon);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden' && L.rid && L.outbox.length && navigator.sendBeacon && API){
    try{ const b = {action:'sync', rid:L.rid, token:L.token, events:L.outbox.slice(0, 200), state:L.state}; if(navigator.sendBeacon(API, new Blob([JSON.stringify(b)], {type:'text/plain'}))) { /* 次回の通信でも念のため送り直す */ } }catch(e){} } });

  function onAuthLost(){ L.rid = ''; L.token = ''; save(); }
  function errText(j){
    const m = {
      wrong:'ことばがちがうみたい。掲示をもう一度見てみてね。', wait:'まちがいが続いたので、5分ほど待ってからもう一度入力してください。',
      closed:'今日はレンガ村はお休みです。', no_word:'今日は、ここの物語はお休みです。', entrance_first:'先に、入口のひみつのことばを入力してください。',
      hidden:'まだ道がひらいていません。', auth:'住民票が確認できませんでした。', busy:'混み合っています。少し待ってからもう一度お試しください。',
      not_found:'その復元コードは見つかりませんでした。', bad_code:'復元コードは12文字です（ハイフンはなくても大丈夫）。', required:'必須の項目を入力してください。',
      server:'サーバーでエラーが起きました。少し待ってからもう一度お試しください。', network:'通信できませんでした。電波のよい場所で、もう一度お試しください。',
      noapi:'サーバーの設定がまだです（story/config.js）。'
    };
    return (j && (j.hint || m[j.error || j.code])) || m.server;
  }

  /* ---------- 画面の部品 ---------- */
  function charImg(k){ return '../characters2/' + encodeURIComponent(k) + '.png'; }
  function cname(k){ return defs().characters[k] || k; }
  function cnameEn(k){ return (defs().charactersEn || {})[k] || ''; }
  // セリフの差し込み：{name}（または {住民名}）＝住民名。ほかの登録項目も {項目ID} で差し込めます
  function fill(t){
    const r = L.resident, f = (r && r.fields) || {}, regs = defs().regfields || [];
    const nameF = regs.find(x => x.type === 'text');
    return String(t == null ? '' : t).replace(/\{(name|住民名|[A-Za-z_][A-Za-z0-9_]*)\}/g, (m, k) => {
      if(k === 'name' || k === '住民名') return f.name || (nameF && f[nameF.id]) || 'あなた';
      if(!(k in f)) return m;
      const rf = regs.find(x => x.id === k);
      return rf && rf.type === 'character' ? cname(f[k]) : f[k];
    });
  }
  function fmtDate(d){ if(!d) return ''; const [y, m, dd] = d.split('-').map(Number); const w = '日月火水木金土'[new Date(y, m-1, dd).getDay()]; return `${m}月${dd}日（${w}）`; }
  function topbar(title, opt){
    opt = opt || {};
    return `<header class="sbar">${opt.back ? `<button class="sbtn ghost" data-act="${opt.back}">‹ もどる</button>` : '<span></span>'}<b>${esc(title)}</b>${
      L.resident && !opt.noCard ? '<button class="sbtn chip" data-act="card">住民票</button>' : '<span></span>'}</header>` + embedBar();
  }
  function embedBar(){
    let inFrame = false; try{ inFrame = window.self !== window.top; }catch(e){ inFrame = true; }
    if(!inFrame) return '';
    // 埋め込みの中と全画面では、スマホ内の保存場所が別になるため、住民票の鍵をリンクに付けて引きつぐ（# 以降はサーバーに送られない）
    const u = new URL(location.href); u.hash = '';
    if(L.rid) u.hash = 'login=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify({rid:L.rid, token:L.token, recovery:L.recovery})))));
    return `<div class="embedbar"><span>全画面で開くと、もっと見やすくなります</span><a href="${esc(u.href)}" target="_blank" rel="noopener">全画面で開く</a></div>`;
  }
  function set(html){ app.innerHTML = html; window.scrollTo(0, 0); }
  function toast(msg){ let t = $('svToast'); if(!t){ t = document.createElement('div'); t.id = 'svToast'; t.className = 'stoast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 3800); }
  function modal(html){ let m = $('svModal'); if(!m){ m = document.createElement('div'); m.id = 'svModal'; m.className = 'smodal'; document.body.appendChild(m); } m.innerHTML = html; m.hidden = false; }
  function closeModal(){ const m = $('svModal'); if(m){ m.hidden = true; m.innerHTML = ''; } }
  function shake(el){ el.classList.remove('sshake'); void el.offsetWidth; el.classList.add('sshake'); }
  function celebrate(msg){
    const c = document.createElement('div'); c.className = 'scele';
    c.innerHTML = `<p>${esc(msg)}</p>` + Array.from({length:26}, (_, i) => `<i style="--x:${(Math.random()*100).toFixed(1)}%;--d:${(Math.random()*0.5).toFixed(2)}s;--c:${['#ffd000','#e23d72','#1e5aff','#10c050','#ff8a1a'][i%5]}"></i>`).join('');
    document.body.appendChild(c); setTimeout(() => c.remove(), 1900);
  }

  /* ---------- 埋め込みから「全画面で開く」で来たとき：住民票を引きつぐ ---------- */
  (function(){
    const m = location.hash.match(/^#login=(.+)$/); if(!m) return;
    try{ const o = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      if(o.rid && o.token && o.rid !== L.rid){ L = Object.assign(fresh(), {rid:o.rid, token:o.token, recovery:o.recovery || ''}); save(); } }catch(e){}
    history.replaceState(null, '', location.pathname + location.search);
  })();

  /* ---------- はじまり ---------- */
  async function start(){
    if(!API){ return set(topbar('レンガ村の物語', {noCard:true}) + `<div class="spage"><div class="shero"><h2>準備中です</h2><p>${esc(errText({code:'noapi'}))}</p></div></div>`); }
    if(!L.rid) return showWelcome();
    try{
      const j = await api('boot');
      if(!j.ok){ if(j.error === 'auth') return showWelcome('住民票が見つかりませんでした。復元コードで戻すか、新しく登録してください。'); return showError(j); }
      takeBoot(j); route();
    }catch(e){
      // 通信できないときは、今日の控えがあれば地図を出す
      if(L.today === todayLocal() && L.unlocked && L.unlocked.entrance && L.map){ toast('通信できないため、保存してある地図を表示しています。'); return showMap(); }
      showError({code:'network'}, true);
    }
  }
  function todayLocal(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function takeBoot(j){
    if(j.defs) L.defs = j.defs;
    if(j.today !== L.today){ L.stories = {}; L.intro = null; }      // 日がかわったら、前の日の解放は使わない
    L.today = j.today; L.day = j.day; L.resident = j.resident || L.resident;
    if(j.state) L.state = Object.assign(emptyState(), j.state);
    L.visits = j.visits || []; L.returning = !!j.returning; L.returningThis = !!j.returningThis; L.prevEvent = !!j.prevEvent; L.unlocked = j.unlocked || null; L.map = j.map || null; L.upcoming = j.upcoming || [];
    save();
  }
  function route(){
    if(!L.rid) return showWelcome();
    if(!L.day) return showClosed();
    if(!L.unlocked || !L.unlocked.entrance) return showGate();
    if(L.intro && !L.state.introSeen[L.today]){ L.state.introSeen[L.today] = true; save(); return play(L.intro); }
    showMap();
  }
  function showError(j, retry){
    set(topbar('レンガ村の物語') + `<div class="spage"><div class="shero"><div class="sbig-icon">📡</div><h2>うまくつながりませんでした</h2><p>${esc(errText(j))}</p></div>
      ${retry ? '<button class="sbtn main" data-act="retry">もう一度ためす</button>' : ''}</div>`);
  }

  /* ---------- ようこそ・住民登録・復元 ---------- */
  async function ensureDefs(){
    if(L.defs && L.defs.regfields && L.defs.regfields.length) return true;
    try{ const j = await api('config'); if(j.ok){ L.defs = j.defs; L.today = j.today; L.day = j.day; save(); return true; } }catch(e){}
    return false;
  }
  async function showWelcome(msg){
    set(topbar('レンガ村の物語', {noCard:true}) + `<div class="spage">
      <div class="shero"><p class="skicker">INNOCENT WORLD</p><h1>レンガ村の物語</h1>
        <p>絵本の中の小さな村へようこそ。<br>住民登録をして、あなただけの住民票をつくりましょう。</p></div>
      ${msg ? `<div class="scard"><p class="snote" style="color:#d0201e">${esc(msg)}</p></div>` : ''}
      <button class="sbtn main" data-act="register">住民登録をする</button>
      <button class="sbtn sub" data-act="restore">住民票を復元する（機種変更・2回目以降）</button>
      <p class="snote">名前やメールアドレスなどの個人情報は必要ありません。ニックネームで参加できます。</p></div>`);
  }
  async function showRegister(){
    if(!(await ensureDefs())) return showError({code:'network'}, true);
    const fields = defs().regfields.map(f => {
      if(f.type === 'character') return `<fieldset class="sfield"><legend>${esc(f.label)}</legend><div class="schars">${
        Object.keys(defs().characters).map((k, i) => `<label class="schar"><input type="radio" name="${esc(f.id)}" value="${esc(k)}" ${i ? '' : 'checked'}><img src="${charImg(k)}" alt="" loading="lazy"><span>${esc(cname(k))}</span>${cnameEn(k) ? `<em>${esc(cnameEn(k))}</em>` : ''}</label>`).join('')}</div></fieldset>`;
      if(f.type === 'choice') return `<fieldset class="sfield"><legend>${esc(f.label)}</legend><div class="sopts">${
        f.options.map((o, i) => `<label class="sopt"><input type="radio" name="${esc(f.id)}" value="${esc(o)}" ${i ? '' : 'checked'}><span>${esc(o)}</span></label>`).join('')}</div></fieldset>`;
      return `<label class="sfield"><span class="slabel">${esc(f.label)}${f.required ? '' : '（なくてもOK）'}</span><input class="sinput" name="${esc(f.id)}" maxlength="${f.max || 20}" placeholder="${esc(f.placeholder || '')}" autocomplete="off"></label>`;
    }).join('');
    set(topbar('住民登録', {back:'welcome', noCard:true}) + `<div class="spage">
      <div class="shero"><p class="skicker">RESIDENT REGISTRATION</p><h2>レンガ村の住民になる</h2></div>
      <form id="svReg" class="scard">${fields}<button class="sbtn main pink" type="submit">住民登録する</button></form>
      <p class="snote">ニックネームには本名を入れないでください。<br>記録は innocent world の運営と、物語の集計だけに使います。</p></div>`);
    $('svReg').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target), fields = {};
      for(const f of defs().regfields){ fields[f.id] = String(fd.get(f.id) || '').trim(); if(f.required && !fields[f.id]){ toast(f.label + 'を入れてください'); return; } }
      try{
        const j = await api('register', {fields});
        if(!j.ok) return toast(errText(j));
        Object.assign(L, fresh(), {defs:L.defs, rid:j.rid, token:j.token, recovery:j.recovery, resident:j.resident}); save();
        showCard({first:true});
      }catch(err){ toast(errText(err)); }
    });
  }
  function showRestore(){
    set(topbar('住民票の復元', {back:'welcome', noCard:true}) + `<div class="spage">
      <div class="shero"><div class="sbig-icon">🔑</div><h2>住民票を復元する</h2><p>住民票に書かれた「復元コード」（12文字）を入力してください。<br>もちものや物語の続きも戻ります。</p></div>
      <form id="svRes" class="scard"><input class="sinput big mono" name="c" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" aria-label="復元コード"><button class="sbtn main" type="submit">復元する</button></form>
      <p class="snote">復元すると、前に使っていたスマホでは住民票が使えなくなります。</p></div>`);
    $('svRes').addEventListener('submit', async e => {
      e.preventDefault();
      try{
        const j = await api('restore', {code:e.target.c.value});
        if(!j.ok){ shake(e.target); return toast(errText(j)); }
        Object.assign(L, fresh(), {defs:L.defs, rid:j.rid, token:j.token, recovery:'', resident:j.resident, state:Object.assign(emptyState(), j.state)}); save();
        celebrate('おかえりなさい！ 住民票を復元しました');
        setTimeout(start, 900);
      }catch(err){ toast(errText(err)); }
    });
  }

  /* ---------- お休みの日 ---------- */
  function showClosed(){
    const up = L.upcoming || [];
    set(topbar('レンガ村の物語') + `<div class="spage"><div class="shero"><div class="sbig-icon">🌙</div><p class="skicker">CLOSED TODAY</p><h2>今日のレンガ村はお休みです</h2>
      <p>物語は、開催日にだけひらきます。住民票はいつでも見られます。</p></div>
      ${up.length ? `<div class="scard"><b class="sh">次の開催日</b><ul class="sdays">${up.map(d => `<li>${esc(d.label)}　${esc(fmtDate(d.date))}</li>`).join('')}</ul></div>` : ''}
      <button class="sbtn sub" data-act="card">住民票を見る</button></div>`);
  }

  /* ---------- 入口のひみつのことば ---------- */
  function showGate(){
    set(topbar('レンガ村の物語') + `<div class="spage"><div class="shero">
      <div class="sbig-icon">🗝️</div><p class="skicker">${esc(L.day.label)}　${esc(fmtDate(L.today))}</p>
      <h2>村の入口のひみつのことば</h2><p>入口に掲示された「ひみつのことば」を入力してください。<br>今日のレンガ村の地図と物語がひらきます。</p></div>
      <form id="svGate" class="scard"><input class="sinput big" name="w" placeholder="ひみつのことば" autocomplete="off" aria-label="入口のひみつのことば"><button class="sbtn main" type="submit">村に入る</button></form></div>`);
    $('svGate').addEventListener('submit', async e => {
      e.preventDefault();
      const w = e.target.w.value.trim(); if(!w) return;
      try{
        const j = await api('entrance', {word:w});
        if(!j.ok){ if(j.error === 'auth') return start(); shake(e.target); return toast(errText(j)); }
        L.unlocked = j.unlocked; L.map = j.map; L.visits = j.visits || L.visits; L.returning = !!j.returning; L.returningThis = !!j.returningThis; L.prevEvent = !!j.prevEvent; L.intro = j.intro || null; save();
        celebrate(fill(j.message || 'ようこそ！ 今日の村の地図がひらきました'));
        setTimeout(route, 1000);
      }catch(err){ toast(errText(err)); }
    });
  }

  /* ---------- 地図 ---------- */
  function building(f){
    const r = esc(f.roof), w = esc(f.wall);
    if(f.type === 'windmill') return `<g class="bld"><path d="M-14 26 L-9 -14 L9 -14 L14 26 Z" fill="${w}" stroke="#7a4a20" stroke-width="2"/><path d="M-11 -14 L0 -28 L11 -14 Z" fill="${r}"/>
      <rect x="-5" y="10" width="10" height="16" rx="5" fill="#1e5aff"/><g class="sblades"><path d="M0 -18 L-4 -54 L4 -54 Z M0 -18 L36 -22 L36 -14 Z M0 -18 L4 18 L-4 18 Z M0 -18 L-36 -14 L-36 -22 Z" fill="#fff" stroke="#c89a6a" stroke-width="1.5"/><circle cx="0" cy="-18" r="3.5" fill="#7a4a20"/></g></g>`;
    if(f.type === 'plaza') return `<g class="bld"><ellipse cx="0" cy="14" rx="40" ry="16" fill="#f3dcc0" stroke="#c89a6a" stroke-width="2"/><circle cx="0" cy="8" r="10" fill="#7ad8ff" stroke="#fff" stroke-width="3"/>
      <path d="M0 -2 L0 -30" stroke="#c89a6a" stroke-width="3"/><path d="M0 -30 L18 -24 L0 -18 Z" fill="${r}"/>${[-30,-15,15,30].map((x, i) => `<circle cx="${x}" cy="${-4 - (i%2)*6}" r="3" fill="${['#ffd000','#e8101e','#10c050','#1e5aff'][i]}"/>`).join('')}</g>`;
    return `<g class="bld"><rect x="-26" y="-6" width="52" height="34" rx="3" fill="${w}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
      <path d="M-32 -4 L0 -30 L32 -4 Z" fill="${r}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/><rect x="-6" y="10" width="12" height="18" rx="6" fill="${r}"/>
      <rect x="-20" y="2" width="10" height="9" fill="#ffd96a" stroke="#fff" stroke-width="1.5"/><rect x="10" y="2" width="10" height="9" fill="#ffd96a" stroke="#fff" stroke-width="1.5"/></g>`;
  }
  function showMap(){
    const facs = L.map || [];
    const pins = facs.map(f => {
      const x = Math.max(8, Math.min(92, f.x)) * 4, y = Math.max(8, Math.min(90, f.y)) * 5;
      if(f.status === 'hidden') return `<g transform="translate(${x},${y})" class="spin ghost" data-act="hiddenfac" data-id="${esc(f.id)}" role="button" tabindex="0" aria-label="まだひらいていない場所">
        <circle r="24" fill="rgba(255,255,255,.6)" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 4"/><text y="8" text-anchor="middle" font-size="24" font-weight="800" fill="#8a7a9a">?</text></g>`;
      const st = f.status, badge = st === 'locked' ? '🔒' : st === 'done' ? '✓' : 'NEW', bc = st === 'done' ? '#10a040' : st === 'open' ? '#e23d72' : '#5a6390';
      return `<g transform="translate(${x},${y})" class="spin ${st}" data-act="fac" data-id="${esc(f.id)}" role="button" tabindex="0" aria-label="${esc(f.name)}（${st === 'locked' ? 'ひみつのことばが必要' : st === 'done' ? '読み終えた' : 'ひらいている'}）">
        <ellipse cx="0" cy="30" rx="34" ry="7" fill="rgba(60,30,10,.18)"/>${building(f)}
        <g transform="translate(0,46)"><rect class="pinlabel" x="-46" y="-12" width="92" height="24" rx="12" fill="#fff" stroke="${esc(f.roof)}" stroke-width="2"/><text y="5" text-anchor="middle" font-size="12.5" font-weight="800" fill="#1f2f8f">${esc(f.name)}</text></g>
        <g transform="translate(32,-30)"><g class="badge"><circle r="13" fill="${bc}" stroke="#fff" stroke-width="2"/><text y="4.5" text-anchor="middle" font-size="${st === 'open' ? 8.5 : 12}" font-weight="800" fill="#fff">${badge}</text></g></g></g>`;
    }).join('');
    const its = Object.keys(L.state.items).filter(k => L.state.items[k] && defs().items[k]);
    set(topbar('レンガ村の地図') + `<div class="spage">
      <div class="sday"><span>${esc(L.day ? L.day.label : '')}</span>${esc(fmtDate(L.today))}</div>
      <div class="smap"><svg viewBox="0 0 400 500" role="img" aria-label="レンガ村の地図">
        <defs><pattern id="svBrick" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#e8a070"/><path d="M0 0H24M0 6H24M0 12H24M6 0V6M18 6V12" stroke="#c87850" stroke-width="1"/></pattern>
        <radialGradient id="svGrass" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#b8ec8a"/><stop offset="1" stop-color="#7cc860"/></radialGradient></defs>
        <rect width="400" height="500" fill="url(#svGrass)"/>
        <path d="M96 150 Q150 220 200 250 Q250 220 304 140 M200 250 Q150 300 88 360 M200 250 Q260 300 312 350 M200 250 L200 500" stroke="url(#svBrick)" stroke-width="26" fill="none" stroke-linecap="round"/>
        <path d="M20 480 Q70 440 120 480 M280 50 Q330 20 380 50" stroke="#5aa8e8" stroke-width="10" fill="none" stroke-linecap="round" opacity=".7"/>
        ${[[30,90],[360,210],[40,250],[350,440],[150,470],[130,90],[262,470],[200,40]].map(([x, y]) => `<g transform="translate(${x},${y})"><rect x="-3" y="4" width="6" height="12" fill="#7a4a20"/><circle r="14" fill="#3aa848"/><circle cx="-5" cy="-4" r="5" fill="#5ac868"/></g>`).join('')}
        ${pins}
      </svg></div>
      <div class="slegend"><span><i style="background:#5a6390"></i>ことばが必要</span><span><i style="background:#e23d72"></i>読める</span><span><i style="background:#10a040"></i>読み終えた</span></div>
      <div class="scard"><b class="sh">もちもの</b>${its.length ? `<ul class="sitems">${its.map(k => `<li><span>${esc(defs().items[k].icon || '★')}</span>${esc(defs().items[k].name)}</li>`).join('')}</ul>` : '<p class="snote" style="text-align:left">まだ何も持っていません。</p>'}</div>
      <p class="snote">建物をタップして、施設に掲示されたひみつのことばを入力すると、その施設の物語がひらきます。<br>一度ひらいた施設は、今日のあいだはそのまま読めます。</p></div>`);
  }

  /* ---------- 施設のひみつのことば ---------- */
  function openFac(id){
    const f = (L.map || []).find(x => x.id === id); if(!f) return;
    if(f.status !== 'locked') return fetchStory(f, '');
    modal(`<div class="sdlg" role="dialog" aria-label="${esc(f.name)}"><div class="sdlghead" style="--c:${esc(f.roof)}"><b>${esc(f.name)}</b><span>${esc(f.sub || '')}</span></div>
      <p>施設に掲示されたひみつのことばを入力してください。</p>
      <form id="svFac"><input class="sinput big" name="w" placeholder="ひみつのことば" autocomplete="off" aria-label="${esc(f.name)}のひみつのことば"><button class="sbtn main" type="submit">ひらく</button></form>
      <button class="sbtn link" data-act="close">とじる</button></div>`);
    const form = $('svFac'); setTimeout(() => form.w.focus(), 60);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const w = form.w.value.trim(); if(!w) return;
      await fetchStory(f, w, form);
    });
  }
  async function fetchStory(f, word, form){
    // 今日すでに受け取った物語は、通信しなくても読める
    if(!word && L.stories[f.id]) return play(L.stories[f.id]);
    try{
      const j = await api('facility', {facility:f.id, word});
      if(!j.ok){ if(form) shake(form); if(j.error === 'entrance_first'){ closeModal(); return start(); } return toast(errText(j)); }
      closeModal();
      if(j.map) L.map = j.map;
      if(!j.story){ save(); showMap(); return toast('今はまだ、ここの物語はありません。'); }
      L.stories[f.id] = j.story; save();
      if(word){ celebrate(fill(j.message || f.name + 'の物語がひらきました')); setTimeout(() => play(j.story), 900); }
      else play(j.story);
    }catch(err){ toast(errText(err)); }
  }

  /* ---------- 物語（会話と選択肢） ---------- */
  let P = null;
  function play(bundle){
    P = {b:bundle, id:bundle.start, line:0, got:[]};
    if(bundle.facility !== 'intro') push({type:'start', facility:bundle.facility, route:bundle.route});
    enterScene();
  }
  function scene(){ return P && P.b.scenes[P.id]; }
  function addAll(add, flag, item){
    const st = L.state, got = [];
    if(add) Object.keys(add).forEach(k => st.points[k] = (st.points[k] || 0) + add[k]);
    (flag || []).forEach(f => st.flags[f] = true);
    (item || []).forEach(i => { if(!st.items[i]){ st.items[i] = L.today; got.push(i); } });
    save(); return got;
  }
  function enterScene(){
    const sc = scene();
    if(!sc){ toast('物語の続きが見つかりませんでした。'); return finish(); }
    P.got = addAll(sc.add, sc.flag, sc.item); P.line = 0; render();
  }
  function check(c){
    if(!c) return true;
    if(c.unknown && c.unknown.length) return false;
    const st = L.state;
    if(c.day && (!L.day || L.day.dayNo !== c.day)) return false;
    if(c.returning === true && !L.returning) return false;
    if(c.returning === false && L.returning) return false;
    if(c.prevEvent && !L.prevEvent) return false;
    if(c.returningThis && !L.returningThis) return false;
    if(c.flags && !c.flags.every(f => st.flags[f])) return false;
    if(c.notFlags && c.notFlags.some(f => st.flags[f])) return false;
    if(c.items && !c.items.every(i => st.items[i])) return false;
    if(c.points && !Object.keys(c.points).every(k => (st.points[k] || 0) >= c.points[k])) return false;
    if(c.done && !c.done.every(f => st.done[f])) return false;
    if(c.doneCount && Object.keys(st.done).length < c.doneCount) return false;
    return true;
  }
  function render(){
    const sc = scene(), lines = sc.lines.length ? sc.lines : [['', '']], ln = lines[P.line] || ['', ''];
    const who = ln[0], text = ln[1], last = P.line >= lines.length - 1;
    const choices = last ? sc.choices.filter(c => check(c.cond)) : [];
    const fac = (L.map || []).find(x => x.id === P.b.facility);
    const bg = /^#[0-9a-f]{3,8}$/i.test(sc.bg) ? `style="background:${sc.bg}"` : '';
    const got = last && P.got.length ? `<div class="sgot">${P.got.map(i => { const it = defs().items[i]; return `<span>${it ? esc((it.icon || '★') + ' ' + it.name) : esc(i)} をもらった！</span>`; }).join('')}</div>` : '';
    let foot;
    if(choices.length) foot = `<div class="schoices">${choices.map(c => `<button class="sbtn choice" data-act="choose" data-i="${sc.choices.indexOf(c)}">${esc(fill(c.text))}</button>`).join('')}</div>`;
    else if(last && sc.ar) foot = `<div class="sar"><a class="sbtn main pink" href="${esc(arLink(sc.ar))}" target="_blank" rel="noopener" data-act="ar">${esc(fill(sc.arLabel || 'ARを見る'))}</a>
      <small>新しい画面でARが開きます。見終わったら、この画面にもどってきてね。</small><button class="sbtn link" data-act="next">地図にもどる</button></div>`;
    else foot = `<span class="snext">${last && !sc.next ? 'おわり ▶' : 'タップで次へ ▼'}</span>`;
    set(`<div class="sscene bg-${esc(/^[a-z]+$/.test(sc.bg) ? sc.bg : 'meadow')}" ${bg}>
      <button class="sbtn ghost scl" data-act="leave">‹ 地図へ</button>${fac ? `<span class="sfac">${esc(fac.name)}</span>` : ''}
      ${who ? `<img class="sactor" src="${charImg(who)}" alt="${esc(cname(who))}">` : ''}
      <div class="sbox" ${choices.length || (last && sc.ar) ? '' : 'data-act="next" role="button" tabindex="0" aria-label="次へ"'}>
        ${who ? `<div class="sname">${esc(cname(who))}</div>` : ''}
        <p class="${who ? '' : 'narr'}">${esc(fill(text))}</p>${got}${foot}
      </div></div>`);
  }
  function arLink(m){ const u = new URL(AR_URL, location.href); u.searchParams.set('ar', m); return u.href; }
  function next(){
    const sc = scene(); if(!sc) return;
    if(P.line < sc.lines.length - 1){ P.line++; return render(); }
    if(sc.next && P.b.scenes[sc.next]){ P.id = sc.next; return enterScene(); }
    finish();
  }
  function choose(i){
    const sc = scene(), c = sc.choices[i]; if(!c) return;
    addAll(c.add, c.flag, c.item);
    push({type:'choice', scene:P.id, choice:c.id, text:c.text});
    if(c.next && P.b.scenes[c.next]){ P.id = c.next; enterScene(); } else finish();
  }
  async function finish(){
    const b = P && P.b; P = null;
    if(b && b.facility !== 'intro'){
      if(!L.state.done[b.facility]) L.state.done[b.facility] = L.today;
      push({type:'done', facility:b.facility, route:b.route});
    }
    save();
    // 記録を送り、地図を最新にする（広場がひらく など）
    try{ const j = await api('boot', {}, {quiet:true}); if(j.ok) takeBoot(j); }catch(e){}
    route();
  }

  /* ---------- 住民票 ---------- */
  function showCard(opt){
    opt = opt || {};
    const r = L.resident; if(!r) return route();
    const f = r.fields || {}, regs = defs().regfields || [];
    const nameF = regs.find(x => x.type === 'text') || {id:'name'}, friendF = regs.find(x => x.type === 'character');
    const extra = regs.filter(x => x !== nameF && x !== friendF && f[x.id]);
    const friend = friendF && f[friendF.id];
    const days = Array.from(new Set(L.visits || [])).sort();
    const stamps = days.length ? days.map(d => `<div class="sstamp on"><b>${esc(fmtDate(d).replace(/（.）/, ''))}</b><span>来村</span></div>`).join('') : '<div class="sstamp"><b>まだ</b><span>来村前</span></div>';
    const P2 = defs().points || {}, pts = Object.keys(P2).map(k => `<li><span>${esc(P2[k])}</span><b>${L.state.points[k] || 0}</b></li>`).join('');
    const its = Object.keys(L.state.items).filter(k => L.state.items[k] && defs().items[k]);
    modal(`<div class="sresident" role="dialog" aria-label="住民票">
      <div class="srtop"><span>レンガ村</span><b>住民票</b><em>RESIDENT CARD</em></div>
      <div class="srbody">
        ${friend ? `<div class="srphoto"><img src="${charImg(friend)}" alt=""><span>${esc(cname(friend))}となかよし</span></div>` : ''}
        <dl><dt>住民番号</dt><dd class="mono">${esc(r.rid)}</dd><dt>住民名</dt><dd class="nm">${esc(f[nameF.id] || '')}</dd>
        ${extra.map(x => `<dt>${esc(x.label.replace(/（.*?）/, ''))}</dt><dd>${esc(f[x.id])}</dd>`).join('')}
        <dt>登録日</dt><dd>${esc(fmtDate(String(r.createdAt || '').slice(0, 10)))}</dd></dl>
        <div class="srseal" aria-hidden="true">レンガ村<br>村長之印</div>
      </div>
      <div class="srstamps">${stamps}</div>
      ${pts ? `<ul class="srpts">${pts}</ul>` : ''}
      ${its.length ? `<div class="sritems">${its.map(k => `<span>${esc((defs().items[k].icon || '★') + ' ' + defs().items[k].name)}</span>`).join('')}</div>` : ''}
      ${L.recovery ? `<div class="srcode"><small>復元コード（機種変更のときに使います）<br>このページのスクリーンショットを残してください</small><b class="mono">${esc(L.recovery)}</b></div>`
        : '<button class="sbtn sub" data-act="newcode">復元コードを表示する（新しく発行）</button>'}
      ${opt.first ? '<p class="srwelcome">ようこそ、レンガ村へ！ 住民登録が完了しました。</p>' : ''}
      <button class="sbtn main" data-act="${opt.first ? 'closego' : 'close'}">${opt.first ? '村へ行く' : 'とじる'}</button>
      ${opt.first ? '' : '<button class="sbtn link" data-act="delete">住民票を削除する</button>'}
    </div>`);
  }

  /* ---------- 操作 ---------- */
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if(!b) return;
    const a = b.dataset.act;
    if(a === 'ar'){ if(P && P.b && P.b.facility !== 'intro' && !L.state.done[P.b.facility]){ L.state.done[P.b.facility] = L.today; push({type:'done', facility:P.b.facility, route:P.b.route}); syncSoon(); } return; }   // リンクはそのまま新しいタブで開く
    e.preventDefault();
    if(a === 'welcome') return showWelcome();
    if(a === 'register') return showRegister();
    if(a === 'restore') return showRestore();
    if(a === 'retry') return start();
    if(a === 'card') return showCard();
    if(a === 'close') return closeModal();
    if(a === 'closego'){ closeModal(); return start(); }
    if(a === 'fac') return openFac(b.dataset.id);
    if(a === 'hiddenfac'){ const f = (L.map || []).find(x => x.id === b.dataset.id); return toast(f && f.hint ? f.hint : 'まだ道がひらいていません。ほかの施設の物語を読んでみてね。'); }
    if(a === 'next') return next();
    if(a === 'choose') return choose(+b.dataset.i);
    if(a === 'leave'){ P = null; return showMap(); }
    if(a === 'newcode'){
      try{ const j = await api('newRecovery'); if(!j.ok) return toast(errText(j)); L.recovery = j.recovery; save(); showCard(); toast('新しい復元コードを発行しました。前のコードは使えなくなりました。'); }catch(err){ toast(errText(err)); }
      return;
    }
    if(a === 'delete'){
      if(!confirm('住民票と、これまでの記録をすべて削除します。元には戻せません。よろしいですか？')) return;
      try{ const j = await api('delete'); if(!j.ok) return toast(errText(j)); }catch(err){ return toast(errText(err)); }
      L = fresh(); save(); closeModal(); showWelcome(); toast('住民票を削除しました。');
    }
  });
  document.addEventListener('keydown', e => {
    if((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')){ e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', {bubbles:true})); }
  });
  // 別のタブ（AR）から戻ってきたら、記録を送って地図を最新に
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && L.rid && !P && L.outbox.length) syncSoon(); });

  start();
})();
