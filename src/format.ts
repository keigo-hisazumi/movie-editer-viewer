// 表示用の小さな関数（movie-editer の shorts/viewer.py・timefmt.py と同じ書き方）

/** HTML に埋め込む文字のエスケープ */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** 秒を 'HH:MM:SS.mmm' にする */
export function hms(sec: number): string {
  let ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3_600_000);
  ms -= h * 3_600_000;
  const m = Math.floor(ms / 60_000);
  ms -= m * 60_000;
  const s = Math.floor(ms / 1000);
  ms -= s * 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}.${p(ms, 3)}`;
}

/** 一覧用の短い時刻（HH:MM:SS） */
export function shortTime(sec: number): string {
  return hms(sec).slice(0, 8);
}

/** 長さ（1分以上なら「N分M.M秒」） */
export function dur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m ? `${m}分${s.toFixed(1)}秒` : `${s.toFixed(1)}秒`;
}

/** Python の f"{x:+g}" に近い符号付きの数 */
export function signed(x: number, digits?: number): string {
  const v = digits === undefined ? String(Number(x.toPrecision(6))) : x.toFixed(digits);
  return x >= 0 ? `+${v}` : v;
}

/** Python の f"{x:g}" に近い数 */
export function g(x: number): string {
  return String(Number(x.toPrecision(6)));
}

/** ISO 8601 の日時をローカル時刻の 'YYYY-MM-DD HH:MM' にする */
export function localTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
