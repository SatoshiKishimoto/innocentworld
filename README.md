# innocent world ARパレード

スマホのカメラ越しに、火の鳥・光のクジラ・光の蝶・行進するパレード・フィナーレ花火を表示するWeb ARページです。

- 公開URL：https://satoshikishimoto.github.io/innocentworld/
- SafariまたはChromeで開いてください（LINEなどアプリ内ブラウザではカメラが使えないことがあります）
- 設定（イベント名・距離・速さなど）は `index.html` 内の `CONFIG` と `PARADE` で変更できます

## パレードのテーマ（オリジナル曲）
- `music/parade.mp3`：ループ用（約157秒）。最後から最初へ切れ目なくつながります。ARパレードで使用
- `music/parade_full.mp3`：1曲版（約2分40秒）。最後が「じゃーん！」で終わります。会場で1回流すとき用
- `music/compose.py`：作曲・音源生成スクリプト（`python3 music/compose.py` で作り直せます）

## フィナーレ花火の音楽（オリジナル曲）
- `music/fireworks.mp3`：花火モードで1回だけ流れる曲（約68秒）。花火の打ち上げは、この曲の拍に合わせてあります
- `music/fireworks.py`：作曲・音源生成スクリプト（`python3 music/fireworks.py`）

## クリスマスパレードの音楽（オリジナル曲）
- `music/xmas.mp3`：クリスマスパレードで流れるBGM（約116秒・ループ再生、鈴とチェレスタ入り）
- `music/xmas.py`：作曲・音源生成スクリプト（`python3 music/xmas.py`）

## 更新を公開するとき

`sh tools/bump.sh` を実行してから commit / push してください。版番号（version.txt）が変わると、iPhoneのホーム画面から開いたときも自動で新しい版に読み込み直されます。
