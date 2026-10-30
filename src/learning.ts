// 動画ページの「学習」のセクション（movie-editer の shorts/viewer.py の _learning_section と同じ内容）
// 全体の学び（cut_learning.md・short_learning.md の決め方）と、トピックごとに読み取ったこと・カットとの違い・仕上がり
import { foldCard, foldSection } from './fold';
import { dur, esc, localTime } from './format';
import { learnedFresh } from './stages';
import type { Finish, LearnBrief, LearningDoc, TopicCut, VideoData } from './types';

const lines = (xs: string[]) => (xs.length ? xs.join('<br>') : '<span class=muted>なし</span>');
const sign = (x: number) => `${x >= 0 ? '+' : ''}${Number(x ?? 0).toFixed(1)}`;
const said = (x: { said?: string }) => (x.said ? ` <span class='muted small'>← 「${esc(x.said)}」</span>` : '');
const f1 = (x: number) => Number(x ?? 0).toFixed(1);

/** 学びのファイルの簡単な Markdown（見出し・箇条書き・太字・コード）を HTML に */
export function mdHtml(text: string): string {
  const out: string[] = [];
  let items: string[] = [];
  let tag = '';
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  const flush = () => {
    if (items.length) out.push(`<${tag}>${items.map((x) => `<li>${x}</li>`).join('')}</${tag}>`);
    items = [];
    tag = '';
  };
  // 書き手向けのコメント（<!-- … -->）は出さない。入れ子の書き方でも残らないよう、変わらなくなるまで取り除く
  // （出す文字はどれも esc を通すので、残っても HTML にはならない）
  let body = text;
  for (let prev = ''; prev !== body; ) {
    prev = body;
    body = body.replace(/<!--[\s\S]*?-->/g, '');
  }
  for (const line of body.split('\n')) {
    const h = /^(#{1,4})\s+(.*)/.exec(line);
    const li = /^\s*(?:(\d+)\.|[-*])\s+(.*)/.exec(line);
    if (h) {
      flush();
      const level = Math.min(h[1].length + 2, 6);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
    } else if (li) {
      const kind = li[1] ? 'ol' : 'ul';
      if (tag && tag !== kind) flush();
      tag = kind;
      items.push(inline(li[2]));
    } else if (line.trim()) {
      if (items.length) items[items.length - 1] += ' ' + inline(line.trim()); // 箇条書きの続きの行
      else out.push(`<p>${inline(line.trim())}</p>`);
    } else {
      flush();
    }
  }
  flush();
  return out.join('');
}

/** 学びのファイルの「事例」より前（決め方）。事例はトピックごとのカードに出す */
export function learningRules(text: string): string {
  return text.split(/^##\s*事例/m)[0];
}

/** カットとの違い（learn.json の要約） */
function learnRows(r: LearnBrief): [string, string][] {
  // 1文ずつ <div>（残しているかもしれない印を下に添えるので <br> でつながない）
  const changes = r.changes.map(
    (s) =>
      `<div>${esc(s.change)}：${esc(s.start.slice(3))} ${esc(s.words || s.text)}` +
      (s.why ? ` <span class='muted small'>（カットでは ${esc(s.why)}）</span>` : '') +
      (s.in_gap ? `<div class='err small'>※${esc(s.in_gap)}</div>` : '') +
      '</div>',
  );
  const rows: [string, string][] = [
    [
      'カットとの違い',
      `${dur(r.cut.duration)} → ${dur(r.adjusted.duration)}（人が外した ${r.removed_sec}秒・戻した ${r.added_sec}秒、` +
        `頭 ${sign(r.head)}秒・終わり ${sign(r.tail)}秒）`,
    ],
    ['人が変えた文', changes.length ? changes.join('') : '<span class=muted>なし（間の調整だけ）</span>'],
  ];
  const pauses = [
    ...(r.pauses_removed ?? []).map(([t, s]) => `詰めた ${s}秒（${esc(t.slice(3))}）`),
    ...(r.pauses_added ?? []).map(([t, s]) => `戻した ${s}秒（${esc(t.slice(3))}）`),
  ];
  if (pauses.length) rows.push(['間', pauses.join('、')]);
  for (const n of r.notes ?? []) rows.push(['注意', `<span class=err>${esc(n)}</span>`]);
  return rows;
}

/** 人が仕上げたショートの作り（learn.json の finish） */
export function finishRows(f: Finish): [string, string][] {
  const rows: [string, string][] = [['仕上がり', `${f1(f.duration)}秒（<code>${esc(f.xml)}</code>、元動画のクリップ ${f.clips} 個）`]];
  if (f.title) {
    const m = f.title_match ? `カットの${esc(f.title_match)}と同じ` : 'カットの見出し・タイトル案と違う';
    rows.push(['ずっと出ている文字', `${f.title.split('\n').map(esc).join('<br>')}<div class='muted small'>${m}</div>`]);
  }
  if (f.zoom.length) {
    rows.push(['寄り', lines(f.zoom.map((z) => `${esc(z.scale)}%（位置 ${esc(z.pos?.join(', '))}）${f1(z.sec)}秒・${z.count} 個`))]);
  }
  if (f.moved.length) {
    rows.push(['先に出した所', lines(f.moved.map((m) => `${f1(m.start)}〜${f1(m.end)}秒 ← 元動画 ${esc(m.src.slice(3))}${said(m)}`))]);
  }
  if (f.gaps.length) {
    rows.push([
      '元動画のクリップが無い所',
      lines(f.gaps.map((g) => `${f1(g.start)}〜${f1(g.end)}秒${g.texts.length ? `：${esc(g.texts.join(' '))}` : ''}`)) +
        "<div class='muted small'>Filmora が書き出さなかったクリップ（声と字幕はある）。ここで外したように見える文は残しているかもしれない</div>",
    ]);
  }
  const st = f.caption_stats;
  if (st.count) {
    rows.push([
      '字幕',
      `${st.count} 個（平均 ${st.avg_chars} 文字・最大 ${st.max_chars} 文字・平均 ${st.avg_sec}秒）` +
        `<details><summary class='muted small'>字幕の一覧</summary><div class=small>${f.captions.map((c) => esc(c.text)).join(' / ')}</div></details>`,
    ]);
  }
  rows.push([
    '強調の文字',
    lines(
      f.emphasis.map(
        (x) => `${f1(x.start)}秒 <strong>${esc(x.text)}</strong>${x.over_caption ? "<span class='muted small'>（字幕に重ねる）</span>" : ''}${said(x)}`,
      ),
    ),
  ]);
  rows.push(['画像', lines(f.images.map((x) => `${f1(x.start)}〜${f1(x.end)}秒 ${esc(x.name)}<span class='muted small'>（${esc(x.scale)}%）</span>${said(x)}`))]);
  rows.push(['効果音', lines(f.se.map((x) => `${x.start.toFixed(2)}秒 ${esc(x.name)}${said(x)}`))]);
  rows.push(['BGM', lines(f.bgm.map((x) => `${f1(x.start)}〜${f1(x.end)}秒 ${esc(x.name)}（${f1(x.from)}秒から、${sign(x.db)}dB）`))]);
  for (const n of f.notes) rows.push(['注意', `<span class=err>${esc(n)}</span>`]);
  return rows;
}

function learnCard(tc: TopicCut, title: string): string {
  const r = tc.learn;
  const chips = [
    `<a class=chip href="#${esc(tc.name)}">カット</a>`,
    learnedFresh(tc)
      ? `<span class='chip ok'>学習 ${esc((r?.made ?? '').slice(0, 10))}</span>`
      : "<span class='chip warn'>学習のあと XML が変わった</span>",
  ];
  const items: [string, string][] = [
    ['読み取ったこと（カット）', lines((tc.lessons?.cut ?? []).map(esc))],
    ['読み取ったこと（仕上がり）', lines((tc.lessons?.short ?? []).map(esc))],
    ...(r ? learnRows(r) : []),
    ...(r?.finish ? finishRows(r.finish) : []),
  ];
  return foldCard(
    `learn-${tc.name}`,
    `<div class='muted small'>${esc(tc.name)}${r ? ` ・ ${esc(r.adjusted_xml)}` : ''}</div><h3>${esc(title)}</h3><div>${chips.join('')}</div>`,
    `<dl>${items.map(([k, s]) => `<dt>${esc(k)}</dt><dd>${s}</dd>`).join('')}</dl>`,
  );
}

/** 学びのファイルの「事例」から後（トピックごとの事例） */
export function learningCases(text: string): string {
  const m = /^##\s*事例.*$/m.exec(text);
  return m ? text.slice(m.index + m[0].length) : '';
}

/** トップページの「学習」：全体の学び（sources/learning の cut_learning.md・short_learning.md）。
 * learning は undefined ならまだ読めていない、null なら送られていない */
export function learningBody(learning: LearningDoc | null | undefined): string {
  if (learning === undefined) return "<h2 id=learning>学習</h2><p class=muted>学んだことを読み込み中…</p>";
  const cards = (
    [
      ['cut', 'カットの決め方', 'cut_learning.md', '/cut が従う'],
      ['short', 'ショートの仕上げ方', 'short_learning.md', '/short と /cut のタイトル・見出しが従う'],
    ] as const
  ).map(([key, title, file, use]) => {
    const text = learning?.[key] ?? '';
    if (!text.trim()) {
      return `<div class=card id="rules-${key}"><h3>${title}（${file}）</h3><p class=muted>まだありません</p></div>`;
    }
    const cases = learningCases(text);
    return (
      `<div class=card id="rules-${key}"><h3>${title}（${file}）</h3><div class='muted small'>${use}</div>` +
      `<div class=md>${mdHtml(learningRules(text))}</div>` +
      (cases.trim() ? `<details><summary class='muted small'>事例（トピックごと）</summary><div class=md>${mdHtml(cases)}</div></details>` : '') +
      '</div>'
    );
  });
  const updated = learning?.updated ? `<div class='muted small'>更新 ${esc(localTime(learning.updated))}</div>` : '';
  return `<h2 id=learning>学習</h2><p class='muted small'>/learn が微調整・仕上げたショートから学んだこと（全体）。トピックごとに読み取ったことは各動画のページの「学習」にあります。</p>${updated}${cards.join('')}`;
}

/** 動画ページの「学習」のセクション：トピックごとに読み取ったこと・カットとの違い・仕上がり。全体の学びはトップページ（base） */
export function learnSection(v: VideoData, topicNames: Map<number, string>, base = '/'): string {
  const cards = (v.topic_cuts ?? [])
    .filter((tc) => tc.learn || tc.lessons)
    .map((tc) => learnCard(tc, tc.cut?.title || (topicNames.get(tc.topic) ?? tc.name)));
  const empty =
    "<p class=muted>この動画で学習したトピックはまだありません（カットを Filmora で微調整・仕上げて書き出し、「学習させる」を押すと、ここに出ます）。</p>";
  return foldSection(
    'learn',
    `学習${cards.length ? `（${cards.length} 本）` : ''}`,
    `<p class='muted small'>全体で学んだこと（カットの決め方・ショートの仕上げ方）は<a href="${esc(base)}#learning">トップページの「学習」</a>にあります。</p>${cards.join('') || empty}`,
  );
}
