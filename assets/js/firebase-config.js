/**
 * Firebase の接続先。
 *
 * ここに入る値は**秘密ではない**。ブラウザに配る前提のもので、
 * 公開リポジトリに置いても構わない。守りは firestore.rules で掛けている。
 *
 * 逆に、**ここ以外の場所に秘密を書かないこと**。
 * お客様名・プランナー名・業者用のトークン・LINE WORKS のキーは
 * すべて Firestore 側に置く。このリポジトリは公開なので、
 * コードに書いた時点で世界中から読める。
 *
 * 値の取り方：
 *   Firebase コンソール → プロジェクトの設定 → マイアプリ →
 *   ウェブアプリ（</> のアイコン）を追加 → 表示される firebaseConfig をコピー
 */

export const firebaseConfig = {
  apiKey: "ここにapiKey",
  authDomain: "ここにauthDomain",
  projectId: "ここにprojectId",
  storageBucket: "ここにstorageBucket",
  messagingSenderId: "ここにmessagingSenderId",
  appId: "ここにappId",
};

/** ログインを許すメールアドレスのドメイン。firestore.rules と必ず揃えること */
export const ALLOWED_EMAIL_DOMAIN = "archigarden.net";

/** まだ設定を入れていないか */
export function isConfigured() {
  return !String(firebaseConfig.projectId).startsWith("ここに");
}
