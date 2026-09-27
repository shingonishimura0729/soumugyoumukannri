/**
 * Firebase の接続先。
 *
 * ここに入る値は**秘密ではない**。ブラウザに配る前提のもので、
 * 公開リポジトリに置いても構わない。守りは firestore.rules で掛けている。
 *
 * 逆に、**ここ以外の場所に秘密を書かないこと**。
 * お客様名やトークルームのIDはURLから受け取り、コードには書かない。
 *
 * 値の取り方：
 *   Firebase コンソール → プロジェクトの設定 → マイアプリ → ウェブアプリ
 */

export const firebaseConfig = {
  apiKey: "AIzaSyDZ1cuRYhp6r0Wo1Im6oeodvPU2I0uIGt8",
  authDomain: "archigarden-renraku.firebaseapp.com",
  projectId: "archigarden-renraku",
  storageBucket: "archigarden-renraku.firebasestorage.app",
  messagingSenderId: "149877532108",
  appId: "1:149877532108:web:a16bfdf80cfa9007d3e969",
};
