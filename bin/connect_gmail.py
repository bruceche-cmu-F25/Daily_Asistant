#!/usr/bin/env python3
"""One-time Gmail read-only Desktop OAuth authorization."""

from __future__ import annotations

import argparse
import base64
import hashlib
import http.server
import json
import secrets
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path


BASE = Path(__file__).resolve().parent.parent
BACKEND = BASE / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from daily_dashboard.gmail_adapter import (  # noqa: E402
    GMAIL_READONLY_SCOPE,
    GmailAdapter,
    GmailAuthError,
    load_oauth_client,
)


class Callback(http.server.BaseHTTPRequestHandler):
    result: dict[str, str] = {}

    def do_GET(self) -> None:  # noqa: N802
        Callback.result = {
            key: values[0]
            for key, values in urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).items()
        }
        body = "Gmail read-only authorization received. You can close this tab."
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body.encode())))
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> None:
    parser = argparse.ArgumentParser(description="Authorize Gmail read-only access once")
    parser.add_argument("--no-open", action="store_true", help="Print the URL instead of opening it")
    args = parser.parse_args()
    client = load_oauth_client()
    server = http.server.HTTPServer(("127.0.0.1", 0), Callback)
    server.timeout = 300
    redirect_uri = f"http://127.0.0.1:{server.server_port}"
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    authorization_url = f"{client['auth_uri']}?{urllib.parse.urlencode({
        'client_id': client['client_id'],
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': GMAIL_READONLY_SCOPE,
        'access_type': 'offline',
        'prompt': 'consent',
        'state': state,
        'code_challenge': challenge,
        'code_challenge_method': 'S256',
    })}"
    print("Open this Google authorization URL if it did not open automatically:")
    print(authorization_url)
    if not args.no_open:
        subprocess.run(["/usr/bin/open", authorization_url], check=False)
    server.handle_request()
    result = Callback.result
    if result.get("state") != state:
        raise GmailAuthError("OAuth state did not match")
    if result.get("error"):
        raise GmailAuthError(f"Google authorization was declined: {result['error']}")
    code = result.get("code")
    if not code:
        raise GmailAuthError("No authorization code was returned")
    request = urllib.request.Request(
        str(client["token_uri"]),
        data=urllib.parse.urlencode({
            "client_id": client["client_id"],
            "client_secret": client.get("client_secret", ""),
            "code": code,
            "code_verifier": verifier,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        }).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        token = json.load(response)
    adapter = GmailAdapter()
    adapter.save_token(token)
    profile = adapter.profile()
    print(f"Gmail read-only connected: {profile.get('emailAddress', 'account verified')}")


if __name__ == "__main__":
    main()
