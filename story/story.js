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

  /* ---------- 表示モード（日本語・ひらがな・English） ---------- */
  const I = window.STORY_I18N;
  let LANG = (() => { try{ const v = localStorage.getItem('iw_story_lang'); return I.langs[v] ? v : ''; }catch(e){ return ''; } })();
  function setLang(v){ LANG = v; try{ localStorage.setItem('iw_story_lang', v); }catch(e){} document.documentElement.lang = I.langs[v].html; document.documentElement.dataset.lang = v; }
  if(LANG) setLang(LANG);
  const lang = () => LANG || 'ja';
  // スプレッドシートの文：文字列（日本語だけ）または {ja, kana, en}。ない言語は日本語を使う
  function T(x){ if(x == null) return ''; if(typeof x !== 'object') return String(x); return x[lang()] || x.ja || x.en || x.kana || ''; }
  function t(key){ const v = I.ui[key]; let s = v ? (v[lang()] || v.ja) : key; for(let i = 1; i < arguments.length; i++) s = s.replace('{' + (i - 1) + '}', arguments[i]); return s; }

  /* ---------- スマホ内の保存（控え） ---------- */
  function emptyState(){ return {points:{}, flags:{}, items:{}, done:{}, introSeen:{}}; }
  function fresh(){ return {rid:'', token:'', recovery:'', resident:null, state:emptyState(), outbox:[], defs:null, day:null, today:'', visits:[], returning:false, unlocked:null, map:null, stories:{}, intro:null}; }
  let L = load();
  function load(){ try{ const v = JSON.parse(localStorage.getItem(KEY)); if(v && typeof v === 'object') return Object.assign(fresh(), v); }catch(e){} return fresh(); }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(L)); }catch(e){} }
  const defs = () => L.defs || {items:{}, points:{}, characters:{}, regfields:[]};
  let VIEW = null, MODAL = null;   // 言語を切りかえたときに描き直す画面

  /* ---------- 通信 ---------- */
  let busyN = 0;
  function loading(on){
    busyN += on ? 1 : -1;
    let el = $('svLoading');
    if(busyN > 0 && !el){ el = document.createElement('div'); el.id = 'svLoading'; el.className = 'sloading'; el.innerHTML = '<div><span></span>' + esc(t('loading')) + '</div>'; document.body.appendChild(el); }
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
    if(j && j.hint) return T(j.hint);
    const k = (j && (j.error || j.code)) || 'server', m = I.errors[k] || I.errors.server;
    return m[lang()] || m.ja;
  }

  /* ---------- 画面の部品 ---------- */
  function charImg(k){ return '../characters2/' + encodeURIComponent(k) + '.png'; }
  function cname(k){ return T(defs().characters[k]) || k; }
  function cnameEn(k){ const c = defs().characters[k]; return (c && typeof c === 'object' && c.en) || (defs().charactersEn || {})[k] || ''; }
  // セリフの差し込み：{name}（または {住民名}）＝住民名。ほかの登録項目も {項目ID} で差し込めます
  function fill(t){
    const r = L.resident, f = (r && r.fields) || {}, regs = defs().regfields || [];
    const nameF = regs.find(x => x.type === 'text');
    return String(t == null ? '' : t).replace(/\{(name|住民名|[A-Za-z_][A-Za-z0-9_]*)\}/g, (m, k) => {
      if(k === 'name' || k === '住民名') return f.name || (nameF && f[nameF.id]) || t('you');
      if(!(k in f)) return m;
      const rf = regs.find(x => x.id === k);
      return rf && rf.type === 'character' ? cname(f[k]) : optLabel(rf, f[k]);
    });
  }
  // 登録項目の「選択肢」：保存する値は日本語のまま、表示だけ切りかえる
  function optLabel(rf, v){ if(!rf || !rf.options) return v; const o = rf.options.find(x => (typeof x === 'object' ? x.ja : x) === v); return o ? T(o) : v; }
  function fmtDate(d){
    if(!d) return ''; const [y, m, dd] = d.split('-').map(Number), wd = new Date(y, m-1, dd).getDay();
    if(lang() === 'en') return `${I.week.en[wd]}, ${I.months[m-1]} ${dd}`;
    if(lang() === 'kana') return `${m}がつ${dd}にち（${I.week.kana[wd]}）`;
    return `${m}月${dd}日（${I.week.ja[wd]}）`;
  }
  function langBtn(){ return `<button class="sbtn ghost slang" data-act="lang" aria-label="ことば / Language">🌐 <span>${esc(t('langBtn'))}</span></button>`; }
  function topbar(title, opt){
    opt = opt || {};
    return `<header class="sbar">${opt.back ? `<button class="sbtn ghost" data-act="${opt.back}">‹ ${esc(t('back'))}</button>` : '<span></span>'}
      <span class="sbarr">${langBtn()}${soundBtn()}${L.resident && !opt.noCard ? `<button class="sbtn chip" data-act="card">${esc(t('card'))}</button>` : ''}</span></header>
      ${title ? `<p class="sbartitle">${esc(title)}</p>` : ''}` + embedBar();
  }
  function embedBar(){
    let inFrame = false; try{ inFrame = window.self !== window.top; }catch(e){ inFrame = true; }
    if(!inFrame) return '';
    // 埋め込みの中と全画面では、スマホ内の保存場所が別になるため、住民票の鍵をリンクに付けて引きつぐ（# 以降はサーバーに送られない）
    const u = new URL(location.href); u.hash = '';
    if(L.rid) u.hash = 'login=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify({rid:L.rid, token:L.token, recovery:L.recovery})))));
    return `<div class="embedbar"><span>${esc(t('embedLead'))}</span><a href="${esc(u.href)}" target="_blank" rel="noopener">${esc(t('embedOpen'))}</a></div>`;
  }
  function set(html){ app.innerHTML = html; window.scrollTo(0, 0); try{ music(); }catch(e){} }
  // 場所ごとのBGM（テーマパークのエリア音楽のように切りかわる）。物語の中は施設ごと、なければ背景で決める
  const BG_SONG = {meadow:'gate', well:'well', bakery:'bakery', flower:'bakery', forest:'forest', windmill:'forest', clock:'clock', library:'library', plaza:'plaza', night:'night'};
  function music(){
    const B = window.IWBGM; if(!B) return;
    let song = 'gate';
    if(P && P.b){ const f = P.b.facility, sc = P.b.scenes && P.b.scenes[P.id], fac = (L.map || []).find(x => x.id === f);
      song = f === 'intro' ? 'gate' : B.songs.includes(f) ? f : (sc && BG_SONG[sc.bg]) || (fac && BG_SONG[fac.type]) || 'map'; }
    else if(VIEW === showMap) song = 'map';
    else if(VIEW === showClosed) song = 'night';
    B.play(song);
  }
  function toast(msg){ let t = $('svToast'); if(!t){ t = document.createElement('div'); t.id = 'svToast'; t.className = 'stoast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 3800); }
  function modal(html, again){ MODAL = again || null; let m = $('svModal'); if(!m){ m = document.createElement('div'); m.id = 'svModal'; m.className = 'smodal'; document.body.appendChild(m); } m.innerHTML = html; m.hidden = false; }
  function closeModal(){ MODAL = null; const m = $('svModal'); if(m){ m.hidden = true; m.innerHTML = ''; } }
  function shake(el){ el.classList.remove('sshake'); void el.offsetWidth; el.classList.add('sshake'); SFX.play('wrong'); }
  /* ---------- 効果音（音はおまけ。音がなくても内容はすべて文字と動きで分かる） ----------
     将来の音声：セリフに音声ファイルがあれば SFX.voice(url) で再生（「セリフ」シートの音声列） */
  const SFX = (() => {
    let ctx = null, on = true;
    try{ on = localStorage.getItem('iw_story_sound') !== 'off'; }catch(e){}
    let voiceEl = null;
    function ac(){ if(!ctx){ const C = window.AudioContext || window.webkitAudioContext; if(!C) return null; ctx = new C(); } if(ctx.state !== 'running') ctx.resume().catch(() => {}); return ctx; }
    function tone(f, t, d, type, vol){
      const c = ac(); if(!c) return;
      const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + t;
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + d + 0.05);
    }
    const bell = (f, t, d, v) => { tone(f, t, d, 'sine', v); tone(f*2, t, d*0.6, 'sine', (v || 0.12)*0.35); tone(f*3.01, t, d*0.3, 'triangle', (v || 0.12)*0.12); };
    const N = n => 440 * Math.pow(2, (n - 69)/12);
    const play = {
      page(){ tone(N(88), 0, 0.06, 'triangle', 0.03); },
      correct(){ [72, 76, 79, 84].forEach((n, i) => bell(N(n), i*0.09, 0.9, 0.11)); },
      wrong(){ tone(N(57), 0, 0.18, 'triangle', 0.08); tone(N(53), 0.16, 0.28, 'triangle', 0.08); },
      item(){ [84, 88, 91, 96, 100].forEach((n, i) => bell(N(n), i*0.06, 0.6, 0.07)); },
      ending(){ [[60,64,67],[65,69,72],[67,71,74],[72,76,79,84]].forEach((ch, i) => ch.forEach(n => { tone(N(n), i*0.32, i === 3 ? 2.2 : 0.4, 'triangle', 0.06); tone(N(n+12), i*0.32, i === 3 ? 1.6 : 0.3, 'sine', 0.03); }));
        [96, 100, 103, 108].forEach((n, i) => bell(N(n), 1.0 + i*0.12, 1.2, 0.05)); }
    };
    return {
      get on(){ return on; },
      set(v){ on = v; try{ localStorage.setItem('iw_story_sound', v ? 'on' : 'off'); }catch(e){} if(window.IWBGM) window.IWBGM.setOn(v); if(!v) this.stopVoice(); else ac(); },
      play(name){ if(!on || !play[name]) return; try{ play[name](); }catch(e){} },
      voice(url){ this.stopVoice(); if(!on || !url) return; try{ voiceEl = new Audio(url); voiceEl.play().catch(() => {}); }catch(e){} },
      stopVoice(){ if(voiceEl){ try{ voiceEl.pause(); }catch(e){} voiceEl = null; } }
    };
  })();
  if(window.IWBGM) window.IWBGM.setOn(SFX.on);
  function soundBtn(){ return `<button class="sbtn ghost ssound" data-act="sound" aria-pressed="${SFX.on}" aria-label="${esc(t(SFX.on ? 'soundOn' : 'soundOff'))}">${SFX.on ? '🔊' : '🔇'}</button>`; }
  // アイテムをもらったとき：大きく見せる
  function itemPop(ids){
    if(!ids || !ids.length) return;
    const c = document.createElement('div'); c.className = 'sitempop'; c.setAttribute('role', 'status');
    c.innerHTML = ids.map(i => { const it = defs().items[i] || {name:i}; return `<div class="sipcard"><span class="sipicon">${esc(it.icon || '★')}</span><b>${esc(T(it.name))}</b><em>${esc(t('gotItem'))}</em>${T(it.desc) ? `<small>${esc(T(it.desc))}</small>` : ''}</div>`; }).join('')
      + `<p class="siptap">${esc(t('tapClose'))}</p>` + Array.from({length:14}, (_, k) => `<i style="--a:${k*360/14}deg;--d:${(k%3)*0.08}s"></i>`).join('');
    c.addEventListener('click', () => c.remove());
    document.body.appendChild(c); SFX.play('item');
    setTimeout(() => c.remove(), 3200);
  }
  function celebrate(msg){
    const c = document.createElement('div'); c.className = 'scele';
    c.innerHTML = `<p>${esc(msg)}</p>` + Array.from({length:26}, (_, i) => `<i style="--x:${(Math.random()*100).toFixed(1)}%;--d:${(Math.random()*0.5).toFixed(2)}s;--c:${['#ffd000','#e23d72','#1e5aff','#10c050','#ff8a1a'][i%5]}"></i>`).join('');
    document.body.appendChild(c); setTimeout(() => c.remove(), 1900);
    SFX.play('correct');
  }

  /* ---------- 埋め込みから「全画面で開く」で来たとき：住民票を引きつぐ ---------- */
  (function(){
    const m = location.hash.match(/^#login=(.+)$/); if(!m) return;
    try{ const o = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      if(o.rid && o.token && o.rid !== L.rid){ L = Object.assign(fresh(), {rid:o.rid, token:o.token, recovery:o.recovery || ''}); save(); } }catch(e){}
    history.replaceState(null, '', location.pathname + location.search);
  })();

  /* ---------- 表示モードをえらぶ ---------- */
  function langChoices(){
    return `<div class="slangs">${Object.keys(I.langs).map(k => `<button class="slangcard ${k === LANG ? 'on' : ''}" data-act="setlang" data-lang="${k}">
      <b>${esc(I.langs[k].label)}</b><span>${esc(I.langs[k].sub)}</span></button>`).join('')}</div>`;
  }
  function showLangFirst(){
    VIEW = showLangFirst;
    set(`<div class="spage sfirst"><div class="shero"><p class="skicker">INNOCENT WORLD</p><div class="sbig-icon">🌐</div>
      <h2>ことばを えらんでください<br><small>Choose your language</small></h2></div>${langChoices()}</div>`);
  }
  function showLangPicker(){
    modal(`<div class="sdlg" role="dialog" aria-label="ことば / Language"><div class="sdlghead" style="--c:#1f2f8f"><b>🌐 ことば / Language</b><span>${esc(t('langTitle'))}</span></div>
      ${langChoices()}<p>${esc(t('langNote'))}</p><button class="sbtn link" data-act="close">${esc(t('close'))}</button></div>`);
  }
  function applyLang(v){
    const first = !LANG;
    setLang(v);
    const again = MODAL;
    closeModal();
    if(first) return start();
    if(P){ rePage(); render(); }
    else if(VIEW) VIEW();
    if(again) again();
  }

  /* ---------- はじまり ---------- */
  async function start(){
    if(!LANG) return showLangFirst();
    if(!API){ VIEW = start; return set(topbar('', {noCard:true}) + `<div class="spage"><div class="shero"><h2>${esc(t('preparing'))}</h2><p>${esc(errText({code:'noapi'}))}</p></div></div>`); }
    if(!L.rid) return showWelcome();
    try{
      const j = await api('boot');
      if(!j.ok){ if(j.error === 'auth') return showWelcome('authLost'); return showError(j); }
      takeBoot(j); route();
    }catch(e){
      // 通信できないときは、今日の控えがあれば地図を出す
      if(L.today === todayLocal() && L.unlocked && L.unlocked.entrance && L.map){ toast(t('offlineMap')); return showMap(); }
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
    VIEW = () => showError(j, retry);
    set(topbar('') + `<div class="spage"><div class="shero"><div class="sbig-icon">📡</div><h2>${esc(t('errTitle'))}</h2><p>${esc(errText(j))}</p></div>
      ${retry ? `<button class="sbtn main" data-act="retry">${esc(t('retry'))}</button>` : ''}</div>`);
  }

  /* ---------- ようこそ・住民登録・復元 ---------- */
  async function ensureDefs(){
    if(L.defs && L.defs.regfields && L.defs.regfields.length) return true;
    try{ const j = await api('config'); if(j.ok){ L.defs = j.defs; L.today = j.today; L.day = j.day; save(); return true; } }catch(e){}
    return false;
  }
  async function showWelcome(msgKey){
    VIEW = () => showWelcome(msgKey);
    set(topbar('', {noCard:true}) + `<div class="spage">
      <div class="shero"><p class="skicker">INNOCENT WORLD</p><h1>${esc(t('appTitle'))}</h1>
        <p>${t('welcomeLead')}</p></div>
      ${msgKey ? `<div class="scard"><p class="snote" style="color:#d0201e">${esc(t(msgKey))}</p></div>` : ''}
      <button class="sbtn main" data-act="register">${esc(t('register'))}</button>
      <button class="sbtn sub" data-act="restore">${esc(t('restoreBtn'))}</button>
      <p class="snote">${esc(t('noPersonal'))}</p></div>`);
  }
  async function showRegister(){
    if(!(await ensureDefs())) return showError({code:'network'}, true);
    // 入力中に言語を切りかえても、入れた内容は残す
    const keep = {}; const old = $('svReg'); if(old) new FormData(old).forEach((v, k) => keep[k] = v);
    VIEW = showRegister;
    const fields = defs().regfields.map(f => {
      const lab = T(f.label);
      if(f.type === 'character') return `<fieldset class="sfield"><legend>${esc(lab)}</legend><div class="schars">${
        Object.keys(defs().characters).map((k, i) => `<label class="schar"><input type="radio" name="${esc(f.id)}" value="${esc(k)}" ${(keep[f.id] ? keep[f.id] === k : !i) ? 'checked' : ''}><img src="${charImg(k)}" alt="" loading="lazy"><span>${esc(cname(k))}</span>${cnameEn(k) && lang() !== 'en' ? `<em>${esc(cnameEn(k))}</em>` : ''}</label>`).join('')}</div></fieldset>`;
      if(f.type === 'choice') return `<fieldset class="sfield"><legend>${esc(lab)}</legend><div class="sopts">${
        f.options.map((o, i) => { const v = typeof o === 'object' ? o.ja : o; return `<label class="sopt"><input type="radio" name="${esc(f.id)}" value="${esc(v)}" ${(keep[f.id] ? keep[f.id] === v : !i) ? 'checked' : ''}><span>${esc(T(o))}</span></label>`; }).join('')}</div></fieldset>`;
      return `<label class="sfield"><span class="slabel">${esc(lab)}${f.required ? '' : esc(t('optional'))}</span><input class="sinput" name="${esc(f.id)}" maxlength="${f.max || 20}" placeholder="${esc(T(f.placeholder))}" value="${esc(keep[f.id] || '')}" autocomplete="off"></label>`;
    }).join('');
    set(topbar(t('regTitle'), {back:'welcome', noCard:true}) + `<div class="spage">
      <div class="shero"><p class="skicker">RESIDENT REGISTRATION</p><h2>${esc(t('regHead'))}</h2></div>
      <form id="svReg" class="scard">${fields}<button class="sbtn main pink" type="submit">${esc(t('regSubmit'))}</button></form>
      <p class="snote">${t('regNote')}</p></div>`);
    $('svReg').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target), fields = {};
      for(const f of defs().regfields){ fields[f.id] = String(fd.get(f.id) || '').trim(); if(f.required && !fields[f.id]){ toast(t('fillIn', T(f.label))); return; } }
      try{
        const j = await api('register', {fields});
        if(!j.ok) return toast(errText(j));
        Object.assign(L, fresh(), {defs:L.defs, rid:j.rid, token:j.token, recovery:j.recovery, resident:j.resident}); save();
        showCard({first:true});
      }catch(err){ toast(errText(err)); }
    });
  }
  function showRestore(){
    const keep = $('svRes') ? $('svRes').c.value : '';
    VIEW = showRestore;
    set(topbar(t('restoreTitle'), {back:'welcome', noCard:true}) + `<div class="spage">
      <div class="shero"><div class="sbig-icon">🔑</div><h2>${esc(t('restoreHead'))}</h2><p>${t('restoreLead')}</p></div>
      <form id="svRes" class="scard"><input class="sinput big mono" name="c" placeholder="XXXX-XXXX-XXXX" value="${esc(keep)}" autocomplete="off" autocapitalize="characters" aria-label="${esc(t('restoreCode'))}"><button class="sbtn main" type="submit">${esc(t('restoreDo'))}</button></form>
      <p class="snote">${esc(t('restoreNote'))}</p></div>`);
    $('svRes').addEventListener('submit', async e => {
      e.preventDefault();
      try{
        if(/^\s*RV[-\s]?\d{4}/i.test(e.target.c.value)){ shake(e.target); return toast(errText({error:'resident_no'})); }
        const j = await api('restore', {code:e.target.c.value});
        if(!j.ok){ shake(e.target); return toast(errText(j)); }
        Object.assign(L, fresh(), {defs:L.defs, rid:j.rid, token:j.token, recovery:'', resident:j.resident, state:Object.assign(emptyState(), j.state)}); save();
        celebrate(t('restored'));
        setTimeout(start, 900);
      }catch(err){ toast(errText(err)); }
    });
  }

  /* ---------- お休みの日 ---------- */
  function showClosed(){
    VIEW = showClosed;
    const up = L.upcoming || [];
    set(topbar('') + `<div class="spage"><div class="shero"><div class="sbig-icon">🌙</div><p class="skicker">CLOSED TODAY</p><h2>${esc(t('closedHead'))}</h2>
      <p>${esc(t('closedLead'))}</p></div>
      ${up.length ? `<div class="scard"><b class="sh">${esc(t('nextDays'))}</b><ul class="sdays">${up.map(d => `<li>${esc(T(d.label))}　${esc(fmtDate(d.date))}</li>`).join('')}</ul></div>` : ''}
      <button class="sbtn sub" data-act="card">${esc(t('seeCard'))}</button></div>`);
  }

  /* ---------- 入口のひみつのことば ---------- */
  function showGate(){
    const keep = $('svGate') ? $('svGate').w.value : '';
    VIEW = showGate;
    set(topbar('') + `<div class="spage"><div class="shero">
      <div class="sbig-icon">🗝️</div><p class="skicker">${esc(T(L.day.label))}　${esc(fmtDate(L.today))}</p>
      <h2>${esc(t('gateHead'))}</h2><p>${t('gateLead')}</p></div>
      <form id="svGate" class="scard"><input class="sinput big" name="w" placeholder="${esc(t('secretWord'))}" value="${esc(keep)}" autocomplete="off" aria-label="${esc(t('gateHead'))}"><button class="sbtn main" type="submit">${esc(t('enter'))}</button></form></div>`);
    $('svGate').addEventListener('submit', async e => {
      e.preventDefault();
      const w = e.target.w.value.trim(); if(!w) return;
      try{
        const j = await api('entrance', {word:w});
        if(!j.ok){ if(j.error === 'auth') return start(); shake(e.target); return toast(errText(j)); }
        L.unlocked = j.unlocked; L.map = j.map; L.visits = j.visits || L.visits; L.returning = !!j.returning; L.returningThis = !!j.returningThis; L.prevEvent = !!j.prevEvent; L.intro = j.intro || null; save();
        celebrate(fill(T(j.message) || t('entered')));
        setTimeout(route, 1000);
      }catch(err){ toast(errText(err)); }
    });
  }

  /* ---------- 地図 ---------- */
  function building(f){
    const r = esc(f.roof), w = esc(f.wall);
    if(f.type === 'windmill') return `<g class="bld"><path d="M-14 26 L-9 -14 L9 -14 L14 26 Z" fill="${w}" stroke="#7a4a20" stroke-width="2"/><path d="M-11 -14 L0 -28 L11 -14 Z" fill="${r}"/>
      <rect x="-5" y="10" width="10" height="16" rx="5" fill="#1e5aff"/><g class="sblades"><path d="M0 -18 L-4 -54 L4 -54 Z M0 -18 L36 -22 L36 -14 Z M0 -18 L4 18 L-4 18 Z M0 -18 L-36 -14 L-36 -22 Z" fill="#fff" stroke="#c89a6a" stroke-width="1.5"/><circle cx="0" cy="-18" r="3.5" fill="#7a4a20"/></g></g>`;
    if(f.type === 'well') return `<g class="bld"><path d="M-30 -24 L0 -40 L30 -24" fill="none" stroke="${r}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="-24" y="-26" width="5" height="34" fill="#7a5230"/><rect x="19" y="-26" width="5" height="34" fill="#7a5230"/><rect x="-21" y="-20" width="42" height="3" fill="#7a5230"/>
      <path d="M0 -18 L0 -2" stroke="#5a3a1a" stroke-width="1.5"/><path d="M-5 -2 h10 l-1.5 8 h-7 z" fill="#a0703a"/>
      <ellipse cx="0" cy="8" rx="28" ry="7" fill="#5aa8e8" stroke="#6a6a72" stroke-width="2"/>
      <path d="M-28 8 V24 Q0 34 28 24 V8 Q0 18 -28 8 Z" fill="${w}" stroke="#6a6a72" stroke-width="1.5"/>
      ${[[-20,14],[-6,17],[8,17],[22,14],[-14,24],[0,27],[14,24]].map(([x, y]) => `<rect x="${x-6}" y="${y-3}" width="12" height="6" rx="2" fill="rgba(0,0,0,.08)" stroke="rgba(90,90,100,.45)" stroke-width="1"/>`).join('')}
      <circle cx="-10" cy="7" r="1.6" fill="#fff"/><circle cx="6" cy="9" r="1.2" fill="#fff"/></g>`;
    if(f.type === 'tower') return `<g class="bld"><rect x="-16" y="-34" width="32" height="62" rx="2" fill="${w}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
      <path d="M-22 -32 L0 -58 L22 -32 Z" fill="${r}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/><circle cx="0" cy="-16" r="11" fill="#fffdf0" stroke="#c89a3a" stroke-width="2.5"/>
      <path d="M0 -16 V-24 M0 -16 L6 -13" stroke="#3a2a1a" stroke-width="2" stroke-linecap="round"/><rect x="-6" y="10" width="12" height="18" rx="6" fill="${r}"/>
      <rect x="-5" y="-4" width="10" height="8" fill="#ffd96a" stroke="#fff" stroke-width="1.5"/></g>`;
    if(f.type === 'forest') return `<g class="bld"><rect x="-3" y="10" width="6" height="16" fill="#7a4a20"/><rect x="-25" y="14" width="5" height="12" fill="#7a4a20"/><rect x="20" y="14" width="5" height="12" fill="#7a4a20"/>
      <circle cx="-22" cy="4" r="14" fill="${r}"/><circle cx="22" cy="4" r="14" fill="${r}"/><circle cx="0" cy="-8" r="20" fill="${r}"/><circle cx="-6" cy="-14" r="7" fill="rgba(255,255,255,.18)"/>
      <path d="M-30 24 Q0 16 30 24" stroke="${w}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="10" cy="-2" r="2.5" fill="#ff6a8a"/><circle cx="-14" cy="6" r="2.5" fill="#ffd000"/></g>`;
    if(f.type === 'plaza') return `<g class="bld"><ellipse cx="0" cy="14" rx="40" ry="16" fill="#f3dcc0" stroke="#c89a6a" stroke-width="2"/><circle cx="0" cy="8" r="10" fill="#7ad8ff" stroke="#fff" stroke-width="3"/>
      <path d="M0 -2 L0 -30" stroke="#c89a6a" stroke-width="3"/><path d="M0 -30 L18 -24 L0 -18 Z" fill="${r}"/>${[-30,-15,15,30].map((x, i) => `<circle cx="${x}" cy="${-4 - (i%2)*6}" r="3" fill="${['#ffd000','#e8101e','#10c050','#1e5aff'][i]}"/>`).join('')}</g>`;
    return `<g class="bld"><rect x="-26" y="-6" width="52" height="34" rx="3" fill="${w}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
      <path d="M-32 -4 L0 -30 L32 -4 Z" fill="${r}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/><rect x="-6" y="10" width="12" height="18" rx="6" fill="${r}"/>
      <rect x="-20" y="2" width="10" height="9" fill="#ffd96a" stroke="#fff" stroke-width="1.5"/><rect x="10" y="2" width="10" height="9" fill="#ffd96a" stroke="#fff" stroke-width="1.5"/></g>`;
  }
  // 道：広場（なければ地図の中心）から各施設へ、ゆるやかなカーブでつなぐ
  function roads(facs){
    const P = f => [Math.max(8, Math.min(92, f.x)) * 4, Math.max(8, Math.min(90, f.y)) * 5 + 26];
    const hub = facs.find(f => f.type === 'plaza'), c = hub ? P(hub) : [200, 260];
    let d = `M${c[0]} 0 L${c[0]} 500 `;   // 北の橋から南の入口まで、広場を通る大通り
    facs.filter(f => f !== hub && f.status !== 'hidden').forEach(f => { const p = P(f), mx = (c[0] + p[0]) / 2, my = (c[1] + p[1]) / 2 + 24; d += `M${c[0]} ${c[1]} Q${mx} ${my} ${p[0]} ${p[1]} `; });
    return d;
  }
  // 施設名の札：文字の長さに合わせて幅を決め、長すぎるときは詰めて1行に収める
  function pinLabel(f, stroke){
    const nm = T(f.name), est = Array.from(nm).reduce((a, c) => a + (/[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 12.5 : 7), 0);
    const w = Math.max(80, Math.min(136, est + 20)), fit = est + 20 > 136 ? `textLength="${w - 14}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<g transform="translate(0,46)"><rect class="pinlabel" x="${-w/2}" y="-12" width="${w}" height="24" rx="12" fill="#fff" stroke="${esc(stroke)}" stroke-width="2"/><text y="5" text-anchor="middle" font-size="12.5" font-weight="800" fill="#1f2f8f" ${fit}>${esc(nm)}</text></g>`;
  }
  // 地図の飾り：レンガの石だたみの村に、水路と橋、施設ごとの小さな芝生、丸い生け垣
  function mapCanals(){
    const edge = 'stroke="#9a5a36" stroke-width="5" fill="none"';
    return `<path d="M-10 22 H410" stroke="url(#svWater)" stroke-width="22"/><path d="M-10 10 H410 M-10 34 H410" ${edge}/>
      <path d="M-10 372 Q80 420 150 510" stroke="url(#svWater)" stroke-width="24" fill="none"/>
      <path d="M-10 359 Q88 408 162 510 M-10 385 Q72 432 138 510" ${edge}/>`;
  }
  function mapBridges(){
    return `<g transform="translate(200,22)"><rect x="-22" y="-16" width="44" height="32" rx="3" fill="#c8915e" stroke="#7a4a20" stroke-width="2"/><path d="M-22 -10H22M-22 -3H22M-22 4H22M-22 11H22" stroke="#9a6a3a" stroke-width="1.2"/></g>`;
  }
  function lawn(x, y){
    const dots = Array.from({length: 11}, (_, i) => { const a = Math.PI * (0.08 + 0.84 * i / 10); return `<circle cx="${(Math.cos(a) * 50).toFixed(1)}" cy="${(14 + Math.sin(a) * 22).toFixed(1)}" r="5" fill="#2f8a3e"/>`; }).join('');
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="14" rx="54" ry="26" fill="#7cc860" stroke="#5aa848" stroke-width="2"/>${dots}</g>`;
  }
  function hedge(x, y){
    const c = [[-12,-8],[0,-8],[12,-8],[-12,4],[0,4],[12,4]];
    return `<g transform="translate(${x},${y})"><rect x="-22" y="-17" width="44" height="32" rx="8" fill="#2f7a38"/>${c.map(([a, b]) => `<circle cx="${a}" cy="${b}" r="7" fill="#3f9a48"/><circle cx="${a - 2}" cy="${b - 2}" r="2.5" fill="#6cc070"/>`).join('')}</g>`;
  }
  function showMap(){
    VIEW = showMap;
    const facs = L.map || [];
    const pins = facs.map(f => {
      const x = Math.max(8, Math.min(92, f.x)) * 4, y = Math.max(8, Math.min(90, f.y)) * 5;
      if(f.status === 'blocked') return `<g transform="translate(${x},${y})" class="spin blocked" data-act="hiddenfac" data-id="${esc(f.id)}" role="button" tabindex="0" aria-label="${esc(T(f.name))}（${esc(t('blockedLabel'))}）">
        <ellipse cx="0" cy="30" rx="34" ry="7" fill="rgba(60,30,10,.18)"/>${building(f)}
        ${pinLabel(f, '#b8a898')}
        <g transform="translate(32,-30)"><circle r="13" fill="#b8a898" stroke="#fff" stroke-width="2"/><text y="4.5" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">…</text></g></g>`;
      if(f.status === 'hidden') return `<g transform="translate(${x},${y})" class="spin ghost" data-act="hiddenfac" data-id="${esc(f.id)}" role="button" tabindex="0" aria-label="${esc(t('hiddenPlace'))}">
        <circle r="24" fill="rgba(255,255,255,.6)" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 4"/><text y="8" text-anchor="middle" font-size="24" font-weight="800" fill="#8a7a9a">?</text></g>`;
      const st = f.status, badge = st === 'locked' ? '🔒' : st === 'done' ? '✓' : 'NEW', bc = st === 'done' ? '#10a040' : st === 'open' ? '#e23d72' : '#5a6390';
      return `<g transform="translate(${x},${y})" class="spin ${st}" data-act="fac" data-id="${esc(f.id)}" role="button" tabindex="0" aria-label="${esc(T(f.name))}（${esc(t(st === 'locked' ? 'legendLocked' : st === 'done' ? 'legendDone' : 'legendOpen'))}）">
        <ellipse cx="0" cy="30" rx="34" ry="7" fill="rgba(60,30,10,.18)"/>${building(f)}
        ${pinLabel(f, f.roof)}
        <g transform="translate(32,-30)"><g class="badge"><circle r="13" fill="${bc}" stroke="#fff" stroke-width="2"/><text y="4.5" text-anchor="middle" font-size="${st === 'open' ? 8.5 : 12}" font-weight="800" fill="#fff">${badge}</text></g></g></g>`;
    }).join('');
    const its = Object.keys(L.state.items).filter(k => L.state.items[k] && defs().items[k]);
    set(topbar(t('mapTitle')) + `<div class="spage">
      <div class="sday"><span>${esc(L.day ? T(L.day.label) : '')}</span>${esc(fmtDate(L.today))}</div>
      <div class="smap"><svg viewBox="0 0 400 500" role="img" aria-label="${esc(t('mapTitle'))}">
        <defs><pattern id="svPave" width="32" height="16" patternUnits="userSpaceOnUse"><rect width="32" height="16" fill="#d9895a"/><rect x="1" y="1" width="14" height="6" fill="#df9466"/><rect x="17" y="9" width="14" height="6" fill="#d27f52"/><path d="M0 0H32M0 8H32M0 16H32M16 0V8M8 8V16M24 8V16" stroke="#b56a40" stroke-width="1.2"/></pattern>
        <pattern id="svLane" width="20" height="10" patternUnits="userSpaceOnUse"><rect width="20" height="10" fill="#f2c79c"/><path d="M0 0H20M0 5H20M5 0V5M15 5V10" stroke="#d9a070" stroke-width="1"/></pattern>
        <pattern id="svWater" width="40" height="12" patternUnits="userSpaceOnUse"><rect width="40" height="12" fill="#4f9ee0"/><path d="M4 4 q5 -3 10 0 M24 9 q5 -3 10 0" stroke="#bfe4ff" stroke-width="1.6" fill="none" stroke-linecap="round"/></pattern></defs>
        <rect width="400" height="500" fill="url(#svPave)"/>
        ${mapCanals()}
        <path d="${roads(facs)}" stroke="#b56a40" stroke-width="30" fill="none" stroke-linecap="round"/>
        <path d="${roads(facs)}" stroke="url(#svLane)" stroke-width="24" fill="none" stroke-linecap="round"/>
        ${mapBridges()}
        ${facs.filter(f => f.status !== 'hidden' && f.type !== 'plaza').map(f => lawn(Math.max(8, Math.min(92, f.x)) * 4, Math.max(8, Math.min(90, f.y)) * 5)).join('')}
        ${[[36,190],[364,200],[150,150],[250,150],[364,420],[36,440],[290,470],[110,470]].filter(([x, y]) => facs.every(f => Math.hypot(Math.max(8, Math.min(92, f.x)) * 4 - x, Math.max(8, Math.min(90, f.y)) * 5 + 10 - y) > 66)).map(([x, y]) => hedge(x, y)).join('')}
        ${pins}
      </svg></div>
      <div class="slegend"><span><i style="background:#5a6390"></i>${esc(t('legendLocked'))}</span><span><i style="background:#e23d72"></i>${esc(t('legendOpen'))}</span><span><i style="background:#10a040"></i>${esc(t('legendDone'))}</span></div>
      <div class="scard"><b class="sh">${esc(t('items'))}</b>${its.length ? `<ul class="sitems">${its.map(k => `<li title="${esc(T(defs().items[k].desc))}"><span>${esc(defs().items[k].icon || '★')}</span>${esc(T(defs().items[k].name))}</li>`).join('')}</ul>` : `<p class="snote" style="text-align:left">${esc(t('noItems'))}</p>`}</div>
      <p class="snote">${t('mapNote')}</p></div>`);
  }

  /* ---------- 施設のひみつのことば ---------- */
  function openFac(id){
    const f = (L.map || []).find(x => x.id === id); if(!f) return;
    if(f.status !== 'locked') return fetchStory(f, '');
    const keep = $('svFac') ? $('svFac').w.value : '';
    modal(`<div class="sdlg" role="dialog" aria-label="${esc(T(f.name))}"><div class="sdlghead" style="--c:${esc(f.roof)}"><b>${esc(T(f.name))}</b><span>${esc(T(f.sub))}</span></div>
      <p>${esc(t('facLead'))}</p>
      <form id="svFac"><input class="sinput big" name="w" placeholder="${esc(t('secretWord'))}" value="${esc(keep)}" autocomplete="off" aria-label="${esc(T(f.name))} ${esc(t('secretWord'))}"><button class="sbtn main" type="submit">${esc(t('open'))}</button></form>
      <button class="sbtn link" data-act="close">${esc(t('close'))}</button></div>`, () => openFac(id));
    const form = $('svFac'); setTimeout(() => form.w.focus(), 60);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const w = form.w.value.trim(); if(!w) return;
      await fetchStory(f, w, form);
    });
  }
  async function fetchStory(f, word, form){
    // 今日すでにひらいた施設も、最新の物語をサーバーから受け取る（シートを直したら反映される）。
    // 通信できないときだけ、手元の控えで読む
    try{
      const j = await api('facility', {facility:f.id, word});
      if(!j.ok){ if(form) shake(form); if(j.error === 'entrance_first'){ closeModal(); return start(); } return toast(errText(j)); }
      closeModal();
      if(j.map) L.map = j.map;
      if(!j.story){ save(); showMap(); return toast(t('noStory')); }
      L.stories[f.id] = j.story; save();
      if(word){ celebrate(fill(T(j.message) || t('facOpened', T(f.name)))); setTimeout(() => play(j.story), 900); }
      else play(j.story);
    }catch(err){
      if(!word && L.stories[f.id]){ closeModal(); return play(L.stories[f.id]); }
      toast(errText(err));
    }
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
  // 1画面の文は短く：長いセリフは文の切れ目で自動的にページを分ける（目安60文字）
  function splitText(t){
    t = String(t || '');
    const PAGE_MAX = lang() === 'en' ? 140 : lang() === 'kana' ? 70 : 60;   // 英語は文字数が多くなるので長め
    if(t.length <= PAGE_MAX) return [t];
    const parts = t.match(/[^。！？!?.]+[。！？!?.」』）)"]*\s*|[^。！？!?.]+$/g) || [t], out = [];
    let cur = '';
    parts.forEach(p => { if(cur && (cur + p).length > PAGE_MAX){ out.push(cur); cur = p; } else cur += p; });
    if(cur) out.push(cur);
    return out;
  }
  function enterScene(){
    const sc = scene();
    if(!sc){ toast(t('sceneMissing')); return finish(); }
    P.got = addAll(sc.add, sc.flag, sc.item); P.line = 0; P.gotShown = false;
    rePage(); render();
  }
  // 表示モードに合わせてページを作る（切りかえたときは、同じセリフの最初のページから）
  function rePage(){
    const sc = scene(); if(!sc) return;
    const src = P.pages && P.pages[P.line] ? P.pages[P.line].src : 0;
    P.pages = [];
    (sc.lines.length ? sc.lines : [['', '']]).forEach((l, n) => splitText(fill(T(l[1]))).forEach((tx, i) => P.pages.push({who:l[0], text:tx, voice:i === 0 ? voiceOf(l[2]) : '', src:n})));
    const at = P.pages.findIndex(p => p.src === src);
    P.line = at < 0 ? 0 : at;
  }
  function voiceOf(v){ return T(v); }
  function check(c){
    if(!c) return true;
    if(c.unknown && c.unknown.length) return false;
    const st = L.state;
    if(c.day && (!L.day || L.day.dayNo !== c.day)) return false;
    if(c.returning === true && !L.returning) return false;
    if(c.returning === false && L.returning) return false;
    if(c.prevEvent && !L.prevEvent) return false;
    if(c.returningThis === true && !L.returningThis) return false;
    if(c.returningThis === false && L.returningThis) return false;
    if(c.flags && !c.flags.every(f => st.flags[f])) return false;
    if(c.notFlags && c.notFlags.some(f => st.flags[f])) return false;
    if(c.items && !c.items.every(i => st.items[i])) return false;
    if(c.points && !Object.keys(c.points).every(k => (st.points[k] || 0) >= c.points[k])) return false;
    const ev = L.day ? L.day.event : '';
    if(c.done && !c.done.every(f => st.done[ev + ':' + f])) return false;
    if(c.doneCount && Object.keys(st.done).filter(k => k.indexOf(ev + ':') === 0).length < c.doneCount) return false;
    return true;
  }
  function face(k){ return `<span class="sface"><img src="${charImg(k)}" alt=""></span>`; }
  function render(){
    const sc = scene(), pages = P.pages, pg = pages[P.line] || {who:'', text:''};
    const who = pg.who, last = P.line >= pages.length - 1;
    const choices = last ? sc.choices.filter(c => check(c.cond)) : [];
    const fac = (L.map || []).find(x => x.id === P.b.facility);
    const bg = /^#[0-9a-f]{3,8}$/i.test(sc.bg) ? `style="background:${sc.bg}"` : '';
    const got = last && P.got.length ? `<div class="sgot">${P.got.map(i => { const it = defs().items[i]; return `<span>${it ? esc((it.icon || '★') + ' ' + T(it.name)) : esc(i)} ${esc(t('gotItem'))}</span>`; }).join('')}</div>` : '';
    const ending = last && sc.ar;
    let foot;
    if(choices.length) foot = `<div class="schoices" role="group" aria-label="${esc(t('whatDo'))}"><p class="sask">${esc(t('whatDo'))}</p>${choices.map(c => `<button class="sbtn choice" data-act="choose" data-i="${sc.choices.indexOf(c)}">${esc(fill(T(c.text)))}</button>`).join('')}</div>`;
    else if(ending) foot = `<div class="sar"><a class="sbtn main pink" href="${esc(arLink(sc.ar))}" target="_blank" rel="noopener" data-act="ar">${esc(fill(T(sc.arLabel) || t('arDefault')))}</a>
      <small>${esc(t('arNote'))}</small><button class="sbtn link" data-act="next">${esc(t('backToMap'))}</button></div>`;
    else foot = `<button class="sbtn main snextbtn" data-act="next">${esc(t(last && !sc.next ? 'close' : 'next'))} <span aria-hidden="true">▶</span></button>`;
    const dots = pages.length > 1 ? `<span class="sdots" aria-label="${P.line + 1} / ${pages.length}">${pages.map((_, i) => `<i class="${i === P.line ? 'on' : ''}"></i>`).join('')}</span>` : '<span></span>';
    set(`<div class="sscene bg-${esc(/^[a-z]+$/.test(sc.bg) ? sc.bg : 'meadow')}" ${bg}>
      <div class="sstop"><button class="sbtn ghost" data-act="leave">‹ ${esc(t('toMap'))}</button><span class="sbarr">${langBtn()}${soundBtn()}</span></div>
      ${fac ? `<span class="sfac">${esc(T(fac.name))}</span>` : ''}
      ${who ? `<img class="sactor" src="${charImg(who)}" alt="" aria-hidden="true">` : ''}
      <article class="sbook ${who ? '' : 'narr'}" aria-live="polite">
        ${who ? `<header class="sspeaker">${face(who)}<b>${esc(cname(who))}</b></header>` : ''}
        <p class="stext">${esc(pg.text)}</p>${got}
        <div class="snav">${P.line > 0 ? `<button class="sbtn link sprev" data-act="prev">◀ ${esc(t('prev'))}</button>` : '<span></span>'}${dots}</div>
        ${foot}
      </article></div>`);
    SFX.voice(pg.voice);
    if(last && P.got.length && !P.gotShown){ P.gotShown = true; setTimeout(() => itemPop(P.got), 250); }
    if(ending && !P.endShown){ P.endShown = true; endingFx(); }
  }
  function endingFx(){
    const c = document.createElement('div'); c.className = 'sending'; c.setAttribute('role', 'status');
    c.innerHTML = `<div class="sendcard"><span>✦</span><b>${esc(t('theEnd'))}</b><em>${lang() === 'en' ? '' : 'THE END'}</em></div>` + Array.from({length:30}, () => `<i style="--x:${(Math.random()*100).toFixed(1)}%;--y:${(Math.random()*70).toFixed(1)}%;--d:${(Math.random()*1.4).toFixed(2)}s;--s:${(6 + Math.random()*10).toFixed(0)}px"></i>`).join('');
    c.addEventListener('click', () => c.remove());
    document.body.appendChild(c); SFX.play('ending');
    setTimeout(() => c.remove(), 3600);
  }
  function arLink(m){ const u = new URL(AR_URL, location.href); u.searchParams.set('ar', m); return u.href; }
  function next(){
    const sc = scene(); if(!sc) return;
    if(P.line < P.pages.length - 1){ P.line++; SFX.play('page'); return render(); }
    if(sc.next && P.b.scenes[sc.next]){ P.id = sc.next; return enterScene(); }
    finish();
  }
  function choose(i){
    const sc = scene(), c = sc.choices[i]; if(!c) return;
    const got = addAll(c.add, c.flag, c.item); if(got.length) setTimeout(() => itemPop(got), 300);
    push({type:'choice', scene:P.id, choice:c.id, text:typeof c.text === 'object' ? (c.text.ja || T(c.text)) : c.text});   // 集計は日本語の文で（言語で分かれない）
    if(c.next && P.b.scenes[c.next]){ P.id = c.next; enterScene(); } else finish();
  }
  async function finish(){
    const b = P && P.b; P = null;
    if(b && b.facility !== 'intro'){
      const dk = (L.day ? L.day.event : '') + ':' + b.facility;
      if(!L.state.done[dk]) L.state.done[dk] = L.today;
      push({type:'done', facility:b.facility, route:b.route});
    }
    // 待たせずに、すぐ地図へ戻る（読み終えた印は手元で先につける）
    if(b && L.map){ const m = L.map.find(x => x.id === b.facility); if(m && m.status !== 'hidden') m.status = 'done'; }
    save();
    route();
    // 記録の送信と地図の更新（広場がひらく など）は、うしろで行う
    try{
      const j = await api('boot', {}, {quiet:true});
      if(j.ok){
        const before = JSON.stringify(L.map), wasMap = VIEW === showMap;
        const closed = (L.map || []).filter(x => x.status === 'blocked' || x.status === 'hidden').map(x => x.id);
        takeBoot(j);
        const opened = (L.map || []).some(x => closed.includes(x.id) && x.status !== 'blocked' && x.status !== 'hidden');
        if(wasMap && VIEW === showMap && !document.querySelector('.smodal:not([hidden]), .sitempop') && JSON.stringify(L.map) !== before){ const y = window.scrollY; showMap(); window.scrollTo(0, y); }
        if(opened && VIEW === showMap){ SFX.play('correct'); toast(t('newPlace')); }
      }
    }catch(e){}
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
    const stamps = days.length ? days.map(d => `<div class="sstamp on"><b>${esc(d.slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/'))}</b><span>${esc(t('visited'))}</span></div>`).join('') : `<div class="sstamp"><b>${esc(t('notYet'))}</b><span>${esc(t('beforeVisit'))}</span></div>`;
    const P2 = defs().points || {}, pts = Object.keys(P2).map(k => `<li><span>${esc(T(P2[k]))}</span><b>${L.state.points[k] || 0}</b></li>`).join('');
    const its = Object.keys(L.state.items).filter(k => L.state.items[k] && defs().items[k]);
    modal(`<div class="sresident" role="dialog" aria-label="${esc(t('card'))}">
      <div class="srtop"><span>${esc(t('village'))}</span><b>${esc(t('card'))}</b>${lang() === 'en' ? '' : '<em>RESIDENT CARD</em>'}</div>
      <div class="srbody">
        ${friend ? `<div class="srphoto"><img src="${charImg(friend)}" alt=""><span>${esc(t('friendOf', cname(friend)))}</span></div>` : ''}
        <dl><dt>${esc(t('residentNo'))}</dt><dd class="mono">${esc(r.rid)}</dd><dt>${esc(t('residentName'))}</dt><dd class="nm">${esc(f[nameF.id] || '')}</dd>
        ${extra.map(x => `<dt>${esc(T(x.label).replace(/（.*?）|\s*\(.*?\)/, ''))}</dt><dd>${esc(optLabel(x, f[x.id]))}</dd>`).join('')}
        <dt>${esc(t('registered'))}</dt><dd>${esc(fmtDate(String(r.createdAt || '').slice(0, 10)))}</dd></dl>
        <div class="srseal" aria-hidden="true">${t('seal')}</div>
      </div>
      <div class="srstamps">${stamps}</div>
      ${pts ? `<ul class="srpts">${pts}</ul>` : ''}
      ${its.length ? `<div class="sritems">${its.map(k => `<span>${esc((defs().items[k].icon || '★') + ' ' + T(defs().items[k].name))}</span>`).join('')}</div>` : ''}
      ${L.recovery ? `<div class="srcode"><small>${t('codeLabel')}</small><b class="mono">${esc(L.recovery)}</b></div>`
        : `<button class="sbtn sub" data-act="newcode">${esc(t('newCode'))}</button>`}
      ${opt.first ? `<p class="srwelcome">${esc(t('regDone'))}</p>` : ''}
      <button class="sbtn main" data-act="${opt.first ? 'closego' : 'close'}">${esc(t(opt.first ? 'goVillage' : 'close'))}</button>
      ${opt.first ? '' : `<details class="srmore"><summary>${esc(t('moreOps'))}</summary><p>${esc(t('deleteNote'))}</p><button class="sbtn danger" data-act="delete">${esc(t('deleteBtn'))}</button></details>`}
    </div>`, () => showCard(opt));
  }

  /* ---------- 操作 ---------- */
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if(!b) return;
    const a = b.dataset.act;
    if(a === 'ar'){ const dk = P && P.b ? (L.day ? L.day.event : '') + ':' + P.b.facility : ''; if(P && P.b && P.b.facility !== 'intro' && !L.state.done[dk]){ L.state.done[dk] = L.today; push({type:'done', facility:P.b.facility, route:P.b.route}); syncSoon(); } return; }   // リンクはそのまま新しいタブで開く
    e.preventDefault();
    if(a === 'lang') return showLangPicker();
    if(a === 'setlang') return applyLang(b.dataset.lang);
    if(a === 'welcome') return showWelcome();
    if(a === 'register') return showRegister();
    if(a === 'restore') return showRestore();
    if(a === 'retry') return start();
    if(a === 'card') return showCard();
    if(a === 'close') return closeModal();
    if(a === 'closego'){ closeModal(); return start(); }
    if(a === 'fac') return openFac(b.dataset.id);
    if(a === 'hiddenfac'){ const f = (L.map || []).find(x => x.id === b.dataset.id); return toast(f && T(f.hint) ? T(f.hint) : t('hiddenHint')); }
    if(a === 'next') return next();
    if(a === 'prev'){ if(P && P.line > 0){ P.line--; render(); } return; }
    if(a === 'sound'){ SFX.set(!SFX.on); b.outerHTML = soundBtn(); if(SFX.on) SFX.play('page'); return; }
    if(a === 'choose') return choose(+b.dataset.i);
    if(a === 'leave'){ SFX.stopVoice(); P = null; return showMap(); }
    if(a === 'newcode'){
      try{ const j = await api('newRecovery'); if(!j.ok) return toast(errText(j)); L.recovery = j.recovery; save(); showCard(); toast(t('newCodeDone')); }catch(err){ toast(errText(err)); }
      return;
    }
    if(a === 'delete'){
      if(!confirm(t('deleteAsk'))) return;
      try{ const j = await api('delete'); if(!j.ok) return toast(errText(j)); }catch(err){ return toast(errText(err)); }
      L = fresh(); save(); closeModal(); showWelcome(); toast(t('deleted'));
    }
  });
  document.addEventListener('keydown', e => {
    if((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')){ e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', {bubbles:true})); }
  });
  // 別のタブ（AR）から戻ってきたら、記録を送って地図を最新に
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && L.rid && !P && L.outbox.length) syncSoon(); });

  start();
})();
