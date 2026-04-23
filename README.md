# 計算ババ抜き 公開用プロジェクト

このフォルダは、そのまま GitHub に上げて Vercel で公開しやすい形にしてあります。

## 1. ローカルで動かす

```bash
npm install
npm run dev
```

ブラウザで表示された URL を開いてください。

## 2. 本番ビルド確認

```bash
npm run build
```

## 3. GitHub に上げる

### Git がまだなら初期化

```bash
git init
git add .
git commit -m "first commit"
```

### GitHub で新しいリポジトリを作る
例: `keisan-babanuki`

その後、GitHub に表示された案内どおりに push します。一般的にはこんな形です。

```bash
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/keisan-babanuki.git
git push -u origin main
```

## 4. Vercel で公開する

1. Vercel にログイン
2. `Add New...` → `Project`
3. GitHub の `keisan-babanuki` を選ぶ
4. Framework Preset は Vite のままで OK
5. `Deploy` を押す

公開が終わると URL ができます。
その URL を LINE や Facebook に貼れば遊んでもらえます。

## 5. URL を送る

- LINE: 娘さんに URL を送る
- Facebook: 投稿本文に URL を貼る

## 補足

- 1人目が人間プレイヤー、2人目以降は CPU です
- 通常モードとアドバンスモードに対応しています
- デザインは公開しやすさ優先で、外部 UI ライブラリを使わない構成にしてあります
