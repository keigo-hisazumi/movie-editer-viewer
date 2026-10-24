# movie-editer-viewer

[movie-editer](https://github.com/keigo-hisazumi/movie-editer) で作ったショートの下書きの記録（トピック・切り抜き候補・ショート）を、Firestore 経由でスマホなどから見るためのビューアです。movie-editer の `serve` と同じ内容を、メール/パスワードでログインした本人だけが見られます。公開先は <https://keigo-hisazumi.github.io/movie-editer-viewer/> です。

## 主な機能

- 元動画（movie-editer の `video_dir` の録画）の一覧と、それぞれの処理の状態
- ボタンでトピックと候補作りを頼む（Mac の movie-editer が受け取って処理し、進み具合と結果が出る）
- 動画ごとの出力の一覧（トピック・候補・ショートの数、更新日時）
- トピックの一覧と、YouTube の概要欄に貼れるチャプター
- 切り抜き候補（見出し・タイトル案・選んだ理由・外す範囲・BGM・効果音・画像）
- 作ったショートの記録（長さ・カット・画面の文字・BGM と効果音・ファイル）
- メール/パスワードのログインで本人だけが見られる

## 使い方

1. movie-editer で `prepare`・`topics`・`candidates`・`make` などを実行すると、その動画の記録が Firestore に自動で送られる（まとめて送り直すときは `python -m shorts publish`）。
2. 公開先を開き、メールアドレスとパスワードでログインする。
3. 一覧から動画を選ぶ。

トピックと候補をブラウザから頼むときは、Mac で movie-editer の `python -m shorts watch` を起動したままにしておき、「元動画」の一覧で「トピックと候補を作る」を押します。依頼は Firestore の `requests` に書かれ、watch が文字起こしと Claude Code での作成を行い、終わると動画のページに出ます。

## Firebase の設定

初回の設定（Firebase プロジェクト・Firestore のルール・ログイン用のアカウント・movie-editer の鍵・GitHub Pages）は [docs/firebase-setup.md](docs/firebase-setup.md) にまとめています。データは Firestore の `videos` コレクションに動画 1 本 1 ドキュメントで入り、中身は movie-editer の `shorts/publish.py` が書く JSON です。元動画の一覧は `sources/all`、ブラウザからの依頼は `requests` に入ります（movie-editer の `shorts/remote.py`）。

## 技術スタック

- TypeScript
- Vite
- Firebase（Authentication・Cloud Firestore、Spark プラン）
- Vitest
- GitHub Pages

## 開発

### 必要な環境

- Node.js 22

### コマンド

```bash
npm ci
npm run dev       # 開発サーバー
npm run build     # 型チェックとビルド（dist/）
npm run preview   # ビルドしたものを確認
npm test          # テスト
```

### 初回の設定

`.env.example` を `.env.local` にコピーし、`VITE_FIREBASE_CONFIG` に Firebase の `firebaseConfig` の JSON を書きます。

## ディレクトリ構成

```text
.
├── docs/firebase-setup.md   # Firebase と GitHub Pages の初回設定
├── firestore.rules          # Firestore のルール（本人だけ読める・書けるのは依頼だけ）
├── index.html               # 画面の外枠
└── src/
    ├── main.ts              # ログインと画面の切り替え
    ├── firebase.ts          # Firebase の初期化と読み込み・依頼の書き込み
    ├── render.ts            # 一覧・動画ページの HTML
    ├── sources.ts           # 元動画の一覧と依頼の HTML
    ├── format.ts            # 時刻などの表示用関数
    ├── types.ts             # Firestore のデータの型
    └── style.css            # 見た目（movie-editer の serve と同じ）
```

## デプロイ

main への PR マージ時に GitHub Actions でビルドし、`gh-pages` ブランチ経由で GitHub Pages に公開します。PR ごとに `pr-<番号>/` のプレビューも作ります。ビルドにはリポジトリ変数 `FIREBASE_CONFIG` を使います。

## 開発ルール

[AGENTS.md](AGENTS.md) を参照してください。

## ライセンス

MIT
