// 上演スケジュールと管理サイトのテスト（エミュレーターに対して実行）
//   node tools/gas-emu/server.js 8790 &   →   node tools/gas-emu/test-admin.js 8790
const PORT = +process.argv[2] || 8790, BASE = 'http://localhost:' + PORT;
let fails = 0, n = 0;
function ok(cond, msg, extra){ n++; if(cond) console.log('  ✓ ' + msg); else { fails++; console.log('  ✗ ' + msg, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } }
const get = p => fetch(BASE + p).then(r => r.json());
const post = o => fetch(BASE + '/exec', {method: 'POST', body: JSON.stringify(o)}).then(r => r.json());
const at = (d, t) => Promise.all([get('/__date?d=' + d), get('/__time' + (t ? '?t=' + t : ''))]);

(async () => {
  console.log('■ 準備');
  await get('/__prop?k=ADMIN_CLIENT_ID&v=test-client.apps.googleusercontent.com');
  await get('/__run?f=setupAdmin');
  let dump = await get('/__dump');
  ok(dump['管理者'] && dump['管理者'].some(r => r[0] === 'owner@example.com' && r[2] === 'owner'), 'setupAdmin で実行したアカウントが owner になる');
  ok(dump['開催日'][0].length >= 12 && dump['ことば'][0].length >= 7, '開催日・ことばの見出しに新しい列が足される', dump['開催日'][0]);

  console.log('■ 管理者の認証（サーバー側）');
  let r = await post({action: 'adminOverview'});
  ok(r.error === 'admin_auth', 'ログインなしでは管理の操作ができない', r);
  r = await post({action: 'adminOverview', adminToken: 'xxxxxxxx'});
  ok(r.error === 'admin_auth', 'でたらめな合言葉では入れない', r);
  r = await post({action: 'adminLogin', idToken: 'not-a-real-token'});
  ok(r.error === 'admin_denied', 'Google が認めないトークンでは入れない', r);
  r = await post({action: 'adminLogin', idToken: 'dev:stranger@example.com'});
  ok(r.error === 'admin_denied', '管理者シートにないアカウントは入れない', r);
  await get('/__prop?k=ADMIN_CLIENT_ID&v=other-client');
  r = await post({action: 'adminLogin', idToken: 'dev:owner@example.com'});
  ok(r.error === 'admin_denied', '別のサイト用に発行されたトークン（クライアントIDちがい）では入れない', r);
  await get('/__prop?k=ADMIN_CLIENT_ID&v=test-client.apps.googleusercontent.com');
  r = await post({action: 'adminLogin', idToken: 'dev:Owner@Example.com'});
  ok(r.ok && r.token && r.me.role === 'owner', '許可したアカウントでログインできる（大文字小文字は区別しない）', r);
  const OWN = r.token;
  r = await post({action: 'config'});
  ok(!JSON.stringify(r).includes('みほん'), '参加者用の情報（config）にひみつのことばが含まれない');

  console.log('■ 管理者の追加と権限');
  r = await post({action: 'adminSaveAdmin', adminToken: OWN, email: 'staff@example.com', name: 'スタッフ', role: 'viewer'});
  ok(r.ok, 'owner は管理者を追加できる', r);
  r = await post({action: 'adminLogin', idToken: 'dev:staff@example.com'}); const VIEW = r.token;
  ok(r.ok && r.me.role === 'viewer', '追加したスタッフ（viewer）がログインできる', r);
  r = await post({action: 'adminSave', adminToken: VIEW, date: '2026-12-26', event: 'iw2026xmas', entrance: {answers: 'あ'}});
  ok(r.error === 'forbidden', 'viewer は上演を登録できない', r);
  r = await post({action: 'adminSaveAdmin', adminToken: VIEW, email: 'x@example.com', role: 'owner'});
  ok(r.error === 'forbidden', 'viewer は管理者を追加できない', r);
  r = await post({action: 'adminSaveAdmin', adminToken: OWN, email: 'owner@example.com', role: 'viewer'});
  ok(r.error === 'self', 'owner は自分の権限を下げられない', r);
  r = await post({action: 'adminSaveAdmin', adminToken: OWN, email: 'staff@example.com', role: 'viewer', active: false});
  r = await post({action: 'adminOverview', adminToken: VIEW});
  ok(r.error === 'admin_auth', '停止した管理者は、ログイン中でもすぐ使えなくなる', r);

  console.log('■ 上演の登録（同じ日に2作品）');
  // 2つ目の作品を用意（見本の物語を写して別の作品IDに）
  dump = await get('/__dump');
  for(const sheet of ['施設', '物語の入口', '場面', 'セリフ', '選択肢']){
    for(const row of dump[sheet].slice(1).filter(x => x[0] === 'iw2026xmas')) await get('/__append?sheet=' + encodeURIComponent(sheet) + '&row=' + encodeURIComponent(JSON.stringify(['letter'].concat(row.slice(1)))));
  }
  await get('/__append?sheet=' + encodeURIComponent('イベント') + '&row=' + encodeURIComponent(JSON.stringify(['letter', '旅立ちの手紙', '', '', '', 'たびだちの てがみ', 'The Farewell Letter'])));
  r = await post({action: 'adminOverview', adminToken: OWN});
  ok(r.ok && r.works.some(w => w.id === 'letter' && w.facilities.length === 5), '作品一覧に、登録済みの作品と施設が出る', r.works && r.works.map(w => w.id));
  const base = {adminToken: OWN, date: '2026-12-26', label: {ja: '特別公演', en: 'Special'}, dayNo: 1, start: '10:00', end: '16:00', grace: 60};
  r = await post(Object.assign({action: 'adminSave', event: 'iw2026xmas', entrance: {answers: 'ほしのかけら｜star', message: {ja: 'ようこそ！'}}, facilities: {bakery: {answers: 'やきたて'}, flower: {answers: 'ひまわり'}, library: {answers: 'とびら'}, windmill: {answers: 'かぜ'}, plaza: {answers: 'ひかり'}}}, base));
  ok(r.ok, '作品Aの上演を登録できる', r);
  r = await post(Object.assign({action: 'adminSave', event: 'letter', entrance: {answers: 'STAR'}, facilities: {bakery: {answers: 'やきたて'}}}, base));
  ok(r.error === 'word_clash', '同じ日に入口のことばが重なると保存できない', r);
  r = await post(Object.assign({action: 'adminSave', event: 'letter', entrance: {answers: 'わたりどり'}, facilities: {bakery: {answers: 'やきたて'}, flower: {answers: 'すずらん'}, library: {answers: 'てがみ'}, windmill: {answers: 'かぜ'}, plaza: {answers: 'ひかり'}}}, base, {start: '13:00', end: '17:00', grace: 30}));
  ok(r.ok, '同じ日に作品Bも登録できる（施設のことばは作品Aと同じでもよい）', r);
  r = await post(Object.assign({action: 'adminSave', event: 'letter', entrance: {answers: 'x'}}, base, {start: '17:00', end: '16:00'}));
  ok(r.error === 'bad_time', '終了が開始より前だと保存できない', r);
  r = await post(Object.assign({action: 'adminSave', event: 'nothing', entrance: {answers: 'x'}}, base));
  ok(r.error === 'no_event', '登録されていない作品は選べない', r);
  r = await post({action: 'adminDay', adminToken: OWN, date: '2026-12-26'});
  ok(r.ok && r.shows.length === 2 && r.shows[1].entrance.answers === 'わたりどり' && r.shows[0].facilities.bakery, '開催日の詳細（ことばつき）を管理者だけが見られる', r);

  console.log('■ 参加者：時刻と作品の切り替え');
  await at('2026-12-26', '09:30');
  let c = await post({action: 'config'});
  ok(c.shows.length === 2 && c.shows.every(s => s.phase === 'before') && !JSON.stringify(c).includes('わたりどり'), '公開する作品は出るが、ことばは出ない', c.shows);
  const reg = await post({action: 'register', fields: {name: 'テスト', friend: 'mimi', color: 'あか'}});
  const me = {rid: reg.rid, token: reg.token};
  r = await post(Object.assign({action: 'entrance', word: 'ほしのかけら'}, me));
  ok(r.error === 'not_yet' && r.start === '10:00', '公開前は入れず、開始時刻を知らせる', r);
  await at('2026-12-26', '10:05');
  r = await post(Object.assign({action: 'entrance', word: 'わたりどり'}, me));
  ok(r.error === 'not_yet' && r.start === '13:00', '作品ごとに公開時刻がちがう（Bはまだ）', r);
  r = await post(Object.assign({action: 'entrance', word: 'ほしのかけら'}, me));
  ok(r.ok && r.day.event === 'iw2026xmas' && r.day.key === 'iw2026xmas@2026-12-26', '入口のことばで作品Aに入る', r.day);
  r = await post(Object.assign({action: 'facility', facility: 'bakery', word: 'やきたて'}, me));
  ok(r.ok && r.story, '作品Aの施設をひらける', r.error);
  // 作品Aの bakery を読み終えた状態を送る
  let st = r.ok ? null : null;
  let b = await post(Object.assign({action: 'boot'}, me)); st = b.state;
  st.runs = {'iw2026xmas@2026-12-26': {flags: {met_baker: true}, items: {}, done: {bakery: '2026-12-26'}}}; st.done['iw2026xmas:bakery'] = '2026-12-26'; st.flags['_pts:iw2026xmas:bakery'] = true; st.points = {courage: 1};
  b = await post(Object.assign({action: 'boot', state: st, events: [{id: 'e1', type: 'done', facility: 'bakery', route: 'bakery_1', date: '2026-12-26', event: 'iw2026xmas', at: '2026-12-26 10:20:00'}]}, me));
  ok(b.day.event === 'iw2026xmas' && b.map.find(f => f.id === 'bakery').status === 'done', '地図で作品Aの読了が出る', b.map && b.map.map(f => f.id + ':' + f.status));
  await at('2026-12-26', '13:10');
  r = await post(Object.assign({action: 'entrance', word: 'わたりどり'}, me));
  ok(r.ok && r.day.event === 'letter' && !r.resumed, '入口に戻って作品Bのことばで切りかえ', r.day);
  ok(r.map.find(f => f.id === 'bakery').status === 'locked', '作品Bの地図は作品Aの進行と別（パン屋はまだ閉じている）', r.map.map(f => f.id + ':' + f.status));
  r = await post(Object.assign({action: 'facility', facility: 'flower', word: 'ひまわり'}, me));
  ok(r.error === 'wrong', '施設のことばは、いま進めている作品（B）の言葉だけで判定', r);
  r = await post(Object.assign({action: 'facility', facility: 'flower', word: 'すずらん'}, me));
  ok(r.ok, '作品Bの花屋は作品Bのことばでひらく', r.error);
  r = await post(Object.assign({action: 'entrance', word: 'ほしのかけら'}, me));
  ok(r.ok && r.resumed && r.map.find(f => f.id === 'bakery').status === 'done', '作品Aに戻ると、切りかえ前の進行が残っている', r.map && r.map.map(f => f.id + ':' + f.status));

  console.log('■ 公開終了と猶予');
  await at('2026-12-26', '16:30');
  b = await post(Object.assign({action: 'boot'}, me));
  ok(b.day.event === 'iw2026xmas' && b.day.phase === 'grace' && b.map, '終了後の猶予中は、入場ずみの作品Aを続けられる', b.day);
  r = await post(Object.assign({action: 'facility', facility: 'flower', word: 'ひまわり'}, me));
  ok(r.ok, '猶予中でも、入場ずみの人は施設をひらける', r.error);
  const reg2 = await post({action: 'register', fields: {name: 'あとから', friend: 'mimi', color: 'あお'}}), me2 = {rid: reg2.rid, token: reg2.token};
  r = await post(Object.assign({action: 'entrance', word: 'ほしのかけら'}, me2));
  ok(r.error === 'ended', '終了後は新しく入場できない', r);
  await at('2026-12-26', '17:05');
  r = await post(Object.assign({action: 'entrance', word: 'わたりどり'}, me2));
  ok(r.error === 'ended' || r.ok === false, '作品Bの終了（17:00）後も新しく入場できない', r);
  await at('2026-12-26', '17:01');
  b = await post(Object.assign({action: 'boot'}, me));
  ok(b.day.phase === 'over' && b.ended && !b.map, '猶予（60分）のあとは、操作を受け付けない', b.day);
  r = await post(Object.assign({action: 'facility', facility: 'library', word: 'とびら'}, me));
  ok(r.error === 'ended', '猶予のあとは施設もひらけない', r);
  r = await post(Object.assign({action: 'sync', events: [{id: 'late1', type: 'done', facility: 'flower', route: 'flower_1', date: '2026-12-26', event: 'iw2026xmas', at: '2026-12-26 16:50:00'}]}, me));
  dump = await get('/__dump');
  ok(r.ok && dump['進行'].some(x => x[3] === 'flower' && x[1] === 'iw2026xmas' && x[5] === '読み終えた'), '猶予のあとに届いた記録も残す', r);

  console.log('■ 中止・日付の変更・削除');
  r = await post({action: 'adminStatus', adminToken: OWN, date: '2026-12-26', event: 'letter', cancel: true});
  await at('2026-12-26', '13:30');
  c = await post({action: 'config'});
  ok(r.ok && c.shows.length === 1 && c.shows[0].event === 'iw2026xmas', '中止した上演は参加者に出ない', c.shows);
  r = await post({action: 'adminStatus', adminToken: OWN, date: '2026-12-26', event: 'letter', cancel: false});
  r = await post(Object.assign({action: 'adminSave', event: 'iw2026xmas', origDate: '2026-12-26', entrance: {answers: 'ほしのかけら'}}, base, {date: '2026-12-27'}));
  ok(r.error === 'has_visitors', '参加者がいる上演は日付を変えられない', r);
  r = await post({action: 'adminRemove', adminToken: OWN, date: '2026-12-26', event: 'iw2026xmas'});
  ok(r.error === 'has_visitors', '参加者がいる上演は削除できない（中止にする）', r);
  r = await post(Object.assign({action: 'adminSave', event: 'letter', entrance: {answers: 'てがみ'}}, base, {date: '2027-01-09'}));
  r = await post(Object.assign({action: 'adminSave', event: 'letter', origDate: '2027-01-09', entrance: {answers: 'てがみ2'}}, base, {date: '2027-01-10'}));
  let d2 = await post({action: 'adminDay', adminToken: OWN, date: '2027-01-10'});
  ok(r.ok && d2.shows.length === 1 && d2.shows[0].entrance.answers === 'てがみ2', '参加者がいない上演は日付を変えられる', d2);
  r = await post({action: 'adminRemove', adminToken: OWN, date: '2027-01-10', event: 'letter'});
  d2 = await post({action: 'adminDay', adminToken: OWN, date: '2027-01-10'});
  ok(r.ok && d2.shows.length === 0, '参加者がいない上演は削除できる', d2);

  console.log('■ 再公開（案A：作品＋開催日ごとに進行を分ける・ポイントは重ねない）');
  r = await post(Object.assign({action: 'adminSave', event: 'iw2026xmas', entrance: {answers: 'さいかい'}, facilities: {bakery: {answers: 'やきたて'}}}, base, {date: '2027-01-16'}));
  await at('2027-01-16', '11:00');
  r = await post(Object.assign({action: 'entrance', word: 'さいかい'}, me));
  ok(r.ok && r.day.key === 'iw2026xmas@2027-01-16' && r.map.find(f => f.id === 'bakery').status === 'locked', '同じ作品の再公開は、はじめから（前回の読了は持ちこさない）', r.map && r.map.map(f => f.id + ':' + f.status));
  b = await post(Object.assign({action: 'boot'}, me));
  ok(b.state.points.courage === 1 && b.state.flags['_pts:iw2026xmas:bakery'] && b.state.runs['iw2026xmas@2026-12-26'].done.bakery, '前回の記録・ポイント・ポイント受け取り済みの印は残る', b.state);
  ok(b.returningThis === true, '前回参加した作品の再訪として扱われる');

  console.log('■ 閉村日の表示');
  await at('2026-12-25', '12:00');
  c = await post({action: 'config'});
  const u26 = c.upcoming.find(x => x.date === '2026-12-26');
  ok(!c.day && u26 && u26.works.length === 2 && u26.works.map(w => typeof w.name === 'object' ? w.name.ja : w.name).includes('旅立ちの手紙'), '次の開催日に、その日の作品が一覧で出る', c.upcoming);
  delete c.defs;   // 住民票用の定義（アイテム名など）は除いて調べる
  ok(!JSON.stringify(c).match(/ほしのかけら|わたりどり|やきたて/), '閉村日の情報にもことばは含まれない');

  console.log('■ 操作履歴');
  r = await post({action: 'adminLog', adminToken: OWN});
  ok(r.ok && r.log.some(x => x.op === '上演を中止') && !JSON.stringify(r.log).includes('ほしのかけら'), '操作履歴が残る（ことばそのものは残さない）', r.log && r.log.slice(0, 3));

  console.log(`\n${n - fails}/${n} 件 OK` + (fails ? `（${fails} 件 NG）` : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
