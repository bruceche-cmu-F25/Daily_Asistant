import importlib.util
import io
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).resolve().parents[1] / 'bin' / 'generate_dashboard.py'
SPEC = importlib.util.spec_from_file_location('generate_dashboard', MODULE_PATH)
dashboard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dashboard)


class DashboardTests(unittest.TestCase):
    def setUp(self):
        dashboard.SOURCE_STATUS.clear()

    def test_pick_url_uses_calendar_html_link(self):
        self.assertEqual(
            dashboard.pick_url('Office hours', html_link='https://calendar.google.com/event?id=123'),
            'https://calendar.google.com/event?id=123',
        )

    def test_digest_item_preserves_notion_todo_state(self):
        block = {
            'id': 'block-1',
            'type': 'to_do',
            'to_do': {
                'checked': True,
                'rich_text': [{'plain_text': 'Ship the dashboard'}],
            },
        }
        self.assertEqual(
            dashboard.digest_item(block),
            {
                'text': 'Ship the dashboard',
                'key': 'notion:block-1',
                'checked': True,
                'is_todo': True,
            },
        )

    def test_event_key_is_stable_when_gcal_id_is_missing(self):
        event = {
            'start_date': '2026-07-14',
            'start_time': '10:00',
            'title': 'Focus block',
            'calendar': 'Work',
        }
        first = dashboard.stable_event_key(event)
        self.assertEqual(first, dashboard.stable_event_key(dict(event)))
        self.assertTrue(first.startswith('event:'))

    def test_problem_bank_is_the_complete_neetcode_150(self):
        problems = dashboard.load_problem_bank()

        self.assertEqual(len(problems), 150)
        self.assertEqual(problems[0]['key'], 'leetcode:contains-duplicate')
        self.assertEqual(problems[0]['topic'], 'Arrays & Hashing')
        self.assertIn('neetcode.io/problems/', problems[0]['start_url'])
        self.assertTrue(all('list=neetcode150' in problem['start_url'] for problem in problems))
        self.assertTrue(all(problem['key'].startswith('leetcode:') for problem in problems))
        self.assertTrue(all('source' not in problem for problem in problems))
        self.assertEqual(
            {difficulty: sum(problem['difficulty'] == difficulty for problem in problems)
             for difficulty in ('Easy', 'Medium', 'Hard')},
            {'Easy': 28, 'Medium': 101, 'Hard': 21},
        )
        self.assertEqual(len({problem['topic'] for problem in problems}), 18)

    def test_brave_uses_json_api_without_pi_skill(self):
        payload = {
            'web': {
                'results': [
                    {'title': 'Result', 'url': 'https://example.com', 'description': 'Summary'}
                ]
            }
        }

        def fake_urlopen(request, timeout):
            self.assertEqual(request.get_header('X-subscription-token'), 'test-token')
            return io.BytesIO(json.dumps(payload).encode('utf-8'))

        with mock.patch.dict(os.environ, {'BRAVE_API_KEY': 'test-token'}), mock.patch.object(
            dashboard.urllib.request, 'urlopen', side_effect=fake_urlopen
        ):
            results = dashboard.brave('dashboard test', n=1)

        self.assertEqual(
            results,
            [{'title': 'Result', 'link': 'https://example.com', 'snippet': 'Summary'}],
        )
        self.assertTrue(dashboard.SOURCE_STATUS['Brave Search']['ok'])

    def test_discover_events_tags_sources_and_deduplicates_links(self):
        results = [
            {'title': 'AI Builders', 'link': 'https://luma.com/ai-builders', 'snippet': 'Mountain View, Silicon Valley'},
            {'title': 'Duplicate', 'link': 'https://luma.com/ai-builders', 'snippet': 'Same event'},
            {'title': 'CMU-SV Seminar', 'link': 'https://events.cmu.edu/sv/event/seminar', 'snippet': 'Moffett Field'},
            {'title': 'Claude Builder Night', 'link': 'https://www.anthropic.com/events/builder', 'snippet': 'San Francisco'},
        ]

        with mock.patch.object(dashboard, 'brave', return_value=results):
            events = dashboard.discover_events()

        self.assertEqual([event['source'] for event in events], ['Luma', 'CMU-SV', 'Anthropic'])
        self.assertEqual(len(events), 3)
        self.assertTrue(all(event['link'].startswith('https://') for event in events))
        self.assertFalse(dashboard.discover_event_is_relevant(
            {'title': 'AI Events in New York City', 'snippet': 'In-person NYC event'},
            'Community',
        ))
        self.assertFalse(dashboard.discover_event_is_relevant(
            {'title': 'Pittsburgh AI Builders', 'snippet': 'Carnegie Mellon main campus'},
            'CMU',
        ))
        self.assertFalse(dashboard.discover_event_is_relevant(
            {'title': 'Google Cloud Next 2025', 'snippet': 'Watch the sessions'},
            'Anthropic',
        ))
        self.assertFalse(dashboard.discover_event_is_relevant(
            {'title': 'NVIDIA AI Software News', 'snippet': 'Announced at GTC San Jose', 'link': 'https://nvidia.com/blog/news'},
            'NVIDIA',
        ))
        past_date = dashboard.TODAY - dashboard.dt.timedelta(days=1)
        self.assertFalse(dashboard.discover_event_is_relevant(
            {'title': f'AI Night — San Francisco, {past_date.strftime("%B %-d, %Y")}', 'snippet': 'A startup event', 'link': 'https://example.com/event'},
            'Community',
        ))

    def test_subprocess_failure_is_visible_in_status(self):
        with mock.patch.object(
            dashboard.subprocess,
            'check_output',
            side_effect=subprocess.CalledProcessError(1, ['gcalcli']),
        ):
            self.assertEqual(dashboard.run(['gcalcli'], source='Calendar'), '')
        self.assertFalse(dashboard.SOURCE_STATUS['Calendar']['ok'])

    def test_run_daily_refreshes_canonical_snapshot_and_opens_v2(self):
        run_daily = MODULE_PATH.parent / 'run_daily.sh'
        with tempfile.TemporaryDirectory() as tmpdir:
            base = Path(tmpdir)
            bin_dir = base / 'bin'
            bin_dir.mkdir()
            fake_refresh = bin_dir / 'refresh_dashboard.py'
            fake_refresh.write_text(
                '#!/bin/zsh\nprint -r -- "$*" > "$DASHBOARD_HOME/refresh-args.txt"\n',
                encoding='utf-8',
            )
            fake_refresh.chmod(0o755)
            fake_open = bin_dir / 'fake_open'
            fake_open.write_text(
                '#!/bin/zsh\nprint -r -- "$*" > "$DASHBOARD_HOME/opened-url.txt"\n',
                encoding='utf-8',
            )
            fake_open.chmod(0o755)
            env = dict(
                os.environ,
                DASHBOARD_HOME=str(base),
                DASHBOARD_OPEN_BIN=str(fake_open),
            )
            result = subprocess.run(
                ['zsh', str(run_daily)],
                text=True,
                capture_output=True,
                env=env,
                check=False,
            )
            refresh_args = (base / 'refresh-args.txt').read_text(encoding='utf-8').strip()
            opened_url = (base / 'opened-url.txt').read_text(encoding='utf-8').strip()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), 'Dashboard snapshot updated for http://127.0.0.1:8766/')
        self.assertEqual(refresh_args, '--no-reminders')
        self.assertEqual(opened_url, 'http://127.0.0.1:8766/')


if __name__ == '__main__':
    unittest.main()
