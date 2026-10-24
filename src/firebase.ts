// Firebase の初期化と、Google ログイン・Firestore の読み込み
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore';
import type { VideoDoc } from './types';

/** movie-editer の config.yaml の firebase.collection と合わせる */
const COLLECTION = 'videos';

/** ビルド時の VITE_FIREBASE_CONFIG（firebaseConfig の JSON）。無いか読めなければ null */
export function firebaseOptions(raw: string | undefined = import.meta.env.VITE_FIREBASE_CONFIG): FirebaseOptions | null {
  if (!raw) return null;
  try {
    const opts = JSON.parse(raw) as FirebaseOptions;
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
    signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
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
