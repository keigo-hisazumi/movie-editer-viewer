import { describe, expect, it } from 'vitest';
import { videoBody } from './render';
import { activeByTopic, videoRequests, type StageCtx } from './stages';
import type { RequestDoc, VideoData } from './types';

const req = (over: Partial<RequestDoc>): RequestDoc => ({
  id: 'x', action: 'cut', video: 'm/20261017.mp4', status: 'queued', created: null, by: '', ...over,
});

const data: VideoData = {
  schema: 1,
  name: '20261017',
  updated: '',
  stream_length: 900,
  topics: [
    { id: 1, start: 0, title: '雑談', summary: '', points: [] },
    { id: 2, start: 300, title: 'ゲーム', summary: '', points: [] },
    { id: 3, start: 600, title: '歌', summary: '', points: [] },
  ],
  topics_error: '',
  legacy_topics: false,
  candidates: null,
  candidates_error: '',
  shorts: [],
  cuts: [],
  cuts_error: '',
  topic_cuts: [
    {
      name: 'topic_02', topic: 2, files: ['20261017_topic_02_cut.xml', '調整.xml'], adjusted: '調整.xml', adjusted_mtime: null, memo: null,
      cut: {
        topic: 2, title: 'ゲームで叫ぶ', titles: ['ゲームで叫ぶ', '案2'], heading: '[叫ぶ]', summary: '', reason: '', start: '00:05:00.000',
        end: '00:07:00.000', duration: 75, removed: { 無音: 10 }, cuts: [['00:05:00.000', '00:05:30.000']], drop: [], files: [], made: '',
      },
    },
    {
      name: 'topic_03', topic: 3, files: [], adjusted: null, adjusted_mtime: null, cut: null,
      memo: { topic: 3, source_xml: '直し.xml', duration: 40, candidate: { id: 3, title: '歌のショート' } },
    },
  ],
};

const ctx = (over: Partial<StageCtx> = {}): StageCtx => ({ rel: 'm/20261017.mp4', requests: [], checked: new Set(), ...over });

describe('段階式の動画ページ', () => {
  it('トピックにチェックボックスを出し、選んだ数をボタンに出す', () => {
    const html = videoBody(data, ctx({ checked: new Set([1, 3]) }));
    expect(html).toContain('data-topic=1 aria-label="トピック1を選ぶ" checked');
    expect(html).toContain('選んだトピックのカットを作る（2 件）');
  });
  it('何も選んでいなければカットのボタンは押せない', () => {
    expect(videoBody(data, ctx())).toContain('<button class=primary data-stage=cut disabled>');
  });
  it('微調整した XML があるトピックに「学習させる」を出す（ショートのボタンは出さない）', () => {
    const html = videoBody(data, ctx());
    expect(html).toContain('カット 1分15.0秒');
    expect(html).toContain('微調整済み');
    expect(html).toContain("<button class='primary small' data-stage=learn data-topic=2 data-redo=\"\">学習させる");
    expect(html).not.toContain('data-stage=short');
    expect(html).toContain('微調整：調整.xml');
    expect(html).toContain('ゲームで叫ぶ<br>案2');
  });
  it('学習済みなら違いを出し、XML が同じならボタンは「もう一度学習させる」', () => {
    const learn = {
      adjusted_xml: '調整.xml', adjusted_mtime: '', made: '', head: 2.4, tail: -1, removed_sec: 5, added_sec: 1.2,
      cut: { start: '00:05:00.000', end: '00:06:30.000', duration: 75, count: 10 },
      adjusted: { start: '00:05:02.400', end: '00:06:29.000', duration: 71.2, count: 9 },
      counts: { 外した: 1, 戻した: 1 },
      changes: [
        { start: '00:05:00.000', end: '00:05:02.000', text: '前置き', change: '外した' },
        { start: '00:05:40.000', end: '00:05:42.000', text: 'ツッコミ', change: '戻した', why: 'drop（関係ない話として外した）' },
      ],
    };
    const tc = { ...data.topic_cuts![0], adjusted_mtime: '', learn };
    const html = videoBody({ ...data, topic_cuts: [tc] }, ctx());
    expect(html).toContain('学習済み');
    expect(html).toContain("<button class='small' data-stage=learn data-topic=2 data-redo=\"1\">もう一度学習させる");
    expect(html).toContain('頭 +2.4秒・終わり -1.0秒');
    expect(html).toContain('外した：05:00.000 前置き');
    expect(html).toContain('（カットでは drop（関係ない話として外した））');
    const changed = videoBody({ ...data, topic_cuts: [{ ...tc, adjusted: '直し2.xml' }] }, ctx());
    expect(changed).toContain('学習のあと XML が変わった');
    expect(changed).toContain('data-redo="">学習させる');
  });
  it('段階式のショートはトピックへのリンクと読み込んだ XML を出す', () => {
    const html = videoBody(data, ctx());
    expect(html).toContain('id="topic_03-short"');
    expect(html).toContain('カット：直し.xml');
    expect(html).toContain('href="#topic-3">トピック3');
  });
  it('処理中のトピックはボタンの代わりに進み具合を出し、選べない', () => {
    const html = videoBody(data, ctx({ requests: [req({ action: 'learn', topics: [2], status: 'running', step: '微調整を学習中' })] }));
    expect(html).not.toContain('data-stage=learn data-topic=2');
    expect(html).toContain('処理中：微調整を学習中');
    expect(html).toContain('data-topic=2 aria-label="トピック2を選ぶ"  disabled');
  });
  it('元動画の一覧に無い動画は頼めない', () => {
    const html = videoBody(data, ctx({ rel: null }));
    expect(html).toContain('ここからは頼めません');
    expect(html).not.toContain('data-stage=');
  });
  it('依頼の状態を読み込む前はボタンを出さない', () => {
    expect(videoBody(data, null)).not.toContain('data-stage=');
  });
});

describe('依頼の振り分け', () => {
  it('この動画の依頼だけを拾う（相対パスでも動画名でも）', () => {
    const rs = [req({ video: 'm/20261017.mp4' }), req({ video: '20261017' }), req({ video: 'other.mp4' }), req({ action: 'scan', video: '' })];
    expect(videoRequests(rs, 'm/20261017.mp4', '20261017')).toHaveLength(2);
  });
  it('処理待ち・処理中の cut・learn・short をトピックごとに拾う', () => {
    const m = activeByTopic([req({ topics: [1, 2] }), req({ action: 'short', topics: [3], status: 'done' }), req({ action: 'learn', topics: [4] })]);
    expect([...m.keys()]).toEqual([1, 2, 4]);
  });
});
