"""Minimal Gmail read-only OAuth and REST adapter for the local Mac runtime."""

from __future__ import annotations

import base64
import datetime as dt
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from .application_signals import EmailEnvelope
from .legacy import PROJECT_ROOT


GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
OAUTH_CLIENT_PATH = PROJECT_ROOT / "data" / "google-oauth-client.json"
TOKEN_PATH = PROJECT_ROOT / "data" / "gmail-token.json"
GMAIL_API_ROOT = "https://gmail.googleapis.com/gmail/v1/users/me"
RECRUITING_QUERY = (
    "newer_than:30d -in:spam -in:trash "
    "{subject:application subject:interview subject:assessment subject:recruiter "
    'subject:"coding challenge" subject:offer subject:unfortunately '
    "from:greenhouse.io from:greenhouse-mail.io from:lever.co from:ashbyhq.com "
    "from:myworkday.com from:codesignal.com from:hackerrank.com}"
)


class GmailAuthError(RuntimeError):
    pass


class _VisibleTextParser(HTMLParser):
    """Extract human-visible text without CSS, JavaScript, or tracking markup."""

    IGNORED = {"style", "script", "noscript"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ignored_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in self.IGNORED:
            self.ignored_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in self.IGNORED and self.ignored_depth:
            self.ignored_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self.ignored_depth and data.strip():
            self.parts.append(data.strip())

    def text(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self.parts)).strip()


def gmail_configured(
    client_path: Path = OAUTH_CLIENT_PATH,
    token_path: Path = TOKEN_PATH,
) -> bool:
    return Path(client_path).is_file() and Path(token_path).is_file()


def load_oauth_client(path: Path = OAUTH_CLIENT_PATH) -> dict[str, Any]:
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        client = payload.get("installed") or payload.get("web")
    except (OSError, json.JSONDecodeError) as exc:
        raise GmailAuthError(f"Cannot read OAuth client: {type(exc).__name__}") from exc
    required = {"client_id", "auth_uri", "token_uri"}
    if not isinstance(client, dict) or not required.issubset(client):
        raise GmailAuthError("OAuth client is not a valid Desktop app credential")
    return client


