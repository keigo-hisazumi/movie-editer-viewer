// 画面の切り替え：メール/パスワードでログイン → 一覧（?v なし。元動画・依頼・出力一覧）／動画ごとのページ（?v=動画名）
import './style.css';
import { FirebaseError } from 'firebase/app';
import { connect, firebaseOptions } from './firebase';
import { esc } from './format';
import { indexBody, videoBody, videoUrl } from './render';
import { parseSources, sourcesBody } from './sources';
import { topicCuts, videoRequests, type StageCtx } from './stages';
import { SCHEMA, type RequestAction, type RequestDoc, type SourcesDoc, type VideoData, type VideoDoc } from './types';

const BASE = import.meta.env.BASE_URL;
const app = document.querySelector<HTMLElement>('#app')!;
const crumb = document.querySelector<HTMLElement>('header .crumb')!;
const nav = document.querySelector<HTMLElement>('#nav')!;
const userBox = document.querySelector<HTMLElement>('#user')!;

function show(body: string, crumbs: [string, string | null][] = [], tabs: [string, string][] = [], scroll = true) {
  crumb.innerHTML = [['出力一覧', BASE] as [string, string | null], ...crumbs]
    .map(([t, u]) => (u ? `<a href="${esc(u)}">${esc(t)}</a>` : esc(t)))
    .join(' / ');
  nav.innerHTML = tabs.length
    ? '<nav class=tabs>' + tabs.map(([t, a]) => `<a href="#${esc(a)}">${esc(t)}</a>`).join('') + '</nav>'
    : '';
  app.innerHTML = body;
  // 描画が読み込みの後なので、URL の #（候補・ショートへのリンク）の位置へ自分で移動する
  if (scroll && location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
}

/** ログインの失敗の理由 */
function signInError(e: unknown): string {
  const code = e instanceof FirebaseError ? e.code : '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)) {
    return 'メールアドレスかパスワードが違います。';
  }
  if (code === 'auth/too-many-requests') return '失敗が続いたため、しばらくログインできません。時間をおいて試してください。';
  return `ログインできませんでした：${e instanceof Error ? e.message : String(e)}`;
}

function errorMessage(e: unknown): string {
  if (e instanceof FirebaseError && e.code === 'permission-denied') {
    return 'このアカウントでは見られません。Firestore のルールに書いたメールアドレスと、ログインしたアカウントが同じか確認してください。';
  }
  return `読み込めませんでした：${e instanceof Error ? e.message : String(e)}`;
}

type Fb = ReturnType<typeof connect>;

/** 動画ページ：動画のドキュメント・元動画の一覧・依頼を見張って描き直し、トピックのカット・ショートを頼めるようにする */
function watchVideo(fb: Fb, name: string): () => void {
  let doc: VideoDoc | null | undefined; // undefined はまだ読めていない
  let src: SourcesDoc | null | undefined;
  let requests: RequestDoc[] | undefined;
  let first = true;
  const checked = new Set<number>();
  let data: VideoData | null = null;
  let ctx: StageCtx | null = null;
  const draw = () => {
    if (doc === undefined) return;
    if (!doc) {
      show(`<h1>${esc(name)}</h1><p class=muted>見つかりません。</p>`, [[name, null]]);
      return;
    }
    data = JSON.parse(doc.data) as VideoData;
    if (data.schema > SCHEMA) {
      show(`<h1>${esc(name)}</h1><p class=err>新しい形式のデータです。ビューアを更新してください。</p>`, [[name, videoUrl(BASE, name)]]);
      return;
    }
    ctx = null;
    if (src !== undefined && requests !== undefined) {
      const rel = parseSources(src).find((s) => s.name === name)?.rel ?? null;
      ctx = { rel, requests: videoRequests(requests, rel, name), checked };
    }
    show(videoBody(data, ctx, BASE), [[name, null]], [
      ['トピック', 'topics'],
      ['カット', 'cuts'],
      ['候補', 'candidates'],
      ['ショート', 'shorts'],
    ], first);
    first = false;
  };
  const fail = (e: Error) => show(`<p class=err>${esc(errorMessage(e))}</p>`);
  const send = (action: RequestAction, topics: number[], button: HTMLButtonElement) => {
    if (!ctx?.rel) return;
    button.disabled = true;
    fb.addRequest(action, ctx.rel, topics)
      .then(() => {
        if (action === 'cut') checked.clear();
      })
      .catch((e: unknown) => {
        button.disabled = false;
        alert(errorMessage(e));
      });
  };
  const onChange = (ev: Event) => {
    const box = ev.target as HTMLInputElement;
    if (box.dataset.topic === undefined) return;
    const t = Number(box.dataset.topic);
    if (box.checked) checked.add(t);
    else checked.delete(t);
    draw();
  };
  const onClick = (ev: Event) => {
    const button = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-stage]');
    if (!button || !data) return;
    const cuts = topicCuts(data);
    if (button.dataset.stage === 'cut') {
      const topics = [...checked].sort((a, b) => a - b);
      if (!topics.length) return;
      const made = topics.filter((t) => cuts.get(t)?.cut);
      if (made.length && !confirm(`トピック ${made.join('・')} のカットは作成済みです。作り直すと今のカットの XML は書き換わります（微調整して書き出した XML はそのまま残ります）。よいですか？`)) return;
      send('cut', topics, button);
      return;
    }
    const t = Number(button.dataset.topic);
    const tc = cuts.get(t);
    if (button.dataset.redo && !confirm(`トピック ${t} の ${tc?.adjusted} はもう学習済みです。もう一度学習させますか？`)) return;
    send('learn', [t], button);
  };
  app.addEventListener('change', onChange);
  app.addEventListener('click', onClick);
  const stops = [
    fb.onVideo(name, (d) => ((doc = d), draw()), fail),
    fb.onSources((d) => ((src = d), draw()), fail),
    fb.onRequests((r) => ((requests = r), draw()), fail),
  ];
  return () => {
    stops.forEach((stop) => stop());
    app.removeEventListener('change', onChange);
    app.removeEventListener('click', onClick);
  };
}

