import base64
import datetime as dt
import io
import json
import stat
import urllib.request

from daily_dashboard.gmail_adapter import GMAIL_READONLY_SCOPE, GmailAdapter


class JsonResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        self.close()


def encoded(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode()).decode().rstrip("=")


def test_expired_token_refreshes_and_preserves_refresh_token(tmp_path, monkeypatch):
    client_path = tmp_path / "client.json"
    token_path = tmp_path / "token.json"
    client_path.write_text(json.dumps({
        "installed": {
            "client_id": "client-id",
            "client_secret": "client-secret",
            "auth_uri": "https://accounts.example/authorize",
            "token_uri": "https://accounts.example/token",
        },
    }))
    token_path.write_text(json.dumps({
        "access_token": "expired",
        "refresh_token": "keep-me",
        "expires_at": "2020-01-01T00:00:00+00:00",
    }))

    def fake_urlopen(request, timeout):
        assert request.full_url == "https://accounts.example/token"
        assert b"refresh_token=keep-me" in request.data
        return JsonResponse(json.dumps({
            "access_token": "fresh",
            "expires_in": 3600,
            "token_type": "Bearer",
            "scope": GMAIL_READONLY_SCOPE,
        }).encode())

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    adapter = GmailAdapter(client_path, token_path)

    assert adapter.access_token() == "fresh"
    saved = json.loads(token_path.read_text())
    assert saved["refresh_token"] == "keep-me"
    assert dt.datetime.fromisoformat(saved["expires_at"]) > dt.datetime.now(dt.UTC)
    assert stat.S_IMODE(token_path.stat().st_mode) == 0o600


def test_message_envelope_prefers_plain_text_and_builds_gmail_link():
    message = {
        "id": "message-123",
        "threadId": "thread-456",
        "internalDate": "1784304000000",
        "snippet": "Complete your assessment",
        "payload": {
            "headers": [
                {"name": "From", "value": "Recruiting <jobs@example.com>"},
                {"name": "Subject", "value": "Example coding assessment"},
            ],
            "mimeType": "multipart/alternative",
            "parts": [
                {
                    "mimeType": "text/plain",
                    "body": {"data": encoded("Finish by Friday.")},
                },
                {
                    "mimeType": "text/html",
                    "body": {"data": encoded("<b>HTML fallback</b>")},
                },
            ],
        },
    }

    envelope = GmailAdapter._envelope(message)

    assert envelope.message_id == "message-123"
    assert envelope.thread_id == "thread-456"
    assert envelope.sender == "Recruiting <jobs@example.com>"
    assert envelope.subject == "Example coding assessment"
    assert envelope.body == "Finish by Friday."
    assert envelope.source_url.endswith("/#all/message-123")


def test_html_fallback_removes_style_and_script_contents():
    body = GmailAdapter._message_text({
        "mimeType": "text/html",
        "body": {
            "data": encoded(
                "<html><head><style>body, table { font-family: Verdana; }</style>"
                "<script>window.tracker = true;</script></head>"
                "<body><p>Thank you for applying to Adobe.</p></body></html>"
            ),
        },
    })

    assert body == "Thank you for applying to Adobe."
