/**
 * innocent world「レンガ村の物語」サーバー（Google Apps Script）
 * ------------------------------------------------------------------
 * 使い方（くわしくは docs/gas-setup.md）
 *   1. 新しい Google スプレッドシートを作り、［拡張機能］→［Apps Script］を開く
 *   2. このファイルの中身をすべて貼り付けて保存
 *   3. 関数 setup を1回実行（シートと見本データができます）
 *   4. ［デプロイ］→［新しいデプロイ］→ 種類「ウェブアプリ」
 *        実行するユーザー：自分 ／ アクセスできるユーザー：全員
 *   5. 表示された URL を story/config.js の api に書く
 *
 * しくみ
 *   ・ひみつのことば、物語本文、住民の記録はすべてこのスプレッドシートにあり、公開コードには含めません。
 *   ・認証トークン（合言葉）、復元コード、ひみつのことばは、それぞれ別のシートで別々に管理します。
 *     トークンと復元コードは、元に戻せない形（ハッシュ）で保存します。
 *   ・「今日」はサーバーの日本時間で決めます。
 *   ・イベント体験用の簡易認証です（厳密な本人確認・来場証明ではありません）。
 */

var TZ = 'Asia/Tokyo';

/* ================= シートの定義（列の順番を変えないでください） ================= */
var SHEETS = {
  // ---- 物語の中身（運営・芽美が編集） ----
  events:     {name: 'イベント',   head: ['event_id', 'イベント名', '公開開始日', '公開終了日', 'メモ', 'イベント名（ひらがな）', 'イベント名（English）']},
  // ---- 上演スケジュール（管理サイトから編集。制作シートからは写さない） ----
  days:       {name: '開催日',     head: ['event_id', '開催日', '表示名', '何日目', '表示名（ひらがな）', '表示名（English）', '公開開始時刻（空欄は0:00）', '公開終了時刻（空欄は24:00）', '終了後の猶予（分・空欄は60）', '状態（公開／中止）', '更新日時', '更新者']},
  words:      {name: 'ことば',     head: ['開催日', '施設ID', '正解（複数は｜で区切る。日本語・ひらがな・英語などを並べてよい）', '正解したときのメッセージ', 'メッセージ（ひらがな）', 'メッセージ（English）', 'event_id（空欄はその日の全作品に共通）']},
  facilities: {name: '施設',       head: ['event_id', '施設ID', '名前', '説明', '地図X(0-100)', '地図Y(0-100)', '屋根の色', '壁の色', '形(house/windmill/plaza)', '地図に出る条件', '条件を満たす前のヒント', '並び順', '名前（ひらがな）', '名前（English）', '説明（ひらがな）', '説明（English）', 'ヒント（ひらがな）', 'ヒント（English）', '入れる条件（満たすまで地図には出るが入れない）']},
  routes:     {name: '物語の入口', head: ['event_id', '施設ID（introは開催日の最初）', '優先順', '条件', '最初の場面ID', '公開開始日', '公開終了日', 'メモ']},
  scenes:     {name: '場面',       head: ['event_id', '場面ID', '背景', '次の場面ID', 'もらえるアイテム', '記録する', 'ポイント', 'AR(parade/xmas/fireworks)', 'ARボタンの文字', 'メモ', 'ARボタンの文字（ひらがな）', 'ARボタンの文字（English）']},
  lines:      {name: 'セリフ',     head: ['event_id', '場面ID', '順番', '話す住人ID（空欄は地の文）', 'セリフ', '音声ファイルURL（将来用・空欄でOK）', 'セリフ（ひらがな）', 'セリフ（English）']},
  choices:    {name: '選択肢',     head: ['event_id', '場面ID', '順番', '選択肢ID', '選択肢の文', '次の場面ID', 'ポイント', '記録する', 'もらえるアイテム', '表示する条件', '選択肢の文（ひらがな）', '選択肢の文（English）']},
  items:      {name: 'アイテム',   head: ['アイテムID', '名前', 'アイコン', '説明', '名前（ひらがな）', '名前（English）', '説明（ひらがな）', '説明（English）']},
  points:     {name: 'ポイント',   head: ['ポイントID', '名前', '名前（ひらがな）', '名前（English）']},
  characters: {name: '住人',       head: ['住人ID', '名前', '英語表記（English）', '名前（ひらがな）']},
  regfields:  {name: '登録項目',   head: ['項目ID', '表示名', '種類(text/choice/character)', '選択肢（｜区切り）', '必須(TRUE/FALSE)', '最大文字数', '入力例', '表示名（ひらがな）', '表示名（English）', '選択肢（ひらがな・｜区切り）', '選択肢（English・｜区切り）', '入力例（ひらがな）', '入力例（English）']},
  // ---- 住民の記録（自動で書き込まれます。手で編集しないでください） ----
  residents:  {name: '住民',       head: ['住民番号', 'トークンハッシュ', '登録項目(JSON)', '登録日時', '最終来訪日時', '状態']},
  recovery:   {name: '復元コード', head: ['住民番号', '復元コードハッシュ', '発行日時', '状態']},
  visits:     {name: '参加履歴',   head: ['住民番号', 'event_id', '開催日', '入場日時']},
  unlocks:    {name: '解放記録',   head: ['住民番号', '開催日', '施設ID', '解放日時', 'event_id']},
  progress:   {name: '進行',       head: ['住民番号', 'event_id', '開催日', '施設ID', '最初の場面ID', '状態', '日時']},
  picks:      {name: '選択',       head: ['住民番号', 'event_id', '開催日', '場面ID', '選択肢ID', '選択肢の文', '日時']},
  states:     {name: '状態',       head: ['住民番号', 'もちもの・ポイント・記録(JSON)', '更新日時']},
  stats:      {name: '集計',       head: ['項目', '値']},
  // ---- 管理サイト ----
  admins:     {name: '管理者',     head: ['Googleアカウント（メールアドレス）', '名前', '権限（owner／editor／viewer）', '状態（有効／停止）', '追加日時', 'メモ']},
  adminlog:   {name: '管理ログ',   head: ['日時', '管理者', '操作', '開催日', 'event_id', '内容']}
};

