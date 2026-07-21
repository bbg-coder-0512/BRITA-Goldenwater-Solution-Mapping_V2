# 中国水质方案匹配地图 - GitHub Pages版

本目录可以直接作为 GitHub Pages 仓库根目录上传。

重要修复：
1. `index.html` 已放在 ZIP 根目录，不再嵌套在子文件夹里。
2. 已加入 `.nojekyll`，避免 GitHub Pages 使用 Jekyll 处理静态文件。
3. 地图数据改为使用 CDN 地图脚本，避免 GeoJSON fetch/CORS 导致页面空白。

数据记录数：323 条。

## 上传方法

不要直接把 ZIP 文件作为单个文件上传到仓库。请先解压，然后把解压后的 `index.html`、`css/`、`js/`、`data/`、`.nojekyll`、`README.md` 上传到仓库根目录。

GitHub Pages 设置：
- Source: Deploy from a branch
- Branch: main
- Folder: /root
