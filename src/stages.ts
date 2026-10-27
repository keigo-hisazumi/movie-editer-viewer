// 動画ページの段階式（トピック → カット → 微調整 → 学習）の部分の HTML
// トピックを選んで「カットを作る」、微調整した XML を置いたトピックで「学習させる」を頼む（movie-editer の watch が /cut・/learn で処理する）
// ショート（/short）は movie-editer に残してあるが、いまはボタンを出さない（作ったショートがあれば表示はする）
import { foldCard, foldSection } from './fold';
import { dur, esc, localTime } from './format';
import { isActive, requestRow, statusChip } from './sources';
import type { CutMemo, LearnBrief, RequestDoc, TopicCut, VideoData } from './types';

/** 動画ページで依頼を出すのに要るもの。rel が null なら元動画の一覧に無い（依頼できない） */
export interface StageCtx {
  rel: string | null;
  requests: RequestDoc[]; // この動画の依頼（新しい順）
  checked: Set<number>; // チェックを入れたトピック（描き直しても保つ）
}

/** この動画の依頼だけ（video は相対パスか動画名） */
export function videoRequests(requests: RequestDoc[], rel: string | null, name: string): RequestDoc[] {
  return requests.filter((r) => r.action !== 'scan' && (r.video === rel || r.video === name));
}

/** トピックごとの処理待ち・処理中の依頼（cut・learn・short） */
export function activeByTopic(requests: RequestDoc[]): Map<number, RequestDoc> {
  const m = new Map<number, RequestDoc>();
  for (const r of requests) {
    if (!isActive(r) || !['cut', 'learn', 'short'].includes(r.action)) continue;
    for (const t of r.topics ?? []) if (!m.has(t)) m.set(t, r);
  }
  return m;
}

/** この動画で、トピック全体に関わる依頼（topics）が処理待ち・処理中か */
function busyAll(requests: RequestDoc[]): RequestDoc | undefined {
  return requests.find((r) => isActive(r) && r.action === 'topics');
}

export function topicCuts(v: VideoData): Map<number, TopicCut> {
  return new Map((v.topic_cuts ?? []).map((t) => [t.topic, t]));
}

/** トピックの表の「選択」の列 */
export function checkCell(topic: number, ctx: StageCtx | null, active: Map<number, RequestDoc>): string {
  const disabled = !ctx?.rel || active.has(topic) || (ctx && busyAll(ctx.requests)) ? 'disabled' : '';
  const checked = ctx?.checked.has(topic) ? 'checked' : '';
  return `<td><input type=checkbox data-topic=${topic} aria-label="トピック${topic}を選ぶ" ${checked} ${disabled}></td>`;
}

/** 学習の後に微調整した XML が変わっていなければ true */
export function learnedFresh(tc: TopicCut | undefined): boolean {
  return !!tc?.learn && tc.learn.adjusted_xml === tc.adjusted && tc.learn.adjusted_mtime === tc.adjusted_mtime;
}

/** トピックの表の「カット・学習」の列 */
export function stageCell(topic: number, tc: TopicCut | undefined, ctx: StageCtx | null, active: Map<number, RequestDoc>): string {
  const chips: string[] = [];
  if (tc?.cut) chips.push(`<a class=chip href="#${esc(tc.name)}">カット ${dur(tc.cut.duration)}</a>`);
  if (tc?.cut) {
    chips.push(tc.adjusted ? `<span class='chip ok'>微調整済み</span>` : '<span class=chip>微調整待ち</span>');
  }
  const fresh = learnedFresh(tc);
  if (tc?.learn) {
    chips.push(fresh ? `<a class='chip ok' href="#${esc(tc.name)}">学習済み</a>` : "<span class='chip warn'>学習のあと XML が変わった</span>");
  }
  if (tc?.memo) chips.push(`<a class='chip ok' href="#${esc(tc.name)}-short">ショート作成済み</a>`);
  const r = active.get(topic);
  let action = '';
  if (r) {
    action = statusChip(r);
  } else if (tc?.cut && tc.adjusted && ctx?.rel && !busyAll(ctx.requests)) {
    action = `<button class='${fresh ? '' : 'primary '}small' data-stage=learn data-topic=${topic} data-redo="${fresh ? 1 : ''}">${
      fresh ? 'もう一度学習させる' : '学習させる'
    }</button>`;
  }
  return `<td>${chips.join('')}${action ? `<div>${action}</div>` : ''}</td>`;
}

/** トピックの表の上：選んだトピックのカットを頼むボタンと説明 */
export function stageBar(v: VideoData, ctx: StageCtx | null): string {
  if (!v.topics?.length) return '';
  const steps =
    "<ol class='muted small steps'>" +
    '<li>ショートにするトピックにチェックを入れて「カットを作る」→ フィラー・無音・関係ない話を詰めたカットだけの XML とタイトル案ができます</li>' +
    '<li>Filmora で <code>topic_XX/</code> のカットの XML を開いて微調整し、FCP7 XML として同じフォルダに書き出します（名前は自由）</li>' +
    '<li>そのトピックの「学習させる」→ 書き出した XML をカットの XML と比べ、直したところを次からのカットの決め方として覚えます（ショートは作りません）</li>' +
    '</ol>';
  if (!ctx) return `${steps}<p class='muted small'>依頼の状態を読み込み中…</p>`;
  if (!ctx.rel) {
    return `${steps}<p class='muted small'>元動画の一覧（video_dir）にこの動画が無いため、ここからは頼めません。</p>`;
  }
  const busy = busyAll(ctx.requests);
  const n = ctx.checked.size;
  const button = busy
    ? statusChip(busy)
    : `<button class=primary data-stage=cut ${n ? '' : 'disabled'}>選んだトピックのカットを作る${n ? `（${n} 件）` : ''}</button>`;
  return `${steps}<div class=stagebar>${button}</div>`;
}

