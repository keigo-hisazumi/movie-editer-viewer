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
  schema: 1,
  name: '20261017',
  updated: '2026-10-17T12:00:00+00:00',
  stream_length: 600,
  topics: [
    { id: 1, start: 0, title: 'オープニング', summary: 'あいさつ', points: ['<b>'] },
    { id: 2, start: 300, title: 'ゲーム', summary: '', points: [] },
  ],
  topics_error: '',
  legacy_topics: false,
  candidates: [
    {
      id: 1, start: 60, end: 120, title: '候補の題', titles: ['案1'], heading: '[強調]の見出し', summary: '', reason: '',
      topic: 1, drop: [[70, 80]], bgm: null, bgm_offset: 0, se: [{ at: 90, file: 'ドン.mp3', db: null }], images: [], ignored: [],
    },
  ],
  candidates_error: '',
  shorts: [{ name: 'short_01', files: ['a.xml'], memo: { candidate: { id: 1, title: 'ショートの題' }, duration: 40, cuts: [['00:01:00.000', '00:01:10.000']] } }],
};

describe('videoBody', () => {
  const html = videoBody(data);
  it('チャプターの長さは次のチャプター（最後は配信の終わり）まで', () => {
    expect(html).toContain('<td class=t>5.0分</td>');
  });
  it('文字はエスケープする', () => {
    expect(html).toContain('<li>&lt;b&gt;</li>');
  });
  it('見出しの [ ] を強調にする', () => {
    expect(html).toContain('<em>強調</em>の見出し');
  });
  it('候補から作ったショートへのリンクを付ける', () => {
    expect(html).toContain('href="#short_01">short_01 作成済み');
    expect(html).toContain('ショートの題');
  });
  it('読めなかったファイルはエラーを出す', () => {
    expect(videoBody({ ...data, candidates: null, candidates_error: 'ValueError: x' })).toContain('candidates.yaml を読めません：ValueError: x');
  });
});

describe('indexBody', () => {
  it('新しい順に並べ、動画ページへリンクする', () => {
    const doc = (name: string) => ({ schema: 1, name, updated: '', published: '', topics_count: 1, candidates_count: 0, shorts_count: 2, data: '' });
    const html = indexBody([doc('20261001'), doc('20261017')], '/movie-editer-viewer/');
    expect(html.indexOf('20261017')).toBeLessThan(html.indexOf('20261001'));
    expect(html).toContain('href="/movie-editer-viewer/?v=20261017"');
    expect(html).toContain('ショート 2');
  });
});
