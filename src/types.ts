// movie-editer の publish（shorts/publish.py）が Firestore に書く内容の型
// 時刻は元動画の秒。memo は topic_XX/memo.json そのまま（元動画の時刻は "HH:MM:SS.mmm"、ショートの中の時刻は秒）

/** data の形式の版。movie-editer の publish.py の SCHEMA と合わせる */
export const SCHEMA = 2;

/** Firestore の videos/{動画名} のドキュメント */
export interface VideoDoc {
  schema: number;
  name: string;
  updated: string; // 出力フォルダのファイルの最終更新（ISO 8601）
  published: string; // 送った日時（ISO 8601）
  topics_count: number;
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
  // 段階式（トピック → カット → 学習）
  cuts?: CutSpec[] | null; // cuts.yaml（id はトピックの ID）
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
  learn?: LearnBrief | null; // 微調整した XML とカットの違い・仕上がり（learn.json の要約。まだなら null）
  lessons?: Lessons | null; // /learn がこのトピックで読み取ったこと（topic_XX/lessons.yaml。まだなら null）
}

/** topic_XX/lessons.yaml（cut：カットの直しから、short：仕上がりから） */
export interface Lessons {
  cut: string[];
  short: string[];
}

/** 文ごとの違い（movie-editer の shorts/learn.py）。change：外した・一部を外した・戻した・一部を戻した */
export interface LearnChange {
  start: string;
  end: string;
  text: string;
  change: string;
  words?: string; // 一部を外した・戻した語
  why?: string; // 戻した文がカットでなぜ外れていたか
  in_gap?: string; // 外した文が、仕上がりの元動画のクリップが無い所の文字に出ている（残しているかもしれない）
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
  pauses_removed?: [string, number][]; // 人が詰めた間（元動画の時刻, 秒）
  pauses_added?: [string, number][]; // 人が戻した間
  notes?: string[];
  finish?: Finish | null; // 仕上がり（前の版の learn.json には無い）
  made: string;
}

/** ショートの中の時刻（秒）の、付けたもの1つ。said はそのとき言っていたこと（文字起こし） */
export interface FinishItem {
  start: number;
  end: number;
  said?: string;
}

/** 人が Filmora で仕上げたショートの作り（movie-editer の shorts/finish.py。learn.json の finish） */
export interface Finish {
  xml: string;
  duration: number;
  size: [number, number];
  clips: number; // 元動画のクリップの数
  title: string | null; // ずっと出ている文字（タイトル・見出し）
  title_match: string | null; // カットの「見出し」「タイトル案N」と同じなら、その名前
  zoom: { scale: number | null; pos: [number, number] | null; sec: number; count: number }[];
  moved: { start: number; end: number; src: string; said: string }[]; // 元動画の順から動かしたクリップ（先出し）
  gaps: { start: number; end: number; texts: string[] }[]; // 元動画のクリップが無い所と、そこに出ている文字
  captions: { start: number; end: number; text: string }[];
  caption_stats: { count: number; max_chars: number; avg_chars: number; avg_sec: number };
  emphasis: (FinishItem & { text: string; track: number; over_caption: boolean })[];
  images: (FinishItem & { name: string; track: number; scale: number | null; pos: [number, number] | null })[];
  se: (FinishItem & { name: string; track: number; db: number })[];
  bgm: (FinishItem & { name: string; track: number; db: number; from: number })[];
  notes: string[];
}

/** Firestore の sources/learning（出力フォルダ直下の学び。動画ごとでない） */
export interface LearningDoc {
  updated: string;
  cut: string; // cut_learning.md
  short: string; // short_learning.md
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

/** cuts.yaml の1項目（movie-editer の shorts/cutspec.py） */
export interface CutSpec {
  id: number; // トピックの ID
  start: number;
  end: number;
  title: string;
  titles: string[];
  heading: string;
  summary: string;
  reason: string;
  drop: [number, number][];
  bgm: string | null;
  bgm_offset: number;
  se: SoundCue[];
  images: ImageCue[];
}

/** ショートのカードに出すもの（topic_XX/ の名前・ファイルと memo.json） */
export interface Short {
  name: string;
  files: string[];
  memo: Memo | null;
}

export interface Memo {
  spec?: {
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
  topic?: number;
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
  cuts?: number; // カットの数（topic_XX/）
  topic_shorts?: number; // ショートの数（topic_XX/）
  learned?: number; // 微調整を学習したトピックの数
}

/** topics：トピックだけ／cut：選んだトピックのカット／learn：微調整した XML とカットの違いを学ぶ／
 * short：微調整した XML からショート（いまはボタンを出していない） */
export type RequestAction = 'topics' | 'cut' | 'learn' | 'short' | 'scan';
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
