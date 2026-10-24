import { describe, expect, it } from 'vitest';
import { firebaseOptions } from './firebase';

const want = { apiKey: 'AIza-x', authDomain: 'p.firebaseapp.com', projectId: 'p', appId: '1:2:web:3' };

describe('firebaseOptions', () => {
  it('JSON を読む', () => {
    expect(firebaseOptions(JSON.stringify(want))).toEqual(want);
  });
  it('Firebase コンソールの JavaScript の書き方（改行は CRLF）もそのまま読む', () => {
    const js = '{\r\n  apiKey: "AIza-x",\r\n  authDomain: "p.firebaseapp.com",\r\n  projectId: "p",\r\n  appId: "1:2:web:3"\r\n}';
    expect(firebaseOptions(js)).toEqual(want);
  });
  it('const firebaseConfig = …; と末尾の , ・\' で囲んだ値も読む', () => {
    const js = "const firebaseConfig = {\n  apiKey: 'AIza-x',\n  authDomain: 'p.firebaseapp.com',\n  projectId: 'p',\n  appId: '1:2:web:3',\n};";
    expect(firebaseOptions(js)).toEqual(want);
  });
  it('無い・読めない・apiKey が無いときは null', () => {
    expect(firebaseOptions(undefined)).toBeNull();
    expect(firebaseOptions('abc')).toBeNull();
    expect(firebaseOptions('{"projectId":"p"}')).toBeNull();
  });
});
