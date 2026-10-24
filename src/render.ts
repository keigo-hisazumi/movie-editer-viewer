// 一覧・動画ごとのページの HTML（movie-editer の shorts/viewer.py の serve と同じ内容・見た目）
import { dur, esc, g, hms, localTime, shortTime, signed } from './format';
import type { Candidate, Memo, Short, VideoData, VideoDoc } from './types';

/** 動画ページの URL（?v=動画名。# はページ内の移動に使う） */
export function videoUrl(base: string, name: string): string {
  return `${base}?v=${encodeURIComponent(name)}`;
}

export function indexBody(docs: VideoDoc[], base: string): string {
  if (!docs.length) {
    return '<h1>出力一覧</h1><p class=muted>まだ何も送られていません。movie-editer で <code>python -m shorts publish</code> を実行すると、ここに出ます。</p>';
  }
  const rows = [...docs]
    .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0)) // 新しい順（動画名の逆順。serve と同じ）
    .map((d) => {
      const chips: string[] = [];
      if (d.topics_count) chips.push(`<span class=chip>トピック ${d.topics_count}</span>`);
      if (d.candidates_count) chips.push(`<span class=chip>候補 ${d.candidates_count}</span>`);
      if (d.shorts_count) chips.push(`<span class='chip ok'>ショート ${d.shorts_count}</span>`);
      return (
        `<tr><td><a href="${esc(videoUrl(base, d.name))}">${esc(d.name)}</a></td>` +
        `<td>${chips.join('') || '<span class=muted>文字起こしのみ</span>'}</td>` +
        `<td class='t muted small'>${esc(localTime(d.updated))}</td></tr>`
      );
    });
  return (
    '<h1>出力一覧</h1><div class=scroll><table>' +
    '<thead><tr><th>動画名</th><th>内容</th><th>更新</th></tr></thead><tbody>' +
    rows.join('') +
    '</tbody></table></div>'
  );
}

/** 見出しの [ ] で囲んだ強調部分を色付きにする */
function headingHtml(s: string): string {
  return esc(s).replace(/\[(.+?)\]/g, '<em>$1</em>');
}

function topicsSection(v: VideoData): [string, Map<number, string>] {
  const names = new Map<number, string>();
  if (v.topics_error) {
    return [`<h2 id=topics>トピック</h2><p class=err>topics.yaml を読めません：${esc(v.topics_error)}</p>`, names];
  }
  if (!v.topics) {
    const msg = v.legacy_topics
      ? '前の形式の topics.md です（python -m shorts migrate で変換する）。'
      : 'topics.yaml はまだありません。';
    return [`<h2 id=topics>トピック</h2><p class=muted>${msg}</p>`, names];
  }
  const topics = v.topics;
  const rows = topics.map((t, i) => {
    names.set(t.id, t.title);
    const end = i + 1 < topics.length ? topics[i + 1].start : v.stream_length;
    const length = end !== null ? `${((end - t.start) / 60).toFixed(1)}分` : '';
    const points = t.points.length
      ? '<ul class=small>' + t.points.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>'
      : '';
    return (
      `<tr id=topic-${t.id}><td class=t>${t.id}</td><td class=t>${shortTime(t.start)}</td>` +
      `<td class=t>${esc(length)}</td><td><strong>${esc(t.title)}</strong>` +
      `<div class='muted small'>${esc(t.summary)}</div>${points}</td></tr>`
    );
  });
  const chapters = topics.map((t) => `${shortTime(t.start)} ${t.title}`).join('\n');
  const html =
    `<h2 id=topics>トピック（${topics.length} 件）</h2><div class=scroll><table>` +
    '<thead><tr><th>#</th><th>開始</th><th>長さ</th><th>タイトル・内容</th></tr></thead><tbody>' +
    rows.join('') +
    '</tbody></table></div>' +
    '<details><summary class=small>チャプター（YouTube の概要欄にそのまま貼れる形）</summary>' +
    `<pre>${esc(chapters)}</pre></details>`;
  return [html, names];
}

function dl(items: [string, string][]): string {
  return items.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('');
}

