// 一覧・動画ごとのページの HTML（movie-editer の shorts/viewer.py の serve と同じ内容・見た目）
import { foldBar, foldCard, foldSection } from './fold';
import { esc, g, localTime, shortTime, signed } from './format';
import { activeByTopic, checkCell, cutsSection, requestsSection, stageBar, stageCell, topicCuts, type StageCtx } from './stages';
import type { Memo, Short, VideoData, VideoDoc } from './types';

/** 動画ページの URL（?v=動画名。# はページ内の移動に使う） */
export function videoUrl(base: string, name: string): string {
  return `${base}?v=${encodeURIComponent(name)}`;
}

export function indexBody(docs: VideoDoc[], base: string): string {
  if (!docs.length) {
    return '<h2 id=outputs>出力一覧</h2><p class=muted>まだ何も送られていません。movie-editer で <code>python -m shorts publish</code> を実行すると、ここに出ます。</p>';
  }
  const rows = [...docs]
    .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0)) // 新しい順（動画名の逆順。serve と同じ）
    .map((d) => {
      const chips: string[] = [];
      if (d.topics_count) chips.push(`<span class=chip>トピック ${d.topics_count}</span>`);
      if (d.cuts_count) chips.push(`<span class=chip>カット ${d.cuts_count}</span>`);
      if (d.shorts_count) chips.push(`<span class='chip ok'>ショート ${d.shorts_count}</span>`);
      return (
        `<tr><td class=wide><a href="${esc(videoUrl(base, d.name))}">${esc(d.name)}</a></td>` +
        `<td>${chips.join('') || '<span class=muted>文字起こしのみ</span>'}</td>` +
        `<td class='t muted small'>${esc(localTime(d.updated))}</td></tr>`
      );
    });
  return (
    '<h2 id=outputs>出力一覧</h2><div class=scroll><table>' +
    '<thead><tr><th>動画名</th><th>内容</th><th>更新</th></tr></thead><tbody>' +
    rows.join('') +
    '</tbody></table></div>'
  );
}

function topicsSection(v: VideoData, ctx: StageCtx | null): [string, Map<number, string>] {
  const names = new Map<number, string>();
  if (v.topics_error) {
    return [foldSection('topics', 'トピック', `<p class=err>topics.yaml を読めません：${esc(v.topics_error)}</p>`), names];
  }
  if (!v.topics) {
    const msg = v.legacy_topics
      ? '前の形式の topics.md です（python -m shorts migrate で変換する）。'
      : 'topics.yaml はまだありません。';
    return [foldSection('topics', 'トピック', `<p class=muted>${msg}</p>`), names];
  }
  const topics = v.topics;
  const cuts = topicCuts(v);
  const active = activeByTopic(ctx?.requests ?? []);
  const rows = topics.map((t, i) => {
    names.set(t.id, t.title);
    const end = i + 1 < topics.length ? topics[i + 1].start : v.stream_length;
    const length = end !== null ? `${((end - t.start) / 60).toFixed(1)}分` : '';
    // 出来事はトピックごとにたためる（たたんでも件数は見える）
    const points = t.points.length
      ? `<details class='points item' data-fold="points-${t.id}" open><summary class='muted small'>出来事 ${t.points.length} 件</summary>` +
        '<ul class=small>' + t.points.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul></details>'
      : '';
    return (
      `<tr id=topic-${t.id}>${checkCell(t.id, ctx, active)}<td class=t>${t.id}</td><td class=t>${shortTime(t.start)}</td>` +
      `<td class=t>${esc(length)}</td><td class=wide><strong>${esc(t.title)}</strong>` +
      `<div class='muted small'>${esc(t.summary)}</div>${points}</td>${stageCell(t.id, cuts.get(t.id), ctx, active)}</tr>`
    );
  });
  const chapters = topics.map((t) => `${shortTime(t.start)} ${t.title}`).join('\n');
  const html = foldSection(
    'topics',
    `トピック（${topics.length} 件）`,
    `${stageBar(v, ctx)}<div class=scroll><table class=topics>` +
      '<thead><tr><th>選択</th><th>#</th><th>開始</th><th>長さ</th><th>タイトル・内容</th><th>カット・ショート</th></tr></thead><tbody>' +
      rows.join('') +
      '</tbody></table></div>' +
      '<details data-fold=chapters><summary class=small>チャプター（YouTube の概要欄にそのまま貼れる形）</summary>' +
      `<pre>${esc(chapters)}</pre></details>`,
  );
  return [html, names];
}

function dl(items: [string, string][]): string {
  return items.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('');
}

function lines(items: string[]): string {
  return items.length ? items.join('<br>') : '<span class=muted>なし</span>';
}

