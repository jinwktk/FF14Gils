# FF14Gils

FF14 のマーケットデータから、金策候補を探すための GitHub Pages 向け静的サイトです。

## 方針

- データ元は Saddlebag Exchange の `POST https://api.saddlebagexchange.com/api/ffxivmarketshare` です。
- GitHub Pages 上のブラウザから直接 API を呼ぶと CORS で失敗する可能性があるため、Actions またはローカルの `scripts/fetch-marketshare.mjs` で `data/marketshare.json` を生成し、サイトはそのスナップショットを表示します。
- UI は依存を増やさず、`index.html`、`styles.css`、`src/app.js`、`src/marketshare.js` の静的構成で作ります。

## 開発コマンド

```powershell
npm test
npm run fetch:data
npm run build
```

## 現在の作業状況

- 2026-06-29: 空リポジトリから開始。
- 2026-06-29: Saddlebag Exchange OpenAPI と実 API 応答を確認し、Marketshare API の必須パラメータとレスポンス形状を確認。
- 2026-06-29: TDD の最初の失敗テストを追加。実装はこのテストを通す形で進めます。
