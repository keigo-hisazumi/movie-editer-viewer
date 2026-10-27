# movie-editer-viewer

[movie-editer](https://github.com/keigo-hisazumi/movie-editer) で作ったショートの下書きの記録（トピック・カット・学習・ショート）を、Firestore 経由でスマホなどから見るためのビューアです。movie-editer の `serve` と同じ内容を、メール/パスワードでログインした本人だけが見られます。公開先は <https://keigo-hisazumi.github.io/movie-editer-viewer/> です。

## 主な機能

- 元動画（movie-editer の `video_dir` の録画）の一覧と、それぞれの処理の状態
- ボタンで段階式の処理を頼む：トピックを作る → トピックを選んでカット（フィラー・無音・関係ない話を詰めた XML とタイトル案）を作る → Filmora で微調整した XML をカットと比べて学習させる（次からのカットに生かす。Mac の movie-editer が受け取って処理し、進み具合と結果が出る）
- トピックごとのカット・微調整した XML・ショートの状態
- 動画ごとの出力の一覧（トピック・カット・ショートの数、更新日時）
- トピックの一覧と、YouTube の概要欄に貼れるチャプター
- カット（見出し・タイトル案・外した話）と、微調整との違い（学習）
- 作ったショートの記録（長さ・カット・画面の文字・BGM と効果音・ファイル）
- メール/パスワードのログインで本人だけが見られる

## 使い方

1. movie-editer で `prepare`・`topics`・`cut`・`learn` などを実行すると、その動画の記録が Firestore に自動で送られる（まとめて送り直すときは `python -m shorts publish`）。
2. 公開先を開き、メールアドレスとパスワードでログインする。
3. 一覧から動画を選ぶ。

ブラウザから頼むときは、Mac で movie-editer の `python -m shorts watch` を起動したままにしておきます。依頼は Firestore の `requests` に書かれ、watch が Claude Code で処理し、終わると動画のページに出ます。

1. 「元動画」の一覧で「トピックを作る」を押す（文字起こしとトピック一覧だけを作る）
2. 動画のページのトピック一覧で、ショートにするトピックにチェックを入れて「選んだトピックのカットを作る」を押す（Mac の `output/<動画名>/topic_XX/` に、カットだけの XML とタイトル案ができる）
3. Mac の Filmora でカットの XML を開いて微調整し、FCP7 XML として同じ `topic_XX/` フォルダに書き出す（名前は自由）
4. 動画のページで、そのトピックの「学習させる」を押す（書き出した XML をカットの XML と比べ、人が直したところを movie-editer の `cut_learning.md` に次からのカットの決め方として書く。ショートは作らない）

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
    ├── stages.ts            # 動画ページの段階式（トピックの選択・カット・ショート）の HTML
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
