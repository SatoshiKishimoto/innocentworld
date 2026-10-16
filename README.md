# innocent world ARパレード

スマホのカメラ越しに、火の鳥・光のクジラ・光の蝶・行進するパレード・フィナーレ花火を表示するWeb ARページです。

- 公開URL：https://satoshikishimoto.github.io/innocentworld/
- SafariまたはChromeで開いてください（LINEなどアプリ内ブラウザではカメラが使えないことがあります）
- 設定（イベント名・距離・速さなど）は `index.html` 内の `CONFIG` と `PARADE` で変更できます

## パレードのテーマ（オリジナル曲）
- `music/parade.mp3`：ループ用（約157秒）。最後から最初へ切れ目なくつながります。ARパレードで使用
- `music/parade_full.mp3`：1曲版（約2分40秒）。最後が「じゃーん！」で終わります。会場で1回流すとき用
- `music/compose.py`：作曲・音源生成スクリプト（`python3 music/compose.py` で作り直せます）