/* ================= 入口（ウェブアプリ） ================= */
function doPost(e){
  var req = {};
  try{ req = JSON.parse(e && e.postData && e.postData.contents || '{}'); }catch(err){ return out({ok: false, error: 'bad_request'}); }
  return out(handle(req));
}
function doGet(e){
  // 動作確認用：URL を開くと {"ok":true,...} が出ます
  return out(handle({action: (e && e.parameter && e.parameter.action) || 'config'}));
}
function out(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handle(req){
  try{
    var a = req.action;
    if(/^admin/.test(String(a || ''))) return adminHandle(req);   // 管理サイト（認証は adminHandle の中で必ず行う）
    if(a === 'config') return apiConfig(req);
    if(a === 'publicSchedule') return {ok: true, today: today(), upcoming: upcomingFrom(today()), works: publicWorks()};   // 公式サイト向け：開催予定（ことばは含めない）
    if(a === 'register') return apiRegister(req);
    if(a === 'restore') return apiRestore(req);
    var me = auth(req);
    if(!me) return {ok: false, error: 'auth'};
    if(req.state || (req.events && req.events.length)) applySync(me, req);
    if(a === 'boot') return apiBoot(me, req);
    if(a === 'entrance') return apiEntrance(me, req);
    if(a === 'facility') return apiFacility(me, req);
    if(a === 'sync') return {ok: true};
    if(a === 'newRecovery') return apiNewRecovery(me);
    if(a === 'delete') return apiDelete(me);
    return {ok: false, error: 'unknown_action'};
  }catch(err){
    console.error(err && err.stack || err);
    return {ok: false, error: 'server', message: String(err && err.message || err)};
  }
}

/* ================= 日付・イベント ================= */
function today(){
  var p = PropertiesService.getScriptProperties();
  var t = p.getProperty('TEST_DATE');            // リハーサル用：スクリプトプロパティ TEST_DATE=2026-12-19
  if(t && /^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}
/** 今の時刻（分）。リハーサル用：スクリプトプロパティ TEST_TIME=10:30 */
function nowMin(){
  var t = PropertiesService.getScriptProperties().getProperty('TEST_TIME');
  var v = (t && /^\d{1,2}:\d{2}$/.test(t)) ? t : Utilities.formatDate(new Date(), TZ, 'HH:mm');
  return toMin(v);
}
function toMin(hm){ var m = String(hm || '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : -1; }
/** 時刻のセル（文字 '10:00' でも、時刻として入ったセルでも）を 'HH:mm' に */
function hm(v){
  if(v instanceof Date) return Utilities.formatDate(v, TZ, 'HH:mm');
  var m = str(v).replace(/^'/, '').replace('：', ':').match(/^(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}
function nowStr(){ return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function dt(v){ return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss') : str(v); }
function ymd(v){
  if(v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  // 日付が数字（例：46327）で入ってしまったセルも読めるようにする（スプレッドシートの日付シリアル値）
  if(typeof v === 'number' || /^\d{5}$/.test(String(v).trim())){
    var n = Number(v);
    if(n > 30000 && n < 80000) return Utilities.formatDate(new Date(Date.UTC(1899, 11, 30) + n * 86400000), 'UTC', 'yyyy-MM-dd');
  }
  var s = String(v || '').trim().replace(/^'/, '').replace(/\//g, '-');
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function inPeriod(d, from, to){ from = ymd(from); to = ymd(to); return (!from || d >= from) && (!to || d <= to); }
/* ================= 上演スケジュール（開催日 × 作品） =================
   「開催日」シートの1行＝1回の上演（その日にその作品を公開する）。同じ日に複数の作品を並べてよい。
   ・入口のひみつのことばで、どの作品に入るかが決まる（同時に進められるのは1作品。入口に戻れば切りかえられる）
   ・公開開始〜終了：新しく入場できる。終了後の猶予（初期値60分）：入場ずみの人だけ続きを遊べる。猶予のあとは操作を受け付けない
   ・状態が「中止」の上演は、なかったものとして扱う（行は消さない）
   ・物語の進み具合（読了・記録）は「作品ID＠開催日」ごとに分ける（同じ作品の再公開は、はじめからになる） */
var _sched = null;
function schedule(){
  if(_sched) return _sched;
  var cache = CacheService.getScriptCache(), hit = cache.get('sched_v1');
  if(hit){ try{ return (_sched = JSON.parse(hit)); }catch(e){} }
  var shows = rows('days').map(function(r, i){
    var ev = str(r[0]), d = ymd(r[1]); if(!ev || !d) return null;
    var g = str(r[8]) === '' ? 60 : Math.max(0, Number(r[8]) || 0);
    return {event: ev, date: d, label: tri(r[2], r[4], r[5]), dayNo: Number(r[3]) || 0, start: hm(r[6]) || '00:00', end: hm(r[7]) || '24:00', grace: g,
      status: /中止|cancel/i.test(str(r[9])) ? 'cancelled' : 'active', row: i + 2};
  }).filter(Boolean).sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : (toMin(a.start) - toMin(b.start)); });
  var words = rows('words').map(function(r){
    var d = ymd(r[0]), f = str(r[1]); if(!d || !f) return null;
    return {date: d, facility: f, answers: splitList(r[2]), message: tri(r[3], r[4], r[5]), event: str(r[6])};
  }).filter(Boolean);
  _sched = {shows: shows, words: words};
  try{ cache.put('sched_v1', JSON.stringify(_sched), 120); }catch(e){}
  return _sched;
}
function clearSchedule(){ _sched = null; CacheService.getScriptCache().remove('sched_v1'); }
function eventOf(id){ return content().events.filter(function(x){ return x.id === id; })[0] || null; }
/** その日に公開する上演（中止をのぞく。作品がイベントシートにないものものぞく） */
function showsOn(d){
  return schedule().shows.filter(function(s){ return s.date === d && s.status === 'active' && eventOf(s.event); });
}
function showOf(d, ev){ return showsOn(d).filter(function(s){ return s.event === ev; })[0] || null; }
/** 上演の今の段階：before（開始前）／open（公開中）／grace（終了後の猶予）／over（おしまい） */
function phase(s, d){
  var today_ = today();
  if(s.date < today_) return 'over';
  if(s.date > today_) return 'before';
  var n = nowMin(), a = toMin(s.start), b = toMin(s.end);
  if(n < a) return 'before';
  if(n < b) return 'open';
  if(n < b + s.grace) return 'grace';
  return 'over';
}
function graceUntil(s){ var m = toMin(s.end) + s.grace; return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
function runKey(ev, d){ return ev + '@' + d; }
/** 物語に渡す、上演の情報（ひみつのことばは含めない） */
function infoOf(s){
  var ev = eventOf(s.event);
  return {event: s.event, eventName: ev ? ev.name : s.event, date: s.date, label: s.label, dayNo: s.dayNo, key: runKey(s.event, s.date),
    start: s.start, end: s.end, until: graceUntil(s), phase: phase(s)};
}
/** 閉村日・入口に出す「公開する作品」 */
function publicShow(s){ var i = infoOf(s); return {event: i.event, name: i.eventName, label: i.label, date: i.date, start: i.start, end: i.end, phase: i.phase}; }
/** 公式サイト向け：これから上演する作品の一覧（名前だけ） */
function publicWorks(){
  var seen = {}, out = [];
  upcomingFrom(today()).forEach(function(x){ x.works.forEach(function(w){ if(!seen[w.event]){ seen[w.event] = 1; out.push({event: w.event, name: w.name}); } }); });
  return out;
}
function upcomingFrom(d){
  var by = {}, order = [];
  schedule().shows.forEach(function(s){
    if(s.status !== 'active' || !eventOf(s.event)) return;
    if(s.date < d || (s.date === d && phase(s) === 'over')) return;
    if(!by[s.date]){ by[s.date] = []; order.push(s.date); }
    by[s.date].push(publicShow(s));
  });
  return order.slice(0, 6).map(function(x){ return {date: x, label: by[x][0].label, works: by[x]}; });
}
/** 古い呼び方との互換：その日の最初の上演 */
function dayInfo(d){ var l = showsOn(d); return l.length ? infoOf(l[0]) : null; }

/* ================= シートの読み書き ================= */
var _ss = null;
function ss(){ return _ss || (_ss = SpreadsheetApp.getActiveSpreadsheet()); }
function sh(key){
  var s = ss().getSheetByName(SHEETS[key].name);
  if(!s) throw new Error('シート「' + SHEETS[key].name + '」がありません。setup を実行してください。');
  return s;
}
function rows(key){
  var s = sh(key), n = s.getLastRow();
  if(n < 2) return [];
  return s.getRange(2, 1, n - 1, SHEETS[key].head.length).getValues();
}
function append(key, row){ sh(key).appendRow(row); }
function withLock(fn){
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try{ return fn(); } finally { lock.releaseLock(); }
}
function str(v){ return v === null || v === undefined ? '' : String(v).trim(); }
/** 3種類の文：ひらがな・英語がなければ日本語の文字列のまま（スマホ側で日本語を代わりに表示） */
function tri(ja, kana, en){ ja = str(ja); kana = str(kana); en = str(en); return (kana || en) ? {ja: ja, kana: kana, en: en} : ja; }
function splitList(v){ return str(v).split(/[｜|,、，\n]/).map(function(x){ return x.trim(); }).filter(String); }

/* ================= 物語の中身（5分間キャッシュ） ================= */
var _content = null;
function content(){
  if(_content) return _content;
  var cache = CacheService.getScriptCache(), hit = cache.get('content_v1');
  if(hit){ try{ return (_content = JSON.parse(hit)); }catch(e){} }
  _content = buildContent();
  try{ cache.put('content_v1', JSON.stringify(_content), 300); }catch(e){}   // 大きすぎるときはキャッシュしない
  return _content;
}
/** スプレッドシートを編集したあと、すぐ反映したいときに実行 */
function clearCache(){ CacheService.getScriptCache().remove('content_v1'); }

function buildContent(){
  var C = {};
  C.events = rows('events').filter(function(r){ return str(r[0]); }).map(function(r){ return {id: str(r[0]), name: tri(r[1], r[5], r[6]), from: ymd(r[2]), to: ymd(r[3])}; });
  C.items = {}; rows('items').forEach(function(r){ if(str(r[0])) C.items[str(r[0])] = {name: tri(r[1], r[4], r[5]), icon: str(r[2]), desc: tri(r[3], r[6], r[7])}; });
  C.points = {}; C.pointByName = {};
  rows('points').forEach(function(r){ if(str(r[0])){ C.points[str(r[0])] = tri(r[1], r[2], r[3]); C.pointByName[str(r[1])] = str(r[0]); } });
  C.characters = {}; C.charactersEn = {}; rows('characters').forEach(function(r){ if(str(r[0])){ C.characters[str(r[0])] = tri(r[1], r[3], r[2]); C.charactersEn[str(r[0])] = str(r[2]); } });
  C.regfields = rows('regfields').filter(function(r){ return str(r[0]); }).map(function(r){
    var oj = splitList(r[3]), ok = splitList(r[9]), oe = splitList(r[10]);
    return {id: str(r[0]), label: tri(r[1], r[7], r[8]), type: str(r[2]) || 'text', options: oj.map(function(o, i){ return tri(o, ok[i], oe[i]); }),
      required: r[4] === true || str(r[4]).toUpperCase() === 'TRUE', max: Number(r[5]) || 20, placeholder: tri(r[6], r[11], r[12])};
  });
  C.facilities = rows('facilities').filter(function(r){ return str(r[0]) && str(r[1]); }).map(function(r){
    return {event: str(r[0]), id: str(r[1]), name: tri(r[2], r[12], r[13]), sub: tri(r[3], r[14], r[15]), x: Number(r[4]) || 50, y: Number(r[5]) || 50,
      roof: str(r[6]) || '#e8101e', wall: str(r[7]) || '#fff1d6', type: str(r[8]) || 'house', show: parseCond(r[9], C), open: parseCond(r[18], C), hint: tri(r[10], r[16], r[17]), order: Number(r[11]) || 0};
  }).sort(function(a, b){ return a.order - b.order; });
  C.routes = rows('routes').filter(function(r){ return str(r[0]) && str(r[1]) && str(r[4]); }).map(function(r){
    return {event: str(r[0]), facility: str(r[1]), prio: Number(r[2]) || 0, cond: parseCond(r[3], C), start: str(r[4]), from: ymd(r[5]), to: ymd(r[6])};
  }).sort(function(a, b){ return a.prio - b.prio; });
  C.scenes = {};
  rows('scenes').forEach(function(r){
    var ev = str(r[0]), id = str(r[1]); if(!ev || !id) return;
    C.scenes[ev + '/' + id] = {id: id, bg: str(r[2]) || 'meadow', next: str(r[3]), item: splitList(r[4]), flag: splitList(r[5]), add: parsePoints(r[6], C),
      ar: str(r[7]), arLabel: tri(r[8], r[10], r[11]), lines: [], choices: []};
  });
  rows('lines').forEach(function(r){
    var sc = C.scenes[str(r[0]) + '/' + str(r[1])]; if(!sc || !str(r[4])) return;
    sc.lines.push({o: Number(r[2]) || 0, who: charId(str(r[3])), text: tri(r[4], r[6], r[7]), voice: str(r[5])});
  });
  rows('choices').forEach(function(r){
    var sc = C.scenes[str(r[0]) + '/' + str(r[1])]; if(!sc || !str(r[4])) return;
    sc.choices.push({o: Number(r[2]) || 0, id: str(r[3]) || ('c' + (sc.choices.length + 1)), text: tri(r[4], r[10], r[11]), next: str(r[5]),
      add: parsePoints(r[6], C), flag: splitList(r[7]), item: splitList(r[8]), cond: parseCond(r[9], C)});
  });
  Object.keys(C.scenes).forEach(function(k){
    var sc = C.scenes[k];
    sc.lines.sort(function(a, b){ return a.o - b.o; }); sc.lines = sc.lines.map(function(l){ return l.voice ? [l.who, l.text, l.voice] : [l.who, l.text]; });
    sc.choices.sort(function(a, b){ return a.o - b.o; }); sc.choices.forEach(function(c){ delete c.o; });
  });
  delete C.pointByName;
  return C;
}

/* ---------- 条件・ポイントの書き方 ----------
   条件（；で区切る。すべて満たしたとき）
     再訪 / 初来訪 / 前回参加 / 2日目 / アイテム:鍵 / 記録:secret_door / 記録なし:x / 勇気>=2 / 読了:bakery / 読了数>=2
   ポイント（，で区切る）
     勇気+1，やさしさ+2 */
function parseCond(v, C){
  var s = str(v); if(!s) return null;
  var c = {};
  s.split(/[;；\n]/).map(function(t){ return t.trim(); }).filter(String).forEach(function(t){
    var m;
    if(t === '再訪'){ c.returning = true; return; }
    if(t === '初来訪'){ c.returning = false; return; }
    if(t === '前回参加'){ c.prevEvent = true; return; }
    if(t === '今回再訪'){ c.returningThis = true; return; }
    if(t === '今回初来訪'){ c.returningThis = false; return; }
    if((m = t.match(/^(\d+)日目$/)) || (m = t.match(/^日[:：](\d+)$/))){ c.day = Number(m[1]); return; }
    if((m = t.match(/^アイテム[:：](.+)$/))){ (c.items = c.items || []).push(itemId(m[1].trim(), C)); return; }
    if((m = t.match(/^記録なし[:：](.+)$/))){ (c.notFlags = c.notFlags || []).push(m[1].trim()); return; }
    if((m = t.match(/^記録[:：](.+)$/))){ (c.flags = c.flags || []).push(m[1].trim()); return; }
    if((m = t.match(/^読了数\s*(?:>=|≧|＞＝)\s*(\d+)$/))){ c.doneCount = Number(m[1]); return; }
    if((m = t.match(/^読了[:：](.+)$/))){ (c.done = c.done || []).push(m[1].trim()); return; }
    if((m = t.match(/^(.+?)\s*(?:>=|≧|＞＝)\s*(\d+)$/))){ c.points = c.points || {}; c.points[pointId(m[1].trim(), C)] = Number(m[2]); return; }
    (c.unknown = c.unknown || []).push(t);      // 読めない条件は満たさない扱い（書き間違いに気づけるように）
  });
  return c;
}
function parsePoints(v, C){
  var s = str(v); if(!s) return null;
  var o = {};
  s.split(/[,，、\n]/).map(function(t){ return t.trim(); }).filter(String).forEach(function(t){
    var m = t.match(/^(.+?)\s*([+＋\-－])\s*(\d+)$/); if(!m) return;
    var k = pointId(m[1].trim(), C); o[k] = (o[k] || 0) + (/[\-－]/.test(m[2]) ? -1 : 1) * Number(m[3]);
  });
  return o;
}
/** 住人ID：nour と書いても nuru（ヌール）として扱う。表示名で書いてもよい */
function charId(v){ var a = {nour: 'nuru', NOUR: 'nuru'}; return a[v] || v; }
function pointId(nameOrId, C){ return (C.pointByName && C.pointByName[nameOrId]) || nameOrId; }
function itemId(nameOrId, C){
  if(C.items[nameOrId]) return nameOrId;
  for(var k in C.items) if(C.items[k].name === nameOrId) return k;
  return nameOrId;
}

/** そのイベントで読み終えた施設の数（前のイベントの読了は数えない。物語の最初 intro は施設に含めない） */
/* 物語の進み具合は「作品ID＠開催日」（ctx.key）ごと：st.runs[key] = {flags, items, done}。
   アイテムとポイントは住民票に通算で残る（st.items / st.points）。条件の「アイテム:」は、この上演の中で手に入れたかで判定する */
function runOf(st, key){ var r = (st.runs && st.runs[key]) || {}; return {flags: r.flags || {}, items: r.items || {}, done: r.done || {}}; }
function doneIn(run){ return Object.keys(run.done).length; }
/** 条件の判定（スマホ側の story.js にも同じ判定があります） */
function check(c, st, ctx){
  if(!c) return true;
  if(c.unknown && c.unknown.length) return false;
  if(c.day && ctx.dayNo !== c.day) return false;
  if(c.returning === true && !ctx.returning) return false;
  if(c.returning === false && ctx.returning) return false;
  if(c.prevEvent && !ctx.prevEvent) return false;
  if(c.returningThis === true && !ctx.returningThis) return false;
  if(c.returningThis === false && ctx.returningThis) return false;
  var i, run = runOf(st, ctx.key);
  if(c.flags) for(i = 0; i < c.flags.length; i++) if(!run.flags[c.flags[i]]) return false;
  if(c.notFlags) for(i = 0; i < c.notFlags.length; i++) if(run.flags[c.notFlags[i]]) return false;
  if(c.items) for(i = 0; i < c.items.length; i++) if(!run.items[c.items[i]]) return false;
  if(c.points) for(var k in c.points) if((st.points[k] || 0) < c.points[k]) return false;
  if(c.done) for(i = 0; i < c.done.length; i++) if(!run.done[c.done[i]]) return false;
  if(c.doneCount && doneIn(run) < c.doneCount) return false;
  return true;
}
/* ================= 認証（トークン・復元コード） ================= */
function salt(){
  var p = PropertiesService.getScriptProperties(), s = p.getProperty('SALT');
  if(!s){ s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SALT', s); }
  return s;
}
function hash(s){
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt() + '|' + s, Utilities.Charset.UTF_8);
  return b.map(function(x){ return ('0' + ((x + 256) % 256).toString(16)).slice(-2); }).join('');
}
function randomStr(n, alphabet){
  var s = '';
  while(s.length < n){
    var u = Utilities.getUuid().replace(/-/g, '');
    for(var i = 0; i < u.length && s.length < n; i += 2){ s += alphabet[parseInt(u.substr(i, 2), 16) % alphabet.length]; }
  }
  return s;
}
var CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';    // まぎらわしい O0 I1 を除く
function newToken(){ return randomStr(40, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'); }
function newRecovery(){ var c = randomStr(12, CODE_ABC); return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8); }
function newResidentNo(){ return 'RV-' + randomStr(4, '0123456789') + '-' + randomStr(3, CODE_ABC); }

/** 住民番号とトークンを確かめる。成功したら {rid,row,fields} */
function auth(req){
  var rid = str(req.rid), token = str(req.token);
  if(!rid || !token) return null;
  var h = hash('t|' + token), all = rows('residents');
  for(var i = 0; i < all.length; i++){
    if(all[i][0] === rid){
      if(all[i][1] !== h || all[i][5] === 'deleted') return null;
      var f = {}; try{ f = JSON.parse(all[i][2] || '{}'); }catch(e){}
      return {rid: rid, row: i + 2, fields: f, createdAt: dt(all[i][3])};
    }
  }
  return null;
}

/* ================= 住民の状態 ================= */
function emptyState(){ return {points: {}, flags: {}, items: {}, done: {}, introSeen: {}, runs: {}}; }
function loadState(rid){
  var all = rows('states');
  for(var i = all.length - 1; i >= 0; i--) if(all[i][0] === rid){ try{ return normState(JSON.parse(all[i][1])); }catch(e){ break; } }
  return emptyState();
}
/** 古い形（作品ごとの done「作品:施設」）を、上演ごとの runs に写す。元の done は消さない（ポイントの二重取り防止にも使う） */
function normState(s){
  var e = emptyState(); s = s || {};
  for(var k in e) e[k] = (s[k] && typeof s[k] === 'object') ? s[k] : e[k];
  for(var dk in e.done){
    var m = dk.match(/^(.+):([^:]+)$/), d = ymd(e.done[dk]); if(!m || !d) continue;
    var key = runKey(m[1], d), r = e.runs[key] || (e.runs[key] = {flags: {}, items: {}, done: {}});
    r.done = r.done || {}; if(!r.done[m[2]]) r.done[m[2]] = d;
  }
  return e;
}
function saveState(rid, st){
  var s = sh('states'), all = rows('states'), json = JSON.stringify(normState(st));
  for(var i = 0; i < all.length; i++) if(all[i][0] === rid){ s.getRange(i + 2, 2, 1, 2).setValues([[json, nowStr()]]); return; }
  s.appendRow([rid, json, nowStr()]);
}
/** スマホに貯まっていた記録（選択・読了）と状態を受け取る（公開が終わったあとでも、記録は受け取って残す） */
function applySync(me, req){
  var d = today();
  withLock(function(){
    if(req.state) saveState(me.rid, req.state);
    // 同じ記録が2回以上届いても1回だけ書く（電波が悪いときの送り直しや、同時に出た通信で重なるため）
    var evs = (req.events || []).slice(0, 200), cache = CacheService.getScriptCache();
    var keys = evs.map(function(x){ return 'ev|' + hash([me.rid, x.id || '', x.type, x.scene || '', x.choice || '', x.facility || '', x.at || ''].join('|')).slice(0, 40); });
    var seen = keys.length ? cache.getAll(keys) : {}, fresh = {};
    evs.forEach(function(x, i){
      if(seen[keys[i]] || fresh[keys[i]]) return;
      fresh[keys[i]] = '1';
      var at = str(x.at) || nowStr(), dd = ymd(x.date) || d, e2 = str(x.event);
      if(!e2){ var cs = currentShow(me.rid, dd); e2 = cs ? cs.event : ''; }
      if(x.type === 'choice') append('picks', [me.rid, e2, dd, str(x.scene), str(x.choice), str(typeof x.text === 'object' ? x.text.ja : x.text).slice(0, 200), at]);
      if(x.type === 'start' || x.type === 'done') append('progress', [me.rid, e2, dd, str(x.facility), str(x.route), x.type === 'done' ? '読み終えた' : '読んだ', at]);
    });
    if(Object.keys(fresh).length) try{ cache.putAll(fresh, 21600); }catch(e){}
  });
}
function visitInfo(rid, d, ev){
  var v = rows('visits').filter(function(r){ return r[0] === rid; });
  return {
    returning: v.some(function(r){ return ymd(r[2]) && ymd(r[2]) < d; }),
    returningThis: v.some(function(r){ return str(r[1]) === ev && ymd(r[2]) && ymd(r[2]) < d; }),
    prevEvent: v.some(function(r){ return str(r[1]) && str(r[1]) !== ev && ymd(r[2]) < d; }),
    visitedToday: v.some(function(r){ return ymd(r[2]) === d && (!ev || str(r[1]) === ev); }),
    dates: v.map(function(r){ return ymd(r[2]); }).filter(function(x, i, a){ return x && a.indexOf(x) === i; })
  };
}
/** 解放記録：[住民番号, 開催日, 施設ID（entrance＝入口）, 日時, event_id]。
   event_id が空の行は、作品が1つだけだった日の古い記録（その日の上演が1つならそれとみなす） */
function unlockRows(rid, d){
  var one = showsOn(d).length === 1 ? showsOn(d)[0].event : '';
  return rows('unlocks').filter(function(r){ return r[0] === rid && ymd(r[1]) === d; })
    .map(function(r){ return {facility: str(r[2]), event: str(r[4]) || one}; });
}
/** いま進めている作品＝その日の最後に入口を通った作品（中止になった上演はのぞく） */
function currentShow(rid, d){
  var u = unlockRows(rid, d).filter(function(x){ return x.facility === 'entrance' && x.event; });
  for(var i = u.length - 1; i >= 0; i--){ var s = showOf(d, u[i].event); if(s) return s; }
  return null;
}
function unlockedToday(rid, d, ev){
  var u = {entrance: false, fac: {}};
  unlockRows(rid, d).forEach(function(x){ if(x.event !== ev) return; if(x.facility === 'entrance') u.entrance = true; else u.fac[x.facility] = true; });
  return u;
}
function enteredEvents(rid, d){
  var o = {}; unlockRows(rid, d).forEach(function(x){ if(x.facility === 'entrance' && x.event) o[x.event] = true; }); return o;
}

/* ================= API ================= */
function publicDefs(){
  var C = content();
  return {items: C.items, points: C.points, characters: C.characters, charactersEn: C.charactersEn || {}, regfields: C.regfields};
}
function apiConfig(){
  var d = today(), l = showsOn(d), C = content();
  return {ok: true, today: d, day: l.length ? infoOf(l[0]) : null, shows: l.map(publicShow), upcoming: upcomingFrom(d), defs: publicDefs()};
}

function apiRegister(req){
  var C = content(), f = req.fields || {}, clean = {};
  for(var i = 0; i < C.regfields.length; i++){
    var rf = C.regfields[i], v = str(f[rf.id]).slice(0, rf.max || 20);
    if(rf.type === 'choice' && v && !rf.options.some(function(o){ return (typeof o === 'object' ? o.ja : o) === v; })) v = '';
    if(rf.type === 'character' && v && !C.characters[v]) v = '';
    if(rf.required && !v) return {ok: false, error: 'required', field: rf.id};
    clean[rf.id] = v;
  }
  var token = newToken(), code = newRecovery(), rid;
  withLock(function(){
    var used = {}; rows('residents').forEach(function(r){ used[r[0]] = 1; });
    do{ rid = newResidentNo(); }while(used[rid]);
    append('residents', [rid, hash('t|' + token), JSON.stringify(clean), nowStr(), nowStr(), 'active']);
    append('recovery', [rid, hash('r|' + code.replace(/-/g, '')), nowStr(), 'active']);
    append('states', [rid, JSON.stringify(emptyState()), nowStr()]);
  });
  return {ok: true, rid: rid, token: token, recovery: code, resident: {rid: rid, fields: clean, createdAt: nowStr()}};
}

function apiRestore(req){
  var code = str(req.code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if(code.length !== 12) return {ok: false, error: 'bad_code'};
  var cache = CacheService.getScriptCache(), key = 'rfail', n = Number(cache.get(key) || 0);
  if(n > 60) return {ok: false, error: 'busy'};              // 総当たり対策（全体で10分に60回まで）
  var h = hash('r|' + code), rid = '';
  rows('recovery').forEach(function(r){ if(r[1] === h && r[3] === 'active') rid = r[0]; });
  if(!rid){ cache.put(key, String(n + 1), 600); return {ok: false, error: 'not_found'}; }
  var token = newToken(), fields = {}, created = '';
  var ok = withLock(function(){
    var s = sh('residents'), all = rows('residents');
    for(var i = 0; i < all.length; i++) if(all[i][0] === rid){
      if(all[i][5] === 'deleted') return false;
      s.getRange(i + 2, 2).setValue(hash('t|' + token));         // 古いスマホのトークンは使えなくなる
      s.getRange(i + 2, 5).setValue(nowStr());
      try{ fields = JSON.parse(all[i][2] || '{}'); }catch(e){}
      created = dt(all[i][3]);
      return true;
    }
    return false;
  });
  if(!ok) return {ok: false, error: 'not_found'};
  return {ok: true, rid: rid, token: token, resident: {rid: rid, fields: fields, createdAt: created}, state: loadState(rid)};
}

function apiNewRecovery(me){
  var code = newRecovery();
  withLock(function(){
    var s = sh('recovery'), all = rows('recovery');
    for(var i = 0; i < all.length; i++) if(all[i][0] === me.rid && all[i][3] === 'active') s.getRange(i + 2, 4).setValue('replaced');
    append('recovery', [me.rid, hash('r|' + code.replace(/-/g, '')), nowStr(), 'active']);
  });
  return {ok: true, recovery: code};
}

function apiDelete(me){
  withLock(function(){
    var s = sh('residents');
    s.getRange(me.row, 2, 1, 5).setValues([['', '{}', s.getRange(me.row, 4).getValue(), nowStr(), 'deleted']]);
    var r = sh('recovery'), all = rows('recovery');
    for(var i = 0; i < all.length; i++) if(all[i][0] === me.rid) r.getRange(i + 2, 4).setValue('deleted');
  });
  return {ok: true};
}

/** 起動時：住民票・今日の開催情報・解放状況・地図 */
function apiBoot(me, req){
  var d = today(), st = loadState(me.rid), l = showsOn(d);
  var res = {ok: true, today: d, shows: l.map(publicShow), upcoming: upcomingFrom(d), resident: {rid: me.rid, fields: me.fields, createdAt: me.createdAt}, state: st, defs: publicDefs()};
  sh('residents').getRange(me.row, 5).setValue(nowStr());
  var cur = currentShow(me.rid, d);
  res.day = cur ? infoOf(cur) : null;
  if(!cur){ res.visits = visitInfo(me.rid, d, '').dates; res.unlocked = null; return res; }
  var info = res.day, vi = visitInfo(me.rid, d, info.event), un = unlockedToday(me.rid, d, info.event);
  res.visits = vi.dates; res.returning = vi.returning; res.returningThis = vi.returningThis; res.prevEvent = vi.prevEvent;
  res.unlocked = un;
  if(info.phase === 'over'){ res.ended = true; return res; }
  if(un.entrance) res.map = mapFor(info, st, vi, un);
  return res;
}

function ctxFor(info, vi){ return {event: info.event, key: info.key, dayNo: info.dayNo, returning: vi.returning, returningThis: vi.returningThis, prevEvent: vi.prevEvent}; }
function mapFor(info, st, vi, un){
  var ctx = ctxFor(info, vi), run = runOf(st, info.key);
  return content().facilities.filter(function(f){ return f.event === info.event; }).map(function(f){
    var shown = check(f.show, st, ctx), canEnter = check(f.open, st, ctx);
    return {id: f.id, name: f.name, sub: f.sub, x: f.x, y: f.y, roof: f.roof, wall: f.wall, type: f.type,
      status: !shown ? 'hidden' : !canEnter ? 'blocked' : !un.fac[f.id] ? 'locked' : run.done[f.id] ? 'done' : 'open',
      hint: shown && canEnter ? '' : f.hint};
  });
}

/** 入口のひみつのことば：ことばで作品が決まる。
   公開中の上演に入れる。終了後の猶予のあいだは、その日すでに入ったことのある作品にだけ戻れる */
function apiEntrance(me, req){
  var d = today(), l = showsOn(d);
  if(!l.length) return {ok: false, error: 'closed'};
  var lim = limited(me.rid, 'entrance'); if(lim) return lim;
  var entered = enteredEvents(me.rid, d), hit = null, early = null, late = null, any = false;
  l.forEach(function(s){
    var w = wordFor(d, 'entrance', s.event); if(!w) return;
    any = true;
    if(!matchWord(req.word, w.answers)) return;
    var ph = phase(s);
    if(ph === 'open' || (ph === 'grace' && entered[s.event])){ if(!hit) hit = {s: s, w: w}; }
    else if(ph === 'before'){ if(!early) early = s; }
    else late = s;
  });
  if(!hit){
    if(!any) return {ok: false, error: 'no_word'};
    if(early) return {ok: false, error: 'not_yet', start: early.start};
    if(late) return {ok: false, error: 'ended'};
    fail(me.rid, 'entrance'); return {ok: false, error: 'wrong'};
  }
  var s = hit.s, info = infoOf(s);
  withLock(function(){
    append('unlocks', [me.rid, d, 'entrance', nowStr(), s.event]);       // 入るたびに記録＝いま進めている作品
    if(!visitInfo(me.rid, d, s.event).visitedToday) append('visits', [me.rid, s.event, d, nowStr()]);
  });
  var st = loadState(me.rid), vi = visitInfo(me.rid, d, s.event), ctx = ctxFor(info, vi), un = unlockedToday(me.rid, d, s.event);
  var intro = pickRoute(info, 'intro', st, ctx, d), pro = pickRoute(info, 'prologue', st, ctx, d);
  return {ok: true, message: hit.w.message, prologue: pro ? bundle(info.event, pro, 'prologue') : null, day: info, shows: l.map(publicShow), resumed: !!entered[s.event],
    returning: vi.returning, returningThis: vi.returningThis, prevEvent: vi.prevEvent, visits: vi.dates, unlocked: un,
    map: mapFor(info, st, vi, un), intro: intro ? bundle(info.event, intro, 'intro') : null};
}

/** 施設のひみつのことば（いま進めている作品の言葉だけで判定。今日すでに解放済みなら、ことばは不要） */
function apiFacility(me, req){
  var d = today(), fid = str(req.facility), cur = currentShow(me.rid, d);
  if(!showsOn(d).length) return {ok: false, error: 'closed'};
  if(!cur) return {ok: false, error: 'entrance_first'};
  var info = infoOf(cur);
  if(info.phase === 'over') return {ok: false, error: 'ended'};
  var un = unlockedToday(me.rid, d, cur.event);
  if(!un.entrance) return {ok: false, error: 'entrance_first'};
  var fac = content().facilities.filter(function(f){ return f.event === cur.event && f.id === fid; })[0];
  if(!fac) return {ok: false, error: 'no_facility'};
  var st = loadState(me.rid), vi = visitInfo(me.rid, d, cur.event), ctx = ctxFor(info, vi), msg = '';
  if(!check(fac.show, st, ctx)) return {ok: false, error: 'hidden', hint: fac.hint};
  if(!check(fac.open, st, ctx)) return {ok: false, error: 'blocked', hint: fac.hint};
  if(!un.fac[fid]){
    var w = wordFor(d, fid, cur.event);
    if(!w) return {ok: false, error: 'no_word'};
    var lim = limited(me.rid, fid); if(lim) return lim;
    if(!matchWord(req.word, w.answers)){ fail(me.rid, fid); return {ok: false, error: 'wrong'}; }
    msg = w.message;
    withLock(function(){ if(!unlockedToday(me.rid, d, cur.event).fac[fid]) append('unlocks', [me.rid, d, fid, nowStr(), cur.event]); });
    un.fac[fid] = true;
  }
  var r = pickRoute(info, fid, st, ctx, d);
  if(!r) return {ok: true, message: msg, story: null, map: mapFor(info, st, vi, un)};
  return {ok: true, message: msg, story: bundle(info.event, r, fid), map: mapFor(info, st, vi, un)};
}

function pickRoute(info, fid, st, ctx, d){
  var list = content().routes.filter(function(r){ return r.event === info.event && r.facility === fid && inPeriod(d, r.from, r.to); });
  for(var i = 0; i < list.length; i++) if(check(list[i].cond, st, ctx)) return list[i];
  return null;
}
/** 最初の場面からたどれる場面をまとめて渡す */
function bundle(ev, route, fid){
  var S = content().scenes, out = {}, q = [route.start], guard = 0;
  while(q.length && guard++ < 300){
    var id = q.shift(); if(!id || out[id]) continue;
    var sc = S[ev + '/' + id]; if(!sc) continue;
    out[id] = sc;
    if(sc.next) q.push(sc.next);
    sc.choices.forEach(function(c){ if(c.next) q.push(c.next); });
  }
  return {facility: fid, route: route.start, start: route.start, scenes: out};
}

/* ---------- ひみつのことば ---------- */
/** その日・その作品・その場所のことば（作品の指定がある行を先に。event_id が空の行は、その日の全作品に共通） */
function wordFor(d, fid, ev){
  var W = schedule().words.filter(function(w){ return w.date === d && w.facility === fid; });
  var w = W.filter(function(x){ return x.event && x.event === ev; })[0] || W.filter(function(x){ return !x.event; })[0];
  return w ? {answers: w.answers, message: w.message} : null;
}
function norm(s){
  s = String(s || '');
  if(s.normalize) s = s.normalize('NFKC');
  return s.toLowerCase()
    .replace(/[ァ-ヶ]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0x60); })
    .replace(/[\s「」『』、。,.!！?？・〜~]/g, '');
}
function matchWord(input, answers){
  var n = norm(input); if(!n) return false;
  for(var i = 0; i < answers.length; i++) if(norm(answers[i]) === n) return true;
  return false;
}
/* 総当たり対策：同じ住民が同じ場所で5回まちがえたら5分待つ */
function limited(rid, fid){
  var n = Number(CacheService.getScriptCache().get('wf|' + rid + '|' + fid) || 0);
  return n >= 5 ? {ok: false, error: 'wait', seconds: 300} : null;
}
function fail(rid, fid){
  var c = CacheService.getScriptCache(), k = 'wf|' + rid + '|' + fid;
  c.put(k, String(Number(c.get(k) || 0) + 1), 300);
}


/* ================= 管理サイト（主催者専用） =================
   ・ログインは Google アカウント：管理サイトで Google にログイン → 受け取った ID トークンを、ここで Google に確かめてもらう
     （受け取り先がこのサイト用のクライアントID か／メールが確認済みか／期限内か）
   ・「管理者」シートに載っていて状態が「有効」のアカウントだけが入れる。権限は owner ＞ editor ＞ viewer
       owner：すべて＋管理者の追加・停止　editor：上演の登録・変更・中止　viewer：見るだけ
   ・ログインに成功すると管理用の合言葉（6時間有効）を渡す。管理の操作は毎回この合言葉と「管理者」シートを確かめる
     （管理者を停止すると、その場で使えなくなる）
   ・スクリプトプロパティ ADMIN_CLIENT_ID に、Google Cloud で作った「ウェブ アプリケーション」のクライアントID を入れておく */
var ADMIN_TTL = 21600;   // 6時間（キャッシュの上限）
var ROLE_RANK = {viewer: 1, editor: 2, owner: 3};

function adminHandle(req){
  var a = String(req.action);
  if(a === 'adminLogin') return adminLogin(req);
  var me = adminAuth(req);
  if(!me) return {ok: false, error: 'admin_auth'};
  var need = {adminMe: 'viewer', adminLogout: 'viewer', adminOverview: 'viewer', adminDay: 'viewer', adminStats: 'viewer', adminLog: 'viewer',
    adminSave: 'editor', adminStatus: 'editor', adminRemove: 'editor', adminAdmins: 'owner', adminSaveAdmin: 'owner'}[a];
  if(!need) return {ok: false, error: 'unknown_action'};
  if(ROLE_RANK[me.role] < ROLE_RANK[need]) return {ok: false, error: 'forbidden'};
  if(a === 'adminMe') return {ok: true, me: me};
  if(a === 'adminLogout'){ CacheService.getScriptCache().remove('adm|' + hash('a|' + str(req.adminToken))); return {ok: true}; }
  if(a === 'adminOverview') return adminOverview(me);
  if(a === 'adminDay') return adminDay(me, req);
  if(a === 'adminStats') return adminStats(me, req);
  if(a === 'adminLog') return adminLog(me, req);
  if(a === 'adminSave') return adminSave(me, req);
  if(a === 'adminStatus') return adminStatus(me, req);
  if(a === 'adminRemove') return adminRemove(me, req);
  if(a === 'adminAdmins') return adminAdmins(me);
  if(a === 'adminSaveAdmin') return adminSaveAdmin(me, req);
}

/* ---------- ログイン ---------- */
function adminLogin(req){
  var cid = PropertiesService.getScriptProperties().getProperty('ADMIN_CLIENT_ID');
  if(!cid) return {ok: false, error: 'admin_not_ready'};
  var cache = CacheService.getScriptCache(), n = Number(cache.get('alfail') || 0);
  if(n >= 30) return {ok: false, error: 'busy'};                     // 総当たり対策（全体で10分に30回まで）
  var info = verifyIdToken(str(req.idToken), cid);
  if(!info){ cache.put('alfail', String(n + 1), 600); return {ok: false, error: 'admin_denied'}; }
  var a = adminByEmail(info.email);
  if(!a){ cache.put('alfail', String(n + 1), 600); adminWriteLog(info.email, 'ログイン拒否（管理者ではない）', '', '', ''); return {ok: false, error: 'admin_denied', email: info.email}; }
  var token = newToken();
  cache.put('adm|' + hash('a|' + token), JSON.stringify({email: a.email}), ADMIN_TTL);
  adminWriteLog(a.email, 'ログイン', '', '', '');
  return {ok: true, token: token, expiresIn: ADMIN_TTL, me: a};
}
/** Google に ID トークンを確かめてもらう（署名・期限は Google 側で確認される） */
function verifyIdToken(idToken, cid){
  if(!idToken || idToken.length > 4096) return null;
  try{
    var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), {muteHttpExceptions: true});
    if(r.getResponseCode() !== 200) return null;
    var p = JSON.parse(r.getContentText());
    if(p.aud !== cid) return null;
    if(p.iss !== 'accounts.google.com' && p.iss !== 'https://accounts.google.com') return null;
    if(!(p.email_verified === true || p.email_verified === 'true')) return null;
    if(!(Number(p.exp) * 1000 > Date.now())) return null;
    return {email: String(p.email || '').toLowerCase(), name: p.name || ''};
  }catch(e){ return null; }
}
function adminList(){
  return rows('admins').map(function(r, i){
    var role = str(r[2]).toLowerCase();
    return {email: str(r[0]).toLowerCase(), name: str(r[1]), role: ROLE_RANK[role] ? role : 'viewer', active: !/停止|stop|off|false/i.test(str(r[3])), added: dt(r[4]), memo: str(r[5]), row: i + 2};
  }).filter(function(a){ return a.email; });
}
function adminByEmail(email){
  email = String(email || '').toLowerCase();
  var a = adminList().filter(function(x){ return x.email === email && x.active; })[0];
  return a ? {email: a.email, name: a.name, role: a.role} : null;
}
function adminAuth(req){
  var t = str(req.adminToken); if(!t) return null;
  var hit = CacheService.getScriptCache().get('adm|' + hash('a|' + t)); if(!hit) return null;
  try{ return adminByEmail(JSON.parse(hit).email); }catch(e){ return null; }
}
function adminWriteLog(email, op, d, ev, detail){
  try{ append('adminlog', [nowStr(), email, op, d ? "'" + d : '', ev || '', typeof detail === 'string' ? detail : JSON.stringify(detail)]); }catch(e){}
}

/* ---------- 見る ---------- */
function adminOverview(me){
  var C = content(), S = schedule(), d = today();
  var count = {}; Object.keys(C.scenes).forEach(function(k){ var ev = k.split('/')[0]; count[ev] = (count[ev] || 0) + 1; });
  var works = C.events.map(function(e){
    return {id: e.id, name: e.name, scenes: count[e.id] || 0,
      facilities: C.facilities.filter(function(f){ return f.event === e.id; }).map(function(f){ return {id: f.id, name: f.name, roof: f.roof}; }),
      dates: S.shows.filter(function(s){ return s.event === e.id; }).map(function(s){ return {date: s.date, status: s.status}; })};
  });
  var shows = S.shows.map(function(s){ return adminShow(s, d); });
  var P = PropertiesService.getScriptProperties(), n = nowMin();
  return {ok: true, me: me, today: d, now: ('0' + Math.floor(n / 60)).slice(-2) + ':' + ('0' + (n % 60)).slice(-2), works: works, shows: shows,
    test: {date: P.getProperty('TEST_DATE') || '', time: P.getProperty('TEST_TIME') || ''}};   // リハーサル用の日付・時刻が残っていたら知らせる
}
function adminShow(s, d){
  var ev = eventOf(s.event);
  return {event: s.event, name: ev ? ev.name : s.event, missing: !ev, date: s.date, label: s.label, dayNo: s.dayNo, start: s.start, end: s.end, grace: s.grace, until: graceUntil(s),
    status: s.status, phase: s.status === 'active' ? phase(s) : 'cancelled'};
}
/** その日の上演と、ことば（管理者にだけ返す） */
function adminDay(me, req){
  var d = ymd(req.date); if(!d) return {ok: false, error: 'bad_date'};
  var S = schedule(), list = S.shows.filter(function(s){ return s.date === d; });
  var W = S.words.filter(function(w){ return w.date === d; });
  var shared = W.filter(function(w){ return !w.event; }).map(function(w){ return {facility: w.facility, answers: w.answers.join('｜'), message: w.message}; });
  return {ok: true, date: d, shared: shared, shows: list.map(function(s){
    var o = adminShow(s, today()), mine = W.filter(function(w){ return w.event === s.event; });
    var ent = mine.filter(function(w){ return w.facility === 'entrance'; })[0];
    o.entrance = ent ? {answers: ent.answers.join('｜'), message: ent.message} : null;
    o.facilities = {}; mine.forEach(function(w){ if(w.facility !== 'entrance') o.facilities[w.facility] = {answers: w.answers.join('｜'), message: w.message}; });
    o.visitors = visitorsOf(d, s.event);
    return o;
  })};
}
function visitorsOf(d, ev){ return rows('visits').filter(function(r){ return ymd(r[2]) === d && str(r[1]) === ev; }).length; }
/** 開催日と作品ごとの参加状況（人数だけ。住民の名前は出さない） */
function adminStats(me, req){
  var d = ymd(req.date), ev = str(req.event); if(!d || !ev) return {ok: false, error: 'bad_request'};
  var people = {}, facs = {}, ends = {};
  rows('visits').forEach(function(r){ if(ymd(r[2]) === d && str(r[1]) === ev) people[r[0]] = 1; });
  rows('progress').forEach(function(r){
    if(ymd(r[2]) !== d || str(r[1]) !== ev) return;
    var f = str(r[3]); facs[f] = facs[f] || {read: {}, done: {}};
    facs[f][str(r[5]) === '読み終えた' ? 'done' : 'read'][r[0]] = 1;
  });
  var unl = {}; rows('unlocks').forEach(function(r){ if(ymd(r[1]) === d && (str(r[4]) === ev || !str(r[4])) && str(r[2]) !== 'entrance'){ var f = str(r[2]); unl[f] = unl[f] || {}; unl[f][r[0]] = 1; } });
  var out = content().facilities.filter(function(f){ return f.event === ev; }).map(function(f){
    var x = facs[f.id] || {read: {}, done: {}};
    return {id: f.id, name: f.name, opened: Object.keys(unl[f.id] || {}).length, read: Object.keys(x.read).length, done: Object.keys(x.done).length};
  });
  return {ok: true, date: d, event: ev, visitors: Object.keys(people).length, facilities: out};
}
function adminLog(me, req){
  var all = rows('adminlog'), n = Math.min(300, Number(req.limit) || 100);
  return {ok: true, log: all.slice(-n).reverse().map(function(r){ return {at: dt(r[0]), who: str(r[1]), op: str(r[2]), date: ymd(r[3]), event: str(r[4]), detail: str(r[5])}; })};
}
function adminAdmins(me){
  return {ok: true, admins: adminList().map(function(a){ return {email: a.email, name: a.name, role: a.role, active: a.active, added: a.added, memo: a.memo}; })};
}

/* ---------- 登録・変更 ---------- */
function cleanTri(o, max){
  o = o || {}; if(typeof o === 'string') o = {ja: o};
  return {ja: str(o.ja).slice(0, max), kana: str(o.kana).slice(0, max), en: str(o.en).slice(0, max)};
}
function cleanAnswers(v){ return splitList(String(v || '').slice(0, 400)).slice(0, 20).map(function(x){ return x.slice(0, 40); }); }
/** 上演を登録・変更する。同じ「開催日＋作品」があれば上書き。日付を変えるときは origDate（参加者がいる上演の日付は変えられない） */
function adminSave(me, req){
  var d = ymd(req.date), ev = str(req.event), orig = ymd(req.origDate) || d;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return {ok: false, error: 'bad_date'};
  if(!eventOf(ev)) return {ok: false, error: 'no_event'};
  var start = hm(req.start) || '00:00', end = str(req.end) === '24:00' ? '24:00' : (hm(req.end) || '24:00');
  if(toMin(start) >= toMin(end)) return {ok: false, error: 'bad_time'};
  var grace = str(req.grace) === '' ? 60 : Math.round(Number(req.grace));
  if(!(grace >= 0 && grace <= 600)) return {ok: false, error: 'bad_grace'};
  var label = cleanTri(req.label, 30), dayNo = Math.max(0, Math.min(99, Math.round(Number(req.dayNo) || 0)));
  var ent = req.entrance || {}, entAns = cleanAnswers(ent.answers);
  if(!entAns.length) return {ok: false, error: 'need_entrance'};
  var facIds = {}; content().facilities.forEach(function(f){ if(f.event === ev) facIds[f.id] = true; });
  var facs = {}; Object.keys(req.facilities || {}).forEach(function(fid){
    if(!facIds[fid]) return;
    var f = req.facilities[fid] || {}, ans = cleanAnswers(f.answers);
    if(ans.length) facs[fid] = {answers: ans, message: cleanTri(f.message, 200)};
  });
  return withLock(function(){
    clearSchedule();
    var S = schedule();
    var same = S.shows.filter(function(s){ return s.date === orig && s.event === ev; })[0] || null;
    if(orig !== d){
      if(!same) return {ok: false, error: 'not_found'};
      if(visitorsOf(orig, ev) > 0) return {ok: false, error: 'has_visitors'};
      if(S.shows.some(function(s){ return s.date === d && s.event === ev; })) return {ok: false, error: 'duplicate'};
    }
    // 同じ日に公開する別の作品と、入口のことばが重なっていないか（ことばで作品を決めるため）
    var mine = {}; entAns.forEach(function(x){ mine[norm(x)] = 1; });
    var clash = S.shows.filter(function(s){ return s.date === d && s.event !== ev && s.status === 'active'; }).filter(function(s){
      var w = S.words.filter(function(x){ return x.date === d && x.facility === 'entrance' && (x.event === s.event || !x.event); })[0];
      return w && w.answers.some(function(x){ return mine[norm(x)]; });
    })[0];
    if(clash) return {ok: false, error: 'word_clash', with: (eventOf(clash.event) || {}).name || clash.event};
    var row = ["'" + d, label.ja, dayNo || '', label.kana, label.en, "'" + start, "'" + end, grace, same ? (same.status === 'cancelled' ? '中止' : '公開') : '公開', "'" + nowStr(), me.email];
    if(same) sh('days').getRange(same.row, 1, 1, 12).setValues([[ev].concat(row)]);
    else append('days', [ev].concat(row));
    // ことば：この上演（元の日付）の行を書き直す。その日の作品がこれ1つなら、作品指定なし（共通）の古い行もこの作品の行にまとめる
    var only = S.shows.filter(function(s){ return s.date === orig && s.event !== ev; }).length === 0;
    var add = [["'" + d, 'entrance', entAns.join('｜'), cleanTri(ent.message, 200).ja, cleanTri(ent.message, 200).kana, cleanTri(ent.message, 200).en, ev]];
    Object.keys(facs).forEach(function(fid){ add.push(["'" + d, fid, facs[fid].answers.join('｜'), facs[fid].message.ja, facs[fid].message.kana, facs[fid].message.en, ev]); });
    rewriteRows('words', function(r){ var rd = ymd(r[0]), re = str(r[6]); return !(rd === orig && (re === ev || (!re && only))); }, add);
    clearSchedule();
    adminWriteLog(me.email, same ? (orig !== d ? '上演の日付を変更（' + orig + '→' + d + '）' : '上演を変更') : '上演を登録', d, ev,
      {label: label.ja, dayNo: dayNo, start: start, end: end, grace: grace, facilities: Object.keys(facs)});   // ことばそのものは記録に残さない
    return {ok: true};
  });
}
/** 中止・再開 */
function adminStatus(me, req){
  var d = ymd(req.date), ev = str(req.event), cancel = !!req.cancel;
  return withLock(function(){
    clearSchedule();
    var s = schedule().shows.filter(function(x){ return x.date === d && x.event === ev; })[0];
    if(!s) return {ok: false, error: 'not_found'};
    sh('days').getRange(s.row, 10, 1, 3).setValues([[cancel ? '中止' : '公開', "'" + nowStr(), me.email]]);
    clearSchedule();
    adminWriteLog(me.email, cancel ? '上演を中止' : '上演を再開', d, ev, '');
    return {ok: true};
  });
}
/** 削除（参加者がまだいない上演だけ。参加者がいる上演は「中止」にする） */
function adminRemove(me, req){
  var d = ymd(req.date), ev = str(req.event);
  return withLock(function(){
    clearSchedule();
    var s = schedule().shows.filter(function(x){ return x.date === d && x.event === ev; })[0];
    if(!s) return {ok: false, error: 'not_found'};
    if(visitorsOf(d, ev) > 0) return {ok: false, error: 'has_visitors'};
    var only = schedule().shows.filter(function(x){ return x.date === d && x.event !== ev; }).length === 0;
    rewriteRows('days', function(r){ return !(ymd(r[1]) === d && str(r[0]) === ev); }, []);
    rewriteRows('words', function(r){ var re = str(r[6]); return !(ymd(r[0]) === d && (re === ev || (!re && only))); }, []);
    clearSchedule();
    adminWriteLog(me.email, '上演を削除', d, ev, '');
    return {ok: true};
  });
}
/** 管理者の追加・変更（owner だけ。自分自身を停止したり owner でなくしたりはできない） */
function adminSaveAdmin(me, req){
  var email = str(req.email).toLowerCase(), role = str(req.role).toLowerCase(), active = req.active !== false;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {ok: false, error: 'bad_email'};
  if(!ROLE_RANK[role]) return {ok: false, error: 'bad_role'};
  if(email === me.email && (role !== 'owner' || !active)) return {ok: false, error: 'self'};
  return withLock(function(){
    var a = adminList().filter(function(x){ return x.email === email; })[0];
    var row = [email, str(req.name).slice(0, 40), role, active ? '有効' : '停止', a ? a.added : "'" + nowStr(), str(req.memo).slice(0, 100)];
    if(a) sh('admins').getRange(a.row, 1, 1, 6).setValues([row]); else append('admins', row);
    adminWriteLog(me.email, a ? '管理者を変更' : '管理者を追加', '', '', {email: email, role: role, active: active});
    return {ok: true};
  });
}
/** シートの中身（2行目から）を、条件に合う行だけ残して書き直す（行の削除の代わり。見出しと列の並びはそのまま） */
function rewriteRows(key, keep, add){
  var s = sh(key), n = SHEETS[key].head.length, all = rows(key);
  var out = all.filter(function(r){ return r.some(function(v){ return str(v) !== ''; }) && keep(r); }).map(function(r){
    return r.map(function(v, i){
      if(!(v instanceof Date)) return v;
      var dc = {days: [1], words: [0]}[key] || [], tc = {days: [6, 7]}[key] || [];   // 日付・時刻は文字のまま書き戻す
      return "'" + (dc.indexOf(i) >= 0 ? ymd(v) : tc.indexOf(i) >= 0 ? hm(v) : dt(v));
    });
  }).concat((add || []).map(function(r){ r = r.slice(0, n); while(r.length < n) r.push(''); return r; }));
  if(all.length) s.getRange(2, 1, all.length, n).clearContent();
  if(out.length) s.getRange(2, 1, out.length, n).setValues(out);
}

/** 管理サイトの準備（最初に1回だけ実行）：シートの見出しをそろえ、この関数を実行した Google アカウントを owner として登録 */
function setupAdmin(){
  setup();
  var me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if(me && !adminList().some(function(a){ return a.email === me; })) append('admins', [me, '', 'owner', '有効', "'" + nowStr(), 'setupAdmin で登録']);
  var cid = PropertiesService.getScriptProperties().getProperty('ADMIN_CLIENT_ID');
  console.log('管理者：' + adminList().map(function(a){ return a.email + '（' + a.role + (a.active ? '' : '・停止') + '）'; }).join('、'));
  console.log(cid ? 'ADMIN_CLIENT_ID は設定ずみです。' : '※ スクリプトプロパティ ADMIN_CLIENT_ID がまだありません（docs/admin-setup.md を見てください）');
}

/* ================= 初期設定（最初に1回だけ実行） ================= */
function setup(){
  var book = ss();
  if(book.setSpreadsheetTimeZone) book.setSpreadsheetTimeZone(TZ);   // 日付の判定を日本時間にそろえる
  Object.keys(SHEETS).forEach(function(k){
    var def = SHEETS[k], s = book.getSheetByName(def.name);
    if(!s){ s = book.insertSheet(def.name); }
    if(s.getLastRow() === 0){
      s.getRange(1, 1, 1, def.head.length).setValues([def.head]);
      s.setFrozenRows(1);
      if(s.getRange(1, 1, 1, def.head.length).setFontWeight) s.getRange(1, 1, 1, def.head.length).setFontWeight('bold').setBackground('#fde9d9');
    } else {
      // 列が増えたとき：見出しの空いているところにだけ、新しい見出しを書く（中身には触らない）
      var cur = s.getRange(1, 1, 1, def.head.length).getValues()[0];
      for(var j = 0; j < def.head.length; j++) if(!str(cur[j])) s.getRange(1, j + 1).setValue(def.head[j]);
    }
  });
  if(rows('events').length === 0) seedSample();
  setupStats();
  var def = book.getSheetByName('シート1') || book.getSheetByName('Sheet1');
  if(def && def.getLastRow() === 0 && book.getSheets().length > 1) book.deleteSheet(def);
  salt();
  clearCache(); clearSchedule();
}

function setupStats(){
  var s = sh('stats');
  var R = "'" + SHEETS.residents.name + "'", V = "'" + SHEETS.visits.name + "'", U = "'" + SHEETS.unlocks.name + "'", P = "'" + SHEETS.picks.name + "'", G = "'" + SHEETS.progress.name + "'";
  var data = [
    ['住民登録者数', '=COUNTIF(' + R + '!F2:F,"active")'],
    ['参加者数（のべ・開催日ごとに1人1回）', '=COUNTA(' + V + '!A2:A)'],
    ['参加者数（実人数）', '=IFERROR(COUNTA(UNIQUE(FILTER(' + V + '!A2:A,' + V + '!A2:A<>""))),0)'],
    ['再訪した住民の数（2日以上参加）', '=IFERROR(SUMPRODUCT(--(COUNTIF(' + V + '!A2:A,UNIQUE(FILTER(' + V + '!A2:A,' + V + '!A2:A<>"")))>1)),0)'],
    ['', ''],
    ['▼ 開催日ごとの参加者数', '=QUERY(' + V + '!A1:D,"select C, count(A) where A is not null group by C label count(A) \'人数\'",1)']
  ];
  s.getRange(2, 1, data.length, 2).setValues(data);
  s.getRange(2, 4).setValue('▼ 施設ごとの解放数（開催日別）');
  s.getRange(3, 4).setValue('=QUERY(' + U + '!A1:D,"select B, C, count(A) where A is not null group by B, C label count(A) \'人数\'",1)');
  s.getRange(2, 8).setValue('▼ 選択肢ごとの人数');
  s.getRange(3, 8).setValue('=QUERY(' + P + '!A1:G,"select D, E, F, count(A) where A is not null group by D, E, F label count(A) \'人数\'",1)');
  s.getRange(2, 13).setValue('▼ 物語を読み終えた数');
  s.getRange(3, 13).setValue('=QUERY(' + G + '!A1:G,"select D, E, count(A) where F = \'読み終えた\' group by D, E label count(A) \'人数\'",1)');
}

/** 見本の物語（仕組みを確かめるための仮のもの。芽美のシナリオに差し替えてください） */
function seedSample(){
  var EV = 'iw2026xmas';
  var put = function(key, data){
    var n = SHEETS[key].head.length;
    data = data.map(function(r){ r = r.slice(0, n); while(r.length < n) r.push(''); return r; });   // 足りない列は空欄
    if(data.length) sh(key).getRange(2, 1, data.length, n).setValues(data);
  };
  // 見本の ひらがな・English（芽美のシナリオに差し替えるまでの仮のもの）
  var K = SAMPLE_KANA_EN;
  put('events', [[EV, 'innocent world 2026 クリスマス', '2026-12-01', '2026-12-31', '見本', 'innocent world 2026 クリスマス', 'innocent world 2026 Christmas']]);
  put('days', [[EV, '2026-12-19', '1日目', 1, '1にちめ', 'Day 1'], [EV, '2026-12-20', '2日目', 2, '2にちめ', 'Day 2']]);
  // ※ 見本のことばです。公開コードに載っているので、本番では必ず「ことば」シートで書きかえてください
  put('words', [
    ['2026-12-19', 'entrance', 'みほんほしのかけら｜sample star', 'ようこそ、レンガ村へ！ 今日の村の地図がひらきました。', 'ようこそ、レンガむらへ！ きょうの ちずが ひらいたよ。', 'Welcome to Brick Village! Today’s map is open.'],
    ['2026-12-19', 'bakery', 'みほんやきたて', ''], ['2026-12-19', 'flower', 'みほんひまわり', ''], ['2026-12-19', 'library', 'みほんほんのとびら', ''],
    ['2026-12-19', 'windmill', 'みほんかぜのうた', ''], ['2026-12-19', 'plaza', 'みほんみんなのひかり', ''],
    ['2026-12-20', 'entrance', 'みほんゆきのしずく｜sample snow', 'おかえりなさい。今日のレンガ村の地図がひらきました。', 'おかえりなさい。きょうの ちずが ひらいたよ。', 'Welcome back. Today’s map is open.'],
    ['2026-12-20', 'bakery', 'みほんしろいパン', ''], ['2026-12-20', 'flower', 'みほんすずらん', ''], ['2026-12-20', 'library', 'みほんしおり', ''],
    ['2026-12-20', 'windmill', 'みほんゆきかぜ', ''], ['2026-12-20', 'plaza', 'みほんみんなのひかり', '']
  ]);
  put('facilities', [
    [EV, 'bakery', 'パン屋さん', '真っ赤な屋根', 24, 30, '#e8101e', '#fff1d6', 'house', '', '', 1, 'パンやさん', 'Bakery', 'まっかな やね', 'Red roof', '', ''],
    [EV, 'flower', '花屋さん', '黄色い壁', 76, 28, '#ff8a1a', '#ffe04a', 'house', '', '', 2, 'はなやさん', 'Flower Shop', 'きいろい かべ', 'Yellow walls', '', ''],
    [EV, 'library', '図書館', '青い扉', 22, 72, '#1e5aff', '#e8eefc', 'house', '', '', 3, 'としょかん', 'Library', 'あおい とびら', 'Blue door', '', ''],
    [EV, 'windmill', '風車', 'ゆっくり回る', 78, 70, '#7a4a20', '#ffffff', 'windmill', '', '', 4, 'ふうしゃ', 'Windmill', 'ゆっくり まわる', 'Turning slowly', '', ''],
    [EV, 'plaza', '中央広場', 'パレードのはじまる場所', 50, 50, '#e23d72', '#fff7ea', 'plaza', '読了数>=2', 'ほかの施設の物語を2つ読むと、広場への道がひらきます。', 5, 'ひろば', 'Central Plaza', 'パレードの はじまる ところ', 'Where the parade begins', 'ほかの ものがたりを 2つ よむと、ひろばへの みちが ひらくよ。', 'Read two other stories to open the path to the plaza.']
  ]);
  put('routes', [
    [EV, 'intro', 1, '今回再訪', 'intro_return', '', '', '1日目にも来た住民（両日参加）'],
    [EV, 'intro', 2, '2日目；今回初来訪', 'intro_day2', '', '', '2日目だけ参加の住民（前回イベント参加者も含む）'],
    [EV, 'intro', 3, '', 'intro_1', '', '', ''],
    [EV, 'bakery', 1, '今回再訪', 'bakery_r1', '', '', '1日目にも来た住民だけ'],
    [EV, 'bakery', 2, '', 'bakery_1', '', '', ''],
    [EV, 'flower', 1, '', 'flower_1', '', '', ''],
    [EV, 'library', 1, '今回再訪', 'library_r1', '', '', '1日目にも来た住民だけ'],
    [EV, 'library', 2, '', 'library_1', '', '', ''],
    [EV, 'windmill', 1, '', 'windmill_1', '', '', ''],
    [EV, 'plaza', 1, 'やさしさ>=2', 'end_kind', '', '', 'エンディング'],
    [EV, 'plaza', 2, '勇気>=2', 'end_brave', '', '', 'エンディング'],
    [EV, 'plaza', 3, '', 'end_wonder', '', '', 'エンディング']
  ]);
  var SC = [
    ['intro_1', 'meadow', '', '', '', '', '', ''], ['intro_return', 'meadow', '', '', 'returned', '', '', ''], ['intro_day2', 'meadow', '', '', '', '', '', ''],
    ['bakery_1', 'bakery', '', '', '', '', '', ''], ['bakery_2a', 'bakery', '', 'bread', '', '', '', ''], ['bakery_2b', 'bakery', '', 'bread', 'saw_light', '', '', ''],
    ['bakery_r1', 'bakery', '', 'bread', '', 'やさしさ+1', '', ''],
    ['flower_1', 'flower', '', '', '', '', '', ''], ['flower_2a', 'flower', '', 'seed', '', '', '', ''], ['flower_2b', 'flower', '', 'seed', 'seed_hill', '', '', ''],
    ['library_1', 'library', '', '', '', '', '', ''], ['library_2a', 'library', '', 'bookmark', '', '', '', ''], ['library_2b', 'library', '', 'bookmark', '', '', '', ''],
    ['library_r1', 'library', 'library_r2', 'key', 'secret_door', '', '', ''], ['library_r2', 'library', '', '', '', '', '', ''],
    ['windmill_1', 'windmill', '', '', '', '', '', ''], ['windmill_2a', 'windmill', '', 'feather', '', '', '', ''], ['windmill_2b', 'windmill', '', 'feather', '', '', '', ''],
    ['end_kind', 'plaza', '', '', 'ending_kind', '', 'parade', 'ARパレードを見る', 'ARパレードを みる', 'Watch the AR Parade'],
    ['end_brave', 'plaza', '', '', 'ending_brave', '', 'fireworks', 'フィナーレ花火を見る', 'はなびを みる', 'Watch the Finale Fireworks'],
    ['end_wonder', 'plaza', '', '', 'ending_wonder', '', 'xmas', 'クリスマスパレードを見る', 'クリスマスパレードを みる', 'Watch the Christmas Parade']
  ];
  put('scenes', SC.map(function(r){ return [EV, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], '', r[8] || '', r[9] || '']; }));
  var L = [
    ['intro_1', '', 'ページをめくると、レンガの小道が目の前にのびていました。'],
    ['intro_1', 'esper', 'わあ、{name}さんだね！ ようこそ、レンガ村へ！'],
    ['intro_1', 'esper', 'ぼくはエスパー。村のあちこちで、ふしぎなことが起きているんだ。'],
    ['intro_1', 'esper', '地図の建物をタップして、施設に掲示された「ひみつのことば」を入れてみて。物語がひらくよ！'],
    ['intro_return', 'esper', 'あっ、{name}さん！ また来てくれたんだね。会えてうれしいな。'],
    ['intro_return', 'esper', '今日は、再訪した住民さんにしか見えない物語があるんだ。パン屋さんと図書館をのぞいてみて！'],
    ['intro_day2', '', 'ページをめくると、レンガ村はきのうより少しにぎやかでした。'],
    ['intro_day2', 'esper', 'はじめまして、{name}さん！ じつはきのう、村でふしぎなことがあったんだ。'],
    ['intro_day2', 'esper', '絵本の最後のページが見つからないの。みんなで手がかりを探しているところなんだ。いっしょに来てくれる？'],
    ['bakery_1', 'niko', 'いらっしゃい！ 焼きたてのパンのにおい、するでしょ？'],
    ['bakery_1', 'niko', 'でもね、今朝からオーブンの火がちょっと元気ないの……。'],
    ['bakery_2a', 'niko', 'ありがとう！ ふたりで運ぶと、あっという間だね。'],
    ['bakery_2a', 'niko', 'お礼に、いちばんおいしく焼けたパンをどうぞ！'],
    ['bakery_2b', 'niko', 'えっ、オーブンの奥に……小さな光の粒？'],
    ['bakery_2b', 'niko', 'ふしぎ……。これ、きっと広場と関係があるよ。持っていって！'],
    ['bakery_r1', 'niko', 'きのうの住民さん！ 待ってたよ。'],
    ['bakery_r1', 'niko', 'きのうのお礼に、ひみつのレシピで焼いた「星のパン」をどうぞ。'],
    ['bakery_r1', 'niko', 'それとね、図書館のじいじが、あなたに渡したいものがあるって。'],
    ['flower_1', 'lily', 'こんにちは！ ここは村いちばんの花屋さん。'],
    ['flower_1', 'lily', 'この種、どこにまいたらいいと思う？'],
    ['flower_2a', 'lily', 'すてき！ 明日には、きっと芽が出るよ。'],
    ['flower_2a', 'lily', 'これはあなたの分。だいじにしてね。'],
    ['flower_2b', 'lily', '風に乗って、村じゅうに花が咲くかも！'],
    ['flower_2b', 'lily', 'はい、あなたの分の種。'],
    ['library_1', 'jiiji', 'ほっほっ。よく来たのう。ここには村の歴史がぜんぶ眠っておる。'],
    ['library_1', 'jiiji', 'この古い本、最後のページだけ白紙なんじゃ。'],
    ['library_2a', 'jiiji', 'おお……文字が光っておる！ あんたも、この物語の一部になったようじゃ。'],
    ['library_2b', 'jiiji', 'むかしむかし、この村は一冊の絵本から生まれたんじゃよ……。'],
    ['library_2b', 'jiiji', 'このしおりを持っておいき。'],
    ['library_r1', 'jiiji', 'また来てくれたのう。2日目の住民にだけ、見せたいものがある。'],
    ['library_r1', 'jiiji', '本棚のうしろの、小さな扉じゃ。この鍵で開くはずじゃよ。'],
    ['library_r2', '', '扉の向こうには、きのうあなたが書いた名前の本が、光りながら並んでいました。'],
    ['library_r2', 'jiiji', 'あんたの選んだことは、ちゃんと村に残っておるんじゃ。'],
    ['windmill_1', 'hal', 'やあ！ 風車のてっぺん、のぼってみる？ ちょっと高いけど……。'],
    ['windmill_2a', 'hal', 'すごい！ 村ぜんぶが見えるね！'],
    ['windmill_2a', 'hal', 'あ、てっぺんにきらきらの羽根が。あなたにあげる！'],
    ['windmill_2b', 'hal', '見守ってくれてありがとう。おかげで安心してのぼれたよ。'],
    ['windmill_2b', 'hal', 'おみやげの羽根、どうぞ！'],
    ['end_kind', 'esper', 'みんなが、あなたのやさしさの話をしてるよ。'],
    ['end_kind', 'mimi', 'その気持ちが、広場いっぱいの光になったの！'],
    ['end_kind', '', '夜空に光がともり、パレードの音楽が聞こえてきました。'],
    ['end_brave', 'esper', 'あなたの勇気が、村に新しい風を運んできたんだ！'],
    ['end_brave', '', '広場の真ん中で、大きな花火が打ち上がりました。'],
    ['end_wonder', 'esper', 'あなたの好奇心が、村のひみつをたくさん見つけてくれたね。'],
    ['end_wonder', '', '雪がふりはじめ、遠くから鈴の音が近づいてきます。']
  ];
  var cnt = {};
  put('lines', L.map(function(r){ cnt[r[0]] = (cnt[r[0]] || 0) + 1; var x = K[r[2]] || ['', '']; return [EV, r[0], cnt[r[0]], r[1], r[2], '', x[0], x[1]]; }));
  put('choices', [
    [EV, 'bakery_1', 1, 'carry', 'いっしょに薪を運ぶ', 'bakery_2a', 'やさしさ+1', '', '', '', 'いっしょに まきを はこぶ', 'Help carry the firewood'],
    [EV, 'bakery_1', 2, 'peek', 'オーブンの中をのぞいてみる', 'bakery_2b', '好奇心+1', '', '', '', 'オーブンの なかを のぞく', 'Peek inside the oven'],
    [EV, 'flower_1', 1, 'sun', 'ひなたの花だんにまく', 'flower_2a', 'やさしさ+1', '', '', '', 'ひなたの はなだんに まく', 'Plant them in the sunny flowerbed'],
    [EV, 'flower_1', 2, 'hill', '風車の丘にまく', 'flower_2b', '勇気+1', '', '', '', 'ふうしゃの おかに まく', 'Plant them on the windmill hill'],
    [EV, 'library_1', 1, 'write', '白紙のページに名前を書く', 'library_2a', '勇気+1', 'wrote_name', '', '', 'しろい ページに なまえを かく', 'Write your name on the blank page'],
    [EV, 'library_1', 2, 'listen', 'じいじに本のお話を聞く', 'library_2b', '好奇心+1', '', '', '', 'じいじに ほんの おはなしを きく', 'Ask Jiji about the book'],
    [EV, 'windmill_1', 1, 'climb', 'のぼってみる！', 'windmill_2a', '勇気+1', '', '', '', 'のぼってみる！', 'I’ll climb up!'],
    [EV, 'windmill_1', 2, 'watch', '下から見守る', 'windmill_2b', 'やさしさ+1', '', '', '', 'したから みまもる', 'Watch from below']
  ]);
  put('items', [
    ['bread', '焼きたてのパン', '🍞', 'ほかほかで、いいにおい。', 'やきたての パン', 'Fresh bread', 'ほかほかで、いい におい。', 'Warm and smells wonderful.'],
    ['seed', 'ふしぎな種', '🌱', '光の当たる場所でまくと、なにかが咲くらしい。', 'ふしぎな たね', 'Mysterious seed', 'ひかりの あたる ところに まくと、なにかが さくらしい。', 'Plant it in the light and something may bloom.'],
    ['bookmark', '星のしおり', '🔖', '図書館の古い本にはさまっていた。', 'ほしの しおり', 'Star bookmark', 'としょかんの ふるい ほんに はさまっていた。', 'Found tucked in an old library book.'],
    ['feather', '風の羽根', '🪶', '風車のてっぺんで見つけた、きらきらの羽根。', 'かぜの はね', 'Wind feather', 'ふうしゃの てっぺんで みつけた、きらきらの はね。', 'A sparkling feather from the top of the windmill.'],
    ['key', '小さな鍵', '🗝️', '再訪した住民だけがもらえる、ひみつの扉の鍵。', 'ちいさな かぎ', 'Little key', 'また きてくれた じゅうみんだけが もらえる、ひみつの とびらの かぎ。', 'The key to a secret door, only for returning residents.']
  ]);
  put('points', [['courage', '勇気', 'ゆうき', 'Courage'], ['kindness', 'やさしさ', 'やさしさ', 'Kindness'], ['wonder', '好奇心', 'わくわく', 'Curiosity']]);
  put('characters', [['esper', 'エスパー', 'Esper', 'エスパー'], ['mimi', 'ミミ', 'Mimi', 'ミミ'], ['lily', 'リリィ', 'Lily', 'リリィ'], ['luke', 'ルーク', 'Luke', 'ルーク'], ['niko', 'ニコ', 'Niko', 'ニコ'], ['hal', 'ハル', 'Hal', 'ハル'], ['arika', 'アリカ', 'Arika', 'アリカ'], ['nuru', 'ヌール', 'Nour', 'ヌール'], ['mock', 'モック', 'Mock', 'モック'], ['jiiji', 'じいじ', 'Jiji', 'じいじ']]);
  put('regfields', [
    ['name', '住民名（ニックネーム）', 'text', '', true, 12, 'れい：ほしのこ', 'なまえ（ニックネーム）', 'Nickname', '', '', 'れい：ほしのこ', 'e.g. Star Kid'],
    ['friend', 'いちばん会いたい住人', 'character', '', false, 20, '', 'いちばん あいたい なかま', 'Who do you most want to meet?', '', '', '', ''],
    ['color', '好きな色', 'choice', 'あか｜あお｜きいろ｜みどり｜ピンク｜むらさき', false, 10, '', 'すきな いろ', 'Favorite color', 'あか｜あお｜きいろ｜みどり｜ピンク｜むらさき', 'Red｜Blue｜Yellow｜Green｜Pink｜Purple', '', '']
  ]);
}

/* 見本の物語の ひらがな・English（seedSample で使用） */
var SAMPLE_KANA_EN = {
"ページをめくると、レンガの小道が目の前にのびていました。": [
"ページを めくると、レンガの こみちが めのまえに のびていました。",
"When you turned the page, a brick path stretched out before you."
],
"わあ、{name}さんだね！ ようこそ、レンガ村へ！": [
"わあ、{name}さんだね！ ようこそ、レンガむらへ！",
"Wow, you must be {name}! Welcome to Brick Village!"
],
"ぼくはエスパー。村のあちこちで、ふしぎなことが起きているんだ。": [
"ぼくは エスパー。むらの あちこちで、ふしぎな ことが おきているんだ。",
"I’m Esper. Strange things are happening all over the village."
],
"地図の建物をタップして、施設に掲示された「ひみつのことば」を入れてみて。物語がひらくよ！": [
"ちずの たてものを タップして、かんばんの「ひみつの ことば」を いれてみて。ものがたりが ひらくよ！",
"Tap a building on the map and enter the secret word on its sign. A story will open!"
],
"あっ、{name}さん！ また来てくれたんだね。会えてうれしいな。": [
"あっ、{name}さん！ また きてくれたんだね。あえて うれしいな。",
"Oh, {name}! You came back! I’m so happy to see you."
],
"今日は、再訪した住民さんにしか見えない物語があるんだ。パン屋さんと図書館をのぞいてみて！": [
"きょうは、また きてくれた ひとだけの ものがたりが あるんだ。パンやさんと としょかんを のぞいてみて！",
"Today there are stories only returning residents can see. Visit the bakery and the library!"
],
"ページをめくると、レンガ村はきのうより少しにぎやかでした。": [
"ページを めくると、レンガむらは きのうより すこし にぎやかでした。",
"When you turned the page, Brick Village was a little livelier than yesterday."
],
"はじめまして、{name}さん！ じつはきのう、村でふしぎなことがあったんだ。": [
"はじめまして、{name}さん！ じつは きのう、むらで ふしぎな ことが あったんだ。",
"Nice to meet you, {name}! Something strange happened in the village yesterday."
],
"絵本の最後のページが見つからないの。みんなで手がかりを探しているところなんだ。いっしょに来てくれる？": [
"えほんの さいごの ページが みつからないの。みんなで てがかりを さがしているんだ。いっしょに きてくれる？",
"The last page of the picture book is missing. We’re all searching for clues. Will you come with us?"
],
"いらっしゃい！ 焼きたてのパンのにおい、するでしょ？": [
"いらっしゃい！ やきたての パンの におい、するでしょ？",
"Welcome! Can you smell the fresh bread?"
],
"でもね、今朝からオーブンの火がちょっと元気ないの……。": [
"でもね、けさから オーブンの ひが ちょっと げんき ないの……。",
"But since this morning, the oven fire has been a little weak…"
],
"ありがとう！ ふたりで運ぶと、あっという間だね。": [
"ありがとう！ ふたりで はこぶと、あっというまだね。",
"Thank you! With two of us, it’s done in no time."
],
"お礼に、いちばんおいしく焼けたパンをどうぞ！": [
"おれいに、いちばん おいしく やけた パンを どうぞ！",
"As thanks, here’s my best loaf!"
],
"えっ、オーブンの奥に……小さな光の粒？": [
"えっ、オーブンの おくに……ちいさな ひかりの つぶ？",
"Huh? Deep in the oven… tiny specks of light?"
],
"ふしぎ……。これ、きっと広場と関係があるよ。持っていって！": [
"ふしぎ……。これ、きっと ひろばと かんけいが あるよ。もっていって！",
"How strange… This must have something to do with the plaza. Take it with you!"
],
"きのうの住民さん！ 待ってたよ。": [
"きのうの じゅうみんさん！ まってたよ。",
"You were here yesterday! I’ve been waiting for you."
],
"きのうのお礼に、ひみつのレシピで焼いた「星のパン」をどうぞ。": [
"きのうの おれいに、ひみつの レシピで やいた「ほしの パン」を どうぞ。",
"To thank you for yesterday, here’s “Star Bread” from my secret recipe."
],
"それとね、図書館のじいじが、あなたに渡したいものがあるって。": [
"それとね、としょかんの じいじが、あなたに わたしたい ものが あるって。",
"Also, Jiji at the library has something to give you."
],
"こんにちは！ ここは村いちばんの花屋さん。": [
"こんにちは！ ここは むらで いちばんの はなやさん。",
"Hello! This is the best flower shop in the village."
],
"この種、どこにまいたらいいと思う？": [
"この たね、どこに まいたら いいと おもう？",
"Where do you think we should plant these seeds?"
],
"すてき！ 明日には、きっと芽が出るよ。": [
"すてき！ あしたには、きっと めが でるよ。",
"Lovely! They’ll surely sprout by tomorrow."
],
"これはあなたの分。だいじにしてね。": [
"これは あなたの ぶん。だいじに してね。",
"This one is for you. Take good care of it."
],
"風に乗って、村じゅうに花が咲くかも！": [
"かぜに のって、むらじゅうに はなが さくかも！",
"The wind might carry them so flowers bloom all over the village!"
],
"はい、あなたの分の種。": [
"はい、あなたの ぶんの たね。",
"Here, these seeds are for you."
],
"ほっほっ。よく来たのう。ここには村の歴史がぜんぶ眠っておる。": [
"ほっほっ。よく きたのう。ここには むらの むかしの ことが ぜんぶ ねむっておる。",
"Ho ho. Welcome. All of the village’s history sleeps here."
],
"この古い本、最後のページだけ白紙なんじゃ。": [
"この ふるい ほん、さいごの ページだけ まっしろ なんじゃ。",
"Only the last page of this old book is blank."
],
"おお……文字が光っておる！ あんたも、この物語の一部になったようじゃ。": [
"おお……もじが ひかっておる！ あんたも、この ものがたりの なかまに なったようじゃ。",
"Oh… the letters are glowing! It seems you’ve become part of this story."
],
"むかしむかし、この村は一冊の絵本から生まれたんじゃよ……。": [
"むかし むかし、この むらは いっさつの えほんから うまれたんじゃよ……。",
"Long, long ago, this village was born from a single picture book…"
],
"このしおりを持っておいき。": [
"この しおりを もっておいき。",
"Take this bookmark with you."
],
"また来てくれたのう。2日目の住民にだけ、見せたいものがある。": [
"また きてくれたのう。2にちめに きた じゅうみんにだけ、みせたい ものが ある。",
"You came back. There’s something I want to show only to residents who return."
],
"本棚のうしろの、小さな扉じゃ。この鍵で開くはずじゃよ。": [
"ほんだなの うしろの、ちいさな とびらじゃ。この かぎで あくはずじゃよ。",
"A little door behind the bookshelf. This key should open it."
],
"扉の向こうには、きのうあなたが書いた名前の本が、光りながら並んでいました。": [
"とびらの むこうには、きのう あなたが かいた なまえの ほんが、ひかりながら ならんでいました。",
"Beyond the door, books with the name you wrote yesterday stood glowing in a row."
],
"あんたの選んだことは、ちゃんと村に残っておるんじゃ。": [
"あんたが えらんだ ことは、ちゃんと むらに のこっておるんじゃ。",
"The choices you made remain here in the village."
],
"やあ！ 風車のてっぺん、のぼってみる？ ちょっと高いけど……。": [
"やあ！ ふうしゃの てっぺん、のぼってみる？ ちょっと たかいけど……。",
"Hi! Want to climb to the top of the windmill? It’s a bit high…"
],
"すごい！ 村ぜんぶが見えるね！": [
"すごい！ むらが ぜんぶ みえるね！",
"Amazing! You can see the whole village!"
],
"あ、てっぺんにきらきらの羽根が。あなたにあげる！": [
"あ、てっぺんに きらきらの はねが。あなたに あげる！",
"Oh, there’s a sparkling feather at the top. It’s yours!"
],
"見守ってくれてありがとう。おかげで安心してのぼれたよ。": [
"みまもってくれて ありがとう。おかげで あんしんして のぼれたよ。",
"Thanks for watching over me. I felt safe climbing."
],
"おみやげの羽根、どうぞ！": [
"おみやげの はね、どうぞ！",
"Here’s a feather as a souvenir!"
],
"みんなが、あなたのやさしさの話をしてるよ。": [
"みんなが、あなたの やさしさの はなしを してるよ。",
"Everyone is talking about your kindness."
],
"その気持ちが、広場いっぱいの光になったの！": [
"その きもちが、ひろば いっぱいの ひかりに なったの！",
"That feeling turned into light that fills the plaza!"
],
"夜空に光がともり、パレードの音楽が聞こえてきました。": [
"よぞらに ひかりが ともり、パレードの おんがくが きこえてきました。",
"Lights glowed in the night sky, and parade music began to play."
],
"あなたの勇気が、村に新しい風を運んできたんだ！": [
"あなたの ゆうきが、むらに あたらしい かぜを はこんできたんだ！",
"Your courage brought a fresh wind to the village!"
],
"広場の真ん中で、大きな花火が打ち上がりました。": [
"ひろばの まんなかで、おおきな はなびが あがりました。",
"Big fireworks burst above the middle of the plaza."
],
"あなたの好奇心が、村のひみつをたくさん見つけてくれたね。": [
"あなたの わくわくする きもちが、むらの ひみつを たくさん みつけてくれたね。",
"Your curiosity found so many of the village’s secrets."
],
"雪がふりはじめ、遠くから鈴の音が近づいてきます。": [
"ゆきが ふりはじめ、とおくから すずの おとが ちかづいてきます。",
"Snow began to fall, and the sound of bells drew closer."
]
};
