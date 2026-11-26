/** 設計リマインドの画面で共通に使う小さな道具。中身（物件名など）は書かない。 */

export const BASE = "https://shingonishimura0729.github.io/soumugyoumukannri/remind/";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** 推測できない長さの鍵（28字）。リンクに入り、これを知っている人だけが開ける */
export function newKey() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const buf = new Uint8Array(28);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => abc[b % abc.length]).join("");
}

const pad = (n) => String(n).padStart(2, "0");

/** 日本時間の今日（YYYY-MM-DD） */
export function todayStr(d = new Date()) {
  const j = new Date(d.getTime() + (9 * 60 + d.getTimezoneOffset()) * 60000);
  return `${j.getFullYear()}-${pad(j.getMonth() + 1)}-${pad(j.getDate())}`;
}

const WD = ["日", "月", "火", "水", "木", "金", "土"];

/** 2026-11-28 → 11/28（土） */
export function dueLabel(due) {
  if (!due) return "";
  const [y, m, d] = due.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}（${WD[wd]}）`;
}

export const isOverdue = (due, today = todayStr()) => !!due && due < today;

export const taskUrl = (key) => `${BASE}t.html?k=${key}`;

/** よく使う確認事項（押すと一度に入る）。物件名や人の名前は書かない */
export const TEMPLATE_CHECKS = ["ｶｰﾎﾟｰﾄ完了検査", "支給品確認", "植栽施工", "FF実施日", "完了立会検査"];

/** 2026-12-04 → 12/4（金） */
export const dateLabel = (d) => (d ? dueLabel(d) : "");

/** 1項目を「□ 項目　12/4（金）　ひとこと」の1行の HTML にする */
export function itemHtml(it) {
  const mark = it.done ? "■" : "□";
  const extra = [dateLabel(it.date), it.note].filter(Boolean).map(esc).join("　");
  return `<div class="it ${it.done ? "ok" : ""}"><span class="mk">${mark}</span><span class="q">${esc(it.q)}</span>${extra ? `<span class="ans">${extra}</span>` : ""}</div>`;
}

/** 項目の新しい形 */
export const newItem = (q, now) => ({ q, done: false, date: "", note: "", addedAtISO: now, atISO: "" });

/** やること・確認事項がすべて■か（1つも無ければ false） */
export function allDone(t) {
  const all = [...(t.todos || []), ...(t.checks || [])];
  return all.length > 0 && all.every((x) => x.done);
}
