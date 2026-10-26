import { describe, expect, it } from 'vitest';
import { dur, esc, hms } from './format';
import { indexBody, videoBody } from './render';
import type { VideoData } from './types';

describe('format', () => {
  it('hms は movie-editer の timefmt.hms と同じ形', () => {
    expect(hms(0)).toBe('00:00:00.000');
    expect(hms(3723.4567)).toBe('01:02:03.457');
  });
  it('dur は1分以上で分を付ける', () => {
    expect(dur(42.34)).toBe('42.3秒');
    expect(dur(125)).toBe('2分5.0秒');
  });
  it('esc は HTML の特殊文字を置き換える', () => {
    expect(esc('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#x27;');
  });
});

const data: VideoData = {
  schema: 2,
  name: '20261017',
  updated: '2026-10-17T12:00:00+00:00',
  stream_length: 600,
  topics: [
    { id: 1, start: 0, title: 'オープニング', summary: 'あいさつ', points: ['<b>'] },
    { id: 2, start: 300, title: 'ゲーム', summary: '', points: [] },
  ],
  topics_error: '',
  legacy_topics: false,
  cuts: [],
  cuts_error: '',
  topic_cuts: [
    {
      name: 'topic_01', topic: 1, files: ['a.xml'], adjusted: null, adjusted_mtime: null, learn: null,
      cut: {
        topic: 1, title: 'カットの題', titles: ['案1'], heading: '[強調]の見出し', summary: '', reason: '', start: '00:01:00.000',
        end: '00:02:00.000', duration: 50, removed: {}, cuts: [], drop: [], files: [], made: '',
      },
      memo: { topic: 1, spec: { id: 1, title: 'ショートの題' }, duration: 40, cuts: [['00:01:00.000', '00:01:10.000']] },
    },
  ],
};

describe('videoBody', () => {
  const html = videoBody(data);
  it('トピックの長さは次のトピック（最後は配信の終わり）まで', () => {
    expect(html).toContain('<td class=t>5.0分</td>');
  });
  it('文字はエスケープする', () => {
    expect(html).toContain('<li>&lt;b&gt;</li>');
  });
  it('見出しの [ ] を強調にする', () => {
    expect(html).toContain('<em>強調</em>の見出し');
  });
  it('トピックのカードに、作ったショートへのリンクと記録を出す', () => {
    expect(html).toContain('href="#topic_01-short"');
    expect(html).toContain('ショートの題');
  });
  it('候補は出さない（廃止した）', () => {
    expect(html).not.toContain('候補');
  });
  it('セクション・カード・トピックの出来事はたためる（既定は開いている）', () => {
    expect(html).toContain('<details class=sec data-fold="sec-topics" open><summary><h2 id="topics">トピック（2 件）</h2></summary>');
    expect(html).toContain(`<details class='card item' id="topic_01" data-fold="topic_01" open>`);
    expect(html).toContain(`data-fold="points-1" open><summary class='muted small'>出来事 1 件</summary>`);
    expect(html).toContain('data-fold-all=items');
  });
  it('読めなかったファイルはエラーを出す', () => {
    expect(videoBody({ ...data, topics: null, topics_error: 'ValueError: x' })).toContain('topics.yaml を読めません：ValueError: x');
  });
});

describe('indexBody', () => {
  it('新しい順に並べ、動画ページへリンクする', () => {
    const doc = (name: string) => ({ schema: 2, name, updated: '', published: '', topics_count: 1, shorts_count: 2, data: '' });
    const html = indexBody([doc('20261001'), doc('20261017')], '/movie-editer-viewer/');
    expect(html.indexOf('20261017')).toBeLessThan(html.indexOf('20261001'));
    expect(html).toContain('href="/movie-editer-viewer/?v=20261017"');
    expect(html).toContain('ショート 2');
  });
});
