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
