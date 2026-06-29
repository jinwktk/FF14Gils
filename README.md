# FF14Gils

FF14 のマーケットデータから、金策候補を探すための GitHub Pages 向け静的サイトです。

## 方針

- データ元は Saddlebag Exchange の `POST https://api.saddlebagexchange.com/api/ffxivmarketshare` です。
- GitHub Pages 上のブラウザから直接 API を呼ぶと CORS で失敗する可能性があるため、Actions またはローカルの `scripts/fetch-marketshare.mjs` で `data/marketshare.json` を生成し、サイトはそのスナップショットを表示します。
- UI は依存を増やさず、`index.html`、`styles.css`、`src/app.js`、`src/marketshare.js` の静的構成です。
- GitHub Actions の `.github/workflows/pages.yml` がデータ取得、ビルド、Pages デプロイを行います。

## データ契約

`data/marketshare.json` は以下の形で生成します。

```json
{
  "generatedAt": "2026-06-29T00:00:00.000Z",
  "source": "https://api.saddlebagexchange.com/api/ffxivmarketshare",
  "query": {
    "server": "Carbuncle",
    "timePeriod": 168,
    "salesAmount": 3,
    "averagePrice": 10000,
    "preset": "housing",
    "sortBy": "marketValue",
    "filters": [56, 65, 66, 67, 68, 69, 70, 71, 72, 81, 82]
  },
  "summary": {},
  "items": []
}
```

ブラウザ側は `data/marketshare.json` のみを読み込み、Saddlebag Exchange API へ直接 POST しません。

## 開発コマンド

```powershell
npm test
npm run fetch:data
npm run build
npm run serve
```

`npm run serve` の代わりに、現在は確認用サーバーを `http://localhost:4173` で起動しています。

## 環境変数

`npm run fetch:data` は以下の環境変数で取得条件を変更できます。

- `FF14GILS_SERVER`: ワールド名。既定値は `Carbuncle`。
- `FF14GILS_TIME_PERIOD`: 集計期間の時間数。既定値は `168`。
- `FF14GILS_SALES_AMOUNT`: 最低販売回数。既定値は `3`。
- `FF14GILS_AVERAGE_PRICE`: 最低平均価格。既定値は `10000`。
- `FF14GILS_PRESET`: `housing`、`materials`、`consumables`、`collectibles`、`all`、`custom`。
- `FF14GILS_CUSTOM_FILTERS`: `custom` 用のカテゴリ ID。
- `FF14GILS_SORT_BY`: Saddlebag Exchange のソート項目。

## GitHub Pages

リモート設定後は、GitHub 側で Pages の source を GitHub Actions に設定してください。ワークフローは `workflow_dispatch`、6時間ごとの schedule、`master`/`main` への push で動きます。

## 現在の作業状況

- 2026-06-29: 空リポジトリから開始。
- 2026-06-29: Saddlebag Exchange OpenAPI と実 API 応答を確認し、Marketshare API の必須パラメータとレスポンス形状を確認。
- 2026-06-29: TDD の最初の失敗テストを追加。実装はこのテストを通す形で進めます。
- 2026-06-29: Architect レビューで、静的 UI が API へ直接 POST しない制約をテストに固定する必要があると判定。回帰テストとデータ契約を追加。
- 2026-06-29: `src/marketshare.js`、`src/app.js`、`scripts/fetch-marketshare.mjs`、`scripts/build.mjs`、GitHub Pages workflow、静的 UI を実装。
- 2026-06-29: `npm run fetch:data` で Carbuncle の marketshare データ 139 件を取得。
- 2026-06-29: `npm test`、`npm run build`、Chrome によるデスクトップ/モバイル UI スモークテストを通過。
- 2026-06-29: code-review で指摘された XSS 対策、API schema 検証、Pages の `npm test` gate、ブラウザ配信対象の契約テストを修正し、最終レビューは `APPROVE/CLEAR`。
- 2026-06-29: UltraQA で通常表示、悪意ある JSON、壊れた JSON、API schema 異常拒否、Chrome デスクトップ/モバイル操作を確認。
