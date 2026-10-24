// 画面の切り替え：Google ログイン → 出力一覧（?v なし）／動画ごとのページ（?v=動画名）
import './style.css';
import { FirebaseError } from 'firebase/app';
import { connect, firebaseOptions } from './firebase';
import { esc } from './format';
import { indexBody, videoBody, videoUrl } from './render';
import { SCHEMA, type VideoData } from './types';

const BASE = import.meta.env.BASE_URL;
const app = document.querySelector<HTMLElement>('#app')!;
const crumb = document.querySelector<HTMLElement>('header .crumb')!;
const nav = document.querySelector<HTMLElement>('#nav')!;
const userBox = document.querySelector<HTMLElement>('#user')!;

function show(body: string, crumbs: [string, string | null][] = [], tabs: [string, string][] = []) {
  crumb.innerHTML = [['出力一覧', BASE] as [string, string | null], ...crumbs]
    .map(([t, u]) => (u ? `<a href="${esc(u)}">${esc(t)}</a>` : esc(t)))
    .join(' / ');
  nav.innerHTML = tabs.length
    ? '<nav class=tabs>' + tabs.map(([t, a]) => `<a href="#${esc(a)}">${esc(t)}</a>`).join('') + '</nav>'
    : '';
  app.innerHTML = body;
  // 描画が読み込みの後なので、URL の #（候補・ショートへのリンク）の位置へ自分で移動する
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
}

function errorMessage(e: unknown): string {
  if (e instanceof FirebaseError && e.code === 'permission-denied') {
    return 'このアカウントでは見られません。Firestore のルールに書いたメールアドレスと、ログインしたアカウントが同じか確認してください。';
  }
  return `読み込めませんでした：${e instanceof Error ? e.message : String(e)}`;
}

async function main() {
  const options = firebaseOptions();
  if (!options) {
    show('<h1>設定がありません</h1><p class=err>ビルド時の VITE_FIREBASE_CONFIG（Firebase の firebaseConfig）がありません。</p>');
    return;
  }
  const fb = connect(options);
  const name = new URLSearchParams(location.search).get('v');

  fb.onUser(async (user) => {
    if (!user) {
      userBox.innerHTML = '';
      show('<h1>ログイン</h1><p>movie-editer の出力を見るには、Google アカウントでログインしてください。</p>' +
        '<p><button class=primary id=signin>Google でログイン</button></p><p class=err id=signin-error></p>');
      document.querySelector('#signin')!.addEventListener('click', () => {
        fb.signIn().catch((e: unknown) => {
          document.querySelector('#signin-error')!.textContent = `ログインできませんでした：${e instanceof Error ? e.message : String(e)}`;
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
        show(indexBody(await fb.listVideos(), BASE));
        return;
      }
      document.title = name;
      const doc = await fb.getVideo(name);
      if (!doc) {
        show(`<h1>${esc(name)}</h1><p class=muted>見つかりません。</p>`, [[name, null]]);
        return;
      }
      const data = JSON.parse(doc.data) as VideoData;
      if (data.schema > SCHEMA) {
        show(`<h1>${esc(name)}</h1><p class=err>新しい形式のデータです。ビューアを更新してください。</p>`, [[name, videoUrl(BASE, name)]]);
        return;
      }
      show(videoBody(data), [[name, null]], [
        ['トピック', 'topics'],
        ['候補', 'candidates'],
        ['ショート', 'shorts'],
      ]);
    } catch (e) {
      show(`<p class=err>${esc(errorMessage(e))}</p>`);
    }
  });
}

void main();
