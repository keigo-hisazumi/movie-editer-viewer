// Firebase の初期化と、メール/パスワードのログイン・Firestore の読み込み・依頼の書き込み
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import type { RequestAction, RequestDoc, SourcesDoc, VideoDoc } from './types';

/** movie-editer の config.yaml の firebase.collection と合わせる */
const COLLECTION = 'videos';
/** 元動画の一覧（config.yaml の firebase.sources）。watch・publish が all ドキュメントに送る */
const SOURCES = 'sources';
/** ビューアからの依頼（config.yaml の firebase.requests）。watch が受け取って処理する */
const REQUESTS = 'requests';
/** 一覧に出す依頼の数（新しい順） */
const REQUEST_LIMIT = 30;

/**
 * ビルド時の VITE_FIREBASE_CONFIG（firebaseConfig）。無いか読めなければ null
 * JSON のほか、Firebase コンソールに出る JavaScript の書き方（キーに " が無い・末尾の ,・const firebaseConfig = …;）もそのまま読む
 */
export function firebaseOptions(raw: string | undefined = import.meta.env.VITE_FIREBASE_CONFIG): FirebaseOptions | null {
  if (!raw) return null;
  const body = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  const json = body
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":') // キーを " で囲む
    .replace(/'([^'"]*)'/g, '"$1"') // ' で囲んだ値を " にする
    .replace(/,(\s*})/g, '$1'); // 末尾の , を取る
  try {
    const opts = JSON.parse(json) as FirebaseOptions;
    return opts.apiKey && opts.projectId ? opts : null;
  } catch {
    return null;
  }
}

export function connect(options: FirebaseOptions) {
  const app = initializeApp(options);
  const auth = getAuth(app);
  const db = getFirestore(app);
  return {
    onUser: (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb),
    signIn: (email: string, password: string) => signInWithEmailAndPassword(auth, email, password),
    signOut: () => signOut(auth),
    async listVideos(): Promise<VideoDoc[]> {
      const snap = await getDocs(collection(db, COLLECTION));
      return snap.docs.map((d) => d.data() as VideoDoc);
    },
    async getVideo(name: string): Promise<VideoDoc | null> {
      const snap = await getDoc(doc(db, COLLECTION, name));
      return snap.exists() ? (snap.data() as VideoDoc) : null;
    },
    /** 元動画の一覧を見張る（変わるたびに cb）。戻り値で見張りをやめる */
    onSources(cb: (d: SourcesDoc | null) => void, onError: (e: Error) => void) {
      return onSnapshot(doc(db, SOURCES, 'all'), (s) => cb(s.exists() ? (s.data() as SourcesDoc) : null), onError);
    },
    /** 新しい依頼から REQUEST_LIMIT 件を見張る（watch が状態を書き戻すたびに cb） */
    onRequests(cb: (r: RequestDoc[]) => void, onError: (e: Error) => void) {
      const q = query(collection(db, REQUESTS), orderBy('created', 'desc'), limit(REQUEST_LIMIT));
      return onSnapshot(
        q,
        (s) =>
          cb(
            s.docs.map((d) => {
              const data = d.data({ serverTimestamps: 'estimate' });
              return { ...data, id: d.id, created: (data.created as Timestamp | null)?.toDate() ?? null } as RequestDoc;
            }),
          ),
        onError,
      );
    },
    /** 依頼を書く（Firestore のルールで、この形の queued の依頼だけ書ける） */
    addRequest(action: RequestAction, video: string) {
      return addDoc(collection(db, REQUESTS), {
        action,
        video,
        status: 'queued',
        created: serverTimestamp(),
        by: auth.currentUser?.email ?? '',
      });
    },
  };
}
