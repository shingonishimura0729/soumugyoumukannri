"""Google Drive アクセス用の薄いラッパ。サービスアカウント認証専用。"""
from __future__ import annotations

import io
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload

SCOPES = ["https://www.googleapis.com/auth/drive"]


class DriveClient:
    def __init__(self, service_account_json: str):
        creds = service_account.Credentials.from_service_account_file(
            service_account_json, scopes=SCOPES
        )
        self.svc = build("drive", "v3", credentials=creds, cache_discovery=False)

    def list_pdfs(self, folder_id: str) -> list[dict]:
        q = (f"'{folder_id}' in parents and trashed=false "
             "and mimeType='application/pdf'")
        files: list[dict] = []
        page_token = None
        while True:
            resp = self.svc.files().list(
                q=q, fields="nextPageToken, files(id,name,parents)",
                pageToken=page_token, pageSize=200,
                supportsAllDrives=True, includeItemsFromAllDrives=True,
            ).execute()
            files.extend(resp.get("files", []))
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
        return files

    def download(self, file_id: str, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = self.svc.files().get_media(fileId=file_id, supportsAllDrives=True)
        with dest.open("wb") as fh:
            downloader = MediaIoBaseDownload(fh, req)
            done = False
            while not done:
                _, done = downloader.next_chunk()
        return dest

    def upload_overwrite(self, file_id: str, local_path: Path) -> None:
        media = MediaFileUpload(str(local_path),
                                mimetype=("application/vnd.openxmlformats-"
                                          "officedocument.spreadsheetml.sheet"),
                                resumable=False)
        self.svc.files().update(fileId=file_id, media_body=media,
                                supportsAllDrives=True).execute()

    def move(self, file_id: str, new_parent_id: str) -> None:
        meta = self.svc.files().get(fileId=file_id, fields="parents",
                                    supportsAllDrives=True).execute()
        prev = ",".join(meta.get("parents", []))
        self.svc.files().update(
            fileId=file_id, addParents=new_parent_id, removeParents=prev,
            fields="id, parents", supportsAllDrives=True,
        ).execute()
