# 銀行明細PDF → 入出金管理表 同期スクリプト

Google Drive 上の銀行明細PDF(十六銀行・岐阜信用金庫)を読み取り、
同じく Drive 上の入出金管理表 Excel に追記し、処理済みPDFを
仕分けフォルダへ移動する自動化スクリプト。

## 構成

| ファイル | 役割 |
|---|---|
| `sync_bank_to_excel.py` | エントリポイント |
| `drive_client.py` | Google Drive API ラッパ |
| `pdf_parser.py` | 銀行別 明細PDFパーサ |
| `excel_writer.py` | Excel追記(重複防止つき) |
| `config.example.yaml` | 設定ファイル雛形 |
| `requirements.txt` | 依存パッケージ |

## 初期セットアップ

### 1. Google Cloud 側の準備

1. <https://console.cloud.google.com/> でプロジェクト作成
2. 「APIとサービス」→「ライブラリ」で **Google Drive API** を有効化
3. 「APIとサービス」→「認証情報」→ **サービスアカウント** を作成
4. 作成したサービスアカウントの「鍵」タブから **JSONキー** をダウンロード
5. ダウンロードした JSON を `scripts/service-account.json` として配置
   (このファイルは `.gitignore` 済み。**絶対にコミットしないこと**)

### 2. Drive 側の共有設定

サービスアカウントのメールアドレス(`xxx@yyy.iam.gserviceaccount.com`)に対して、
以下を「編集者」権限で共有する:

- 銀行明細PDFが入っている未処理フォルダ
- 処理済みPDFを移動する仕分けフォルダ(銀行別)
- 入出金管理表 Excel

### 3. 設定ファイル

```bash
cp scripts/config.example.yaml scripts/config.yaml
```

`config.yaml` を開き、各 `REPLACE_WITH_FOLDER_ID` / `REPLACE_WITH_FILE_ID` を
Drive 上の実 ID に書き換える。フォルダ/ファイルの ID は URL から取得:

- フォルダ: `https://drive.google.com/drive/folders/<ここがID>`
- ファイル: `https://drive.google.com/file/d/<ここがID>/view`

`excel.columns` セクションは、入出金管理表の実際のヘッダ名に合わせる。

### 4. 依存パッケージ

```bash
cd scripts
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 使い方

### 動作確認(Drive書き込みなし)

```bash
python sync_bank_to_excel.py --dry-run
```

### 本番実行

```bash
python sync_bank_to_excel.py
```

オプション:

- `--config PATH` 設定ファイルパス(デフォルト `config.yaml`)
- `--year YYYY` PDFに年表記が無い行用のデフォルト年(デフォルト: 今年)

## 仕組み

1. `source_folder_id` 内のPDFを列挙
2. ファイル名から銀行を識別(`bank_detection` ルール)
3. 銀行別パーサで取引を抽出
4. Excel をローカルにDL → 重複排除しつつ追記 → 上書きアップロード
5. 処理済みPDFを per_bank_processed のフォルダへ移動

重複判定キー: `(日付, 摘要, 入金額, 出金額, 銀行)` の組

## PDFパーサの調整(重要)

`pdf_parser.py` の `parse_juroku` / `parse_gifushinkin` は
**実際の明細PDFサンプルで動作確認しないと精度が出ない**。

サンプルPDFを入手したら以下の手順:

1. 1枚を `scripts/downloads/` に置いて以下を実行し、抽出テーブルを確認:
   ```python
   import pdfplumber
   with pdfplumber.open("downloads/<sample>.pdf") as pdf:
       for page in pdf.pages:
           for t in page.extract_tables() or []:
               for row in t: print(row)
   ```
2. 列順や日付フォーマットを確認し、`pdf_parser.py` の対応パーサを修正
3. `--dry-run` で抽出件数と中身が正しいか確認

## 定期実行(任意)

GitHub Actions の cron でも、Drive 配下のサーバの crontab でも実行可能。
GitHub Actions 化したい場合は別途相談。
