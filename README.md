# Commit Constellation

GitHub 貢獻資料 → Canvas 2D 星系動畫。每天一顆星，亮度是 commit 數，顏色是語言，hover 顯示專案名。每日 CI 自動更新，靜態站無後端。

<picture>
  <source srcset="public/preview.webp" type="image/webp">
  <img src="public/preview.png" alt="Animated nebula of GitHub contributions">
</picture>

## Quick start

```bash
npm install
npm run fetch:mock   # 產生 public/data/ 樣本資料
npm run dev
```

## Deploy (GitHub Pages)

1. **Settings → Pages → Source = GitHub Actions**
2. **Actions → Deploy to GitHub Pages → Run workflow**
3. 第一次用樣本資料；改用真實資料：**Actions → Update contribution data → Run workflow**

之後每天 UTC 04:17 自動更新。

**Optional:**

| 設定 | 方法 |
|---|---|
| 包含 private 貢獻 | repo secret `CONSTELLATION_TOKEN`（fine-grained PAT，read-only Contributions + Metadata） |
| 指定哪些 repo 成為星座 | repo variable `PROJECT_REPOS`（逗號分隔 repo 名稱） |

## Scripts

| 指令 | 用途 |
|---|---|
| `npm run dev` | 本機開發 |
| `npm run build` | 生產建置 → `dist/` |
| `npm run typecheck` | TypeScript 型別檢查 |
| `npm test` | 單元測試 |
| `npm run fetch:mock` | 產生樣本資料 |
| `npm run fetch:data` | 抓真實資料（需 `GITHUB_TOKEN` + `GITHUB_USER`） |

## License

MIT
