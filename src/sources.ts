// 一覧ページの「元動画」（video_dir の動画）と「依頼」の HTML。依頼は movie-editer の watch（Mac）が処理する
import { esc, localTime } from './format';
import { videoUrl } from './render';
import type { RequestDoc, SourceItem, SourcesDoc } from './types';

/** 処理待ち・処理中の依頼（同じ動画にもう一度頼ませない） */
export function activeRequests(requests: RequestDoc[]): Map<string, RequestDoc> {
  const m = new Map<string, RequestDoc>();
  for (const r of requests) {
    if (r.action === 'candidates' && (r.status === 'queued' || r.status === 'running') && !m.has(r.video)) m.set(r.video, r);
  }
  return m;
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

function statusChip(r: RequestDoc): string {
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
      s.shorts ? countChip('ショート', s.shorts, 'ok') : '',
    ].join('') || '<span class=muted>未処理</span>';
  const done = (s.topics ?? 0) > 0 && (s.candidates ?? 0) > 0;
  const action = active
    ? statusChip(active)
    : `<button class='${done ? '' : 'primary'} small' data-request=candidates data-video="${esc(s.rel)}" data-redo="${done ? 1 : ''}">` +
      `${done ? '作り直す' : 'トピックと候補を作る'}</button>`;
  const slash = s.rel.lastIndexOf('/');
  const folder = slash >= 0 ? `<div class='muted small'>${esc(s.rel.slice(0, slash))}/</div>` : '';
  const name = hasOutput ? `<a href="${esc(videoUrl(base, s.name))}">${esc(s.name)}</a>` : esc(s.name);
  return `<tr><td>${name}${folder}</td><td>${chips}</td><td>${action}</td></tr>`;
}

function requestRow(r: RequestDoc, base: string): string {
  const what = r.action === 'scan' ? '一覧の更新' : `トピックと候補：${esc(r.video)}`;
  const name = r.video.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
  const link = r.action === 'candidates' && r.status === 'done' ? ` <a href="${esc(videoUrl(base, name))}">見る</a>` : '';
  const when = r.finished ? localTime(r.finished) : r.created ? localTime(r.created.toISOString()) : '';
  const detail = r.error
    ? `<details open><summary class=small>エラー</summary><pre>${esc(r.error)}</pre></details>`
    : r.log
      ? `<details><summary class=small>Claude Code の報告</summary><pre>${esc(r.log)}</pre></details>`
      : '';
  return `<tr><td>${statusChip(r)}</td><td>${what}${link}${detail}</td><td class='t muted small'>${esc(when)}</td></tr>`;
}

/** 元動画と依頼のセクション。outputs は出力一覧にある動画名（動画ページへのリンクを付ける） */
export function sourcesBody(src: SourcesDoc | null, requests: RequestDoc[], base: string, outputs: Set<string>): string {
  const items = parseSources(src);
  const active = activeRequests(requests);
  const scanning = requests.some((r) => r.action === 'scan' && (r.status === 'queued' || r.status === 'running'));
  const head =
    `<p class='muted small'>Mac で <code>python -m shorts watch</code> を起動している間に処理されます（止まっている間の依頼は、次に起動したときに処理）。` +
    (src ? ` 一覧の更新：${esc(localTime(src.updated))}` : '') +
    ` <button class=small data-request=scan ${scanning ? 'disabled' : ''}>${scanning ? '更新を待っています' : '一覧を更新'}</button></p>`;
  const table = items.length
    ? '<div class=scroll><table><thead><tr><th>動画名</th><th>状態</th><th>依頼</th></tr></thead><tbody>' +
      items.map((s) => sourceRow(s, active.get(s.rel), base, outputs.has(s.name))).join('') +
      '</tbody></table></div>'
    : `<p class=muted>${src ? 'video_dir に動画がありません。' : 'まだ一覧が送られていません。Mac で python -m shorts watch を起動すると、ここに出ます。'}</p>`;
  const history = requests.length
    ? '<h2 id=requests>依頼</h2><div class=scroll><table><thead><tr><th>状態</th><th>内容</th><th>日時</th></tr></thead><tbody>' +
      requests.map((r) => requestRow(r, base)).join('') +
      '</tbody></table></div>'
    : '';
  return `<h2 id=sources>元動画（${items.length} 本）</h2>${head}${table}${history}`;
}
