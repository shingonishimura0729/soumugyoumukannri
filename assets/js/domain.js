/**
 * お客様連絡アプリ ― 計算と文面の組み立て。
 *
 * ここには Firestore も画面も持ち込まない。日付の計算と文字列の組み立てだけを置く。
 * そうしておくと、画面を触らずにこのファイルだけをテストできる。
 *
 * 文面の形は、もともとの単一HTMLアプリが出していたものをそのまま引き継いでいる。
 * **書式を変えると受け取る側が気づく**ので、変えるときは仕様書と合わせること。
 */

/* ============================================================
 * 週の計算
 * ========================================================== */

/** 週のはじまりの曜日。0=日 … 2=火 */
const WEEK_START_DOW = 2;

/** 1週間の日数 */
export const DAYS_IN_WEEK = 7;

/** 曜日の表示 */
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * 日付を `YYYY-MM-DD` にする。
 *
 * @param {Date} date
 * @returns {string}
 */
export function toISODate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * `YYYY-MM-DD` を Date にする。
 *
 * タイムゾーンのずれで前日になるのを避けるため、UTC ではなくローカルで組み立てる。
 *
 * @param {string} iso - `YYYY-MM-DD`
 * @returns {Date | null} 形が違えば null
 */
export function parseISODate(iso) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!matched) return null;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const date = new Date(year, month - 1, day);

  // 2月30日のような値を弾く
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * 日付を足す。
 *
 * @param {string} iso - `YYYY-MM-DD`
 * @param {number} days - 足す日数。負でもよい
 * @returns {string} `YYYY-MM-DD`。元が読めなければ元の値をそのまま返す
 */
