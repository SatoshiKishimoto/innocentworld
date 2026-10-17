#!/bin/sh
# 公開前に実行：版番号を更新して、ホーム画面から開いたiPhoneにも新しい版を読み込ませる
cd "$(dirname "$0")/.."
V=$(date +%Y%m%d%H%M%S)
sed -i "s/^var BUILD = '[^']*';/var BUILD = '$V';/" index.html story/index.html
printf '%s\n' "$V" > version.txt
echo "BUILD $V"
