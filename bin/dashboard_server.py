#!/usr/bin/env python3
"""Serve the local dashboard and persist coding-problem progress in SQLite."""

import argparse
import datetime as dt
import json
import os
import sqlite3
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo


BASE = Path(os.environ.get('DASHBOARD_HOME', Path(__file__).resolve().parent.parent))
DB_PATH = Path(os.environ.get('DASHBOARD_DB_PATH', BASE / 'data' / 'dashboard.db'))
TZ = ZoneInfo(os.environ.get('DASHBOARD_TIMEZONE', 'America/Los_Angeles'))


def connect_db(path=DB_PATH):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA journal_mode=WAL')
    connection.execute('''
        CREATE TABLE IF NOT EXISTS problem_progress (
            problem_key TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            topic TEXT NOT NULL DEFAULT '',
            url TEXT NOT NULL DEFAULT '',
            completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
            stuck_count INTEGER NOT NULL DEFAULT 0,
            solution TEXT NOT NULL DEFAULT '',
            reflection TEXT NOT NULL DEFAULT '',
            completed_at TEXT,
            updated_at TEXT NOT NULL
        )
    ''')
    columns = {
        row['name'] for row in connection.execute('PRAGMA table_info(problem_progress)')
    }
    if 'solution' not in columns:
        connection.execute("ALTER TABLE problem_progress ADD COLUMN solution TEXT NOT NULL DEFAULT ''")
    if 'reflection' not in columns:
        connection.execute("ALTER TABLE problem_progress ADD COLUMN reflection TEXT NOT NULL DEFAULT ''")
    connection.commit()
    return connection


def save_problem_progress(
    connection, problem_key, status, title='', topic='', url='', solution=None, reflection=None
):
    now = dt.datetime.now(TZ).isoformat(timespec='seconds')
    existing = connection.execute(
        '''SELECT completed, stuck_count, solution, reflection, completed_at
           FROM problem_progress WHERE problem_key = ?''',
        (problem_key,),
    ).fetchone()
    completed = bool(existing['completed']) if existing else False
    stuck_count = int(existing['stuck_count']) if existing else 0
    saved_solution = existing['solution'] if existing else ''
    saved_reflection = existing['reflection'] if existing else ''
    completed_at = existing['completed_at'] if existing else None
    if status == 'completed':
        completed, completed_at = True, now
        saved_solution = saved_solution if solution is None else solution
        saved_reflection = saved_reflection if reflection is None else reflection
    elif status == 'reopened':
        completed, completed_at = False, None
    elif status == 'stuck':
        stuck_count += 1
    connection.execute('''
        INSERT INTO problem_progress
            (problem_key, title, topic, url, completed, stuck_count, solution, reflection,
             completed_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(problem_key) DO UPDATE SET
            title = excluded.title,
            topic = excluded.topic,
            url = excluded.url,
            completed = excluded.completed,
            stuck_count = excluded.stuck_count,
            solution = excluded.solution,
            reflection = excluded.reflection,
            completed_at = excluded.completed_at,
            updated_at = excluded.updated_at
    ''', (
        problem_key, title, topic, url, int(completed), stuck_count,
        saved_solution, saved_reflection, completed_at, now,
    ))
    connection.commit()


def problem_state(connection):
    rows = connection.execute('''
        SELECT problem_key, title, topic, url, completed, stuck_count, solution, reflection,
               completed_at
        FROM problem_progress
        ORDER BY updated_at DESC
    ''').fetchall()
    today = dt.datetime.now(TZ).date().isoformat()
    return {
        'items': {
            row['problem_key']: {
                'completed': bool(row['completed']),
                'title': row['title'],
                'topic': row['topic'],
                'url': row['url'],
                'stuck_count': row['stuck_count'],
                'solution': row['solution'],
                'reflection': row['reflection'],
                'completed_at': row['completed_at'],
            }
            for row in rows
        },
        'today_count': sum(
            1 for row in rows
            if row['completed'] and (row['completed_at'] or '').startswith(today)
        ),
    }


class DashboardHandler(BaseHTTPRequestHandler):
    server_version = 'DailyDashboard/1.0'

    def log_message(self, format, *args):
        return

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        if urllib.parse.urlparse(self.path).path != '/api/problems':
            self.send_error(404)
            return
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '600')
        self.end_headers()

    def send_file(self, path, content_type):
        if not path.is_file():
            self.send_error(404)
            return
        body = path.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == '/api/health':
            self.send_json(200, {'ok': True})
        elif path == '/api/problems':
            connection = connect_db()
            try:
                self.send_json(200, problem_state(connection))
            finally:
                connection.close()
        elif path in ('/', '/today.html'):
            self.send_file(BASE / 'today.html', 'text/html; charset=utf-8')
        elif path == '/assets/todo-favicon.svg':
            self.send_file(BASE / 'assets' / 'todo-favicon.svg', 'image/svg+xml')
        else:
            self.send_error(404)

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != '/api/problems':
            self.send_error(404)
            return
        if self.headers.get_content_type() != 'application/json':
            self.send_json(415, {'error': 'application/json required'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 131_072:
                raise ValueError('invalid request size')
            payload = json.loads(self.rfile.read(length))
            problem_key = str(payload.get('problem_key', '')).strip()
            if not problem_key or len(problem_key) > 300:
                raise ValueError('invalid problem_key')
            status = str(payload.get('status', '')).strip()
            if status not in {'completed', 'reopened', 'stuck'}:
                raise ValueError('invalid status')
            title = str(payload.get('title', ''))[:500]
            topic = str(payload.get('topic', ''))[:100]
            url = str(payload.get('url', ''))[:1000]
            solution = str(payload.get('solution', ''))[:30_000]
            reflection = str(payload.get('reflection', ''))[:10_000]
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self.send_json(400, {'error': str(exc)})
            return
        connection = connect_db()
        try:
            save_problem_progress(
                connection, problem_key, status, title, topic, url, solution, reflection
            )
            state = problem_state(connection)
        finally:
            connection.close()
        self.send_json(200, {
            'ok': True,
            'today_count': state['today_count'],
            'item': state['items'].get(problem_key),
        })


def main():
    parser = argparse.ArgumentParser(description='Serve the local Daily Dashboard.')
    parser.add_argument('--port', type=int, default=int(os.environ.get('DASHBOARD_PORT', '8765')))
    args = parser.parse_args()
    connect_db().close()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), DashboardHandler)
    print(f'http://127.0.0.1:{args.port}/today.html', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
