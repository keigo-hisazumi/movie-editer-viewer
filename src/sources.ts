// 一覧ページの「元動画」（video_dir の動画）と「依頼」の HTML。依頼は movie-editer の watch（Mac）が処理する
import { esc, localTime } from './format';
import { videoUrl } from './render';
import type { RequestDoc, SourceItem, SourcesDoc } from './types';

/** 処理待ち・処理中の依頼か */
export function isActive(r: RequestDoc): boolean {
  return r.status === 'queued' || r.status === 'running';
}

/** 処理待ち・処理中の依頼（scan 以外）を動画ごとに（同じ動画にもう一度頼ませない） */
export function activeRequests(requests: RequestDoc[]): Map<string, RequestDoc> {
  const m = new Map<string, RequestDoc>();
  for (const r of requests) {
    if (r.action !== 'scan' && isActive(r) && !m.has(r.video)) m.set(r.video, r);
  }
  return m;
}

/** 依頼の内容（一覧の「内容」） */
export function requestLabel(r: RequestDoc): string {
  const topics = r.topics?.length ? `（トピック ${r.topics.join('・')}）` : '';
  switch (r.action) {
    case 'scan':
      return '一覧の更新';
    case 'topics':
      return `トピック：${r.video}`;
    case 'cut':
      return `カット${topics}：${r.video}`;
    case 'learn':
      return `学習${topics}：${r.video}`;
    case 'short':
      return `ショート${topics}：${r.video}`;
    default:
      return `トピックと候補：${r.video}`;
  }
}

/** 元動画の一覧を読む。読めなければ空 */
export function parseSources(d: SourcesDoc | null): SourceItem[] {
  if (!d) return [];
  try {
    const items = JSON.parse(d.data) as SourceItem[];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function countChip(label: string, n: number | null, cls = ''): string {
  if (n === null) return '';
  if (n < 0) return `<span class='chip warn'>${label}読めない</span>`;
  return `<span class='chip ${cls}'>${label} ${n}</span>`;
}

export function statusChip(r: RequestDoc): string {
  if (r.status === 'queued') return "<span class=chip>待機中</span>";
  if (r.status === 'running') return `<span class='chip ok'>処理中${r.step ? `：${esc(r.step)}` : ''}</span>`;
  if (r.status === 'done') return "<span class='chip ok'>完了</span>";
  return "<span class='chip warn'>エラー</span>";
}

function sourceRow(s: SourceItem, active: RequestDoc | undefined, base: string, hasOutput: boolean): string {
  const chips =
    [
      s.transcript ? '<span class=chip>文字起こし済み</span>' : '',
      countChip('トピック', s.topics),
      countChip('候補', s.candidates),
      s.cuts ? countChip('カット', s.cuts) : '',
      s.learned ? countChip('学習', s.learned, 'ok') : '',
      s.shorts + (s.topic_shorts ?? 0) ? countChip('ショート', s.shorts + (s.topic_shorts ?? 0), 'ok') : '',
    ].join('') || '<span class=muted>未処理</span>';
  const done = (s.topics ?? 0) > 0;
  // 段階式の1：トピックだけを作る。作った後は動画のページでトピックを選んでカットを頼む
  const action = active
    ? statusChip(active)
    : done && hasOutput
      ? `<a class=small href="${esc(videoUrl(base, s.name))}#topics">トピックを選ぶ</a> ` +
        `<button class=small data-request=topics data-video="${esc(s.rel)}" data-redo=1>トピックを作り直す</button>`
      : `<button class='primary small' data-request=topics data-video="${esc(s.rel)}" data-redo="${done ? 1 : ''}">` +
        `${done ? 'トピックを作り直す' : 'トピックを作る'}</button>`;
  const name = hasOutput ? `<a href="${esc(videoUrl(base, s.name))}">${esc(s.name)}</a>` : esc(s.name);
  return `<tr><td>${name}</td><td>${chips}</td><td>${action}</td></tr>`;
}

/** 動画のあるフォルダ（video_dir からの相対パス。直下は ''） */
export function folderOf(rel: string): string {
  const slash = rel.lastIndexOf('/');
  return slash >= 0 ? rel.slice(0, slash) : '';
}

/** フォルダごとにまとめる。新しい順（フォルダ名の逆順。直下は最後） */
export function groupByFolder(items: SourceItem[]): [string, SourceItem[]][] {
  const groups = new Map<string, SourceItem[]>();
  for (const s of items) {
    const f = folderOf(s.rel);
    groups.set(f, [...(groups.get(f) ?? []), s]);
  }
  return [...groups].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a < b ? 1 : a > b ? -1 : 0));
}

