"""銀行明細PDF → 入出金管理表(Excel) 同期エントリポイント。

処理フロー:
  1. Drive の source_folder_id から未処理PDFを取得
  2. ファイル名から銀行を判定 → 銀行別パーサで取引を抽出
  3. Drive 上の Excel を一旦ローカルへDL → 追記 → 上書きアップロード
  4. 処理済みPDFを per_bank_processed (or processed_folder_id) へ移動
"""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

import yaml

from drive_client import DriveClient
from excel_writer import append_transactions
from pdf_parser import PARSERS, detect_bank


def load_config(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def run(config_path: Path, year: int, dry_run: bool) -> int:
    cfg = load_config(config_path)
    gd = cfg["google_drive"]
    drive = DriveClient(gd["service_account_json"])

    tmp = Path(__file__).parent / "downloads"
    tmp.mkdir(exist_ok=True)

    pdfs = drive.list_pdfs(gd["source_folder_id"])
    if not pdfs:
        print("source_folder にPDFがありません。")
        return 0

    all_tx = []
    file_bank: dict[str, str] = {}
    for f in pdfs:
        bank = detect_bank(f["name"], cfg["bank_detection"])
        if not bank:
            print(f"[skip] 銀行判定できず: {f['name']}")
            continue
        parser = PARSERS.get(bank)
        if not parser:
            print(f"[skip] パーサ未実装: {bank}")
            continue
        local = drive.download(f["id"], tmp / f["name"])
        txs = parser(local, year)
        print(f"[parse] {f['name']}: {len(txs)} 件")
        all_tx.extend(txs)
        file_bank[f["id"]] = bank

    if not all_tx:
        print("追記対象の取引がありません。")
        return 0

    excel_local = tmp / "kanrihyou.xlsx"
    drive.download(gd["excel_file_id"], excel_local)

    appended = append_transactions(
        excel_local, cfg["excel"]["sheet_name"], cfg["excel"]["header_row"],
        cfg["excel"]["columns"], all_tx,
    )
    print(f"[excel] {appended} 件を追記(重複スキップ除く)")

    if dry_run:
        print("dry-run: Driveへのアップロード/移動はスキップ")
        return 0

    drive.upload_overwrite(gd["excel_file_id"], excel_local)

    per_bank = gd.get("per_bank_processed") or {}
    fallback = gd.get("processed_folder_id")
    for file_id, bank in file_bank.items():
        target = per_bank.get(bank) or fallback
        if not target or "REPLACE" in target:
            print(f"[warn] 移動先未設定のためスキップ: {file_id}")
            continue
        drive.move(file_id, target)
        print(f"[move] {file_id} -> {bank}")

    return 0


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--config", type=Path,
                   default=Path(__file__).parent / "config.yaml")
    p.add_argument("--year", type=int, default=date.today().year,
                   help="PDFに年が無い行用のデフォルト年")
    p.add_argument("--dry-run", action="store_true",
                   help="Drive書き込みを行わず動作確認")
    args = p.parse_args()

    if not args.config.exists():
        print(f"config が見つかりません: {args.config}", file=sys.stderr)
        print("config.example.yaml をコピーして編集してください。", file=sys.stderr)
        return 2
    return run(args.config, args.year, args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
