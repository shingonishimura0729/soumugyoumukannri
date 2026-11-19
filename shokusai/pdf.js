/**
 * 外構図面（PDF）を開く。スタッフ用（index.html）と業者さま用（share.html）で共通。
 *
 * 図面は Firestore の shokusaiFiles/{乱数}_{番号} に 700KB ずつ base64 で分けて置いてある。
 * 速くするために：
 *   1. 断片を1つずつ順番ではなく、まとめて同時に読む（PC の測定で約4分の1の時間）
 *   2. 読み込みは REST で行う（ログイン不要・読む決まりは「IDを知っていれば誰でも」）
 *   3. 一度読んだ図面は覚えておき、2回目はすぐ開く
 *   4. ボタンにカーソルを合わせた・指が触れた時点で、先に読み始める
 */
import { firebaseConfig } from "../assets/js/firebase-config.js";

const BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/shokusaiFiles/`;
const cache = new Map(); // 図面のID → 読み込み（Promise）。中身は PDF を開くための一時的なリンク
const listeners = new Map(); // 図面のID → 進み具合を知らせる先

function b64ToBytes(b64) {
  if (Uint8Array.fromBase64) return Uint8Array.fromBase64(b64);
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

async function part(id, n) {
  for (let tryN = 0; ; tryN++) {
    try {
      const r = await fetch(`${BASE}${id}_${n}?mask.fieldPaths=b64`);
      if (r.status === 404) throw Object.assign(new Error("図面の一部が見つかりません"), { fatal: true });
      if (!r.ok) throw new Error("通信に失敗しました（" + r.status + "）");
      return b64ToBytes((await r.json()).fields.b64.stringValue);
    } catch (e) {
      if (e.fatal || tryN >= 2) throw e; // 電波が弱いときのために2回までやり直す
      await new Promise((ok) => setTimeout(ok, 600 * (tryN + 1)));
    }
  }
}

/** 図面を読み込む（同じ図面は1回だけ）。onProgress(済んだ数, 全部の数) */
export function loadPdf(f, onProgress) {
  if (onProgress) listeners.set(f.id, onProgress);
  if (!cache.has(f.id)) {
    let done = 0;
    const p = Promise.all([...Array(f.of)].map((_, n) => part(f.id, n).then((u) => { done++; listeners.get(f.id)?.(done, f.of); return u; })))
      .then((parts) => URL.createObjectURL(new Blob(parts, { type: "application/pdf" })));
    p.catch(() => cache.delete(f.id));
    cache.set(f.id, p);
  }
  return cache.get(f.id);
}

/** ボタンにカーソルを合わせた・指が触れたら、先に読み始める */
export function prefetchPdf(btn, f) {
  const go = () => { loadPdf(f).catch(() => {}); };
  btn.addEventListener("pointerenter", go, { once: true });
  btn.addEventListener("touchstart", go, { once: true, passive: true });
}

/** 図面を新しい窓で開く。読み込み中は進み具合をボタンに出す */
export async function openPdf(f, btn) {
  // 先に窓を開けておく（読み込みの後に開くと、携帯ではポップアップとして止められるため）
  const w = window.open("", "_blank");
  try { w?.document.write('<meta name="viewport" content="width=device-width"><p style="font:16px system-ui,sans-serif;padding:24px;color:#556529">図面を読み込んでいます…</p>'); } catch {}
  const label = btn.textContent; btn.disabled = true;
  const show = (i, n) => { btn.textContent = `📄 読み込み中 ${Math.round((i / n) * 100)}%`; };
  show(0, 1);
  try {
    const url = await loadPdf(f, show);
    if (w && !w.closed) w.location.href = url; else location.href = url;
  } catch (e) { w?.close(); alert("図面を開けませんでした：" + (e.message || e)); }
  finally { listeners.delete(f.id); btn.textContent = label; btn.disabled = false; }
}
