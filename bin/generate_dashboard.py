#!/usr/bin/env python3
"""Compatibility source adapters used by the canonical 8766 refresh.

The executable v1 HTML/8765 runtime has been retired.  Keep importing this
module from ``refresh_dashboard.py`` until the source adapters are separated,
but do not render or serve ``today.html`` again.
"""
import csv
import datetime as dt
import glob
import hashlib
import html
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

BIN_DIR = Path(__file__).resolve().parent
if str(BIN_DIR) not in sys.path:
    sys.path.insert(0, str(BIN_DIR))
from job_feed import collect_job_leads, load_candidate_profile

BASE = Path(os.environ.get('DASHBOARD_HOME', Path(__file__).resolve().parent.parent))
OUT = BASE / 'today.html'
EVENT_DIR = BASE / 'event-plists'
EVENT_DIR.mkdir(parents=True, exist_ok=True)
TZ = ZoneInfo(os.environ.get('DASHBOARD_TIMEZONE', 'America/Los_Angeles'))
TODAY = dt.datetime.now(TZ).date()
UID = os.getuid()

NOTION_PAGE_ID = os.environ.get('NOTION_PAGE_ID', '35ea5189545c80cfa8c3c910e0265817')  # 变得更强
LINKS_PAGE_ID = os.environ.get('NOTION_LINKS_PAGE_ID', 'c56dc8e9-16e7-4f7a-a2b2-c04482452dd2')  # Links to Visit
NOTION_URL = f'https://www.notion.so/{NOTION_PAGE_ID}?source=copy_link'
WEEKLY_PLAN_TITLE = 'Road Map'
WEEKLY_PLAN_URL = NOTION_URL
WEEKLY_PLAN_ID = NOTION_PAGE_ID
BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search'
SOURCE_STATUS = {}

HARVARD_WEB = 'https://www.youtube.com/playlist?list=PLhQjrBD2T380xvFSUmToMMzERZ3qB5Ueu'
ABDUL_BARI = 'https://www.youtube.com/playlist?list=PLDN4rrl48XKpZkf03iYFl-O29szjTrs_O'
JOBRIGHT = 'https://jobright.ai/jobs/recommend'
PRINTING = 'https://mobile.eprintitsaas.com/app/add-files?locationid=657b709e3f26b41cad5395f5&domainname=sfpl'
SIMPLIFY = 'https://simplify.jobs/jobs'
NEETCODE = 'https://neetcode.io/roadmap'
GMAIL = 'https://mail.google.com/mail/u/0/#inbox'
SWE_INTERNS = 'https://github.com/speedyapply/2027-SWE-College-Jobs'
SWE_NEW_GRAD = 'https://github.com/SimplifyJobs/New-Grad-Positions'
SPEEDY_AI = 'https://github.com/speedyapply/2027-AI-College-Jobs'
CAREER_OPS = 'https://career-ops.org/'
CANDIDATE_PROFILE_PATH = BASE / 'data' / 'candidate_profile.json'

DEFAULT_LINKS = {
    'leetcode': 'https://leetcode.com/problemset/',
    'freecodecamp': 'https://www.freecodecamp.org/learn/',
    'free code camp': 'https://www.freecodecamp.org/learn/',
    'abdul': ABDUL_BARI,
    '算法': ABDUL_BARI,
    'harvard': HARVARD_WEB,
    'cs50': HARVARD_WEB,
    'jobright': JOBRIGHT,
    'neetcode': NEETCODE,
    'gmail': GMAIL,
}

TARGET_COPY = 'Target: Dec 2026 grad → 2027 New Grad full-time + Winter/Spring 2027 internship/co-op + Fall 2026 internship if eligible.'
TARGET_COPY_CN = '目标：26年12月毕业后，优先看 2027 New Grad 全职、Winter/Spring 2027 实习/Co-op，也看 Fall 2026 实习。'


def set_status(source, ok, detail):
    """Keep a short, safe status message for the generated page."""
    SOURCE_STATUS[source] = {'ok': bool(ok), 'detail': short(str(detail), 90)}


