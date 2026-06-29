# FF14Gils

FF14 のマーケットデータから、金策候補を探すための GitHub Pages 向け静的サイトです。

## 方針

- データ元は Saddlebag Exchange の `POST https://api.saddlebagexchange.com/api/ffxivmarketshare` です。
- GitHub Pages 上のブラウザから直接 API を呼ぶと CORS で失敗する可能性があるため、Actions またはローカルの `scripts/fetch-marketshare.mjs` で `data/marketshare.json` を生成し、サイトはそのスナップショットを表示します。
- UI は依存を増やさず、`index.html`、`styles.css`、`src/app.js`、`src/marketshare.js`、`src/worlds.js` の静的構成です。
- GitHub Actions の `.github/workflows/pages.yml` がデータ取得、ビルド、Pages デプロイを行います。

## データ契約

`data/marketshare.json` は以下の形で生成します。

```json
{
  "generatedAt": "2026-06-29T00:00:00.000Z",
  "source": "https://api.saddlebagexchange.com/api/ffxivmarketshare",
  "query": {
    "server": "Hades",
    "timePeriod": 168,
    "salesAmount": 3,
    "averagePrice": 10000,
    "preset": "housing",
    "sortBy": "marketValue",
    "filters": [56, 65, 66, 67, 68, 69, 70, 71, 72, 81, 82]
  },
  "summary": {},
  "items": [
    {
      "itemId": "51269",
      "name": "ガーデン・パーティライト",
      "nameJa": "ガーデン・パーティライト",
      "nameEn": "Garden Mood Lighting"
    }
  ]
}
```

ブラウザ側は `data/worlds.json` とワールド別 `data/worlds/<world>.json` のみを読み込み、Saddlebag Exchange API へ直接 POST しません。`data/marketshare.json` は既定ワールド用の互換スナップショットです。未指定時は日本DCの32ワールドを生成し、初期表示は `Hades` です。利用者が一度選んだワールドは `ff14gils_world` Cookie に保存し、次回表示時に優先します。アイテム名はXIVAPI v2の `language=ja` で補完し、日本語名を表示します。

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

- `FF14GILS_SERVER`: 初期表示するワールド名。生成対象に含まれる場合だけ優先され、未指定時は `Hades`。
- `FF14GILS_WORLDS`: 生成するワールド名のカンマ区切り。未指定時は日本 DC の主要ワールドを生成。
- `FF14GILS_TIME_PERIOD`: 集計期間の時間数。既定値は `168`。
- `FF14GILS_SALES_AMOUNT`: 最低販売回数。既定値は `3`。
- `FF14GILS_AVERAGE_PRICE`: 最低平均価格。既定値は `10000`。
- `FF14GILS_PRESET`: `housing`、`materials`、`consumables`、`collectibles`、`all`、`custom`。
- `FF14GILS_CUSTOM_FILTERS`: `custom` 用のカテゴリ ID。
- `FF14GILS_SORT_BY`: Saddlebag Exchange のソート項目。

## GitHub Pages

`.github/workflows/pages.yml` は GitHub Pages を GitHub Actions 経由で有効化し、`workflow_dispatch`、1時間ごとの schedule、`master`/`main` への push で動きます。ブラウザからSaddlebag APIを直接POSTする方式はCORSで失敗するため、ActionsがAPIを呼び出して静的JSONを更新します。

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
- 2026-06-29: ワールド選択 UI を追加し、`data/worlds.json` とワールド別スナップショット32件を生成。Chrome smoke で `Carbuncle` から `Chocobo` への切替、表示更新、console error なしを確認。
- 2026-06-29: Pages workflow の初回公開失敗を受け、`actions/configure-pages` に `enablement: true` を設定。
- 2026-06-29: 日本人利用者向けに、アイテム名の日本語化と `ギル` 表記、自然な日本語UIへ寄せるテスト仕様を追加。
- 2026-06-29: 初期表示ワールドを `Hades` に変更し、選択したワールドをCookieへ保持するテスト仕様を追加。
- 2026-06-29: ブラウザからSaddlebag APIへの直接POSTはCORSで失敗することを確認し、GitHub ActionsのAPI取得を毎時更新にするテスト仕様を追加。
- 2026-06-29: `src/preferences.js` を追加し、選択したワールドをCookieで180日保持。既定ワールドを `Hades` に変更。
- 2026-06-29: `scripts/item-name-api.mjs` を追加し、XIVAPI v2から日本語アイテム名を取得して `data/item-names-ja.json` と各ワールドJSONへ反映。
- 2026-06-29: 使いやすいダッシュボード構造のため、集計ストリップ、絞り込みパネル、結果パネルのHTML契約テストを追加。
- 2026-06-29: UIをダッシュボード型に再設計。上段に集計、左に絞り込み、右に結果一覧を配置し、スマホでは1カラムで自然に読める構成へ変更。
