/**
 * お客様連絡アプリの計算と文面のテスト。
 *
 * 文面は、もとの単一HTMLアプリが出していた形をそのまま引き継ぐ。
 * 受け取る側が形の変化に気づくので、ここで固定する。
 *
 * 実行： node --test tests/
 * （npm install は要らない。Node 標準のテスト機能だけを使う）
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNoticeMessage,
  buildReportMessage,
  buildWeeklyMessage,
  emptyDays,
  fillCureDates,
  isTouched,
  normalizeDays,
  noticeBody,
  stripEmoji,
  upcomingWeekStart,
  weekDates,
  weekLabel,
  weekStartOf,
} from "../assets/js/domain.js";

const 火曜 = "2026-09-29";

/** `○○×○○○○` のような文字列から7日ぶんを組み立てる */
function days(pattern, memos = {}) {
  return pattern.split("").map((mark, i) => ({
    work: mark === "○",
    memo: memos[i] ?? "",
  }));
}

describe("週の計算", () => {
  it("火曜はその日が週のはじまり", () => {
    assert.equal(weekStartOf(new Date(2026, 8, 29)), "2026-09-29");
  });

  it("水曜は直前の火曜が週のはじまり", () => {
    assert.equal(weekStartOf(new Date(2026, 8, 30)), "2026-09-29");
  });

  it("月曜は6日前の火曜が週のはじまり", () => {
    assert.equal(weekStartOf(new Date(2026, 9, 5)), "2026-09-29");
  });

  it("初期表示は今日以降の直近の火曜", () => {
    assert.equal(upcomingWeekStart(new Date(2026, 8, 29)), "2026-09-29");
    assert.equal(upcomingWeekStart(new Date(2026, 8, 30)), "2026-10-06");
  });

  it("7日ぶんの日付を火曜から並べる", () => {
    assert.deepEqual(weekDates(火曜), [
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
    ]);
  });

  it("月をまたいでも正しく進む", () => {
    assert.equal(weekDates("2026-12-29")[3], "2027-01-01");
  });

  it("週の見出しは火曜から月曜まで", () => {
    assert.equal(weekLabel(火曜), "9/29(火) 〜 10/5(月)");
  });
});

describe("保存値の整え方", () => {
  it("足りなければ埋める", () => {
    assert.equal(normalizeDays([{ work: false, memo: "解体" }]).length, 7);
    assert.deepEqual(normalizeDays([{ work: false, memo: "解体" }])[0], {
      work: false,
      memo: "解体",
    });
  });

  it("多ければ切る", () => {
    assert.equal(
      normalizeDays(new Array(12).fill({ work: true, memo: "" })).length,
      7
    );
  });

  it("壊れた値でも落ちない", () => {
    assert.equal(normalizeDays("こわれている").length, 7);
    assert.deepEqual(normalizeDays([null, 3, "x"])[0], { work: true, memo: "" });
  });

  it("既定は全部「作業あり」", () => {
    assert.ok(emptyDays().every((d) => d.work));
  });
});

describe("業者が触ったかどうか", () => {
  it("全部○でメモも空なら未入力とみなす", () => {
    assert.equal(isTouched(emptyDays()), false);
  });

  it("×が1つでもあれば入力済み", () => {
    assert.equal(isTouched(days("○○×○○○○")), true);
  });

  it("メモだけでも入力済み", () => {
    assert.equal(isTouched(days("○○○○○○○", { 2: "ブロック積み" })), true);
  });

  it("空白だけのメモは入力とみなさない", () => {
    assert.equal(isTouched(days("○○○○○○○", { 2: "   " })), false);
  });
});

describe("コンクリート打設の解放日", () => {
  const notice = { id: "n1", type: "concrete", date: "2026-09-29" };

  it("打設日から歩行2日後・車両7日後を埋める", () => {
    const filled = fillCureDates(notice, { walk: 2, car: 7 });
    assert.equal(filled.walk, "2026-10-01");
    assert.equal(filled.car, "2026-10-06");
  });

  it("打設日が無ければ何も埋めない", () => {
    const filled = fillCureDates({ ...notice, date: "" }, { walk: 2, car: 7 });
    assert.equal(filled.walk, undefined);
  });

  it("本文に立入りを控える注記が入る", () => {
    const body = noticeBody([fillCureDates(notice, { walk: 2, car: 7 })]);
    assert.ok(body.includes("■ コンクリート打設"));
    assert.ok(body.includes("打設日：9/29(火)"));
    assert.ok(body.includes("歩行：10/1(木)から可"));
    assert.ok(body.includes("車両乗入れ：10/6(火)から可"));
    assert.ok(
      body.includes("※それまでは施工部分への立入り・駐車をお控えください")
    );
  });
});

