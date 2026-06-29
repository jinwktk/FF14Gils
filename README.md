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

ブラウザ側は `data/worlds.json` とワールド別 `data/worlds/<world>.json`、期間別 `data/worlds/<world>-<period>.json` のみを読み込み、Saddlebag Exchange API へ直接 POST しません。`data/marketshare.json` は既定ワールド・既定期間用の互換スナップショットです。未指定時は日本DCの32ワールドと 1日、3日、7日、1か月の期間別データを生成し、初期表示は `Hades` の `7日` です。`data/worlds.json` の各ワールドは `name`、`path`、`dataCenter`、`periods` を持ち、UIではDCごとのカテゴリとして表示します。1か月はSaddlebag Exchange APIの上限が7日までのため、7日候補アイテムを種にしてUniversalis履歴APIの30日販売履歴から売上額・売れた数・平均価格を再集計します。利用者が一度選んだワールドは `ff14gils_world` Cookie に保存し、次回表示時に優先します。アイテム名はXIVAPI v2の `language=ja` で補完し、日本語名を表示します。

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
- `FF14GILS_PERIODS`: 生成する売上期間。`1d`、`3d`、`7d`、`30d` をカンマ区切りで指定。未指定時は4期間すべて。
- `FF14GILS_SALES_AMOUNT`: 最低販売回数。既定値は `3`。
- `FF14GILS_AVERAGE_PRICE`: 最低平均価格。既定値は `10000`。
- `FF14GILS_PRESET`: `housing`、`materials`、`consumables`、`collectibles`、`all`、`custom`。
- `FF14GILS_CUSTOM_FILTERS`: `custom` 用のカテゴリ ID。
- `FF14GILS_SORT_BY`: Saddlebag Exchange のソート項目。

## GitHub Pages

`.github/workflows/pages.yml` は GitHub Pages を GitHub Actions 経由で有効化し、`workflow_dispatch`、10分ごとの schedule、`master`/`main` への push で動きます。schedule は毎時 03、13、23、33、43、53 分に実行し、毎時ちょうどの混雑を避けます。ブラウザからSaddlebag APIを直接POSTする方式はCORSで失敗するため、ActionsがAPIを呼び出して静的JSONを更新します。

## 検索と支援リンク

- Google検索向けに `index.html` へ `robots`、`googlebot`、canonical、OG/Twitter、JSON-LD、sitemapリンクを置きます。
- `robots.txt` は全体クロールを許可し、`https://jinwktk.github.io/FF14Gils/sitemap.xml` を案内します。
- Google Search Console 連携で確認できた登録済みプロパティは `sc-domain:rukalun.mydns.jp` のみです。`https://jinwktk.github.io/FF14Gils/` をSearch Consoleに追加した後、sitemapを送信します。
- Search Console のHTMLファイル確認用に `googled9f512eea3a99dc1.html` をサイトルートへ配信します。確認状態を維持するため、このファイルは削除しません。
- ヘッダー右上にKo-fi支援アイコンを置き、リンク先は `https://ko-fi.com/jinwktk` です。ユーザー名を変更する場合は `index.html` のリンクとJSON-LDの `sameAs` を更新します。

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
- 2026-06-29: ブラウザからSaddlebag APIへの直接POSTはCORSで失敗することを確認し、GitHub ActionsのAPI取得を10分ごと更新にするテスト仕様を追加。Saddlebag marketshare は更新時刻を返さないため、完全な更新検知ではなく短時間の実測に基づくCron更新にする。
- 2026-06-29: `src/preferences.js` を追加し、選択したワールドをCookieで180日保持。既定ワールドを `Hades` に変更。
- 2026-06-29: `scripts/item-name-api.mjs` を追加し、XIVAPI v2から日本語アイテム名を取得して `data/item-names-ja.json` と各ワールドJSONへ反映。
- 2026-06-29: 使いやすいダッシュボード構造のため、集計ストリップ、絞り込みパネル、結果パネルのHTML契約テストを追加。
- 2026-06-29: UIをダッシュボード型に再設計。上段に集計、左に絞り込み、右に結果一覧を配置し、スマホでは1カラムで自然に読める構成へ変更。
- 2026-06-29: 上部の取得条件カードと集計カードは、ワールド選択や一覧件数と重複するため削除する方針に変更。
- 2026-06-29: 上部の取得条件カードと集計カードを削除し、タイトル直下に絞り込みと結果一覧が出る構成へ変更。
- 2026-06-29: ワールド選択を日本DCごとのカテゴリに分ける方針に変更。`data/worlds.json` に `dataCenter` を持たせ、UIはDCごとの `<optgroup>` で表示する。
- 2026-06-29: 列名クリックで一覧をソートできるように変更。クリックした列は昇順/降順を切り替え、現在の並びはヘッダーの矢印と `aria-sort` に反映する。
- 2026-06-29: 1日、3日、7日、1か月の売上を見られるようにする方針に変更。`data/worlds.json` に期間一覧と期間別JSONパスを持たせ、7日は従来のワールド別JSONパスを互換として残す。
- 2026-06-29: 画面全体をダークデザインへ変更する方針にする。暗い背景、低輝度のカード、明るい本文色でマーケットダッシュボードとして読みやすくする。
- 2026-06-29: 一覧ヘッダーにスナップショットの最終更新日時を表示する方針にする。上部の重複カードは戻さず、件数の近くに小さく表示する。
- 2026-06-29: Saddlebag Exchange APIは1か月指定を拒否するため、1か月データはUniversalis履歴APIで集計する構成に変更。
- 2026-06-29: 共有時の見栄えと検索向けに、生成したOGP画像、OG/Twitterメタ、canonical、description、JSON-LD、robots.txt、sitemap.xml を追加する方針にする。
- 2026-06-29: 生成画像を `assets/og-image.png` として保存し、OGP/Twitterカードに設定。`robots.txt` と `sitemap.xml` もビルド成果物へ含める。
- 2026-06-29: Google検索向けに `googlebot` メタと sitemap の `<link rel="sitemap">` を追加する方針にする。Google公式では古い sitemap ping は非推奨のため、サイト側のクロール許可とSearch Consoleへのsitemap送信を前提にする。
- 2026-06-29: Search Console 連携で登録済みプロパティを確認したところ `sc-domain:rukalun.mydns.jp` のみで、`jinwktk.github.io/FF14Gils` は未登録。コード側のSEO設定を先に整備する。
- 2026-06-29: ヘッダー右上にKo-fi支援アイコンを追加し、`assets/ko-fi.svg` をローカル配信する方針にする。
- 2026-06-29: モバイル幅ではKo-fiアイコンをヘッダー右上に固定し、CDPで横はみ出しなし、アイコン読込済みを確認。
- 2026-06-29: Search Console のHTMLファイル確認用に `googled9f512eea3a99dc1.html` をルートへ追加し、`scripts/build.mjs` でPages配信対象に含める。
- 2026-06-29: OGP画像から `Hades 初期表示 / 1日・3日・7日・1か月対応` の条件文言を削除し、タイトル、説明、URLだけの画像に再生成する。
