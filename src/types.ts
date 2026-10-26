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
  cuts_count?: number; // 段階式のカットの数（topic_XX/。前の版の publish には無い）
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
  // 段階式（トピック → カット → ショート）。前の版の publish には無い
  cuts?: Candidate[] | null; // cuts.yaml（id はトピックの ID）
  cuts_error?: string;
  topic_cuts?: TopicCut[];
}

/** output/<動画名>/topic_XX/ のカット・微調整した XML・ショートの状態 */
export interface TopicCut {
  name: string; // topic_XX
  topic: number;
  files: string[];
  cut: CutMemo | null; // cut.json
  adjusted: string | null; // 人が微調整して書き出した XML のファイル名
  adjusted_mtime: string | null;
  memo: Memo | null; // ショートの memo.json（まだなら null）
  learn?: LearnBrief | null; // 微調整した XML とカットの違い（learn.json の要約。まだなら null）
}

/** 文ごとの違い（movie-editer の shorts/learn.py）。change：外した・一部を外した・戻した・一部を戻した */
export interface LearnChange {
  start: string;
  end: string;
  text: string;
  change: string;
  words?: string; // 一部を外した・戻した語
  why?: string; // 戻した文がカットでなぜ外れていたか
}

/** topic_XX/learn.json の要約（movie-editer の shorts/topiccut.py の topic_summary） */
export interface LearnBrief {
  adjusted_xml: string;
  adjusted_mtime: string;
  cut: { start: string; end: string; duration: number; count: number };
  adjusted: { start: string; end: string; duration: number; count: number };
  head: number; // +：人が頭を遅らせた
  tail: number; // -：人が終わりを早めた
  removed_sec: number;
  added_sec: number;
  counts: Record<string, number>;
  changes: LearnChange[];
  made: string;
}

/** topic_XX/cut.json（movie-editer の shorts/topiccut.py の make_cut） */
export interface CutMemo {
  topic: number;
  title: string;
  titles: string[];
  heading: string;
  summary: string;
  reason: string;
  start: string;
  end: string;
  duration: number;
  removed: Record<string, number>;
  cuts: [string, string][];
  drop: [string, string][];
  files: { name: string; desc: string }[];
  made: string;
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
  topic?: number; // 段階式のショート（topic_XX/）
  source_xml?: string; // 読み込んだ微調整の XML
  source_notes?: string[];
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
  cuts?: number; // 段階式のカットの数（topic_XX/）
  topic_shorts?: number; // 段階式のショートの数
  learned?: number; // 微調整を学習したトピックの数
}

/** topics：トピックだけ／cut：選んだトピックのカット／learn：微調整した XML とカットの違いを学ぶ／
 * short：微調整した XML からショート（いまはボタンを出していない）／candidates：トピックと候補（前のやり方） */
export type RequestAction = 'topics' | 'cut' | 'learn' | 'short' | 'candidates' | 'scan';
export type RequestStatus = 'queued' | 'running' | 'done' | 'error';

/** Firestore の requests/{id}。ビューアが queued で書き、watch が状態を書き戻す */
export interface RequestDoc {
  id: string;
  action: RequestAction;
  video: string; // SourceItem.rel（scan は空）
  topics?: number[]; // cut・learn・short のトピック ID
  status: RequestStatus;
  created: Date | null;
  by: string;
  started?: string;
  finished?: string;
  step?: string;
  log?: string; // Claude Code の報告
  error?: string;
}