function candidateCard(c: Candidate, topicNames: Map<number, string>, made: Map<number, string[]>): string {
  const chips = [
    `<span class=chip>${shortTime(c.start)}〜${shortTime(c.end)}</span>`,
    `<span class=chip>${dur(c.end - c.start)}</span>`,
  ];
  for (const s of made.get(c.id) ?? []) {
    chips.push(`<a class='chip ok' href="#${esc(s)}">${esc(s)} 作成済み</a>`);
  }
  const items: [string, string][] = [];
  if (c.heading) items.push(['見出し', `<span class=heading>${headingHtml(c.heading)}</span>`]);
  if (c.titles.length) items.push(['タイトル案', c.titles.map(esc).join('<br>')]);
  if (c.topic !== null) {
    const label = `${c.topic}. ${topicNames.get(c.topic) ?? '（topics.yaml に無い）'}`;
    items.push(['トピック', `<a href="#topic-${c.topic}">${esc(label)}</a>`]);
  }
  if (c.summary) items.push(['内容', esc(c.summary)]);
  if (c.reason) items.push(['理由', esc(c.reason)]);
  if (c.drop.length) {
    items.push(['外す範囲', c.drop.map(([a, b]) => `${hms(a)}〜${hms(b)}（${(b - a).toFixed(1)}秒）`).join('<br>')]);
  }
  if (c.bgm !== null) items.push(['BGM', esc(c.bgm) + (c.bgm_offset ? `（${g(c.bgm_offset)}秒から）` : '')]);
  if (c.se.length) {
    items.push([
      '効果音',
      c.se.map((s) => `${hms(s.at)} ${esc(s.file)}` + (s.db !== null ? `（${signed(s.db)}dB）` : '')).join('<br>'),
    ]);
  }
  if (c.images.length) {
    items.push([
      '画像',
      c.images.map((m) => hms(m.at) + (m.end !== null ? `〜${hms(m.end)}` : '') + ` ${esc(m.file)}`).join('<br>'),
    ]);
  }
  if (c.ignored.length) {
    items.push(['注意', `<span class=err>${esc(c.ignored.join('・'))} は廃止した指定（使われない）</span>`]);
  }
  return (
    `<div class=card id=cand-${c.id}><h3>候補${c.id}：${esc(c.title)}</h3>` +
    `<div>${chips.join('')}</div><dl>${dl(items)}</dl></div>`
  );
}

function lines(items: string[]): string {
  return items.length ? items.join('<br>') : '<span class=muted>なし</span>';
}

function shortCard(s: Short): string {
  const files = s.files.map(esc).join(', ');
  const head = `<div class='muted small'>${esc(s.name)}${files ? ' ・ ' + files : ''}</div>`;
  const memo: Memo | null = s.memo;
  if (!memo) {
    return `<div class=card id="${esc(s.name)}">${head}<p class=muted>memo.json がありません</p></div>`;
  }
  const c = memo.candidate ?? {};
  const removed =
    Object.entries(memo.removed ?? {})
      .map(([k, v]) => `${esc(k)} ${v}秒`)
      .join('、') || 'なし';
  const chips = [
    `<span class=chip>${Number(memo.duration ?? 0).toFixed(1)}秒</span>`,
    `<span class=chip>カット ${(memo.cuts ?? []).length} 個</span>`,
  ];
  if (c.id !== undefined && c.id !== null) chips.push(`<a class=chip href="#cand-${esc(c.id)}">候補${esc(c.id)}</a>`);
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
  const items: [string, string][] = [
    [
      '区間',
      `${esc(memo.start)}〜${esc(memo.end)}（削った分：${removed}）` +
        `<div class='muted small'>候補 ${esc(c.start)}〜${esc(c.end)}、${esc(memo.snap)}</div>`,
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
    ['選んだ理由', esc(c.reason || '（未記入）')],
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
  for (const [k, v] of Object.entries(memo.extra ?? {})) items.push([k, lines(v.map(esc))]);
  return (
    `<div class=card id="${esc(s.name)}">${head}<h3>${esc(c.title || s.name)}</h3>` +
    `<div>${chips.join('')}</div><dl>${dl(items)}</dl></div>`
  );
}

export function videoBody(v: VideoData): string {
  const [topicsHtml, topicNames] = topicsSection(v);
  const made = new Map<number, string[]>();
  for (const s of v.shorts) {
    const cid = s.memo?.candidate?.id;
    if (cid !== undefined && cid !== null) made.set(Number(cid), [...(made.get(Number(cid)) ?? []), s.name]);
  }
  let candsHtml: string;
  if (v.candidates_error) {
    candsHtml = `<h2 id=candidates>候補</h2><p class=err>candidates.yaml を読めません：${esc(v.candidates_error)}</p>`;
  } else if (!v.candidates) {
    candsHtml = '<h2 id=candidates>候補</h2><p class=muted>candidates.yaml はまだありません。</p>';
  } else {
    candsHtml =
      `<h2 id=candidates>候補（${v.candidates.length} 本）</h2>` +
      v.candidates.map((c) => candidateCard(c, topicNames, made)).join('');
  }
  const shortsHtml = v.shorts.length
    ? `<h2 id=shorts>ショート（${v.shorts.length} 本）</h2>` + v.shorts.map(shortCard).join('')
    : '<h2 id=shorts>ショート</h2><p class=muted>まだ作っていません。</p>';
  return `<h1>${esc(v.name)}</h1>${topicsHtml}${candsHtml}${shortsHtml}`;
}
