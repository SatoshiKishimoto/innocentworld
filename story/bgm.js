/* レンガ村の物語　BGM（テーマパークのエリア音楽のように、場所ごとに曲が変わる）
   音はすべてブラウザの中で合成します（音声ファイルは使いません）。曲はすべてこのアプリ用のオリジナルです。
   使い方：IWBGM.play('map') / IWBGM.play('bakery') … / IWBGM.setOn(false) */
(function(){
  'use strict';
  const NOTE = {C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11};
  const midi = s => { const m = s.match(/^([A-G](?:#|b)?)(\d)$/); return m ? 12 * (+m[2] + 1) + NOTE[m[1]] : null; };
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  // 和音：根音＋種類（'' 長三和音 / m 短三和音 / 7 属七 / M7 長七 / m7 短七）
  function chord(name){
    const m = name.match(/^([A-G](?:#|b)?)(m7|M7|m|7)?$/); if(!m) return [48, 52, 55];
    const r = 48 + NOTE[m[1]], q = m[2] || '';
    const iv = {'':[0,4,7], m:[0,3,7], '7':[0,4,7,10], M7:[0,4,7,11], m7:[0,3,7,10]}[q];
    return iv.map(i => r + i);
  }
  // 旋律：「音名オクターブ.長さ(8分音符の数)」をすき間で区切る。r は休み
  function melody(str){
    const out = []; let at = 0;
    str.trim().split(/\s+/).forEach(tok => { const [n, l] = tok.split('.'); const len = +l || 1; if(n !== 'r') out.push({at, n:midi(n), len}); at += len; });
    return {notes:out, steps:at};
  }

  /* ---------- 曲 ---------- */
  const SONGS = {
    // 入口・住民登録：ゲートをくぐるときのわくわくするマーチ
    gate: {bpm:132, beats:4, lead:'glock', lead2:'brass', acc:'oompah', drums:'march',
      chords:'C F G C Am F D7 G',
      mel:`E5.2 G5.2 C6.3 G5.1  A5.2 F5.2 C5.2 F5.2  G5.3 F5.1 E5.2 D5.2  E5.4 C5.2 r.2
           A5.2 C6.2 E6.2 C6.2  F5.2 A5.2 C6.2 A5.2  F#5.2 A5.2 D6.2 C6.2  B5.4 G5.2 r.2`},
    // 地図：村をお散歩する、はずむような曲
    map: {bpm:112, beats:4, lead:'reed', lead2:'glock', acc:'oompah', drums:'stroll',
      chords:'F C Dm Bb F Gm7 C7 F Bb F Gm C Am Dm G7 C7',
      mel:`C5.1 F5.1 A5.2 G5.1 F5.1 A5.2  G5.3 E5.1 C5.4  D5.1 F5.1 A5.2 D6.2 A5.2  Bb5.3 A5.1 G5.2 F5.2
           A5.1 C6.1 A5.2 F5.2 A5.2  Bb5.2 A5.2 G5.2 F5.2  E5.2 G5.2 Bb5.2 E5.2  F5.6 r.2
           D6.2 Bb5.2 F5.2 Bb5.2  C6.3 A5.1 F5.4  G5.1 A5.1 Bb5.2 D6.2 Bb5.2  C6.6 r.2
           E6.2 C6.2 A5.2 C6.2  D6.3 C6.1 A5.2 F5.2  G5.2 B5.2 D6.2 F6.2  E6.4 C6.2 r.2`},
    // 村の井戸：水面がゆれる、すこしふしぎな曲
    well: {bpm:80, beats:4, lead:'musicbox', acc:'arp', accVoice:'harp', drums:'',
      chords:'Am F C G Am Dm E7 Am',
      mel:`E5.4 A5.2 B5.2  C6.4 A5.4  G5.2 E5.2 G5.2 C6.2  B5.6 r.2
           A5.2 C6.2 E6.4  D6.2 C6.2 A5.4  B5.2 G#5.2 E5.2 D6.2  C6.2 B5.2 A5.4`},
    // パン屋さん：アコーディオンのワルツ
    bakery: {bpm:152, beats:3, lead:'accordion', acc:'waltz', drums:'',
      chords:'G G D7 D7 D7 D7 G G G7 C C G Em A7 D7 G',
      mel:`D5.2 G5.2 B5.2  D6.4 B5.2  C6.2 A5.2 F#5.2  A5.4 D5.2  F#5.2 A5.2 C6.2  E6.4 C6.2  B5.2 G5.2 D5.2  G5.4 r.2
           F5.2 G5.2 B5.2  E6.4 C6.2  E6.2 D6.2 C6.2  B5.4 G5.2  G5.2 B5.2 E6.2  C#6.2 E6.2 G5.2  F#5.2 A5.2 C6.2  B5.4 r.2`},
    // 森：木もれ日の中の、フルートの曲（ときどき小鳥）
    forest: {bpm:100, beats:4, lead:'flute', acc:'pad', drums:'birds',
      chords:'D G D A Bm G Em7 A7',
      mel:`F#5.2 A5.2 D6.3 A5.1  B5.2 D6.2 B5.2 G5.2  A5.3 F#5.1 D5.4  E5.2 F#5.2 A5.4
           D6.2 C#6.2 B5.2 F#5.2  G5.2 B5.2 D6.4  E6.2 D6.2 B5.2 G5.2  A5.4 C#6.2 E6.2`},
    // 時計台：チクタクと歯車がまわる、ピチカートの曲
    clock: {bpm:116, beats:4, lead:'pizz', lead2:'glock', acc:'staccato', drums:'ticktock',
      chords:'Em B7 Em B7 C G Am B7',
      mel:`E5.1 r.1 G5.1 r.1 B5.1 r.1 G5.1 r.1  F#5.1 r.1 A5.1 r.1 D#5.1 r.1 F#5.1 r.1  E5.1 G5.1 B5.1 E6.1 D6.2 B5.2  A5.2 F#5.2 D#5.4
           E5.1 r.1 G5.1 r.1 C6.1 r.1 E6.1 r.1  D6.2 B5.2 G5.4  A5.1 C6.1 E6.1 C6.1 A5.2 C6.2  B5.4 r.4`},
    // 図書館：しずかなオルゴール
    library: {bpm:88, beats:3, lead:'musicbox', acc:'arp', accVoice:'musicbox', drums:'',
      chords:'Eb Cm Ab Bb Eb Fm Bb7 Eb',
      mel:`G5.2 Bb5.2 Eb6.2  D6.4 C6.2  C6.2 Ab5.2 Eb5.2  F5.6  G5.2 Bb5.2 G6.2  F6.2 Eb6.2 C6.2  D6.2 Bb5.2 Ab5.2  G5.6`},
    // 中央広場：パレードのマーチ
    plaza: {bpm:126, beats:4, lead:'brass', lead2:'glock', acc:'oompah', drums:'parade',
      chords:'Bb Eb F Bb Gm Cm F7 Bb',
      mel:`F5.2 Bb5.2 D6.2 F6.2  G6.3 F6.1 Eb6.2 G5.2  A5.2 C6.2 F6.2 Eb6.2  D6.4 Bb5.2 r.2
           Bb5.1 C6.1 D6.2 G6.2 D6.2  Eb6.2 D6.2 C6.2 G5.2  A5.2 C6.2 Eb6.2 A5.2  Bb5.4 F5.2 Bb5.2`},
    // お休みの日：子守うた
    night: {bpm:70, beats:4, lead:'musicbox', acc:'arp', accVoice:'harp', drums:'',
      chords:'C Am F G C Am F G',
      mel:`E5.4 G5.4  A5.4 E5.4  F5.2 A5.2 C6.4  B5.8  C6.4 G5.4  A5.4 C6.4  A5.4 G5.2 F5.2  G5.8`}
  };
  Object.keys(SONGS).forEach(k => { const s = SONGS[k]; s.chordList = s.chords.split(/\s+/).map(chord); s.m = melody(s.mel); s.barSteps = s.beats * 2; s.total = s.chordList.length * s.barSteps; });

  /* ---------- 音色 ---------- */
  let ctx = null, master = null, noiseBuf = null, on = true;
  function ac(){
    if(!ctx){
      const C = window.AudioContext || window.webkitAudioContext; if(!C) return null;
      ctx = new C(); master = ctx.createGain(); master.gain.value = on ? 1 : 0;
      const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  }
  function env(g, t, a, peak, dur, rel){
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, Math.max(t + a, t + dur - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function osc(out, type, f, t, dur, peak, a, rel, detune){
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if(detune) o.detune.value = detune;
    env(g, t, a, peak, dur, rel); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function filtered(out, freq, q){ const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q || 0.7; f.connect(out); return f; }
  const VOICE = {
    glock(out, f, t, d, v){ osc(out, 'sine', f * 2, t, 0.9, v * 0.8, 0.003, 0.85); osc(out, 'sine', f * 5.4, t, 0.25, v * 0.12, 0.002, 0.24); },
    musicbox(out, f, t, d, v){ osc(out, 'sine', f * 2, t, 1.4, v, 0.003, 1.35); osc(out, 'triangle', f * 4, t, 0.35, v * 0.18, 0.002, 0.33); },
    brass(out, f, t, d, v){ const fl = filtered(out, 1800, 1.2); fl.frequency.setValueAtTime(700, t); fl.frequency.linearRampToValueAtTime(2200, t + 0.06); osc(fl, 'sawtooth', f, t, d * 0.92, v * 0.55, 0.03, 0.06); },
    reed(out, f, t, d, v){ const fl = filtered(out, 1600); osc(fl, 'square', f, t, d * 0.88, v * 0.45, 0.015, 0.05); },
    accordion(out, f, t, d, v){ const fl = filtered(out, 2400); osc(fl, 'sawtooth', f, t, d * 0.95, v * 0.32, 0.03, 0.06, -7); osc(fl, 'sawtooth', f, t, d * 0.95, v * 0.32, 0.03, 0.06, 7); },
    flute(out, f, t, d, v){ const o = osc(out, 'sine', f * 2, t, d * 0.95, v * 0.9, 0.06, 0.1); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.2; lg.gain.value = f * 0.012; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d); osc(out, 'triangle', f * 2, t, d * 0.95, v * 0.15, 0.08, 0.1); },
    pizz(out, f, t, d, v){ osc(out, 'triangle', f, t, 0.28, v * 1.1, 0.004, 0.26); osc(out, 'sine', f * 2, t, 0.14, v * 0.3, 0.003, 0.13); },
    harp(out, f, t, d, v){ osc(out, 'triangle', f, t, 1.1, v, 0.004, 1.05); },
    pluck(out, f, t, d, v){ osc(out, 'triangle', f, t, 0.22, v, 0.004, 0.2); },
    pad(out, f, t, d, v){ const fl = filtered(out, 1200); osc(fl, 'sawtooth', f, t, d, v * 0.35, d * 0.25, d * 0.3, -6); osc(fl, 'sawtooth', f, t, d, v * 0.35, d * 0.25, d * 0.3, 6); },
    bass(out, f, t, d, v){ osc(out, 'triangle', f, t, Math.min(d, 0.5), v, 0.01, 0.12); }
  };
  function noise(out, t, dur, v, type, freq){
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    env(g, t, 0.002, v, dur, dur * 0.9); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02);
  }
  const DRUM = {
    kick(out, t, v){ const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); env(g, t, 0.004, v, 0.2, 0.18); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.25); },
    snare(out, t, v){ noise(out, t, 0.14, v, 'bandpass', 1800); osc(out, 'triangle', 190, t, 0.08, v * 0.5, 0.002, 0.07); },
    hat(out, t, v){ noise(out, t, 0.04, v, 'highpass', 7000); },
    tick(out, t, v, hi){ osc(out, 'sine', hi ? 1900 : 1300, t, 0.05, v, 0.001, 0.045); },
    bird(out, t, v){ const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(2600, t); o.frequency.exponentialRampToValueAtTime(3900, t + 0.07); o.frequency.exponentialRampToValueAtTime(2900, t + 0.13);
      env(g, t, 0.01, v, 0.15, 0.08); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2); }
  };

  /* ---------- 1拍（8分音符1つ）ずつ鳴らす ---------- */
  function step(S, out, i, t, sd){
    const bar = Math.floor(i / S.barSteps) % S.chordList.length, inBar = i % S.barSteps, beat = inBar / 2, ch = S.chordList[bar];
    const at = i % S.total;
    S.m.notes.forEach(n => { if(n.at === at && n.n){ const d = n.len * sd; VOICE[S.lead](out, hz(n.n - 12), t, d, 0.07); if(S.lead2 && n.len >= 2) VOICE[S.lead2](out, hz(n.n - 12), t, d, 0.025); } });
    const root = ch[0] - 12, onBeat = inBar % 2 === 0;
    if(S.acc === 'oompah' && onBeat){
      if(beat % 2 === 0) VOICE.bass(out, hz(beat === 0 ? root : root + 7 - (ch[2] - ch[0] === 7 ? 0 : 0)), t, sd * 2, 0.11);
      else ch.slice(0, 3).forEach(n => VOICE.pluck(out, hz(n + 12), t, sd, 0.025));
    }
    if(S.acc === 'staccato' && onBeat){
      if(beat % 2 === 0) VOICE.pluck(out, hz(beat === 0 ? root : root + 7), t, sd, 0.1);
      else ch.slice(0, 3).forEach(n => VOICE.pluck(out, hz(n + 12), t, sd * 0.6, 0.022));
    }
    if(S.acc === 'waltz' && onBeat){
      if(beat === 0) VOICE.bass(out, hz(root), t, sd * 2, 0.11);
      else ch.forEach(n => VOICE.pluck(out, hz(n + 12), t, sd, 0.022));
    }
    if(S.acc === 'arp'){
      const seq = ch.concat(ch.map(n => n + 12)), n = seq[inBar % seq.length];
      VOICE[S.accVoice || 'harp'](out, hz(n), t, sd, 0.03);
      if(inBar === 0) VOICE.bass(out, hz(root), t, sd * S.barSteps, 0.06);
    }
    if(S.acc === 'pad'){
      if(inBar === 0){ ch.slice(0, 3).forEach(n => VOICE.pad(out, hz(n + 12), t, sd * S.barSteps, 0.03)); VOICE.bass(out, hz(root), t, sd * 4, 0.09); }
      if(inBar === 4) VOICE.bass(out, hz(root + 7), t, sd * 4, 0.07);
      if(onBeat) VOICE.harp(out, hz(ch[(beat + 1) % ch.length] + 24), t, sd, 0.012);
    }
    const D = S.drums;
    if(D === 'march'){ if(inBar === 0 || inBar === 4) DRUM.kick(out, t, 0.12); if(inBar === 2 || inBar === 6) DRUM.snare(out, t, 0.05); if(inBar === 7) DRUM.snare(out, t, 0.025); }
    if(D === 'parade'){ if(inBar === 0 || inBar === 4) DRUM.kick(out, t, 0.14); if(inBar === 2 || inBar === 6) DRUM.snare(out, t, 0.06); if(inBar === 5 || inBar === 7) DRUM.snare(out, t, 0.025); DRUM.hat(out, t, 0.012); }
    if(D === 'stroll'){ if(inBar === 0 || inBar === 4) DRUM.kick(out, t, 0.08); if(!onBeat) DRUM.hat(out, t, 0.01); }
    if(D === 'ticktock' && onBeat) DRUM.tick(out, t, 0.04, beat % 2 === 0);
    if(D === 'birds' && inBar === 6 && bar % 4 === 1){ DRUM.bird(out, t, 0.02); DRUM.bird(out, t + sd * 0.6, 0.016); }
  }

  /* ---------- 再生のしくみ（先読みして予約する） ---------- */
  let cur = null, timer = 0;
  function tick(){
    if(!cur || !ctx) return;
    const sd = 60 / cur.S.bpm / 2;
    while(cur.next < ctx.currentTime + 0.15){
      if(cur.next > ctx.currentTime - 0.05){ try{ step(cur.S, cur.out, cur.i, cur.next, sd); }catch(e){} }
      cur.i++; cur.next += sd;
    }
  }
  function play(name){
    if(!SONGS[name]) return;
    if(cur && cur.name === name) return;
    if(!ac()) return;
    if(cur){ const old = cur.out, t = ctx.currentTime; old.gain.cancelScheduledValues(t); old.gain.setValueAtTime(old.gain.value, t); old.gain.linearRampToValueAtTime(0, t + 0.6); setTimeout(() => { try{ old.disconnect(); }catch(e){} }, 900); }
    const out = ctx.createGain(); out.gain.setValueAtTime(0, ctx.currentTime); out.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.8); out.connect(master);
    cur = {name, S:SONGS[name], out, i:0, next:ctx.currentTime + 0.12};
    if(!timer) timer = setInterval(tick, 40);
    if(ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function setOn(v){
    on = !!v;
    if(ctx){ const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(on ? 1 : 0, t + 0.3); if(on && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
  }
  // iPhone：消音スイッチ（マナーモード）がオンでも、このページの音は鳴らす（🔊 ボタンで消せる）
  function playbackSession(){
    try{ if(navigator.audioSession) navigator.audioSession.type = 'playback'; }catch(e){}
  }
  // 古い iPhone 向け：無音の音声を1回流すと、消音スイッチの影響を受けない再生モードになる
  let silentEl = null;
  function silentWav(){
    const n = 2205, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => { for(let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 22050, true); v.setUint32(28, 44100, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([b], {type:'audio/wav'}));
  }
  // スマホは、画面にさわったときでないと音を出し始められない
  let unlocked = false;
  function unlock(){
    playbackSession();
    if(!navigator.audioSession && !silentEl && /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document){
      try{ silentEl = new Audio(silentWav()); silentEl.setAttribute('playsinline', ''); silentEl.loop = true; silentEl.play().catch(() => { silentEl = null; }); }catch(e){}
    }
    const c = ac(); if(!c) return;
    if(c.state !== 'running') c.resume().catch(() => {});
    if(!unlocked){   // 無音を一瞬鳴らして、音の出口をひらく
      try{ const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); unlocked = true; }catch(e){}
    }
  }
  ['touchend', 'click', 'keydown', 'pointerup'].forEach(e => document.addEventListener(e, unlock, {passive:true, capture:true}));
  // 別のアプリに切りかえたら止め、もどったら再開（iPhone の「中断」からも戻す）
  document.addEventListener('visibilitychange', () => {
    if(!ctx) return;
    if(document.visibilityState === 'hidden'){ ctx.suspend().catch(() => {}); if(silentEl) try{ silentEl.pause(); }catch(e){} }
    else if(on){ ctx.resume().catch(() => {}); if(silentEl) silentEl.play().catch(() => {}); }
  });
  playbackSession();
  window.IWBGM = {play, setOn, songs:Object.keys(SONGS), get current(){ return cur && cur.name; }};
})();
