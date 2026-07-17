import importlib.util
import io
import json
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).resolve().parents[1] / 'bin' / 'generate_dashboard.py'
SPEC = importlib.util.spec_from_file_location('generate_dashboard', MODULE_PATH)
dashboard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dashboard)
SERVER_PATH = MODULE_PATH.parent / 'dashboard_server.py'
SERVER_SPEC = importlib.util.spec_from_file_location('dashboard_server', SERVER_PATH)
dashboard_server = importlib.util.module_from_spec(SERVER_SPEC)
SERVER_SPEC.loader.exec_module(dashboard_server)


class DashboardTests(unittest.TestCase):
    def setUp(self):
        dashboard.SOURCE_STATUS.clear()

    def test_pick_url_uses_calendar_html_link(self):
        self.assertEqual(
            dashboard.pick_url('Office hours', html_link='https://calendar.google.com/event?id=123'),
            'https://calendar.google.com/event?id=123',
        )

    def test_neetcode_is_a_fixed_study_and_quick_action(self):
        source = MODULE_PATH.read_text(encoding='utf-8')
        self.assertIn("NEETCODE = 'https://neetcode.io/roadmap'", source)
        self.assertIn("{'title': 'NeetCode Roadmap / 算法路线图', 'url': NEETCODE}", source)
        self.assertIn("('NeetCode', 'Roadmap + patterns / 算法路线', NEETCODE, 'green')", source)

    def test_linkedin_link_has_brand_logo_and_fallback(self):
        brand_class, icon = dashboard.link_visual('https://www.linkedin.com/in/example/')
        self.assertEqual(brand_class, 'brand-linkedin')
        self.assertIn('>in</span>', icon)
        self.assertNotIn('<img', icon)
        self.assertNotIn('favicon.ico', icon)

    def test_gmail_is_a_quick_action_with_gmail_brand(self):
        brand_class, icon = dashboard.link_visual(dashboard.GMAIL)
        self.assertEqual(brand_class, 'brand-gmail')
        self.assertIn('>M</span>', icon)
        self.assertNotIn('<img', icon)
        source = MODULE_PATH.read_text(encoding='utf-8')
        self.assertIn("('Gmail', 'Inbox / 邮件', GMAIL, 'hot')", source)

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

    def test_coach_queue_is_the_complete_neetcode_150(self):
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

    def test_sqlite_problem_history_tracks_stuck_complete_and_reopen(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            connection = dashboard_server.connect_db(Path(tmpdir) / 'dashboard.db')
            try:
                dashboard_server.save_problem_progress(
                    connection, 'leetcode:two-sum', 'stuck', 'Two Sum', 'Arrays & Hashing',
                    'https://leetcode.com/problems/two-sum/',
                )
                stuck = dashboard_server.problem_state(connection)
                self.assertFalse(stuck['items']['leetcode:two-sum']['completed'])
                self.assertEqual(stuck['items']['leetcode:two-sum']['stuck_count'], 1)

                dashboard_server.save_problem_progress(
                    connection, 'leetcode:two-sum', 'completed', 'Two Sum', 'Arrays & Hashing',
                    'https://leetcode.com/problems/two-sum/', 'def two_sum(): pass',
                    'Remember the complement map.',
                )
                completed = dashboard_server.problem_state(connection)
                self.assertTrue(completed['items']['leetcode:two-sum']['completed'])
                self.assertEqual(completed['items']['leetcode:two-sum']['title'], 'Two Sum')
                self.assertEqual(completed['items']['leetcode:two-sum']['solution'], 'def two_sum(): pass')
                self.assertEqual(
                    completed['items']['leetcode:two-sum']['reflection'],
                    'Remember the complement map.',
                )
                self.assertEqual(completed['today_count'], 1)

                dashboard_server.save_problem_progress(
                    connection, 'leetcode:two-sum', 'reopened', 'Two Sum', 'Arrays & Hashing',
                    'https://leetcode.com/problems/two-sum/',
                )
                reopened = dashboard_server.problem_state(connection)
                self.assertFalse(reopened['items']['leetcode:two-sum']['completed'])
                self.assertEqual(reopened['today_count'], 0)
            finally:
                connection.close()

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

    def test_render_writes_complete_responsive_page_atomically(self):
        event = {
            'id': '',
            'title': 'Focus block',
            'start_date': '2026-07-14',
            'start_time': '10:00',
            'end_date': '2026-07-14',
            'end_time': '11:00',
            'location': '',
            'description': '',
            'calendar': 'Work',
            'url': '',
            'all_day': False,
        }
        todo = {'text': 'Ship it', 'key': 'notion:block-1', 'checked': True, 'is_todo': True}
        dashboard.set_status('Calendar', True, 'Updated')
        dashboard.set_status('Notion', True, 'Updated')
        dashboard.set_status('Brave Search', False, 'Missing key')

        with tempfile.TemporaryDirectory() as tmpdir:
            old_out = dashboard.OUT
            try:
                dashboard.OUT = Path(tmpdir) / 'today.html'
                event['url'] = str(dashboard.OUT)
                dashboard.render([event], [], [], {'study': [], 'jobs': []}, [todo], [todo])
                page = dashboard.OUT.read_text(encoding='utf-8')
                snapshot = json.loads(dashboard.dashboard_snapshot_path().read_text(encoding='utf-8'))
                self.assertFalse(dashboard.OUT.with_suffix('.html.tmp').exists())
            finally:
                dashboard.OUT = old_out

        self.assertIn('name="viewport"', page)
        self.assertIn('data-key="notion:block-1" data-initial="1"', page)
        self.assertIn('Brave Search</b> Missing key', page)
        self.assertIn('No action link / 无跳转链接', page)
        self.assertIn("localStorage.getItem('todo:'+cb.dataset.key)", page)
        self.assertIn('rel="noopener noreferrer"', page)
        self.assertNotIn('dashboard-shader', page)
        self.assertNotIn('class="crt-overlay"', page)
        self.assertNotIn('class="screen-vignette"', page)
        self.assertIn('class="retro-page"', page)
        self.assertIn('class="topbar"', page)
        self.assertIn('id="today" data-index="01 / TODAY"', page)
        self.assertNotIn('getContext("webgl"', page)
        self.assertNotIn('requestAnimationFrame', page)
        self.assertIn('prefers-reduced-motion: reduce', page)
        self.assertIn('class="link-icon"', page)
        self.assertIn('brand-linkedin', page)
        self.assertIn('brand-gmail', page)
        self.assertIn('.job-link-group .job-pill[class*="brand-"]', page)
        self.assertNotIn('favicon.ico', page)
        self.assertNotIn('removeBrokenImage', page)
        self.assertIn('border-radius: 30px / 20px', page)
        self.assertNotIn('transform: perspective(1800px)', page)
        self.assertNotIn('filter: contrast(1.025) saturate(.92) sepia(.045)', page)
        self.assertNotIn('vec2 crtCurve(vec2 uv)', page)
        self.assertNotIn('@keyframes lens-breathe', page)
        self.assertIn('backdrop-filter: none !important', page)
        self.assertIn('data-scroll-target="news"', page)
        self.assertNotIn('href="#news"', page)
        self.assertIn('target.scrollIntoView', page)
        self.assertIn('repeat(auto-fit, minmax(220px, 1fr))', page)
        self.assertIn('id="link-search-input"', page)
        self.assertIn('id="link-search-results"', page)
        self.assertIn('placeholder="Search links or problems…"', page)
        self.assertIn('const problemIndex = (() => {', page)
        self.assertIn('const linkIndex = [...problemIndex, ...savedLinkIndex]', page)
        self.assertIn('NeetCode 150 · ${problem.topic}', page)
        self.assertIn('entry.searchText.toLowerCase().includes(query)', page)
        self.assertIn('window.open(entry.url, "_blank", "noopener,noreferrer")', page)
        self.assertIn('id="coach" data-index="00 / NEETCODE 150"', page)
        self.assertIn('id="coach-tasks" type="application/json"', page)
        self.assertIn('id="coach-finish"', page)
        self.assertIn("'/api/problems'", page)
        self.assertIn('window.dashboardProblemStore', page)
        self.assertIn('完成并写心得', page)
        self.assertIn('href="https://neetcode.io/practice/practice/neetcode150"', page)
        self.assertIn('data-scroll-target="history"', page)
        self.assertIn('id="problem-complete-dialog"', page)
        self.assertIn('id="problem-solution"', page)
        self.assertIn('id="problem-reflection"', page)
        self.assertIn('id="history" data-index="HISTORY / 150"', page)
        self.assertIn('id="history-topic-grid"', page)
        self.assertIn('id="problem-history-list"', page)
        self.assertIn('id="roadmap-graph"', page)
        self.assertIn('class="roadmap-edges"', page)
        self.assertIn('id="roadmap-topic-nodes"', page)
        self.assertIn('id="roadmap-problem-list"', page)
        self.assertIn('const roadmapPositions = {', page)
        self.assertIn('"Arrays & Hashing": [440, 20]', page)
        self.assertLess(page.index('id="links"'), page.index('id="history"'))
        self.assertLess(page.index('id="history"'), page.index('<footer class="marquee"'))
        self.assertNotIn('window.dashboardCompletionStore', page)
        self.assertEqual(snapshot['events'][0]['title'], 'Focus block')
        self.assertEqual(snapshot['events'][0]['key'], dashboard.stable_event_key(event))
        self.assertEqual(snapshot['weekly'][0]['text'], 'Ship it')
        self.assertEqual(len(snapshot['quick_actions']), 8)

    def test_theme_has_safe_effects_without_full_page_compositing(self):
        root = MODULE_PATH.parents[1]
        css = (root / 'assets' / 'dashboard-retro.css').read_text(encoding='utf-8')
        js = (root / 'assets' / 'dashboard-retro.js').read_text(encoding='utf-8')

        self.assertIn('--safe-scanlines:', css)
        self.assertIn('background-image: var(--safe-scanlines)', css)
        self.assertIn('@keyframes status-pulse', css)
        self.assertIn('@keyframes marquee-drift', css)
        self.assertIn('text-shadow:', css)
        self.assertIn('--interaction-glow:', css)
        self.assertIn('box-shadow: var(--interaction-glow)', css)
        self.assertIn('transform: translateY(-1px)', css)

        animations = {
            value.strip().split()[0]
            for value in re.findall(r'animation:\s*([^;]+);', css)
            if not value.strip().startswith('none')
        }
        self.assertEqual(animations, {'status-pulse', 'marquee-drift'})

        for unsafe_css in (
            'position: fixed', 'inset: 0', 'will-change', 'mix-blend-mode',
            'backdrop-filter: blur', 'filter: blur', 'filter: contrast', 'perspective(',
        ):
            self.assertNotIn(unsafe_css, css)
        for unsafe_js in ('getContext("webgl"', 'requestAnimationFrame', 'dashboard-shader'):
            self.assertNotIn(unsafe_js, js)

    def test_run_daily_reports_generated_page_in_terminal(self):
        run_daily = MODULE_PATH.parent / 'run_daily.sh'
        with tempfile.TemporaryDirectory() as tmpdir:
            base = Path(tmpdir)
            bin_dir = base / 'bin'
            bin_dir.mkdir()
            fake_generator = bin_dir / 'generate_dashboard.py'
            fake_generator.write_text(
                '#!/bin/zsh\nprint -r -- "$*" > "$DASHBOARD_HOME/generator-args.txt"\n',
                encoding='utf-8',
            )
            fake_generator.chmod(0o755)
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
            generator_args = (base / 'generator-args.txt').read_text(encoding='utf-8').strip()
            opened_url = (base / 'opened-url.txt').read_text(encoding='utf-8').strip()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), f'Dashboard updated: {base}/today.html')
        self.assertEqual(generator_args, '--no-open')
        self.assertEqual(opened_url, 'http://127.0.0.1:8766/')


if __name__ == '__main__':
    unittest.main()
