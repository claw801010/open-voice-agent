#!/usr/bin/env python3
"""Local scheduling API stub for MK-01 booking manual QA.

Serves the sample booking JSON from catalog/fixtures on common POST paths.
Default: http://127.0.0.1:8765

  python scripts/booking_scheduling_stub_server.py

Or via Docker Compose profile ``booking-stub`` (see docker-compose-local.yaml).
"""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
_FIXTURE = _REPO_ROOT / "catalog/fixtures/booking-scheduling-upstream-response.sample.json"
_SAMPLE_BODY = json.loads(_FIXTURE.read_text(encoding="utf-8"))


class _SchedulingStubHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        return

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/health":
            self._send_json(200, {"status": "ok", "service": "booking-scheduling-stub"})
            return
        self._send_json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path.startswith(("/api/", "/book", "/appointments", "/slots")):
            self._send_json(201, _SAMPLE_BODY)
            return
        self._send_json(404, {"error": "not_found"})

    def _send_json(self, status: int, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    host = os.environ.get("BOOKING_STUB_HOST", "0.0.0.0")
    port = int(os.environ.get("BOOKING_STUB_PORT", "8765"))
    server = HTTPServer((host, port), _SchedulingStubHandler)
    print(f"booking stub listening on http://{host}:{port} (fixture {_FIXTURE.name})")
    server.serve_forever()


if __name__ == "__main__":
    main()
