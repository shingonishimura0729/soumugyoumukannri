/**
 * 入力した内容の保管。
 *
 * 業者さんが入れたものを、あとから管理の人が同じURLで見られるようにする。
 * 保管先は Firestore。ログインは使わない。
 *
 * **URLに入っているトークルームIDが鍵になる。**
 * ルームIDは推測できない長さの乱数で、それを文書のIDに使う。
 * ルールで「一覧を取る」を禁じてあるので、IDを知っている人しか読めない。
 * 逆に言うと**URLを知っている人は誰でも読み書きできる**。
 * トークルームに貼ってある以上、そのルームの人が触れるのは想定どおり。
 */

import {
  getApp,
  getApps,
  initializeApp,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  doc,
  getDoc,
  initializeFirestore,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

/** 週の入力を入れておくコレクション */
const COLLECTION = "renrakuWeeks";

let dbCache = null;

/**
 * Firestore を返す。
 *
 * `experimentalAutoDetectLongPolling` を渡している。会社や現場の回線で
 * WebChannel が通らないことがあり、その場合に**読み込みが終わらないまま固まる**。
 * 自動で長いポーリングへ落とさせる。
 */
function db() {
  if (!dbCache) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    dbCache = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  }
  return dbCache;
}

/** 推測できないトークルームIDを作る。見間違えにくい文字だけを使う */
export function newRoomId() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** ルームIDとして通る形か。URLから来た値をそのままパスに使わないため */
export function isRoomId(value) {
  return typeof value === "string" && /^[a-z0-9]{16,64}$/.test(value);
}

function ref(roomId, weekStart) {
  return doc(db(), COLLECTION, `${roomId}_${weekStart}`);
}

/**
 * その週の入力を読む。
 *
 * @param {string} roomId
 * @param {string} weekStart - `YYYY-MM-DD`
 * @returns {Promise<object | null>} まだ無ければ null
 */
export async function loadWeek(roomId, weekStart) {
  const snap = await getDoc(ref(roomId, weekStart));
  return snap.exists() ? snap.data() : null;
}

/**
 * その週の入力を書く。
 *
 * **firestore.rules が許す項目だけを送る。**
 * 余分な項目を足すと弾かれて保存できなくなるので、
 * 増やすときはルール側も一緒に直すこと。
 *
 * @param {string} roomId
 * @param {string} weekStart - `YYYY-MM-DD`
 * @param {object} input - days / notices / finishDate
 * @returns {Promise<string>} 保存した時刻（ISO文字列）
 */
export async function saveWeek(roomId, weekStart, input) {
  const updatedAtISO = new Date().toISOString();

  await setDoc(ref(roomId, weekStart), {
    roomId,
    weekStart,
    days: input.days.map((day) => ({
      work: day.work === true,
      memo: String(day.memo ?? "").trim().slice(0, 120),
    })),
    notices: input.notices.slice(0, 20).map((notice) => ({
      id: String(notice.id ?? ""),
      type: String(notice.type ?? "other"),
      date: String(notice.date ?? ""),
      detail: String(notice.detail ?? "").trim().slice(0, 120),
    })),
    finishDate: String(input.finishDate ?? "").slice(0, 10),
    // 表示にはこちらを使う。serverTimestamp は書いた直後には読めないため
    updatedAtISO,
    updatedAt: serverTimestamp(),
  });

  return updatedAtISO;
}
