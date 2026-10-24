// Firebase の初期化と、メール/パスワードのログイン・Firestore の読み込み
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore';
import type { VideoDoc } from './types';

/** movie-editer の config.yaml の firebase.collection と合わせる */
const COLLECTION = 'videos';

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
  };
}