def run(cmd, timeout=45, source=None):
    try:
        output = subprocess.check_output(cmd, text=True, stderr=subprocess.STDOUT, timeout=timeout)
        if source:
            set_status(source, True, 'Updated')
        return output
    except subprocess.TimeoutExpired:
        if source:
            set_status(source, False, f'Timed out after {timeout}s')
        return ''
    except (subprocess.CalledProcessError, OSError) as exc:
        if source:
            set_status(source, False, f'{type(exc).__name__}: {exc}')
        return ''


def notion_page_url(page_id):
    return f'https://www.notion.so/{page_id.replace("-", "")}?source=copy_link'


def strip_html(s):
    return re.sub(r'<[^>]+>', '', s or '').strip()


def first_url(*parts):
    blob = ' '.join(p or '' for p in parts)
    m = re.search(r'https?://[^\s"<>]+', blob)
    return m.group(0) if m else None


def pick_url(title, location='', description='', html_link=''):
    u = first_url(location, description, html_link)
    if u:
        return u
    low = ' '.join([title or '', location or '', description or '']).lower()
    for k, v in DEFAULT_LINKS.items():
        if k in low:
            return v
    if any(k in low for k in ['weekly plan', 'according to weekly plan', 'accroding to weekly plan', 'roadmap', 'road map', '学习']):
        return WEEKLY_PLAN_URL
    return str(OUT)


def agenda_events():
    raw = run(
        ['gcalcli', 'agenda', 'today', 'tomorrow', '--tsv', '--details', 'all', '--nocolor'],
        source='Calendar',
    )
    events = []
    if not raw.strip():
        return events
    for r in csv.DictReader(raw.splitlines(), delimiter='\t'):
        if r.get('start_date') != TODAY.isoformat():
            continue
        title = r.get('title', '').strip()
        url = pick_url(title, r.get('location', ''), r.get('description', ''), r.get('html_link', ''))
        events.append({
            'id': r.get('id', ''),
            'title': title or '(untitled)',
            'start_date': r.get('start_date', ''),
            'start_time': r.get('start_time', ''),
            'end_date': r.get('end_date', ''),
            'end_time': r.get('end_time', ''),
            'location': strip_html(r.get('location', '')),
            'description': strip_html(r.get('description', '')),
            'calendar': r.get('calendar', ''),
            'url': url,
            'all_day': not bool(r.get('start_time')),
        })
    return events