export function addDays(iso, days) {
  const date = parseISODate(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/**
 * `9/15(火)` の形にする。
 *
 * @param {string} iso - `YYYY-MM-DD`
 * @returns {string} 読めなければ空文字
 */
export function formatDayLabel(iso) {
  const date = parseISODate(iso);
  if (!date) return "";
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]})`;
}

/**
 * その日を含む週のはじまり（火曜）を返す。
 *
 * 火曜そのものならその日。水曜〜月曜なら直前の火曜。
 *
 * @param {Date} date - 基準日
 * @returns {string} `YYYY-MM-DD`
 */
export function weekStartOf(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (start.getDay() - WEEK_START_DOW + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  start.setDate(start.getDate() - diff);
  return toISODate(start);
}

/**
 * 今日以降で直近の週のはじまりを返す。
 *
 * 初期表示に使う。火曜なら当日、それ以外は**次の**火曜。
 *
 * @param {Date} today - 基準日
 * @returns {string} `YYYY-MM-DD`
 */
export function upcomingWeekStart(today) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = (WEEK_START_DOW - start.getDay() + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  start.setDate(start.getDate() + diff);
  return toISODate(start);
}

/**
 * 週の7日ぶんの日付を並べる。
 *
 * @param {string} weekStart - 週のはじまり `YYYY-MM-DD`
 * @returns {string[]} 火曜から7日ぶん
 */
export function weekDates(weekStart) {
  return Array.from({ length: DAYS_IN_WEEK }, (_, i) => addDays(weekStart, i));
}

/**
 * 週の見出し。`9/29(火) 〜 10/5(月)`
 *
 * @param {string} weekStart
 * @returns {string}
 */
export function weekLabel(weekStart) {
  const dates = weekDates(weekStart);
  return `${formatDayLabel(dates[0])} 〜 ${formatDayLabel(dates[DAYS_IN_WEEK - 1])}`;
}

/* ============================================================
 * 1週間の予定
 * ========================================================== */

/**
 * 未入力の7日ぶん。既定は全部「作業あり」。
 *
 * @returns {{work: boolean, memo: string}[]}
 */
export function emptyDays() {
  return Array.from({ length: DAYS_IN_WEEK }, () => ({ work: true, memo: "" }));
}

/**
 * 保存されていた値を7日ぶんに整える。
 *
 * 足りなければ埋め、多ければ切る。**壊れた値で画面が落ちないようにするため。**
 *
 * @param {unknown} days - 保存されていた値
 * @returns {{work: boolean, memo: string}[]} 必ず7要素
 */
export function normalizeDays(days) {
  const source = Array.isArray(days) ? days : [];
  return Array.from({ length: DAYS_IN_WEEK }, (_, i) => {
    const item = source[i];
    if (!item || typeof item !== "object") return { work: true, memo: "" };
    return {
      work: item.work !== false,
      memo: typeof item.memo === "string" ? item.memo : "",
    };
  });
}

/**
 * 週の連絡のIDを組み立てる。
 *
 * @param {string} projectId
 * @param {string} weekStart
 * @returns {string}
 */
export function weeklyReportId(projectId, weekStart) {
  return `${projectId}_${weekStart}`;
}

/**
 * 業者が触ったかどうか。
 *
 * 全部○のまま・メモも空なら「まだ触っていない」と見なす。
 * 未入力のまま送ってしまう事故を防ぐために使う。
 *
 * @param {readonly {work: boolean, memo: string}[]} days - 7日ぶん
 * @returns {boolean} 触られていれば true
 */
export function isTouched(days) {
  return days.some((day) => day.work === false || day.memo.trim() !== "");
}

/* ============================================================
 * 注意事項
 * ========================================================== */

/** 注意事項の種類 */
export const NOTICE_TYPES = {
  CONCRETE: "concrete",
  WATER: "water",
  HOME: "home",
  OTHER: "other",
};

/** 画面に出す名前 */
export const NOTICE_LABELS = {
  concrete: "コンクリート打設",
  water: "水道使用不可",
  home: "ご在宅お願い",
  other: "その他",
};

/** コンクリート養生の既定の日数 */
export const CURE_DEFAULT = { walk: 2, car: 7 };

/**
 * 打設日から解放日を埋める。
 *
 * 打設日が入っていないときは何もしない。**推測で日付を作らないため。**
 *
 * @param {object} notice - 注意事項
 * @param {{walk: number, car: number}} cure - 養生日数
 * @returns {object} 歩行・車両の日付を入れたもの
 */
export function fillCureDates(notice, cure) {
  if (notice.type !== NOTICE_TYPES.CONCRETE || !notice.date) return notice;
  return {
    ...notice,
    walk: addDays(notice.date, cure.walk),
    car: addDays(notice.date, cure.car),
  };
}

/**
 * 注意事項1件を行に組み立てる。
 *
 * @param {object} notice
 * @returns {string[]} 行の配列。呼び出し側が改行でつなぐ
 */
export function noticeLines(notice) {
  switch (notice.type) {
    case NOTICE_TYPES.CONCRETE: {
      const lines = [`打設日：${formatDayLabel(notice.date) || "（未定）"}`];
      if (notice.walk) lines.push(`歩行：${formatDayLabel(notice.walk)}から可`);
      if (notice.car) {
        lines.push(`車両乗入れ：${formatDayLabel(notice.car)}から可`);
      }
      lines.push("※それまでは施工部分への立入り・駐車をお控えください");
      return lines;
    }
    case NOTICE_TYPES.WATER:
      return [
        formatDayLabel(notice.date) || "（日程調整中）",
        "※作業中、一時的に水道が使えない時間があります",
        "※作業後の水の出し方は、別途お送りする「水道工事後のご使用について」をご覧ください",
      ];
    case NOTICE_TYPES.HOME:
      return [
        formatDayLabel(notice.date) || "（日程調整中）",
        `※${notice.detail ? `${notice.detail}の` : ""}立会いをお願いしたく、ご在宅をお願いします`,
      ];
    default:
      return [formatDayLabel(notice.date), notice.detail ?? ""].filter(
        (line) => line !== ""
      );
  }
}

/**
 * 注意事項をまとめて本文にする。
 *
 * @param {readonly object[]} notices
 * @returns {string} 1件も無ければ空文字
 */
export function noticeBody(notices) {
  return notices
    .map((notice) =>
      [`■ ${NOTICE_LABELS[notice.type]}`, ...noticeLines(notice)].join("\n")
    )
    .join("\n\n");
}

/* ============================================================
 * 文面
 * ========================================================== */

/** 既定の定型文。設定で上書きできる */
export const DEFAULT_PHRASES = {
  casual: {
    greet: "お世話になっております！\n今週の工事予定をお送りします😊",
    close:
      "お車の出入りや搬入の予定があれば、3日前までに教えてください🙏\n引き続きよろしくお願いします！",
    nGreet: "お世話になっております。\n工事についてのご連絡です。",
    nClose: "ご不便をおかけしますが、よろしくお願いします。",
    finishNote: "※天候などで前後することがあります",
  },
  formal: {
    greet: "お世話になっております。\n今週の工事予定をご案内いたします。",
    close:
      "お車の出入りや搬入のご予定がございましたら、3日前までにお知らせいただけますと幸いです。\n引き続きよろしくお願いいたします。",
    nGreet: "お世話になっております。\n工事に関するご連絡です。",
    nClose: "ご不便をおかけいたしますが、何卒よろしくお願いいたします。",
    finishNote: "※天候等により前後する場合がございます",
  },
};

/**
 * 絵文字を落とす。絵文字なしを選んだときに使う。
 *
 * 異体字セレクタ（U+FE0F）は絵文字と組み合わさって1文字になるため、
 * 文字クラスではなく**選択（|）で並べる**。文字クラスに入れると
 * 組み合わせ文字を分解して扱うことになり、消し残しが出る。
 *
 * @param {string} text
 * @returns {string}
 */
export function stripEmoji(text) {
  return text.replace(/\p{Extended_Pictographic}|️/gu, "").replace(/ +$/gm, "");
}

/**
 * 週間連絡の本文を組み立てる。
 *
 * @param {object} input - 物件の週の内容と文体
 * @returns {string} そのままトークへ貼れる本文
 */
export function buildWeeklyMessage(input) {
  const phrases = input.phrases ?? DEFAULT_PHRASES[input.tone];
  const decorate = (text) => (input.emoji ? text : stripEmoji(text));

  const customer = (input.customerName ?? "").trim();
  const head = customer ? `${customer}様\n` : "";

  const dates = weekDates(input.weekStart);
  const lines = input.days.map((day, i) => {
    const mark = day.work ? "○" : "×";
    const memo = input.showMemo && day.work && day.memo ? `　${day.memo}` : "";
    return `${formatDayLabel(dates[i] ?? addDays(input.weekStart, i))}　${mark}${memo}`;
  });

  const body = noticeBody(input.notices ?? []);

  const parts = [
    `${head}${decorate(phrases.greet)}`,
    `━━━━━━━━━━\n【工事予定】 ○＝作業あり ×＝休工\n${lines.join("\n")}\n━━━━━━━━━━`,
  ];

  if (body) parts.push(`【ご注意いただきたい点】\n${body}`);

  parts.push(
    `■ 完成予定\n${input.finishDate ? formatDayLabel(input.finishDate) : "（確認中）"}\n${phrases.finishNote}`
  );
  parts.push(decorate(phrases.close));

  return parts.join("\n\n");
}

/**
 * 注意事項だけを送る本文を組み立てる。
 *
 * 急ぎで伝えることがあるとき、週間連絡とは別に送る。
 * **こちらは絵文字を入れない**（用件だけを伝えるため）。
 *
 * @param {object} input - お客様名・注意事項・文体
 * @returns {string} 注意事項が無ければ空文字
 */
export function buildNoticeMessage(input) {
  const body = noticeBody(input.notices ?? []);
  if (!body) return "";

  const phrases = input.phrases ?? DEFAULT_PHRASES[input.tone];
  const customer = (input.customerName ?? "").trim();
  const head = customer ? `${customer}様\n` : "";

  return `${head}${stripEmoji(phrases.nGreet)}\n\n${body}\n\n${stripEmoji(phrases.nClose)}`;
}
