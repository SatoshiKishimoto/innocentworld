// Google Apps Script の簡易エミュレーター（ローカルでのテスト用）
// node tools/gas-emu/server.js [port]  →  http://localhost:PORT/exec に gas/Code.gs の doPost/doGet をつなぐ
process.env.TZ = 'Asia/Tokyo';
const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm'), crypto = require('crypto');
const PORT = +process.argv[2] || 8790;

const isDateStr = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(v);
const toCell = v => isDateStr(v) ? new Date(v.length === 10 ? v + 'T00:00:00' : v.replace(' ', 'T')) : v;   // スプレッドシートと同じく、日付らしい文字は日付になる
class Range {
  constructor(sh, r, c, nr, nc){ Object.assign(this, {sh, r, c, nr, nc}); }
  getValues(){ const o = []; for(let i = 0; i < this.nr; i++){ const row = this.sh.data[this.r - 1 + i] || []; const x = []; for(let j = 0; j < this.nc; j++){ const v = row[this.c - 1 + j]; x.push(v === undefined ? '' : v); } o.push(x); } return o; }
  getValue(){ return this.getValues()[0][0]; }
  setValues(v){ for(let i = 0; i < this.nr; i++){ const row = this.sh.data[this.r - 1 + i] || (this.sh.data[this.r - 1 + i] = []); for(let j = 0; j < this.nc; j++) row[this.c - 1 + j] = toCell(v[i][j]); } return this; }
  setValue(v){ return this.setValues([[v]]); }
  setFontWeight(){ return this; } setBackground(){ return this; }
}
class Sheet {
  constructor(name){ this.name = name; this.data = []; }
  getName(){ return this.name; }
  getLastRow(){ let n = this.data.length; while(n > 0 && !(this.data[n - 1] || []).some(v => v !== '' && v !== undefined)) n--; return n; }
  getRange(r, c, nr, nc){ return new Range(this, r, c, nr || 1, nc || 1); }
  appendRow(row){ this.data[this.getLastRow()] = row.map(toCell); }
  setFrozenRows(){}
}
const book = {
  sheets: [new Sheet('シート1')],
  getSheetByName(n){ return this.sheets.find(s => s.name === n) || null; },
  insertSheet(n){ const s = new Sheet(n); this.sheets.push(s); return s; },
  getSheets(){ return this.sheets; },
  deleteSheet(s){ this.sheets = this.sheets.filter(x => x !== s); },
  setSpreadsheetTimeZone(){}
};
const props = {}, cache = {};
function fmt(d, tz, f){
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}).formatToParts(d).map(x => [x.type, x.value]));
  return f.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour === '24' ? '00' : p.hour).replace('mm', p.minute).replace('ss', p.second);
}
const ctx = {
  console, Date, JSON, Math, String, Number, Object, Array,
  SpreadsheetApp: {getActiveSpreadsheet: () => book},
  Utilities: {
    formatDate: fmt, getUuid: () => crypto.randomUUID(),
    DigestAlgorithm: {SHA_256: 'sha256'}, Charset: {UTF_8: 'utf8'},
    computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b)
  },
  PropertiesService: {getScriptProperties: () => ({getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; }})},
  CacheService: {getScriptCache: () => ({get: k => cache[k] === undefined ? null : cache[k], put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; }})},
  LockService: {getScriptLock: () => ({waitLock(){}, releaseLock(){}})},
  ContentService: {MimeType: {JSON: 'json'}, createTextOutput: s => ({s, setMimeType(){ return this; }})}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../gas/Code.gs'), 'utf8'), ctx, {filename: 'Code.gs'});
ctx.setup();
// 各リクエストごとに、GAS と同じく実行のたびの変数をリセット
const reset = () => vm.runInContext('_ss = null; _content = null;', ctx);

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (o, code) => { res.writeHead(code || 200, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}); res.end(JSON.stringify(o)); };
  if(u.pathname === '/__date'){ const d = u.searchParams.get('d'); if(d) props.TEST_DATE = d; else delete props.TEST_DATE; return send({ok: true, date: d}); }
  if(u.pathname === '/__dump'){ return send(Object.fromEntries(book.sheets.map(s => [s.name, s.data.map(r => r.map(v => v instanceof Date ? fmt(v, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss') : v))]))); }
  if(u.pathname === '/__append'){   // テスト用：シートに行を足す ?sheet=名前&row=JSON配列
    const sh = book.getSheetByName(u.searchParams.get('sheet')); if(!sh) return send({ok: false});
    sh.appendRow(JSON.parse(u.searchParams.get('row'))); Object.keys(cache).forEach(k => delete cache[k]); return send({ok: true});
  }
  if(u.pathname === '/__clearcache'){ Object.keys(cache).forEach(k => delete cache[k]); return send({ok: true}); }
  if(req.method === 'OPTIONS'){ res.writeHead(405); return res.end(); }   // 本物の GAS も事前確認（OPTIONS）には応じない
  if(u.pathname !== '/exec') { res.writeHead(404); return res.end(); }
  if(req.method === 'GET'){ reset(); return send(JSON.parse(ctx.doGet({parameter: Object.fromEntries(u.searchParams)}).s)); }
  let body = ''; req.on('data', c => body += c); req.on('end', () => { reset(); send(JSON.parse(ctx.doPost({postData: {contents: body}}).s)); });
}).listen(PORT, () => console.log('GAS emulator on http://localhost:' + PORT + '/exec'));