describe("buildWeeklyMessage", () => {
  const base = {
    customerName: "玉井",
    weekStart: 火曜,
    days: days("○○×○○○○"),
    notices: [],
    finishDate: "2026-10-30",
    tone: "casual",
    emoji: true,
    showMemo: false,
  };

  it("宛名・工事予定・完成予定・締めがこの順で入る", () => {
    const text = buildWeeklyMessage(base);
    assert.ok(text.startsWith("玉井様\n"));
    assert.ok(text.includes("【工事予定】 ○＝作業あり ×＝休工"));
    assert.ok(text.includes("9/29(火)　○"));
    assert.ok(text.includes("10/1(木)　×"));
    assert.ok(text.includes("■ 完成予定\n10/30(金)"));
    assert.ok(text.includes("※天候などで前後することがあります"));
    assert.ok(text.indexOf("【工事予定】") < text.indexOf("■ 完成予定"));
  });

  it("お客様名が空なら宛名を出さない", () => {
    assert.ok(
      !buildWeeklyMessage({ ...base, customerName: "  " }).includes("様\n")
    );
  });

  it("完成予定が未定なら（確認中）と出す", () => {
    assert.ok(
      buildWeeklyMessage({ ...base, finishDate: "" }).includes(
        "■ 完成予定\n（確認中）"
      )
    );
  });

  it("作業内容は「載せる」を選んだときだけ出る", () => {
    const withMemo = { ...base, days: days("○○×○○○○", { 0: "ブロック積み" }) };
    assert.ok(!buildWeeklyMessage(withMemo).includes("ブロック積み"));
    assert.ok(
      buildWeeklyMessage({ ...withMemo, showMemo: true }).includes(
        "9/29(火)　○　ブロック積み"
      )
    );
  });

  it("休工日の作業内容は載せない", () => {
    const text = buildWeeklyMessage({
      ...base,
      days: days("○○×○○○○", { 2: "予備日" }),
      showMemo: true,
    });
    assert.ok(!text.includes("予備日"));
  });

  it("絵文字なしを選ぶと絵文字が消える", () => {
    assert.ok(buildWeeklyMessage(base).includes("😊"));
    assert.ok(!buildWeeklyMessage({ ...base, emoji: false }).includes("😊"));
  });

  it("フォーマルを選ぶと文体が変わる", () => {
    const text = buildWeeklyMessage({ ...base, tone: "formal" });
    assert.ok(text.includes("今週の工事予定をご案内いたします。"));
    assert.ok(text.includes("※天候等により前後する場合がございます"));
  });

  it("注意事項があるときだけ枠が出る", () => {
    assert.ok(!buildWeeklyMessage(base).includes("【ご注意いただきたい点】"));
    const text = buildWeeklyMessage({
      ...base,
      notices: [{ id: "n1", type: "water", date: "2026-10-01" }],
    });
    assert.ok(text.includes("【ご注意いただきたい点】"));
    assert.ok(text.includes("■ 水道使用不可"));
  });
});

describe("buildNoticeMessage", () => {
  it("注意事項が無ければ空文字", () => {
    assert.equal(
      buildNoticeMessage({ customerName: "玉井", notices: [], tone: "casual" }),
      ""
    );
  });

  it("用件だけを伝えるので絵文字は入れない", () => {
    const text = buildNoticeMessage({
      customerName: "玉井",
      notices: [
        { id: "n1", type: "home", date: "2026-10-01", detail: "配管位置の確認" },
      ],
      tone: "casual",
    });
    assert.ok(!text.includes("😊"));
    assert.ok(text.includes("玉井様"));
    assert.ok(
      text.includes("※配管位置の確認の立会いをお願いしたく、ご在宅をお願いします")
    );
  });
});

describe("buildReportMessage（業者がトークへ返す文面）", () => {
  const base = {
    projectName: "ｸﾞﾗﾝ長良 小野様邸",
    weekStart: 火曜,
    days: days("○○×○○○○", { 0: "ブロック積み" }),
    notices: [],
  };

  it("現場名と週と7日ぶんが入る", () => {
    const text = buildReportMessage(base);
    assert.ok(text.includes("【工事予定】ｸﾞﾗﾝ長良 小野様邸"));
    assert.ok(text.includes("9/29(火) 〜 10/5(月)"));
    assert.ok(text.includes("9/29(火)　○　ブロック積み"));
    assert.ok(text.includes("10/1(木)　×"));
  });

  it("休工日の作業内容は載せない", () => {
    const text = buildReportMessage({
      ...base,
      days: days("○○×○○○○", { 2: "予備日" }),
    });
    assert.ok(!text.includes("予備日"));
  });

  it("作業内容は常に載せる（事務所が見るため）", () => {
    // お客様向けと違い、載せるかどうかの選択は無い
    assert.ok(buildReportMessage(base).includes("ブロック積み"));
  });

  it("注意事項があるときだけ枠が出る", () => {
    assert.ok(!buildReportMessage(base).includes("【注意してほしいこと】"));
    const text = buildReportMessage({
      ...base,
      notices: [{ id: "n1", type: "concrete", date: "2026-10-02" }],
    });
    assert.ok(text.includes("【注意してほしいこと】"));
    assert.ok(text.includes("■ コンクリート打設"));
  });

  it("お客様向けの挨拶や宛名は入れない", () => {
    const text = buildReportMessage(base);
    for (const word of ["様\n", "お世話になって", "完成予定", "😊"]) {
      assert.ok(!text.includes(word), `${word} が入っています`);
    }
  });
});

describe("stripEmoji", () => {
  it("絵文字を消しても文字は残す", () => {
    assert.equal(stripEmoji("よろしくお願いします🙏"), "よろしくお願いします");
  });

  it("消したあとの行末の空白を残さない", () => {
    assert.equal(stripEmoji("ありがとう 😊\n次の行"), "ありがとう\n次の行");
  });
});
