#!/usr/bin/env python3
"""FALAH Quran API — Python client (stdlib only).

Usage: FALAH_API_BASE_URL=https://api.example.com python3 python.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


class QuranApiError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code


class QuranApi:
    def __init__(self, base_url: str, token: str | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _get(self, path: str) -> dict:
        request = urllib.request.Request(f"{self.base_url}/api/v1{path}")
        request.add_header("accept", "application/json")
        if self.token:
            request.add_header("authorization", f"Bearer {self.token}")
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                body = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:  # the API answers with JSON on errors too
            body = json.loads(error.read().decode("utf-8"))
        if not body.get("success"):
            error = body.get("error", {})
            raise QuranApiError(error.get("code", "UNKNOWN"), error.get("message", ""))
        return body

    def health(self) -> dict:
        return self._get("/health")["data"]

    def version(self) -> dict:
        return self._get("/version")["data"]

    def surahs(self) -> list[dict]:
        return self._get("/surahs?limit=114")["data"]

    def ayah(self, surah: int, ayah: int, translation: str | None = None) -> dict:
        query = f"?translation={translation}" if translation else ""
        return self._get(f"/ayahs/by-key/{surah}:{ayah}{query}")["data"]

    def search(self, query: str, limit: int = 20, **filters) -> tuple[list[dict], int]:
        params = {"q": query, "limit": limit, **filters}
        body = self._get("/search?" + urllib.parse.urlencode(params))
        return body["data"], body["meta"]["total"]

    def surah_ayahs(self, surah: int) -> list[dict]:
        """Walks the pagination until the whole surah is collected."""
        collected, page = [], 1
        while True:
            body = self._get(f"/surahs/{surah}/ayahs?page={page}&limit=100")
            collected.extend(body["data"])
            if page >= body["meta"]["total_pages"]:
                return collected
            page += 1


def main() -> int:
    base = os.environ.get("FALAH_API_BASE_URL")
    if not base:
        print("set FALAH_API_BASE_URL", file=sys.stderr)
        return 2

    api = QuranApi(base)
    print("status :", api.health()["status"])
    version = api.version()
    print("dataset:", version["dataset"]["version"], version["dataset"]["status"])
    print("surahs :", len(api.surahs()))

    ayah = api.ayah(112, 1)
    print(ayah["ayah_key"], ayah["text"])
    print("hash   :", ayah["content_hash"])

    hits, total = api.search("الرحمن", limit=3)
    print(f"search : {total} hits, first = {hits[0]['ayah_key'] if hits else '-'}")
    print("baqarah:", len(api.surah_ayahs(2)), "ayahs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