def brave(query, n=6, freshness='pd', timeout=45):
    token = os.environ.get('BRAVE_API_KEY')
    if not token:
        set_status('Brave Search', False, 'BRAVE_API_KEY is not set')
        return []
    params = urllib.parse.urlencode({
        'q': query,
        'count': min(max(n, 1), 20),
        'freshness': freshness,
        'text_decorations': 'false',
        'safesearch': 'moderate',
    })
    req = urllib.request.Request(
        f'{BRAVE_SEARCH_URL}?{params}',
        headers={'Accept': 'application/json', 'X-Subscription-Token': token},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.load(resp)
        set_status('Brave Search', True, 'Updated')
    except Exception as exc:
        set_status('Brave Search', False, f'{type(exc).__name__}: {exc}')
        return []
    return [
        {
            'title': item.get('title', ''),
            'link': item.get('url', ''),
            'snippet': item.get('description', ''),
        }
        for item in (data.get('web') or {}).get('results', [])[:n]
    ]


def tech_news():
    return brave('biggest technology news today AI software chips big tech startups', 5, 'pd')


def discover_event_source(url):
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()
    if 'luma.com' in host:
        return 'Luma'
    if host.endswith('cmu.edu') and ('/sv/' in parsed.path.lower() or host.startswith('sv.')):
        return 'CMU-SV'
    if host.endswith('cmu.edu'):
        return 'CMU'
    if 'anthropic.com' in host:
        return 'Anthropic'
    if 'microsoft.com' in host:
        return 'Microsoft'
    if 'google.com' in host:
        return 'Google'
    if 'amazon.com' in host or 'aws.' in host:
        return 'AWS'
    if 'nvidia.com' in host:
        return 'NVIDIA'
    if 'apple.com' in host:
        return 'Apple'
    return 'Community'


def discover_event_is_bay_area(text):
    """Require an explicit Bay Area location instead of guessing from the source."""
    locations = (
        'bay area', 'silicon valley', 'san francisco', 'south bay', 'peninsula',
        'mountain view', 'sunnyvale', 'santa clara', 'san jose', 'san josé',
        'palo alto', 'redwood city', 'menlo park', 'cupertino', 'moffett field',
        'san mateo', 'foster city', 'fremont', 'oakland', 'berkeley',
    )
    return any(location in text for location in locations) or bool(re.search(r'\bSF\b', text, re.IGNORECASE))


def discover_event_is_relevant(item, source):
    title = html.unescape(item.get('title', ''))
    text = f"{title} {html.unescape(item.get('snippet', ''))}".lower()
    link = item.get('link', '').lower()
    if any(term in text for term in ('applications are now closed', 'event has ended', 'past event', 'watch sessions')):
        return False
    if any(term in text for term in ('pittsburgh', 'pgh')):
        return False
    if source == 'CMU' and any(term in text for term in ('calendar search', 'calendar feed')):
        return False
    if not discover_event_is_bay_area(text):
        return False
    company_sources = {'Anthropic', 'Microsoft', 'Google', 'AWS', 'NVIDIA', 'Apple'}
    event_signals = ('event', 'meetup', 'summit', 'conference', 'workshop', 'webinar', 'hackathon', 'session', 'developer day', 'gtc')
    if source in company_sources and not any(signal in title.lower() or signal in link for signal in event_signals):
        return False
    years = [int(year) for year in re.findall(r'\b(20\d{2})\b', text)]
    if years and max(years) < TODAY.year:
        return False
    month_names = {
        name.lower(): index for index, name in enumerate(
            ('January', 'February', 'March', 'April', 'May', 'June',
             'July', 'August', 'September', 'October', 'November', 'December'),
            start=1,
        )
    }
    if 'week of' not in title.lower():
        dated_title = re.search(
            r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,\s*(20\d{2}))?',
            title,
            re.IGNORECASE,
        )
        if dated_title:
            month_name, day, year = dated_title.groups()
            event_date = dt.date(int(year or TODAY.year), month_names[month_name.lower()], int(day))
            if event_date < TODAY:
                return False
    for month_name, year in re.findall(
        r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\b[^\n]{0,20}\b(20\d{2})\b',
        text,
    ):
        event_month = dt.date(int(year), month_names[month_name], 1)
        if event_month < TODAY.replace(day=1):
            return False
    return True


def discover_events():
    """Find Bay Area event candidates; the UI is read-only and links to sources."""
    queries = [
        f'San Francisco Bay Area Silicon Valley AI developer startup events Luma {TODAY.strftime("%B %Y")}',
        f'site:events.cmu.edu/sv OR site:sv.cmu.edu events career AI Silicon Valley {TODAY.strftime("%B %Y")}',
        f'site:anthropic.com/events OR site:developer.microsoft.com/reactor OR site:developer.apple.com/events "San Francisco" developer AI {TODAY.strftime("%B %Y")}',
        f'site:developers.google.com OR site:nvidia.com events "Silicon Valley" OR "San Jose" OR "San Francisco" {TODAY.strftime("%B %Y")}',
    ]
    seen, found = set(), []
    for query in queries:
        for item in brave(query, 5, 'pm', timeout=35):
            link = item.get('link', '').strip()
            title = item.get('title', '').strip()
            if not link.startswith('https://') or not title or link in seen:
                continue
            source = discover_event_source(link)
            if not discover_event_is_relevant(item, source):
                continue
            seen.add(link)
            found.append({**item, 'source': source})
            if len(found) >= 12:
                return found
    return found


