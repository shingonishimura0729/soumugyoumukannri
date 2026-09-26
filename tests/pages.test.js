/**
 * 画面そのもののテスト。
 *
 * ブラウザを立ち上げずに、開いた瞬間に壊れるよくある事故だけを潰す。
 *
 *   1. 埋め込んだ JavaScript の構文
 *   2. `$("...")` で触っている id が HTML にあるか
 *   3. import している名前が、その相手から本当に export されているか
 *
 * どれも見落とすと**真っ白な画面**になり、原因が分かりにくい。
 * 中身の動きまでは見ない。それは実際に開いて確かめる。
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 画面として確かめるもの */
const PAGES = ["renraku/index.html"];

/** ファイルが export している名前を集める */
function exportsOf(file) {
  const src = readFileSync(file, "utf8");
  const names = new Set();
  for (const m of src.matchAll(
    /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/gm
  )) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  return names;
}

/** HTML から埋め込みスクリプトを取り出す */
function scriptOf(html) {
  const matched = /<script type="module">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(matched, "module スクリプトが見つかりません");
  return matched[1];
}

for (const page of PAGES) {
  describe(page, () => {
    const file = resolve(root, page);
    const html = readFileSync(file, "utf8");
    const script = scriptOf(html);

    it("JavaScript の構文が通る", () => {
      const out = join(tmpdir(), `${page.replace(/[\\/]/g, "-")}.mjs`);
      writeFileSync(out, script, "utf8");
      // 構文だけを見る。import の解決はしない
      execFileSync(process.execPath, ["--check", out], { stdio: "pipe" });
    });

    it("触っている id がすべて HTML にある", () => {
      const declared = new Set(
        [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
      );
      const used = [...script.matchAll(/\$\("([^"]+)"\)/g)].map((m) => m[1]);
      const missing = [...new Set(used)].filter((id) => !declared.has(id));
      assert.deepEqual(missing, [], `HTML に無い id: ${missing.join(", ")}`);
    });

    it("import している名前がすべて export されている", () => {
      for (const m of script.matchAll(
        /import\s*\{([^}]*)\}\s*from\s*"(\.[^"]+)"/g
      )) {
        const available = exportsOf(resolve(dirname(file), m[2]));
        const wanted = m[1].split(",").map((s) => s.trim()).filter(Boolean);
        const gone = wanted.filter((name) => !available.has(name));
        assert.deepEqual(gone, [], `${m[2]} が export していない: ${gone.join(", ")}`);
      }
    });
  });
}

describe("公開リポジトリとしての約束", () => {
  /**
   * このリポジトリは公開なので、秘密を書いた時点で世界中から読める。
   * 置き忘れやすいものを機械で見張る。
   */
  const FILES = [...PAGES, "index.html", "assets/js/domain.js"];

  it("鍵やトークンらしきものをコードに書いていない", () => {
    for (const file of FILES) {
      const src = readFileSync(resolve(root, file), "utf8");
      for (const word of [
        "BEGIN PRIVATE KEY", "client_secret", "Bearer ", "apiKey", "AIza",
      ]) {
        assert.ok(!src.includes(word), `${file} に ${word} があります`);
      }
    }
  });

  it("お客様名らしきものを埋め込んでいない", () => {
    /**
     * 宛名は URL か入力欄から受け取る。コードに書いてはいけない。
     * 「〇〇様」の形が例文以外で紛れ込むのを見張る。
     */
    for (const file of PAGES) {
      const src = readFileSync(resolve(root, file), "utf8");
      const matched = [...src.matchAll(/[一-龠ぁ-んァ-ヶ]{2,6}様(?!の|方|々)/g)]
        .map((m) => m[0])
        .filter((name) => !["お客様", "皆様"].includes(name));
      assert.deepEqual(matched, [], `${file} に ${matched.join(", ")} があります`);
    }
  });
});
