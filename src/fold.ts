// 動画ページの折りたたみ（セクション・カード・トピックの出来事を <details> にする）
// 開け閉めは data-fold の名前ごとに覚え、Firestore の変更で描き直しても、ページを開き直しても保つ
import { esc } from './format';

/** たためるセクション（見出しは h2。id はページ内リンク・上のタブの行き先） */
export function foldSection(id: string, title: string, body: string): string {
  return `<details class=sec data-fold="sec-${esc(id)}" open><summary><h2 id="${esc(id)}">${title}</h2></summary>${body}</details>`;
}

/** たためるカード。head はたたんでも見える所（題・チップ）、body は開いたときだけ見える所 */
export function foldCard(id: string, head: string, body: string): string {
  return `<details class='card item' id="${esc(id)}" data-fold="${esc(id)}" open><summary>${head}</summary>${body}</details>`;
}

/** 動画ページの上の「すべて開く・中身をたたむ・すべてたたむ」 */
export function foldBar(): string {
  return (
    "<div class=foldbar><span class='muted small'>表示：</span>" +
    '<button class=small data-fold-all=open>すべて開く</button>' +
    '<button class=small data-fold-all=items title="セクションは開いたまま、カードとトピックの出来事を題だけにする">中身をたたむ</button>' +
    '<button class=small data-fold-all=all title="セクションを見出しだけにする">すべてたたむ</button></div>'
  );
}

/** 開け閉めの覚え（data-fold の名前 → 開いているか）。localStorage に動画ごとに残す */
export class FoldState {
  private map = new Map<string, boolean>();
  private key: string;

  constructor(video: string) {
    this.key = `fold:${video}`;
    try {
      const saved = JSON.parse(localStorage.getItem(this.key) ?? '{}') as Record<string, boolean>;
      this.map = new Map(Object.entries(saved));
    } catch {
      // 読めなければ既定（すべて開く）のまま
    }
  }

  /** 描き直した後に、覚えている開け閉めを当てる */
  apply(root: HTMLElement): void {
    for (const d of root.querySelectorAll<HTMLDetailsElement>('details[data-fold]')) {
      const v = this.map.get(d.dataset.fold!);
      if (v !== undefined) d.open = v;
    }
  }

  /** 開け閉めを覚える（toggle は伝わらない（バブリングしない）ので capture で拾う） */
  track(root: HTMLElement): () => void {
    const onToggle = (ev: Event) => {
      const d = ev.target;
      if (!(d instanceof HTMLDetailsElement) || d.dataset.fold === undefined) return;
      if (this.map.get(d.dataset.fold) === d.open) return;
      this.map.set(d.dataset.fold, d.open);
      this.save();
    };
    root.addEventListener('toggle', onToggle, true);
    return () => root.removeEventListener('toggle', onToggle, true);
  }

  /** 「すべて開く」など。mode：open はすべて開く、items は中身だけたたむ、all はセクションもたたむ */
  setAll(root: HTMLElement, mode: string): void {
    for (const d of root.querySelectorAll<HTMLDetailsElement>('details[data-fold]')) {
      const isSec = d.classList.contains('sec');
      const isItem = d.classList.contains('item');
      if (mode === 'open') d.open = isSec || isItem ? true : d.open;
      else if (mode === 'items' && isItem) d.open = false;
      else if (mode === 'items' && isSec) d.open = true;
      else if (mode === 'all' && isSec) d.open = false;
      this.map.set(d.dataset.fold!, d.open);
    }
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(Object.fromEntries(this.map)));
    } catch {
      // 保存できなくても、このページを開いている間は覚えている
    }
  }
}

/** id の要素を囲む <details> を開く（たたんだ所へのリンク・URL の # で飛んだとき） */
export function reveal(id: string): HTMLElement | null {
  const el = document.getElementById(id);
  for (let d = el?.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
  // 要素そのものがたたんだカードなら開く
  if (el instanceof HTMLDetailsElement) el.open = true;
  return el;
}
