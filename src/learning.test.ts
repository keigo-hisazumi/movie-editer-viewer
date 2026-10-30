import { describe, expect, it } from 'vitest';
import { learnSection, learningBody, learningCases, learningRules, mdHtml } from './learning';
import { videoBody } from './render';
import type { Finish, LearnBrief, VideoData } from './types';

const finish: Finish = {
  xml: '20261011_大声.xml', duration: 48.8, size: [1080, 1920], clips: 18,
  title: '大声ですべてを解決する\nアラサーOLお姉さん', title_match: '見出し',
  zoom: [{ scale: 220, pos: [917, 1498], sec: 34.8, count: 17 }],
  moved: [{ start: 0, end: 1.7, src: '00:28:59.267', said: '大声はすべてを解決する' }],
  gaps: [{ start: 32.9, end: 43.3, texts: ['誰か助けてー！'] }],
  captions: [{ start: 1.7, end: 2.4, text: '今日人生で' }],
  caption_stats: { count: 1, max_chars: 5, avg_chars: 5, avg_sec: 0.7 },
  emphasis: [{ start: 2.9, end: 3.3, text: 'しゃぶ葉', track: 4, over_caption: true, said: 'しゃぶよう' }],
  images: [{ start: 12.8, end: 14.4, name: '男性2人のテーブル.png', track: 7, scale: 80, pos: [540, 516], said: '男性二人組が' }],
  se: [{ start: 0.03, end: 1.6, name: 'バーン(ドラ).mp3', track: 1, db: 0, said: '大声' }],
  bgm: [{ start: 10.1, end: 48.8, name: '(BGM)WILD_BOYS.mp3', track: 2, db: -15, from: 0 }],
  notes: [],
};

const learn: LearnBrief = {
  adjusted_xml: '20261011_大声.xml', adjusted_mtime: 't', cut: { start: '', end: '', duration: 97.6, count: 33 },
  adjusted: { start: '', end: '', duration: 37.2, count: 18 }, head: 0.3, tail: -0.5, removed_sec: 60.9, added_sec: 0.5,
  counts: { 外した: 1 }, made: '2026-10-30T10:00:00',
  changes: [{ start: '00:28:47.620', end: '00:28:48.820', text: '誰か助けてー', change: '外した', in_gap: '仕上がりの 32.9〜43.3秒の文字に出ている' }],
  pauses_removed: [['00:26:12.767', 0.43]],
  finish,
};

const data: VideoData = {
  schema: 2, name: '20261011', updated: '', stream_length: 900, topics: [], topics_error: '', legacy_topics: false,
  topic_cuts: [
    {
      name: 'topic_04', topic: 4, files: [], adjusted: '20261011_大声.xml', adjusted_mtime: 't', memo: null, learn,
      lessons: { cut: ['同じ感想は具体的な方だけ残した'], short: ['決め台詞を冒頭に先出しした'] },
      cut: {
        topic: 4, title: 'しゃぶ葉で最悪な男2人組', titles: [], heading: '[大声]ですべてを解決する', summary: '', reason: '', start: '', end: '',
        duration: 97.6, removed: {}, cuts: [], drop: [], files: [], made: '',
      },
    },
    { name: 'topic_05', topic: 5, files: [], adjusted: null, adjusted_mtime: null, memo: null, cut: null },
  ],
};

describe('学習のセクション', () => {
  it('トピックごとに読み取ったこと・カットとの違い・仕上がりを出す', () => {
    const html = learnSection(data, new Map(), '/viewer/');
    expect(html).toContain('id="learn"');
    expect(html).toContain('学習（1 本）');
    expect(html).toContain('id="learn-topic_04"');
    expect(html).toContain('同じ感想は具体的な方だけ残した');
    expect(html).toContain('決め台詞を冒頭に先出しした');
    expect(html).toContain('仕上がりの 32.9〜43.3秒の文字に出ている');
    expect(html).toContain('詰めた 0.43秒');
    expect(html).toContain('カットの見出しと同じ');
    expect(html).toContain('バーン(ドラ).mp3');
    expect(html).toContain('(BGM)WILD_BOYS.mp3（0.0秒から、-15.0dB）');
    expect(html).not.toContain('learn-topic_05'); // 学習していないトピックは出さない
  });
  it('全体の学びは出さず、トップページへのリンクにする', () => {
    const html = learnSection(data, new Map(), '/viewer/');
    expect(html).toContain('href="/viewer/#learning"');
    expect(html).not.toContain('rules-cut');
  });
  it('カットのカードには学習の詳細を出さず、学習のセクションへのリンクにする', () => {
    const html = videoBody(data);
    const cutCard = html.slice(html.indexOf('id="topic_04"'), html.indexOf('id="learn"'));
    expect(cutCard).toContain('href="#learn-topic_04"');
    expect(cutCard).not.toContain('人が変えた文');
  });
});

describe('トップページの学習', () => {
  it('決め方を出し、事例はたたんで出す', () => {
    const html = learningBody({ updated: '', cut: '## 決め方\n1. **オチ**で終える\n## 事例\n- 古い事例', short: '' });
    expect(html).toContain('id=learning');
    expect(html).toContain('<ol><li><strong>オチ</strong>で終える</li></ol>');
    expect(html).toContain('<details><summary class=\'muted small\'>事例（トピックごと）</summary><div class=md><ul><li>古い事例</li></ul>');
    expect(html).toContain('まだありません'); // short_learning.md が空
  });
  it('読み込み中', () => {
    expect(learningBody(undefined)).toContain('読み込み中');
  });
});

describe('Markdown', () => {
  it('見出し・番号付き・箇条書き・続きの行・コメント', () => {
    expect(mdHtml('# 学び\n<!-- メモ -->\n1. a `x`\n   続き\n- b')).toBe('<h3>学び</h3><ol><li>a <code>x</code> 続き</li></ol><ul><li>b</li></ul>');
    expect(mdHtml('<b>')).toBe('<p>&lt;b&gt;</p>');
  });
  it('事例より前', () => {
    expect(learningRules('a\n## 事例\nb')).toBe('a\n');
    expect(learningCases('a\n## 事例\nb')).toBe('\nb');
    expect(learningCases('a')).toBe('');
  });
});
