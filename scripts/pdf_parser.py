"""銀行明細PDFから取引行を抽出するパーサ群。

各銀行の明細フォーマットに合わせて parse_* 関数を実装する。
実PDFサンプルが揃ったら、TODO 箇所のレイアウトを実データに合わせて調整する。
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Callable

import pdfplumber


@dataclass
class Transaction:
    date: date
    description: str
    deposit: int | None
    withdraw: int | None
    balance: int | None
    bank: str
    source_file: str


_AMOUNT_RE = re.compile(r"[\d,]+")


def _to_int(s: str | None) -> int | None:
    if not s:
        return None
    m = _AMOUNT_RE.search(s)
    if not m:
        return None
    return int(m.group(0).replace(",", ""))


def _parse_jp_date(s: str, default_year: int) -> date | None:
    # 例: "2026/1/5", "2026-01-05", "01/05", "1月5日"
    s = s.strip()
    m = re.match(r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})", s)
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    m = re.match(r"(\d{1,2})[/\-.](\d{1,2})", s)
    if m:
        return date(default_year, int(m.group(1)), int(m.group(2)))
    m = re.match(r"(\d{1,2})月(\d{1,2})日", s)
    if m:
        return date(default_year, int(m.group(1)), int(m.group(2)))
    return None


def parse_juroku(pdf_path: Path, default_year: int) -> list[Transaction]:
    """十六銀行 明細PDFのパーサ。

    TODO: 実PDFサンプル取得後、テーブル抽出ロジックを実データに合わせる。
    現状は pdfplumber の table 抽出を試み、列順 [日付, 摘要, 出金, 入金, 残高]
    を仮定。違っていればこの関数だけ書き換えればよい。
    """
    txs: list[Transaction] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                for row in table:
                    if not row or len(row) < 4:
                        continue
                    d = _parse_jp_date(row[0] or "", default_year)
                    if not d:
                        continue
                    desc = (row[1] or "").strip()
                    withdraw = _to_int(row[2])
                    deposit = _to_int(row[3])
                    balance = _to_int(row[4]) if len(row) > 4 else None
                    txs.append(Transaction(d, desc, deposit, withdraw, balance,
                                           "十六銀行", pdf_path.name))
    return txs


def parse_gifushinkin(pdf_path: Path, default_year: int) -> list[Transaction]:
    """岐阜信用金庫 明細PDFのパーサ。

    TODO: 実PDFサンプル取得後にレイアウト調整。
    十六と列順が異なる可能性が高い(信金は [日付, 摘要, 入金, 出金, 残高] が多い)。
    """
    txs: list[Transaction] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                for row in table:
                    if not row or len(row) < 4:
                        continue
                    d = _parse_jp_date(row[0] or "", default_year)
                    if not d:
                        continue
                    desc = (row[1] or "").strip()
                    deposit = _to_int(row[2])
                    withdraw = _to_int(row[3])
                    balance = _to_int(row[4]) if len(row) > 4 else None
                    txs.append(Transaction(d, desc, deposit, withdraw, balance,
                                           "岐阜信用金庫", pdf_path.name))
    return txs


PARSERS: dict[str, Callable[[Path, int], list[Transaction]]] = {
    "juroku": parse_juroku,
    "gifushinkin": parse_gifushinkin,
}


def detect_bank(filename: str, detection_rules: dict) -> str | None:
    name = filename.lower()
    for bank, rule in detection_rules.items():
        for kw in rule.get("filename_contains", []):
            if kw.lower() in name:
                return bank
    return None