/** 元動画・依頼のセクションを Firestore の変更に合わせて描き直す。戻り値で見張りをやめる */
function watchSources(fb: Fb, outputs: Set<string>): () => void {
  const box = document.querySelector<HTMLElement>('#sources-box')!;
  let src: SourcesDoc | null = null;
  let requests: RequestDoc[] = [];
  let loaded = { sources: false, requests: false }; // 両方読めてから描く
  let open: Set<string> | null = null; // 開いているフォルダ（描き直しても開閉を保つ。最初は null で既定）
  const draw = () => {
    if (loaded.sources && loaded.requests) box.innerHTML = sourcesBody(src, requests, BASE, outputs, open);
  };
  // フォルダを開け閉めしたら覚えておく（toggle は伝わらない（バブリングしない）ので capture で拾う）
  box.addEventListener(
    'toggle',
    (ev) => {
      const el = ev.target as HTMLElement;
      if (!(el instanceof HTMLDetailsElement) || el.dataset.folder === undefined) return;
      open = new Set([...box.querySelectorAll<HTMLDetailsElement>('details[data-folder]')].filter((d) => d.open).map((d) => d.dataset.folder!));
    },
    true,
  );
  const fail = (e: Error) => {
    box.innerHTML = `<h2 id=sources>元動画</h2><p class=err>${esc(errorMessage(e))}</p>`;
  };
  const stops = [
    fb.onSources((d) => {
      src = d;
      loaded = { ...loaded, sources: true };
      draw();
    }, fail),
    fb.onRequests((r) => {
      requests = r;
      loaded = { ...loaded, requests: true };
      draw();
    }, fail),
  ];
  box.addEventListener('click', (ev) => {
    const button = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-request]');
    if (!button) return;
    const action: RequestAction = button.dataset.request === 'scan' ? 'scan' : button.dataset.request === 'candidates' ? 'candidates' : 'topics';
    const video = button.dataset.video ?? '';
    const what = action === 'topics' ? 'トピック（topics.yaml）' : 'トピックと候補（topics.yaml・candidates.yaml）';
    const warn = action === 'topics' ? 'トピックの番号が変わると、作ったカット（topic_XX/）と合わなくなります。' : '';
    if (button.dataset.redo && !confirm(`${video} の${what}を作り直します（今のファイルは書き換わります）。${warn}よいですか？`)) return;
    button.disabled = true;
    fb.addRequest(action, video).catch((e: unknown) => {
      button.disabled = false;
      alert(errorMessage(e));
    });
  });
  return () => stops.forEach((stop) => stop());
}

async function main() {
  const options = firebaseOptions();
  if (!options) {
    show('<h1>設定がありません</h1><p class=err>ビルド時の VITE_FIREBASE_CONFIG（Firebase の firebaseConfig）がありません。</p>');
    return;
  }
  const fb = connect(options);
  const name = new URLSearchParams(location.search).get('v');

  let stopSources = () => {};
  fb.onUser(async (user) => {
    stopSources();
    stopSources = () => {};
    if (!user) {
      userBox.innerHTML = '';
      show('<h1>ログイン</h1><p>movie-editer の出力を見るには、ログインしてください。</p>' +
        '<form id=signin class=signin>' +
        '<label>メールアドレス<input name=email type=email autocomplete=username required></label>' +
        '<label>パスワード<input name=password type=password autocomplete=current-password required></label>' +
        '<button class=primary>ログイン</button></form><p class=err id=signin-error></p>');
      const form = document.querySelector<HTMLFormElement>('#signin')!;
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = new FormData(form);
        const button = form.querySelector('button')!;
        button.disabled = true;
        fb.signIn(String(f.get('email')), String(f.get('password'))).catch((e: unknown) => {
          document.querySelector('#signin-error')!.textContent = signInError(e);
          button.disabled = false;
        });
      });
      return;
    }
    userBox.innerHTML = `<span>${esc(user.email)}</span><button id=signout>ログアウト</button>`;
    document.querySelector('#signout')!.addEventListener('click', () => void fb.signOut());
    app.innerHTML = '<p class=muted>読み込み中…</p>';
    try {
      if (!name) {
        document.title = '出力一覧';
        const docs = await fb.listVideos();
        show('<div id=sources-box><p class=muted>元動画を読み込み中…</p></div>' + indexBody(docs, BASE), [], [
          ['元動画', 'sources'],
          ['出力一覧', 'outputs'],
        ]);
        stopSources = watchSources(fb, new Set(docs.map((d) => d.name)));
        return;
      }
      document.title = name;
      stopSources = watchVideo(fb, name);
    } catch (e) {
      show(`<p class=err>${esc(errorMessage(e))}</p>`);
    }
  });
}

void main();
