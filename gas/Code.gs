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
  days:       {name: '開催日',     head: ['event_id', '開催日', '表示名', '何日目', '表示名（ひらがな）', '表示名（English）']},
  words:      {name: 'ことば',     head: ['開催日', '施設ID', '正解（複数は｜で区切る。日本語・ひらがな・英語などを並べてよい）', '正解したときのメッセージ', 'メッセージ（ひらがな）', 'メッセージ（English）']},
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
  unlocks:    {name: '解放記録',   head: ['住民番号', '開催日', '施設ID', '解放日時']},
  progress:   {name: '進行',       head: ['住民番号', 'event_id', '開催日', '施設ID', '最初の場面ID', '状態', '日時']},
  picks:      {name: '選択',       head: ['住民番号', 'event_id', '開催日', '場面ID', '選択肢ID', '選択肢の文', '日時']},
  states:     {name: '状態',       head: ['住民番号', 'もちもの・ポイント・記録(JSON)', '更新日時']},
  stats:      {name: '集計',       head: ['項目', '値']}
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
    if(a === 'config') return apiConfig(req);
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
function nowStr(){ return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function dt(v){ return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss') : str(v); }
function ymd(v){
  if(v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  // 日付が数字（例：46327）で入ってしまったセルも読めるようにする（スプレッドシートの日付シリアル値）
  if(typeof v === 'number' || /^\d{5}$/.test(String(v).trim())){
    var n = Number(v);
    if(n > 30000 && n < 80000) return Utilities.formatDate(new Date(Date.UTC(1899, 11, 30) + n * 86400000), 'UTC', 'yyyy-MM-dd');
  }
  var s = String(v || '').trim().replace(/\//g, '-');
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function inPeriod(d, from, to){ from = ymd(from); to = ymd(to); return (!from || d >= from) && (!to || d <= to); }
/** 今日の開催情報（開催日でなければ null） */
function dayInfo(d){
  var days = content().days, events = content().events;
  for(var i = 0; i < days.length; i++){
    if(days[i].date !== d) continue;
    var ev = events.filter(function(x){ return x.id === days[i].event; })[0];
    if(!ev || !inPeriod(d, ev.from, ev.to)) continue;
    return {event: days[i].event, eventName: ev.name, date: d, label: days[i].label, dayNo: days[i].dayNo};
  }
  return null;
}

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
  C.days = rows('days').filter(function(r){ return str(r[0]) && ymd(r[1]); }).map(function(r){ return {event: str(r[0]), date: ymd(r[1]), label: tri(r[2], r[4], r[5]), dayNo: Number(r[3]) || 0}; });
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
function doneIn(st, ev){ var n = 0, p = ev + ':'; for(var k in st.done) if(k.indexOf(p) === 0) n++; return n; }
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
  var i;
  if(c.flags) for(i = 0; i < c.flags.length; i++) if(!st.flags[c.flags[i]]) return false;
  if(c.notFlags) for(i = 0; i < c.notFlags.length; i++) if(st.flags[c.notFlags[i]]) return false;
  if(c.items) for(i = 0; i < c.items.length; i++) if(!st.items[c.items[i]]) return false;
  if(c.points) for(var k in c.points) if((st.points[k] || 0) < c.points[k]) return false;
  if(c.done) for(i = 0; i < c.done.length; i++) if(!st.done[ctx.event + ':' + c.done[i]]) return false;
  if(c.doneCount && doneIn(st, ctx.event) < c.doneCount) return false;
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
function emptyState(){ return {points: {}, flags: {}, items: {}, done: {}, introSeen: {}}; }
function loadState(rid){
  var all = rows('states');
  for(var i = all.length - 1; i >= 0; i--) if(all[i][0] === rid){ try{ return normState(JSON.parse(all[i][1])); }catch(e){ break; } }
  return emptyState();
}
function normState(s){ var e = emptyState(); s = s || {}; for(var k in e) e[k] = (s[k] && typeof s[k] === 'object') ? s[k] : e[k]; return e; }
function saveState(rid, st){
  var s = sh('states'), all = rows('states'), json = JSON.stringify(normState(st));
  for(var i = 0; i < all.length; i++) if(all[i][0] === rid){ s.getRange(i + 2, 2, 1, 2).setValues([[json, nowStr()]]); return; }
  s.appendRow([rid, json, nowStr()]);
}
/** スマホに貯まっていた記録（選択・読了）と状態を受け取る */
function applySync(me, req){
  var d = today(), info = dayInfo(d), ev = info ? info.event : '';
  withLock(function(){
    if(req.state) saveState(me.rid, req.state);
    (req.events || []).slice(0, 200).forEach(function(x){
      var at = str(x.at) || nowStr(), dd = ymd(x.date) || d, e2 = str(x.event) || ev;
      if(x.type === 'choice') append('picks', [me.rid, e2, dd, str(x.scene), str(x.choice), str(typeof x.text === 'object' ? x.text.ja : x.text).slice(0, 200), at]);
      if(x.type === 'start' || x.type === 'done') append('progress', [me.rid, e2, dd, str(x.facility), str(x.route), x.type === 'done' ? '読み終えた' : '読んだ', at]);
    });
  });
}
function visitInfo(rid, d, ev){
  var v = rows('visits').filter(function(r){ return r[0] === rid; });
  return {
    returning: v.some(function(r){ return ymd(r[2]) && ymd(r[2]) < d; }),
    returningThis: v.some(function(r){ return str(r[1]) === ev && ymd(r[2]) && ymd(r[2]) < d; }),
    prevEvent: v.some(function(r){ return str(r[1]) && str(r[1]) !== ev; }),
    visitedToday: v.some(function(r){ return ymd(r[2]) === d; }),
    dates: v.map(function(r){ return ymd(r[2]); })
  };
}
function unlockedToday(rid, d){
  var u = {entrance: false, fac: {}};
  rows('unlocks').forEach(function(r){ if(r[0] === rid && ymd(r[1]) === d){ if(r[2] === 'entrance') u.entrance = true; else u.fac[str(r[2])] = true; } });
  return u;
}

/* ================= API ================= */
function publicDefs(){
  var C = content();
  return {items: C.items, points: C.points, characters: C.characters, charactersEn: C.charactersEn || {}, regfields: C.regfields};
}
function apiConfig(){
  var d = today(), info = dayInfo(d), C = content();
  var upcoming = C.days.filter(function(x){ return x.date >= d; }).slice(0, 6).map(function(x){ return {date: x.date, label: x.label}; });   // label は3言語
  return {ok: true, today: d, day: info, upcoming: upcoming, defs: publicDefs()};
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
  var d = today(), info = dayInfo(d), st = loadState(me.rid);
  var res = {ok: true, today: d, day: info, resident: {rid: me.rid, fields: me.fields, createdAt: me.createdAt}, state: st, defs: publicDefs()};
  sh('residents').getRange(me.row, 5).setValue(nowStr());
  if(!info){
    var C = content();
    res.upcoming = C.days.filter(function(x){ return x.date >= d; }).slice(0, 6).map(function(x){ return {date: x.date, label: x.label}; });
    res.visits = visitInfo(me.rid, d, '').dates;
    return res;
  }
  var vi = visitInfo(me.rid, d, info.event), un = unlockedToday(me.rid, d);
  res.visits = vi.dates; res.returning = vi.returning; res.returningThis = vi.returningThis; res.prevEvent = vi.prevEvent;
  res.unlocked = un;
  if(un.entrance) res.map = mapFor(info, st, vi, un);
  return res;
}

function ctxFor(info, vi){ return {event: info.event, dayNo: info.dayNo, returning: vi.returning, returningThis: vi.returningThis, prevEvent: vi.prevEvent}; }
function mapFor(info, st, vi, un){
  var ctx = ctxFor(info, vi);
  return content().facilities.filter(function(f){ return f.event === info.event; }).map(function(f){
    var shown = check(f.show, st, ctx), canEnter = check(f.open, st, ctx);
    return {id: f.id, name: f.name, sub: f.sub, x: f.x, y: f.y, roof: f.roof, wall: f.wall, type: f.type,
      status: !shown ? 'hidden' : !canEnter ? 'blocked' : !un.fac[f.id] ? 'locked' : st.done[info.event + ':' + f.id] ? 'done' : 'open',
      hint: shown && canEnter ? '' : f.hint};
  });
}

/** 入口のひみつのことば */
function apiEntrance(me, req){
  var d = today(), info = dayInfo(d);
  if(!info) return {ok: false, error: 'closed'};
  var un = unlockedToday(me.rid, d), msg = '';
  if(!un.entrance){
    var w = wordFor(d, 'entrance');
    if(!w) return {ok: false, error: 'no_word'};
    var lim = limited(me.rid, 'entrance'); if(lim) return lim;
    if(!matchWord(req.word, w.answers)){ fail(me.rid, 'entrance'); return {ok: false, error: 'wrong'}; }
    msg = w.message;
    withLock(function(){
      if(!unlockedToday(me.rid, d).entrance) append('unlocks', [me.rid, d, 'entrance', nowStr()]);
      if(!visitInfo(me.rid, d, info.event).visitedToday) append('visits', [me.rid, info.event, d, nowStr()]);
    });
    un.entrance = true;
  }
  var st = loadState(me.rid), vi = visitInfo(me.rid, d, info.event), ctx = ctxFor(info, vi);
  var intro = pickRoute(info, 'intro', st, ctx, d);
  return {ok: true, message: msg, returning: vi.returning, returningThis: vi.returningThis, prevEvent: vi.prevEvent, visits: vi.dates, unlocked: un,
    map: mapFor(info, st, vi, un), intro: intro ? bundle(info.event, intro, 'intro') : null};
}

/** 施設のひみつのことば（今日すでに解放済みなら、ことばは不要） */
function apiFacility(me, req){
  var d = today(), info = dayInfo(d), fid = str(req.facility);
  if(!info) return {ok: false, error: 'closed'};
  var un = unlockedToday(me.rid, d);
  if(!un.entrance) return {ok: false, error: 'entrance_first'};
  var fac = content().facilities.filter(function(f){ return f.event === info.event && f.id === fid; })[0];
  if(!fac) return {ok: false, error: 'no_facility'};
  var st = loadState(me.rid), vi = visitInfo(me.rid, d, info.event), ctx = ctxFor(info, vi), msg = '';
  if(!check(fac.show, st, ctx)) return {ok: false, error: 'hidden', hint: fac.hint};
  if(!check(fac.open, st, ctx)) return {ok: false, error: 'blocked', hint: fac.hint};
  if(!un.fac[fid]){
    var w = wordFor(d, fid);
    if(!w) return {ok: false, error: 'no_word'};
    var lim = limited(me.rid, fid); if(lim) return lim;
    if(!matchWord(req.word, w.answers)){ fail(me.rid, fid); return {ok: false, error: 'wrong'}; }
    msg = w.message;
    withLock(function(){ if(!unlockedToday(me.rid, d).fac[fid]) append('unlocks', [me.rid, d, fid, nowStr()]); });
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
function wordFor(d, fid){
  var all = rows('words');
  for(var i = 0; i < all.length; i++) if(ymd(all[i][0]) === d && str(all[i][1]) === fid) return {answers: splitList(all[i][2]), message: tri(all[i][3], all[i][4], all[i][5])};
  return null;
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
    }
  });
  if(rows('events').length === 0) seedSample();
  setupStats();
  var def = book.getSheetByName('シート1') || book.getSheetByName('Sheet1');
  if(def && def.getLastRow() === 0 && book.getSheets().length > 1) book.deleteSheet(def);
  salt();
  clearCache();
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