/** 微調整した XML とカットの違い（learn.json の要約） */
function learnRows(r: LearnBrief): [string, string][] {
  const sign = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;
  const changes = r.changes.map(
    (s) =>
      `${esc(s.change)}：${esc(s.start.slice(3))} ${esc(s.words || s.text)}` +
      (s.why ? ` <span class='muted small'>（カットでは ${esc(s.why)}）</span>` : ''),
  );
  return [
    [
      '微調整との違い',
      `${dur(r.cut.duration)} → ${dur(r.adjusted.duration)}（人が外した ${r.removed_sec}秒・戻した ${r.added_sec}秒、` +
        `頭 ${sign(r.head)}秒・終わり ${sign(r.tail)}秒）`,
    ],
    ['人が変えた文', changes.length ? changes.join('<br>') : '<span class=muted>なし（間の調整だけ）</span>'],
  ];
}

function cutCard(tc: TopicCut, title: string): string {
  const cut: CutMemo | null = tc.cut;
  const chips = [`<a class=chip href="#topic-${tc.topic}">トピック${tc.topic}</a>`];
  if (cut) chips.push(`<span class=chip>${dur(cut.duration)}（カット ${cut.cuts.length} 個）</span>`);
  chips.push(
    tc.adjusted
      ? `<span class='chip ok'>微調整：${esc(tc.adjusted)}${tc.adjusted_mtime ? `（${esc(localTime(tc.adjusted_mtime))}）` : ''}</span>`
      : '<span class=chip>微調整した XML なし</span>',
  );
  if (!cut) {
    return foldCard(tc.name, `<h3>${esc(title)}</h3><div>${chips.join('')}</div>`, '<p class=muted>cut.json がありません</p>');
  }
  const removed =
    Object.entries(cut.removed ?? {})
      .map(([k, s]) => `${esc(k)} ${s}秒`)
      .join('、') || 'なし';
  const lines = (xs: string[]) => (xs.length ? xs.join('<br>') : '<span class=muted>なし</span>');
  const items: [string, string][] = [
    ['見出し', cut.heading ? `<span class=heading>${esc(cut.heading).replace(/\[(.+?)\]/g, '<em>$1</em>')}</span>` : '<span class=muted>なし</span>'],
    ['タイトル案', lines(cut.titles.map(esc))],
    ['内容', esc(cut.summary || '（未記入）')],
    ['区間', `${esc(cut.start)}〜${esc(cut.end)}（削った分：${removed}）`],
    ['外した話', lines(cut.drop.map(([a, b]) => `${esc(a)}〜${esc(b)}`))],
    ...(tc.learn ? learnRows(tc.learn) : []),
    [
      'ファイル',
      lines(tc.files.map((f) => `<code>${esc(f)}</code>`)) +
        "<div class='muted small'>カットの XML を Filmora で微調整し、FCP7 XML としてこのフォルダに書き出す（名前は自由）</div>",
    ],
  ];
  return foldCard(
    tc.name,
    `<div class='muted small'>${esc(tc.name)}</div><h3>${esc(cut.title || title)}</h3><div>${chips.join('')}</div>`,
    `<dl>${items.map(([k, s]) => `<dt>${esc(k)}</dt><dd>${s}</dd>`).join('')}</dl>`,
  );
}

/** 「カット」のセクション。shortCard は render.ts のショートのカード（id を変えて使う） */
export function cutsSection(v: VideoData, topicNames: Map<number, string>, shortCard: (name: string, tc: TopicCut) => string): string {
  const err = v.cuts_error ? `<p class=err>cuts.yaml を読めません：${esc(v.cuts_error)}</p>` : '';
  const items = v.topic_cuts ?? [];
  if (!items.length) {
    return foldSection('cuts', 'カット', `${err}<p class=muted>まだありません。トピックを選んで「カットを作る」を押すと、ここに出ます。</p>`);
  }
  const cards = items.map(
    (tc) => cutCard(tc, topicNames.get(tc.topic) ?? tc.name) + (tc.memo ? shortCard(`${tc.name}-short`, tc) : ''),
  );
  return foldSection('cuts', `カット（${items.length} 本）`, `${err}${cards.join('')}`);
}

/** この動画の依頼の履歴 */
export function requestsSection(ctx: StageCtx | null, base: string): string {
  if (!ctx?.requests.length) return '';
  return foldSection(
    'requests',
    `依頼（${ctx.requests.length} 件）`,
    '<div class=scroll><table><thead><tr><th>状態</th><th>内容</th><th>日時</th></tr></thead><tbody>' +
      ctx.requests.map((r) => requestRow(r, base)).join('') +
      '</tbody></table></div>',
  );
}
