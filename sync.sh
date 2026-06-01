#!/bin/bash
# 斌选 - 同步根目录代码到 www/ 目录
# 用法: ./sync.sh 或 npm run sync-www

set -e

echo "🔄 同步代码到 www/ ..."

# 确保目录存在
mkdir -p www/js www/css www/assets www/lib

# 同步核心文件
cp -v index.html www/
cp -v js/app.js www/js/
cp -v js/data.js www/js/
cp -v js/ai.js www/js/
cp -v css/styles.css www/css/

# 同步本地化资源
if [ -d "lib" ]; then
    cp -rv lib/* www/lib/
fi

# 同步图片资源（背景图等）
if [ -d "assets" ]; then
    cp -rv assets/* www/assets/
fi

echo "✅ 同步完成！"
echo "📦 接下来运行: npx cap sync"
