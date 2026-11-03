// movie-editer の publish・watch（shorts/publish.py・shorts/remote.py）が Firestore に書く内容の型
// 正本は movie-editer-schema（movie-editer と共有。schema.json から作った型）。ここではビューアだけで使う形を足す
// 時刻は元動画の秒。memo は topic_XX/memo.json そのまま（元動画の時刻は "HH:MM:SS.mmm"、ショートの中の時刻は秒）
import type { Memo, RequestDoc as RequestFields } from 'movie-editer-schema';

export type {
  CutMemo,
  CutSpec,
  Finish,
  ImageCue,
  LearnBrief,
  LearnChange,
  LearningDoc,
  Lessons,
  Memo,
  RequestAction,
  RequestStatus,
  SoundCue,
  SourceItem,
  SourcesDoc,
  Topic,
  TopicCut,
  VideoData,
  VideoDoc,
} from 'movie-editer-schema';

/** data の形式の版。movie-editer の publish.py の SCHEMA と合わせる（movie-editer-schema の SCHEMA_VERSION） */
export { SCHEMA_VERSION as SCHEMA } from 'movie-editer-schema';

/** ショートのカードに出すもの（topic_XX/ の名前・ファイルと memo.json） */
export interface Short {
  name: string;
  files: string[];
  memo: Memo | null;
}

/** Firestore の requests/{id} を読んだもの（id はドキュメントの ID、created は Timestamp を Date にしたもの） */
export interface RequestDoc extends Omit<RequestFields, 'created'> {
  id: string;
  created: Date | null;
}