/** ショートのカード（topic_XX/memo.json）。id は要素の id（topic_XX-short） */
function shortCard(s: Short, id: string = s.name): string {
  const files = s.files.map(esc).join(', ');
  const head = `<div class='muted small'>${esc(s.name)}${files ? ' ・ ' + files : ''}</div>`;
  const memo: Memo | null = s.memo;
  if (!memo) {
    return foldCard(id, head, '<p class=muted>memo.json がありません</p>');
  }
  const c = memo.spec ?? {};
  const removed =
    Object.entries(memo.removed ?? {})
      .map(([k, v]) => `${esc(k)} ${v}秒`)
      .join('、') || 'なし';
  const chips = [
    `<span class=chip>${Number(memo.duration ?? 0).toFixed(1)}秒</span>`,
    `<span class=chip>カット ${(memo.cuts ?? []).length} 個</span>`,
  ];
  if (memo.topic !== undefined && memo.topic !== null) {
    chips.push(`<a class=chip href="#topic-${esc(memo.topic)}">トピック${esc(memo.topic)}</a>`);
  }
  if (memo.source_xml) chips.push(`<span class=chip>カット：${esc(memo.source_xml)}</span>`);
  if (memo.note) chips.push(`<span class='chip warn'>${esc(memo.note)}</span>`);
  const sound: string[] = [];
  if (memo.bgm) {
    const b = memo.bgm;
    sound.push(`BGM：${esc(b.name)}（${b.from.toFixed(1)}秒から、${signed(b.db, 1)}dB）`);
  }
  for (const x of memo.se ?? []) sound.push(`効果音：${x.at.toFixed(2)}秒 ${esc(x.name)}（${signed(x.db, 1)}dB）`);
  if (memo.voice_db !== undefined && memo.voice_db !== null) {
    sound.push(`<span class='muted small'>声の音量 ${memo.voice_db.toFixed(1)}dBFS を基準に素材の音量を上げ下げ</span>`);
  }
  for (const n of memo.sound_notes ?? []) sound.push(`<span class=err>注意：${esc(n)}</span>`);
  const images = (memo.images ?? []).map((x) => `${x.start.toFixed(1)}〜${x.end.toFixed(1)}秒 ${esc(x.name)}`);
  for (const n of memo.image_notes ?? []) images.push(`<span class=err>注意：${esc(n)}</span>`);
  for (const n of memo.source_notes ?? []) sound.push(`<span class=err>注意（読み込んだ XML）：${esc(n)}</span>`);
  const items: [string, string][] = [
    [
      '区間',
      `${esc(memo.start)}〜${esc(memo.end)}（削った分：${removed}）` +
        `<div class='muted small'>${esc(memo.snap)}</div>`,
    ],
    [
      '画面の文字',
      lines(
        (memo.texts ?? []).map(
          (t) =>
            `${esc(t.name)}：<strong>${esc(t.text)}</strong>` +
            `<span class='muted small'>（${esc(t.font)}、${g(t.size)}、${esc(t.color)}）</span>`,
        ),
      ) + "<div class='muted small'>XML には入らないので Filmora でテキストを足す</div>",
    ],
    ['BGM・効果音', lines(sound)],
    ['画像', lines(images)],
    ['タイトル案', lines((c.titles ?? []).map(esc))],
    ['内容', esc(c.summary || '（未記入）')],
    [
      'ファイル',
      lines((memo.files ?? []).map((f) => `<code>${esc(f.name)}</code>：${esc(f.desc)}`)) +
        "<div class='muted small'>XML は Filmora の ファイル ▸ メディアの読み込み ▸ タイムライン XML の読み込み で開く</div>",
    ],
    ['カット', lines((memo.cuts ?? []).map(([a, b], i) => `${i + 1}. ${esc(a)}〜${esc(b)}`))],
  ];
  if (memo.drop?.length) items.push(['外した範囲', lines(memo.drop.map(([a, b]) => `${esc(a)}〜${esc(b)}`))]);
  if (memo.fillers?.length) {
    items.push(['削ったフィラー', memo.fillers.map((x) => `${esc(x.text)}（${esc(x.at)}）`).join('、')]);
  }
  return foldCard(id, `${head}<h3>${esc(c.title || s.name)}</h3><div>${chips.join('')}</div>`, `<dl>${dl(items)}</dl>`);
}

/** 動画ページ。ctx は段階式の依頼に要るもの（null なら依頼のボタンは出さない・使えない） */
export function videoBody(v: VideoData, ctx: StageCtx | null = null, base = '/'): string {
  const [topicsHtml, topicNames] = topicsSection(v, ctx);
  const cutsHtml = cutsSection(v, topicNames, (id, tc) => shortCard({ name: tc.name, files: tc.files, memo: tc.memo }, id));
  return `<h1>${esc(v.name)}</h1>${foldBar()}${topicsHtml}${cutsHtml}${requestsSection(ctx, base)}`;
}
