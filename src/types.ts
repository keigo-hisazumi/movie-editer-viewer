// movie-editer の publish（shorts/publish.py）が Firestore に書く内容の型
// 時刻は元動画の秒。memo は short_XX/memo.json そのまま（元動画の時刻は "HH:MM:SS.mmm"、ショートの中の時刻は秒）

/** data の形式の版。movie-editer の publish.py の SCHEMA と合わせる */
export const SCHEMA = 1;

/** Firestore の videos/{動画名} のドキュメント */
export interface VideoDoc {
  schema: number;
  name: string;
  updated: string; // 出力フォルダのファイルの最終更新（ISO 8601）
  published: string; // 送った日時（ISO 8601）
  topics_count: number;
  candidates_count: number;
  shorts_count: number;
  data: string; // VideoData の JSON
}

export interface VideoData {
  schema: number;
  name: string;
  updated: string;
  stream_length: number | null;
  topics: Topic[] | null;
  topics_error: string;
  legacy_topics: boolean;
  candidates: Candidate[] | null;
  candidates_error: string;
  shorts: Short[];
}

export interface Topic {
  id: number;
  start: number;
  title: string;
  summary: string;
  points: string[];
}

export interface SoundCue {
  at: number;
  file: string;
  db: number | null;
}

export interface ImageCue {
  at: number;
  file: string;
  end: number | null;
}

export interface Candidate {
  id: number;
  start: number;
  end: number;
  title: string;
  titles: string[];
  heading: string;
  summary: string;
  reason: string;
  topic: number | null;
  drop: [number, number][];
  bgm: string | null;
  bgm_offset: number;
  se: SoundCue[];
  images: ImageCue[];
  ignored: string[];
}

export interface Short {
  name: string;
  files: string[];
  memo: Memo | null;
}

export interface Memo {
  candidate?: {
    id?: number;
    title?: string;
    titles?: string[];
    summary?: string;
    reason?: string;
    start?: string;
    end?: string;
  };
  duration?: number;
  note?: string;
  start?: string;
  end?: string;
  snap?: string;
  removed?: Record<string, number>;
  cuts?: [string, string][];
  drop?: [string, string][];
  fillers?: { at: string; text: string }[];
  texts?: { name: string; text: string; font: string; size: number; color: string }[];
  bgm?: { name: string; from: number; db: number } | null;
  se?: { at: number; name: string; db: number }[];
  voice_db?: number | null;
  sound_notes?: string[];
  images?: { name: string; start: number; end: number }[];
  image_notes?: string[];
  files?: { name: string; desc: string }[];
  extra?: Record<string, string[]>;
}

// ---- 元動画の一覧と、ビューアからの依頼（movie-editer の shorts/remote.py・watch コマンド）

/** Firestore の sources/all のドキュメント。data は SourceItem[] の JSON */
export interface SourcesDoc {
  updated: string; // 送った日時（ISO 8601）
  count: number;
  data: string;
}

/** video_dir の元動画1本と、その出力フォルダの状態 */
export interface SourceItem {
  name: string; // 動画名（出力フォルダ名。ファイル名から拡張子を除いたもの）
  rel: string; // video_dir からの相対パス（依頼の video に使う）
  size: number;
  mtime: string;
  transcript: boolean;
  topics: number | null; // topics.yaml の件数（無ければ null、読めなければ -1）
  candidates: number | null;
  shorts: number;
}

export type RequestAction = 'candidates' | 'scan';
export type RequestStatus = 'queued' | 'running' | 'done' | 'error';

/** Firestore の requests/{id}。ビューアが queued で書き、watch が状態を書き戻す */
export interface RequestDoc {
  id: string;
  action: RequestAction;
  video: string; // SourceItem.rel（scan は空）
  status: RequestStatus;
  created: Date | null;
  by: string;
  started?: string;
  finished?: string;
  step?: string;
  log?: string; // Claude Code の報告
  error?: string;
}
