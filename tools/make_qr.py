"""入口に貼るQRコードを作ります。
   python3 tools/make_qr.py https://sites.google.com/view/xxxx  [出力ファイル名]
   （pip install segno が必要）"""
import sys, segno
url = sys.argv[1] if len(sys.argv) > 1 else 'https://satoshikishimoto.github.io/innocentworld/story/'
out = sys.argv[2] if len(sys.argv) > 2 else 'qr-entrance.png'
segno.make(url, error='h').save(out, scale=20, border=3, dark='#1f2f8f')
print('saved', out, '→', url)
