import { describe, expect, it } from 'vitest';
import { activeRequests, groupByFolder, sourcesBody } from './sources';
import type { RequestDoc, SourceItem, SourcesDoc } from './types';

const item = (rel: string, over: Partial<SourceItem> = {}): SourceItem => ({
  name: rel.split('/').pop()!.replace(/\.[^.]+$/, ''),
  rel,
  size: 1,
  mtime: '',
  transcript: false,
  topics: null,
  candidates: null,
  shorts: 0,
  ...over,
});
const src = (items: SourceItem[]): SourcesDoc => ({ updated: '2026-10-24T00:00:00+00:00', count: items.length, data: JSON.stringify(items) });
const req = (over: Partial<RequestDoc>): RequestDoc => ({
  id: 'x', action: 'candidates', video: '', status: 'queued', created: null, by: '', ...over,
});

describe('sourcesBody', () => {
  it('未処理の動画には「トピックと候補を作る」、作成済みには「作り直す」のボタンを出す', () => {
    const html = sourcesBody(src([item('202610/20261017.mp4'), item('20261001.mp4', { transcript: true, topics: 5, candidates: 3 })]), [], '/', new Set(['20261001']));
    expect(html).toContain('data-video="202610/20261017.mp4" data-redo="">トピックと候補を作る');
    expect(html).toContain('data-video="20261001.mp4" data-redo="1">作り直す');
    expect(html).toContain('href="/?v=20261001"');
    expect(html).not.toContain('href="/?v=20261017"');
  });
  it('処理中の依頼がある動画にはボタンを出さず、進み具合を出す', () => {
    const html = sourcesBody(src([item('a.mp4')]), [req({ video: 'a.mp4', status: 'running', step: '文字起こし中' })], '/', new Set());
    expect(html).not.toContain('data-video="a.mp4"');
    expect(html).toContain('処理中：文字起こし中');
  });
  it('エラーの依頼は内容を出し、文字はエスケープする', () => {
    const html = sourcesBody(src([]), [req({ video: 'a.mp4', status: 'error', error: '<失敗>' })], '/', new Set());
    expect(html).toContain('&lt;失敗&gt;');
  });
  it('一覧がまだ無いときは watch の起動を案内する', () => {
    expect(sourcesBody(null, [], '/', new Set())).toContain('python -m shorts watch を起動すると');
  });
});

describe('activeRequests', () => {
  it('待機中・処理中の candidates の依頼だけを動画ごとに拾う', () => {
    const m = activeRequests([
      req({ video: 'a.mp4', status: 'done' }),
      req({ video: 'b.mp4', status: 'queued' }),
      req({ action: 'scan', status: 'queued' }),
    ]);
    expect([...m.keys()]).toEqual(['b.mp4']);
  });
});

describe('フォルダごとの折りたたみ', () => {
  const items = [item('202609/a.mp4'), item('b.mp4'), item('202610/c.mp4'), item('202610/d.mp4', { topics: 1, candidates: 1 })];
  it('新しいフォルダから並べ、直下は最後', () => {
    expect(groupByFolder(items).map(([f, l]) => [f, l.length])).toEqual([['202610', 2], ['202609', 1], ['', 1]]);
  });
  it('既定ではいちばん新しいフォルダと、処理中の依頼があるフォルダだけ開く', () => {
    const html = sourcesBody(src(items), [req({ video: 'b.mp4', status: 'running' })], '/', new Set());
    expect(html).toContain('data-folder="202610" open');
    expect(html).toContain('data-folder="" open');
    expect(html).not.toContain('data-folder="202609" open');
    expect(html).toContain('<strong>202610/</strong> <span class=chip>2 本</span><span class=chip>未作成 1</span>');
  });
  it('開いているフォルダを指定すれば、その開閉を保つ', () => {
    const html = sourcesBody(src(items), [], '/', new Set(), new Set(['202609']));
    expect(html).toContain('data-folder="202609" open');
    expect(html).not.toContain('data-folder="202610" open');
  });
});
