#!/bin/sh
# 公開前に実行：版番号を更新して、ホーム画面から開いたiPhoneにも新しい版を読み込ませる
cd "$(dirname "$0")/.."
V=$(date +%Y%m%d%H%M%S)
for f in index.html story/index.html admin/index.html; do   # 公開していないページ（admin など）がなくても止まらない
  [ -f "$f" ] && sed -i "s/^var BUILD = '[^']*';/var BUILD = '$V';/" "$f"
done
printf '%s\n' "$V" > version.txt
echo "BUILD $V"