/** 最初に開いておくフォルダ：いちばん新しいフォルダと、処理待ち・処理中の依頼があるフォルダ */
export function defaultOpenFolders(groups: [string, SourceItem[]][], active: Map<string, RequestDoc>): Set<string> {
  const open = new Set<string>(groups.length ? [groups[0][0]] : []);
  for (const rel of active.keys()) open.add(folderOf(rel));
  return open;
}

export function requestRow(r: RequestDoc, base: string): string {
  const what = esc(requestLabel(r));
  const name = r.video.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
  const link = r.action !== 'scan' && r.status === 'done' ? ` <a href="${esc(videoUrl(base, name))}">見る</a>` : '';
  const when = r.finished ? localTime(r.finished) : r.created ? localTime(r.created.toISOString()) : '';
  const detail = r.error
    ? `<details open><summary class=small>エラー</summary><pre>${esc(r.error)}</pre></details>`
    : r.log
      ? `<details><summary class=small>Claude Code の報告</summary><pre>${esc(r.log)}</pre></details>`
      : '';
  return `<tr><td>${statusChip(r)}</td><td>${what}${link}${detail}</td><td class='t muted small'>${esc(when)}</td></tr>`;
}

/**
 * 元動画と依頼のセクション。outputs は出力一覧にある動画名（動画ページへのリンクを付ける）
 * 元動画はフォルダ（月別フォルダなど）ごとに折りたたむ。open は開いておくフォルダ（null なら defaultOpenFolders）
 */
export function sourcesBody(
  src: SourcesDoc | null,
  requests: RequestDoc[],
  base: string,
  outputs: Set<string>,
  open: Set<string> | null = null,
): string {
  const items = parseSources(src);
  const active = activeRequests(requests);
  const scanning = requests.some((r) => r.action === 'scan' && (r.status === 'queued' || r.status === 'running'));
  const head =
    `<p class='muted small'>Mac で <code>python -m shorts watch</code> を起動している間に処理されます（止まっている間の依頼は、次に起動したときに処理）。` +
    (src ? ` 一覧の更新：${esc(localTime(src.updated))}` : '') +
    ` <button class=small data-request=scan ${scanning ? 'disabled' : ''}>${scanning ? '更新を待っています' : '一覧を更新'}</button></p>`;
  const groups = groupByFolder(items);
  const opened = open ?? defaultOpenFolders(groups, active);
  const folder = ([f, list]: [string, SourceItem[]]) => {
    const todo = list.filter((s) => !((s.topics ?? 0) > 0)).length;
    const busy = list.filter((s) => active.has(s.rel)).length;
    const chips =
      `<span class=chip>${list.length} 本</span>` +
      (todo ? `<span class=chip>未作成 ${todo}</span>` : '') +
      (busy ? `<span class='chip ok'>処理中・待機中 ${busy}</span>` : '');
    return (
      `<details class=folder data-folder="${esc(f)}" ${opened.has(f) ? 'open' : ''}>` +
      `<summary><strong>${f ? esc(f) + '/' : '（直下）'}</strong> ${chips}</summary>` +
      '<div class=scroll><table><thead><tr><th>動画名</th><th>状態</th><th>依頼</th></tr></thead><tbody>' +
      list.map((s) => sourceRow(s, active.get(s.rel), base, outputs.has(s.name))).join('') +
      '</tbody></table></div></details>'
    );
  };
  const table = items.length
    ? groups.map(folder).join('')
    : `<p class=muted>${src ? 'video_dir に動画がありません。' : 'まだ一覧が送られていません。Mac で python -m shorts watch を起動すると、ここに出ます。'}</p>`;
  const history = requests.length
    ? '<h2 id=requests>依頼</h2><div class=scroll><table><thead><tr><th>状態</th><th>内容</th><th>日時</th></tr></thead><tbody>' +
      requests.map((r) => requestRow(r, base)).join('') +
      '</tbody></table></div>'
    : '';
  return `<h2 id=sources>元動画（${items.length} 本）</h2>${head}${table}${history}`;
}