def job_posts():
    # Search for Bruce's target window: Dec 2026 graduation -> 2027 NG/Intern/co-op.
    queries = [
        '2027 new grad software engineer full time application opened United States',
        'winter 2027 software engineering internship co-op application opened',
        'spring 2027 software engineer intern application opened',
        'December 2026 graduate software engineer new grad jobs',
        '2027 SDE intern new grad software engineer jobs apply',
        'site:greenhouse.io 2027 software engineer new grad OR intern',
        'site:jobs.lever.co 2027 software engineer new grad OR intern',
    ]
    seen, out = set(), []
    for q in queries:
        for item in brave(q, 5, 'pw', timeout=35):
            link = item.get('link', '')
            title = (item.get('title', '') + ' ' + item.get('snippet', '')).lower()
            if not link or link in seen:
                continue
            # Reduce senior/noise, but keep major index pages.
            if any(bad in title for bad in ['senior ', 'staff ', 'principal ', 'manager ']):
                continue
            seen.add(link)
            out.append(item)
            if len(out) >= 8:
                return out
    return out


def notion_req(path):
    tok = os.environ.get('NOTION_API_TOKEN')
    if not tok:
        set_status('Notion', False, 'NOTION_API_TOKEN is not set')
        return None
    req = urllib.request.Request('https://api.notion.com/v1' + path, headers={
        'Authorization': 'Bearer ' + tok,
        'Notion-Version': '2025-09-03',
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.load(resp)
        set_status('Notion', True, 'Updated')
        return data
    except Exception as exc:
        set_status('Notion', False, f'{type(exc).__name__}: {exc}')
        return None


def notion_post(path, payload):
    tok = os.environ.get('NOTION_API_TOKEN')
    if not tok:
        set_status('Notion', False, 'NOTION_API_TOKEN is not set')
        return None
    req = urllib.request.Request(
        'https://api.notion.com/v1' + path,
        data=json.dumps(payload).encode(),
        method='POST',
        headers={
            'Authorization': 'Bearer ' + tok,
            'Notion-Version': '2025-09-03',
            'Content-Type': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.load(resp)
        set_status('Notion', True, 'Updated')
        return data
    except Exception as exc:
        set_status('Notion', False, f'{type(exc).__name__}: {exc}')
        return None


def rich(arr):
    return ''.join(x.get('plain_text', '') for x in arr or [])


def rich_links(arr):
    links = []
    for x in arr or []:
        text = x.get('plain_text', '')
        url = x.get('href')
        link = (x.get('text') or {}).get('link') if isinstance(x.get('text'), dict) else None
        if isinstance(link, dict) and link.get('url'):
            url = link.get('url')
        if url:
            links.append({'title': text or url, 'url': url})
    return links


def block_text(b):
    t = b.get('type')
    v = b.get(t, {}) if isinstance(b.get(t), dict) else {}
    if t == 'child_page':
        return '📄 ' + v.get('title', '')
    if t in ['bookmark', 'embed', 'link_preview']:
        return '🔖 ' + (v.get('url') or '')
    if t == 'to_do':
        return ('☑ ' if v.get('checked') else '☐ ') + rich(v.get('rich_text'))
    if isinstance(v, dict) and 'rich_text' in v:
        return rich(v.get('rich_text'))
    return ''


def block_links(b):
    t = b.get('type')
    v = b.get(t, {}) if isinstance(b.get(t), dict) else {}
    links = []
    if v.get('url'):
        links.append({'title': block_text(b).replace('🔖 ', '') or v['url'], 'url': v['url']})
    if 'rich_text' in v:
        links.extend(rich_links(v.get('rich_text')))
    return links


def children(block_id):
    out, cursor = [], None
    while True:
        path = f'/blocks/{block_id}/children?page_size=100' + (f'&start_cursor={cursor}' if cursor else '')
        data = notion_req(path)
        if not data:
            break
        out += data.get('results', [])
        if not data.get('has_more'):
            break
        cursor = data.get('next_cursor')
    return out


def page_title(obj):
    for prop in (obj.get('properties') or {}).values():
        if prop.get('type') == 'title':
            return rich(prop.get('title'))
    return ''


def current_week_page():
    candidates = []
    data = notion_post('/search', {'query': 'Week', 'filter': {'property': 'object', 'value': 'page'}, 'page_size': 100})
    for obj in (data or {}).get('results', []):
        title = page_title(obj)
        m = re.search(r'Week\s+(\d+)\s+till\s+(\d{1,2})/(\d{1,2})', title, re.I)
        if not m:
            continue
        end = dt.date(TODAY.year, int(m.group(2)), int(m.group(3)))
        candidates.append((end, int(m.group(1)), title, obj['id']))
    if not candidates:
        return (WEEKLY_PLAN_TITLE, WEEKLY_PLAN_URL, WEEKLY_PLAN_ID)
    future = [c for c in candidates if c[0] >= TODAY]
    chosen = min(future or candidates, key=lambda x: (x[0], x[1]))
    return chosen[2], notion_page_url(chosen[3]), chosen[3]


def links_to_visit():
    sections = {'study': [], 'jobs': [], 'other': []}
    current = 'other'
    for b in children(LINKS_PAGE_ID):
        txt = block_text(b).strip()
        low = txt.lower()
        if 'study links' in low:
            current = 'study'
            continue
        if 'job hunt' in low:
            current = 'jobs'
            continue
        if low in ['ideas', 'done'] or 'leading conferences' in low:
            current = 'other'
        for l in block_links(b):
            title = txt
            title = re.sub(r'^[☐☑🔖]\s*', '', title).strip() or l['title']
            # Avoid private/secrets pages and keep URL lists useful.
            if any(secret in title.lower() for secret in ['api key', 'token value', 'secret access key']):
                continue
            sections[current].append({'title': title, 'url': l['url']})
    # Required/fallback links.
    required_study = [
        {'title': 'NeetCode Roadmap / 算法路线图', 'url': NEETCODE},
        {'title': 'Abdul Bari DSA / 算法题老师视频', 'url': ABDUL_BARI},
        {'title': 'Harvard CS50W Web Development / Harvard Web 开发课', 'url': HARVARD_WEB},
        {'title': 'Advanced TS tutorial', 'url': 'https://www.youtube.com/watch?v=lMfGp29Ht8c&list=PLIvujZeVDLMx040-j1W4WFs1BxuTGdI_b'},
        {'title': '30 Days Of Python - Asabeneh', 'url': 'https://github.com/Asabeneh/30-Days-Of-Python'},
        {'title': 'Project Based Learning', 'url': 'https://github.com/practical-tutorials/project-based-learning'},
        {'title': 'Build Your Own X', 'url': 'https://github.com/codecrafters-io/build-your-own-x'},
        {'title': 'Microsoft ML For Beginners', 'url': 'https://github.com/microsoft/ML-For-Beginners'},
        {'title': '500 AI/ML/DL/CV/NLP Projects', 'url': 'https://github.com/ashishpatel26/500-AI-Machine-learning-Deep-learning-Computer-vision-NLP-Projects-with-code'},
    ]
    required_jobs = [
        {'title': 'JobRight recommendations / 每天优先刷', 'url': JOBRIGHT},
        {'title': 'Simplify jobs', 'url': SIMPLIFY},
        {'title': 'SpeedyApply 2027 SWE Internships + New Grad', 'url': SWE_INTERNS},
        {'title': 'GitHub New Grad Positions', 'url': SWE_NEW_GRAD},
        {'title': 'SpeedyApply 2027 AI College Jobs', 'url': SPEEDY_AI},
        {'title': 'Career Ops / tailored application toolkit', 'url': CAREER_OPS},
    ]
    return {
        'study': dedupe_links(required_study + sections['study'])[:14],
        'jobs': dedupe_links(required_jobs + sections['jobs'])[:12],
    }


def dedupe_links(items):
    seen, out = set(), []
    for item in items:
        url = item.get('url')
        if not url or url in seen:
            continue
        seen.add(url)
        out.append(item)
    return out


def digest_item(block):
    """Preserve Notion checklist metadata instead of flattening it into text."""
    block_type = block.get('type')
    value = block.get(block_type, {}) if isinstance(block.get(block_type), dict) else {}
    if block_type == 'to_do':
        text = rich(value.get('rich_text')).strip()
        return {
            'text': text,
            'key': f'notion:{block.get("id", text)}',
            'checked': bool(value.get('checked')),
            'is_todo': True,
        }
    return {'text': block_text(block).strip(), 'is_todo': False}


def weekly_plan_digest():
    lines = []
    for b in children(WEEKLY_PLAN_ID)[:80]:
        item = digest_item(b)
        s = item['text']
        if s and len(s) < 240:
            lines.append(item)
        if len(lines) >= 14:
            break
    return lines


def high_level_notion_digest():
    lines = []
    for b in children(NOTION_PAGE_ID):
        item = digest_item(b)
        s = item['text']
        if not s:
            continue
        if any(x in s.lower() for x in ['token', 'secret', 'api key', 'access key']):
            continue
        if len(s) < 180:
            lines.append(item)
        if len(lines) >= 10:
            break
    return lines


def schedule_events(events):
    for p in glob.glob(str(EVENT_DIR / 'com.bruce.daily-dashboard.event.*.plist')):
        subprocess.run(['launchctl', 'bootout', f'gui/{UID}', p], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            os.remove(p)
        except OSError:
            pass
    now = dt.datetime.now(TZ)
    for i, e in enumerate(events):
        if e['all_day'] or not e['start_time']:
            continue
        hh, mm = map(int, e['start_time'].split(':')[:2])
        when = dt.datetime.combine(TODAY, dt.time(hh, mm), TZ)
        if when <= now:
            continue
        label = f'com.bruce.daily-dashboard.event.{TODAY.strftime("%Y%m%d")}.{hh:02d}{mm:02d}.{i}'
        plist = EVENT_DIR / f'{label}.plist'
        args = [str(BASE / 'bin/open_event.py'), e['title'], e['url']]
        plist.write_text(plist_xml(label, args, hh, mm), encoding='utf-8')
        subprocess.run(['launchctl', 'bootstrap', f'gui/{UID}', str(plist)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def plist_xml(label, args, hour, minute):
    arr = '\n'.join(f'    <string>{html.escape(a)}</string>' for a in args)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>{label}</string>
  <key>ProgramArguments</key><array>
{arr}
  </array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>{hour}</integer><key>Minute</key><integer>{minute}</integer></dict>
  <key>StandardOutPath</key><string>{BASE}/event.log</string>
  <key>StandardErrorPath</key><string>{BASE}/event.err</string>
</dict></plist>'''


def short(s, n=150):
    s = re.sub(r'\s+', ' ', s or '').strip()
    return s if len(s) <= n else s[:n - 1] + '…'


def stable_event_key(event):
    if event.get('id'):
        return event['id']
    identity = '|'.join([
        event.get('start_date', ''),
        event.get('start_time', ''),
        event.get('title', ''),
        event.get('calendar', ''),
    ])
    return 'event:' + hashlib.sha256(identity.encode('utf-8')).hexdigest()[:20]


def load_problem_bank():
    """Load the explicit problem queue; unrelated dashboard tasks never enter it."""
    path = BASE / 'data' / 'problem_bank.json'
    try:
        problems = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return []
    required = {'key', 'title', 'topic', 'difficulty', 'minutes', 'start_url', 'why', 'done_when', 'starter'}
    return [problem for problem in problems if isinstance(problem, dict) and required.issubset(problem)]


if __name__ == '__main__':
    raise SystemExit(
        'The legacy today.html/8765 runtime has been retired. '
        'Use bin/refresh_dashboard.py and http://127.0.0.1:8766/.'
    )
