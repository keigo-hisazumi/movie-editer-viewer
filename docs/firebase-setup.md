# Firebase と GitHub Pages の準備

movie-editer の出力（トピック・候補・ショートの記録）を Firestore に送り、このビューアで見られるようにするための初回だけの設定です。Firebase は無料の Spark プランのまま使います（Cloud Storage は使いません）。

## 1. Firebase プロジェクトを作る

1. <https://console.firebase.google.com/> を開き、「プロジェクトを作成」を押す。
2. プロジェクト名（例: `movie-editer-viewer`）を入れて進める。Google アナリティクスはオフでよい。
3. 作成後、左下のプランが「Spark」になっていることを確かめる。

## 2. Firestore を作り、ルールを設定する

1. 左のメニューの「構築」▸「Firestore Database」▸「データベースを作成」を押す。
2. ロケーションは `asia-northeast1`（東京）、モードは「本番環境モード」を選ぶ。
3. 「ルール」タブを開き、このリポジトリの [`firestore.rules`](../firestore.rules) の中身を貼る。
4. `OWNER_EMAIL` を、手順 3 で作るログイン用のメールアドレスに書き換えて「公開」を押す。

ルールにより、ブラウザから読めるのはそのアカウントだけになり、ブラウザから書けるのは決まった形の依頼（`requests` への新規作成）だけになります（movie-editer はサービスアカウントで送るのでルールに関係なく書けます）。ルールを更新したときは、同じように貼り直して `OWNER_EMAIL` を書き換えます。

## 3. メール/パスワードのログインを有効にし、自分のアカウントを作る

1. 「構築」▸「Authentication」▸「始める」を押す。
2. 「Sign-in method」タブで「メール/パスワード」を選び、「メール/パスワード」だけを有効にして保存する（「メールリンク」はオフのまま）。
3. 「Users」タブ ▸「ユーザーを追加」で、ログインに使うメールアドレスとパスワードを入れて追加する。
4. 「設定」タブ ▸「ユーザー アクション」で「作成（登録）を有効にする」のチェックを外して保存する。ビューアに登録画面はありませんが、外しておくと他の人が API から勝手にアカウントを作れなくなります。

パスワードを忘れたときは、「Users」タブでそのユーザーのメニューから「パスワードを再設定」を選びます。

## 4. ウェブアプリの設定をビューアに渡す

1. 歯車 ▸「プロジェクトの設定」▸「全般」▸「マイアプリ」でウェブ（`</>`）のアプリを追加する。Firebase Hosting は設定しない。
2. 表示された `firebaseConfig` の `{` から `}` までをコピーする（コンソールに出る書き方のままでよい）。

    ```javascript
    {
      apiKey: "AIza...",
      authDomain: "<プロジェクトID>.firebaseapp.com",
      projectId: "<プロジェクトID>",
      storageBucket: "<プロジェクトID>.firebasestorage.app",
      messagingSenderId: "...",
      appId: "1:..."
    }
    ```

3. GitHub の movie-editer-viewer の「Settings」▸「Secrets and variables」▸「Actions」▸「Variables」タブの「Repository variables」の「New repository variable」で、名前 `FIREBASE_CONFIG`、値にコピーしたものを貼って保存する。

この値はブラウザに配られる公開の値なので、Secret でなく Variable で構いません。データを守っているのは手順 2 のルールです。

## 5. movie-editer に送る鍵を置く

1. 「プロジェクトの設定」▸「サービスアカウント」▸「新しい秘密鍵を生成」を押し、JSON をダウンロードする。
2. Mac のリポジトリの外に置き、自分だけ読めるようにする。

    ```bash
    mkdir -p ~/.config/shorts
    mv ~/Downloads/<ダウンロードした鍵>.json ~/.config/shorts/firebase-key.json
    chmod 600 ~/.config/shorts/firebase-key.json
    ```

3. movie-editer の `config.local.yaml` に鍵のパスを書く。

    ```yaml
    firebase:
      credentials: "~/.config/shorts/firebase-key.json"
    ```

4. Mac のターミナルで movie-editer のフォルダ（`.venv` がある直下）に移動し、依存関係を入れて、今ある出力をまとめて送る。

    ```bash
    .venv/bin/python -m pip install -r requirements.txt
    .venv/bin/python -m shorts publish
    ```

この鍵は Firestore に何でも書ける鍵です。git に入れたり人に渡したりしないでください。漏れたときは同じ画面で鍵を削除し、作り直します。

以後は `prepare`・`transcribe`・`topics`・`candidates`・`make` の後に、その動画が自動で送られます。

ブラウザからトピックと候補作りを頼むときは、`config.local.yaml` に `video_dir`（元動画のフォルダ）も書き、Mac のターミナルで次を起動したままにしておきます（止めるときは Ctrl+C）。起動すると元動画の一覧が送られ、ビューアの「元動画」に出ます。

```bash
.venv/bin/python -m shorts watch
```

## 6. GitHub Pages を有効にする

1. movie-editer-viewer の「Settings」▸「Actions」▸「General」で、「Workflow permissions」を「Read and write permissions」にする。
2. ビューアの PR を main にマージすると、`deploy.yml` が `gh-pages` ブランチにビルドを置く。
3. 「Settings」▸「Pages」で、Source を「Deploy from a branch」、ブランチを `gh-pages` の `/ (root)` にして保存する。
4. <https://keigo-hisazumi.github.io/movie-editer-viewer/> を開き、手順 3 で作ったメールアドレスとパスワードでログインする。

## 無料枠の目安

Spark プランの Firestore は 1 日に読み取り 5 万回・書き込み 2 万回までです。動画 1 本は 1 ドキュメントなので、送るのは 1 回 1 書き込み、一覧を開くと動画の本数分の読み取り（と、元動画の一覧 1 回・依頼 30 件まで）になり、個人で使う分には上限に届きません。watch は変わったものだけを受け取る見張り（リスナー）を使うので、待っている間の読み取りはほとんどありません。