class GmailAdapter:
    def __init__(
        self,
        client_path: Path = OAUTH_CLIENT_PATH,
        token_path: Path = TOKEN_PATH,
        *,
        timeout: int = 30,
    ):
        self.client_path = Path(client_path)
        self.token_path = Path(token_path)
        self.timeout = timeout

    def save_token(self, token: dict[str, Any]) -> None:
        clean = {
            "access_token": str(token.get("access_token") or ""),
            "refresh_token": str(token.get("refresh_token") or ""),
            "token_type": str(token.get("token_type") or "Bearer"),
            "scope": str(token.get("scope") or GMAIL_READONLY_SCOPE),
            "expires_at": token.get("expires_at"),
        }
        if not clean["expires_at"] and token.get("expires_in"):
            clean["expires_at"] = (
                dt.datetime.now(dt.UTC) + dt.timedelta(seconds=int(token["expires_in"]))
            ).isoformat(timespec="seconds")
        self.token_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.token_path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(clean, indent=2), encoding="utf-8")
        os.chmod(temporary, 0o600)
        os.replace(temporary, self.token_path)

    def load_token(self) -> dict[str, Any]:
        try:
            token = json.loads(self.token_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise GmailAuthError("Gmail is not authorized; run bin/connect_gmail.py") from exc
        return token if isinstance(token, dict) else {}

    def access_token(self, *, force_refresh: bool = False) -> str:
        token = self.load_token()
        expires_at = token.get("expires_at")
        valid_until = None
        if expires_at:
            try:
                valid_until = dt.datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
            except ValueError:
                pass
        now = dt.datetime.now(dt.UTC)
        if (
            not force_refresh
            and token.get("access_token")
            and valid_until
            and valid_until > now + dt.timedelta(seconds=60)
        ):
            return str(token["access_token"])
        return self.refresh(token)

    def refresh(self, token: dict[str, Any] | None = None) -> str:
        token = token or self.load_token()
        refresh_token = str(token.get("refresh_token") or "")
        if not refresh_token:
            raise GmailAuthError("No refresh token; run bin/connect_gmail.py again")
        client = load_oauth_client(self.client_path)
        response = self._post_form(
            str(client["token_uri"]),
            {
                "client_id": client["client_id"],
                "client_secret": client.get("client_secret", ""),
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        response["refresh_token"] = refresh_token
        self.save_token(response)
        return str(response["access_token"])

    def profile(self) -> dict[str, Any]:
        return self._api_get("/profile")

    def search(self, query: str = RECRUITING_QUERY, max_results: int = 50) -> list[EmailEnvelope]:
        result = self._api_get(
            "/messages",
            {"q": query, "maxResults": min(max(max_results, 1), 100)},
        )
        envelopes = []
        for item in result.get("messages") or []:
            message_id = str(item.get("id") or "")
            if not message_id:
                continue
            message = self._api_get(f"/messages/{urllib.parse.quote(message_id)}", {"format": "full"})
            envelopes.append(self._envelope(message))
        return envelopes

    def _api_get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        suffix = f"?{urllib.parse.urlencode(params)}" if params else ""
        url = f"{GMAIL_API_ROOT}{path}{suffix}"
        for attempt in range(2):
            request = urllib.request.Request(
                url,
                headers={"Authorization": f"Bearer {self.access_token(force_refresh=attempt == 1)}"},
            )
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    return json.load(response)
            except urllib.error.HTTPError as exc:
                if exc.code == 401 and attempt == 0:
                    continue
                raise GmailAuthError(f"Gmail API returned HTTP {exc.code}") from exc
            except (OSError, json.JSONDecodeError) as exc:
                raise GmailAuthError(f"Gmail API unavailable: {type(exc).__name__}") from exc
        raise GmailAuthError("Gmail authorization failed")

    def _post_form(self, url: str, fields: dict[str, Any]) -> dict[str, Any]:
        request = urllib.request.Request(
            url,
            data=urllib.parse.urlencode(fields).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                result = json.load(response)
        except urllib.error.HTTPError as exc:
            raise GmailAuthError(f"Google OAuth returned HTTP {exc.code}") from exc
        except (OSError, json.JSONDecodeError) as exc:
            raise GmailAuthError(f"Google OAuth unavailable: {type(exc).__name__}") from exc
        if not result.get("access_token"):
            raise GmailAuthError("Google OAuth did not return an access token")
        return result

    @classmethod
    def _envelope(cls, message: dict[str, Any]) -> EmailEnvelope:
        payload = message.get("payload") or {}
        headers = {
            str(item.get("name") or "").lower(): str(item.get("value") or "")
            for item in payload.get("headers") or []
        }
        body = cls._message_text(payload)
        milliseconds = int(message.get("internalDate") or 0)
        received_at = (
            dt.datetime.fromtimestamp(milliseconds / 1000, tz=dt.UTC).isoformat(timespec="seconds")
            if milliseconds else dt.datetime.now(dt.UTC).isoformat(timespec="seconds")
        )
        message_id = str(message.get("id") or "")
        return EmailEnvelope(
            message_id=message_id,
            thread_id=str(message.get("threadId") or ""),
            sender=headers.get("from", ""),
            subject=headers.get("subject", "(no subject)"),
            snippet=str(message.get("snippet") or ""),
            body=body[:100_000],
            received_at=received_at,
            source_url=f"https://mail.google.com/mail/u/0/#all/{message_id}",
        )

    @classmethod
    def _message_text(cls, part: dict[str, Any]) -> str:
        plain: list[str] = []
        rich: list[str] = []

        def visit(node: dict[str, Any]) -> None:
            mime = str(node.get("mimeType") or "")
            data = str((node.get("body") or {}).get("data") or "")
            if data:
                decoded = cls._decode(data)
                if mime == "text/plain":
                    plain.append(decoded)
                elif mime == "text/html":
                    parser = _VisibleTextParser()
                    parser.feed(decoded)
                    rich.append(parser.text())
            for child in node.get("parts") or []:
                if isinstance(child, dict):
                    visit(child)

        visit(part)
        return "\n".join(plain or rich).strip()

    @staticmethod
    def _decode(data: str) -> str:
        padded = data + "=" * (-len(data) % 4)
        try:
            return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")
        except (ValueError, TypeError):
            return ""
