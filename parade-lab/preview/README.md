# parade-lab/preview/ ― 本番パレードの試験版（iPhone での確認用）

統合ブランチ `integ/forest-bridge` の `index.html` を、iPhone で確かめるためにここに置いたもの。本番の `index.html` とは別のページで、本番は変わらない。

- 内容：森の古い橋フロート（時計塔のあと・第3幕の冒頭）、曲の再生位置に合わせた進行（曲の長さは音声ファイルから測定）。
- 画像・音楽・住人の絵は、本番と同じファイル（サイトの一番上）を `<base href="../../">` で読む。
- 本番との違い：版番号による自動読み込み直しをしない（`BUILD = 'dev'`）、ホーム画面用の設定を読まない、画面下に「試験版」の表示。
- `floats/forest-bridge-float.js` は、統合ブランチの `floats/forest-bridge-float.js` と同じ。
- URL の末尾に `?check=1` を付けると、曲の長さ・進行の速さ・山車ごとの通過時間と警告を画面に出す。
- 元にした統合ブランチの版：`integ/forest-bridge` 70dd31b
