/**
 * Firebase への入口。
 *
 * 画面から Firebase を直接さわらず、ここを通す。
 * 読み込み先のバージョンを1か所にまとめておきたいのと、
 * 設定を入れ忘れたときに**真っ白ではなく理由の出る画面**にしたいため。
 */

import {
  getApp,
  getApps,
  initializeApp,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

import {
  ALLOWED_EMAIL_DOMAIN,
  firebaseConfig,
  isConfigured,
} from "./firebase-config.js";

export {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
};

/** 設定が入っていないときに投げる。呼び出し側が画面に理由を出す */
export class NotConfiguredError extends Error {
  constructor() {
    super(
      "Firebase の設定がまだ入っていません。assets/js/firebase-config.js を開いて、" +
        "Firebase コンソールで取得した値に差し替えてください。"
    );
    this.name = "NotConfiguredError";
  }
}

function app() {
  if (!isConfigured()) throw new NotConfiguredError();
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

let dbCache = null;

/**
 * Firestore を返す。
 *
 * `initializeFirestore` に `experimentalAutoDetectLongPolling` を渡している。
 * 会社や現場の回線で WebChannel が通らないことがあり、その場合に
 * **読み込みが終わらないまま固まる**。自動で長いポーリングへ落とさせる。
 */
export function db() {
  if (!dbCache) {
    dbCache = initializeFirestore(app(), {
      experimentalAutoDetectLongPolling: true,
    });
  }
  return dbCache;
}

/* ============================================================
 * ログイン（管理側だけで使う）
 * ========================================================== */

/**
 * 会社のアカウントか。
 *
 * ここは**親切のためのチェック**であって、守りではない。
 * 画面の JavaScript は書き換えられるので、本当の守りは firestore.rules にある。
 * ここで弾くのは「関係ないアカウントで入って、何も出ない画面を見て困る」のを防ぐため。
 *
 * @param {import("firebase/auth").User | null} user
 * @returns {boolean}
 */
export function isCompanyUser(user) {
  return Boolean(
    user?.email?.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)
  );
}

/**
 * ログイン状態を見張る。
 *
 * @param {(user: object | null) => void} handler - 会社のアカウントなら user、それ以外は null
 * @returns {() => void} 見張りをやめる関数
 */
export function watchSignIn(handler) {
  return onAuthStateChanged(getAuth(app()), (user) => {
    handler(isCompanyUser(user) ? user : null);
  });
}

/** Google でログインする。会社のアカウント以外はその場でログアウトさせる */
export async function signIn() {
  const auth = getAuth(app());
  const provider = new GoogleAuthProvider();
  // 会社のアカウントを先に見せる。別のアカウントで入る事故を減らす
  provider.setCustomParameters({ hd: ALLOWED_EMAIL_DOMAIN });

  const result = await signInWithPopup(auth, provider);
  if (!isCompanyUser(result.user)) {
    await signOut(auth);
    throw new Error(
      `${ALLOWED_EMAIL_DOMAIN} のアカウントでログインしてください。`
    );
  }
  return result.user;
}

/** ログアウトする */
export function logOut() {
  return signOut(getAuth(app()));
}

/* ============================================================
 * コレクション名
 * ========================================================== */

/**
 * Firestore のコレクション名。
 *
 * 文字列を画面のあちこちに散らかさない。打ち間違えると
 * **エラーにならずに空のコレクションを作ってしまう**ので、ここに集める。
 */
export const COL = {
  /** 物件 */
  projects: "renrakuProjects",
  /** 送付先プランナー */
  planners: "renrakuPlanners",
  /** 業者とのトークルーム。ここにURLを貼りっぱなしにする */
  rooms: "renrakuRooms",
  /** 文体などの設定 */
  settings: "renrakuSettings",
  /** トークルームに貼るURL。この下に weeks が入る */
  gyousha: "renrakuGyousha",
  /** 送信の記録 */
  sendLog: "renrakuSendLog",
};

/** 業者用トークンの下の、週の入力 */
export const SUB_WEEKS = "weeks";
