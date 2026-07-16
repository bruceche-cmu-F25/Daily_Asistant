#!/usr/bin/env python3
import argparse
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
import time
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

HOME = Path.home()
BASE = Path(os.environ.get('DASHBOARD_HOME', Path(__file__).resolve().parent.parent))
OUT = BASE / 'today.html'
EVENT_DIR = BASE / 'event-plists'
EVENT_DIR.mkdir(parents=True, exist_ok=True)
ASSET_DIR = BASE / 'assets'
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
SIMPLIFY = 'https://simplify.jobs/jobs'
NEETCODE = 'https://neetcode.io/roadmap'
GMAIL = 'https://mail.google.com/mail/u/0/#inbox'
SWE_INTERNS = 'https://github.com/SimplifyJobs/Summer2026-Internships'
SWE_NEW_GRAD = 'https://github.com/SimplifyJobs/New-Grad-Positions'
SPEEDY_AI = 'https://github.com/speedyapply/2026-AI-College-Jobs'
SERVER_PORT = int(os.environ.get('DASHBOARD_PORT', '8765'))
SERVER_URL = f'http://127.0.0.1:{SERVER_PORT}/today.html'

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


def dashboard_snapshot_path():
    """Keep the structured snapshot beside the generated page's data directory."""
    return OUT.parent / 'data' / 'dashboard_snapshot.json'


def write_dashboard_snapshot(payload):
    """Atomically persist the React snapshot, retaining good data on source failure."""
    path = dashboard_snapshot_path()
    previous = {}
    try:
        previous = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        pass

    stale_sources = []
    fallback_fields = {
        'Calendar': ('events',),
        'Notion': ('links', 'weekly', 'notion', 'weekly_plan'),
        'Brave Search': ('jobs', 'news', 'discover_events'),
    }
    for source, fields in fallback_fields.items():
        if SOURCE_STATUS.get(source, {}).get('ok'):
            continue
        stale_sources.append(source)
        for field in fields:
            if field in previous:
                payload[field] = previous[field]

    payload['stale_sources'] = stale_sources
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(tmp, path)


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
        {'title': 'GitHub 2026 SWE Internships', 'url': SWE_INTERNS},
        {'title': 'GitHub New Grad Positions', 'url': SWE_NEW_GRAD},
        {'title': 'SpeedyApply 2026 AI College Jobs', 'url': SPEEDY_AI},
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


def esc(x):
    return html.escape(x or '')


BRAND_RULES = [
    ('linkedin.com', 'linkedin', 'in'),
    ('github.com', 'github', 'GH'),
    ('youtube.com', 'youtube', 'YT'),
    ('youtu.be', 'youtube', 'YT'),
    ('leetcode.com', 'leetcode', 'LC'),
    ('neetcode.io', 'neetcode', 'NC'),
    ('freecodecamp.org', 'freecodecamp', 'fC'),
    ('notion.so', 'notion', 'N'),
    ('jobright.ai', 'jobright', 'JR'),
    ('simplify.jobs', 'simplify', 'S'),
    ('coursera.org', 'coursera', 'C'),
    ('mail.google.com', 'gmail', 'M'),
    ('google.com', 'google', 'G'),
    ('joinhandshake.com', 'handshake', 'H'),
    ('workatastartup.com', 'yc', 'Y'),
    ('cloudflare.com', 'cloudflare', 'CF'),
    ('render.com', 'render', 'R'),
    ('neon.tech', 'neon', 'N'),
    ('elevenlabs.io', 'elevenlabs', '11'),
    ('inworld.ai', 'inworld', 'IW'),
    ('theodinproject.com', 'odin', 'O'),
    ('anthropic.com', 'anthropic', 'A'),
    ('techcrunch.com', 'techcrunch', 'TC'),
    ('reuters.com', 'reuters', 'R'),
    ('bloomberg.com', 'bloomberg', 'B'),
    ('cnbc.com', 'cnbc', 'CN'),
]


def link_visual(url):
    parsed = urllib.parse.urlparse(url or '')
    host = (parsed.hostname or '').lower()
    brand, mark = 'default', re.sub(r'[^a-z0-9]', '', host.split('.')[0])[:2].upper() or '↗'
    for hint, candidate, candidate_mark in BRAND_RULES:
        if host == hint or host.endswith('.' + hint):
            brand, mark = candidate, candidate_mark
            break
    # Keep every badge self-contained. Remote favicons are unreliable on file://
    # pages (some are blocked by SameSite/CORP and many hosts return 404).
    icon = f'<span class="link-icon" aria-hidden="true"><span class="link-fallback">{esc(mark)}</span></span>'
    return f'brand-{brand}', icon


def visual_anchor(css_class, url, label):
    brand_class, icon = link_visual(url)
    return (
        f'<a class="{esc(css_class)} {brand_class}" href="{esc(url)}" target="_blank" '
        f'rel="noopener noreferrer">{icon}<span class="link-label">{esc(label)}</span></a>'
    )


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


def ensure_dashboard_server():
    """Start the local persistence server if needed and return its URL."""
    health_url = f'http://127.0.0.1:{SERVER_PORT}/api/health'
    try:
        with urllib.request.urlopen(health_url, timeout=0.35) as response:
            if response.status == 200:
                return SERVER_URL
    except Exception:
        pass
    server_script = BASE / 'bin' / 'dashboard_server.py'
    try:
        subprocess.Popen(
            [sys.executable, str(server_script), '--port', str(SERVER_PORT)],
            cwd=str(BASE),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError:
        return str(OUT)
    for _ in range(12):
        time.sleep(0.1)
        try:
            with urllib.request.urlopen(health_url, timeout=0.25) as response:
                if response.status == 200:
                    return SERVER_URL
        except Exception:
            continue
    return str(OUT)


def render_digest(items):
    rendered = []
    for item in items:
        if item.get('is_todo'):
            initial = '1' if item.get('checked') else '0'
            rendered.append(
                '<li class="check-item"><label class="check-row">'
                f'<input type="checkbox" data-key="{esc(item.get("key"))}" '
                f'data-initial="{initial}">'
                f'<span>{esc(item.get("text"))}</span></label></li>'
            )
        else:
            rendered.append(f'<li>{esc(item.get("text"))}</li>')
    return ''.join(rendered)


def render_source_status():
    chips = []
    for source in ('Calendar', 'Notion', 'Brave Search'):
        state = SOURCE_STATUS.get(source, {'ok': False, 'detail': 'Not checked'})
        kind = 'ok' if state['ok'] else 'warn'
        symbol = '●' if state['ok'] else '△'
        chips.append(
            f'<span class="status-chip {kind}"><i>{symbol}</i><b>{esc(source)}</b> '
            f'{esc(state["detail"])}</span>'
        )
    return ''.join(chips)


def event_action_html(event):
    if event.get('url') == str(OUT):
        return '<span class="no-link">No action link / 无跳转链接</span>'
    return visual_anchor('btn', event.get('url'), 'Open / 开始做')


def render(events, news, jobs, links, weekly, notion, discovered_events=None):
    discovered_events = discovered_events or []
    theme_css = (ASSET_DIR / 'dashboard-retro.css').read_text(encoding='utf-8')
    theme_js = (ASSET_DIR / 'dashboard-retro.js').read_text(encoding='utf-8')
    task_count = sum(1 for item in weekly + notion if item.get('is_todo'))
    sources_online = all(SOURCE_STATUS.get(name, {}).get('ok') for name in ('Calendar', 'Notion', 'Brave Search'))
    sync_label = 'ALL SYSTEMS ONLINE' if sources_online else 'DEGRADED MODE'
    event_cards = ''.join(f'''
      <article class="event {'allday' if e['all_day'] else ''}">
        <label class="check-row"><input type="checkbox" data-key="{esc(stable_event_key(e))}" data-initial="0"><span><b>{esc(e['start_time'] or 'All day')}</b> · {esc(e['title'])}</span></label>
        <div class="meta">{esc(e['calendar'])}</div>
        {event_action_html(e)}
      </article>''' for e in events)

    study_html = ''.join(visual_anchor('pill', x['url'], short(x['title'], 54)) for x in links['study'])
    job_groups = {
        'Daily first / 每天先刷': [],
        'Curated lists / 岗位列表': [],
        'Platforms / 平台入口': [],
        'Profile & prep / 简历和准备': [],
    }
    for x in links['jobs']:
        title = x['title']
        low = title.lower()
        if 'jobright' in low:
            job_groups['Daily first / 每天先刷'].append(x)
        elif any(k in low for k in ['github', 'speedy', 'tiktok', '2026 tech', 'new grad positions']):
            job_groups['Curated lists / 岗位列表'].append(x)
        elif any(k in low for k in ['simplify', 'handshake', 'yc', 'avisajob', 'linkedin']):
            job_groups['Platforms / 平台入口'].append(x)
        else:
            job_groups['Profile & prep / 简历和准备'].append(x)
    job_links_html = ''.join(
        f'<div class="job-link-group"><h4>{esc(group)}</h4><div class="job-link-row">' +
        ''.join(visual_anchor('job-pill', item['url'], short(item['title'], 46)) for item in items) +
        '</div></div>'
        for group, items in job_groups.items() if items
    )
    weekly_html = render_digest(weekly)
    notion_html = render_digest(notion)
    jobs_html = ''.join(f'<li class="job">{visual_anchor("card-link", j.get("link"), short(j.get("title"), 98))}<p>{esc(short(j.get("snippet"), 118))}</p></li>' for j in jobs)
    news_html = ''.join(f'<li class="news">{visual_anchor("card-link", n.get("link"), short(n.get("title"), 92))}<p>{esc(short(n.get("snippet"), 95))}</p></li>' for n in news)
    source_status_html = render_source_status()
    coach_tasks = load_problem_bank()
    coach_tasks_json = json.dumps(coach_tasks, ensure_ascii=False).replace('</', '<\\/')
    quick_actions = [
        ('Gmail', 'Inbox / 邮件', GMAIL, 'hot'),
        ('LeetCode', '刷题 + 保持手感', 'https://leetcode.com/problemset/', 'blue'),
        ('NeetCode', 'Roadmap + patterns / 算法路线', NEETCODE, 'green'),
        ('freeCodeCamp', 'Full-stack practice', 'https://www.freecodecamp.org/learn/', 'blue'),
        ('JobRight', '投递 / 每天先看推荐', JOBRIGHT, 'hot'),
        ('This Week', f'{WEEKLY_PLAN_TITLE} - 具体计划', WEEKLY_PLAN_URL, 'green'),
        ('DSA Video', 'Abdul Bari 算法老师', ABDUL_BARI, 'purple'),
        ('Harvard Web', 'CS50W Web Development', HARVARD_WEB, 'purple'),
    ]
    quick_actions_html = ''
    for title, sub, url, kind in quick_actions:
        brand_class, icon = link_visual(url)
        quick_actions_html += (
            f'<a class="bigbtn {kind} {brand_class}" href="{esc(url)}" target="_blank" rel="noopener noreferrer">'
            f'{icon}<b>{esc(title)}</b><span class="link-subtitle">{esc(sub)}</span></a>'
        )
    quiet_links = [
        ('ElevenLabs billing', 'https://elevenlabs.io/app/subscription/creative', 'billing', 'Billing'),
        ('Inworld TTS billing', 'https://platform.inworld.ai/workspaces/vibrant-laurel-4090/settings/billing?view=tts', 'billing', 'Billing'),
        ('IdeaBrowser ideas', 'https://www.ideabrowser.com/hub/ideas/browse', 'ideas', 'Ideas'),
        ('TrustMRR search', 'https://trustmrr.com/search', 'ideas', 'Ideas'),
        ('Handshake job 11130472', 'https://app.joinhandshake.com/job-search/11130472?page=1&per_page=25', 'jobs', 'Jobs'),
        ('LinkedIn profile', 'https://www.linkedin.com/in/chi-cheng921/', 'profile', 'Profile'),
        ('GitHub profile', 'https://github.com/bruceche-cmu-F25', 'profile', 'Profile'),
        ('The Odin Project', 'https://www.theodinproject.com/paths/full-stack-javascript', 'study', 'Study'),
        ('Render deploys - NightyNight', 'https://dashboard.render.com/web/srv-d81v651kh4rs73bnioeg/deploys/dep-d8pin2m8mjfs739798eg?r=2026-06-17%4023%3A18%3A38%7E2026-06-17%4023%3A22%3A51', 'infra', 'Infra'),
        ('Cloudflare R2 nightynight-audio', 'https://dash.cloudflare.com/9302b8b9991c726a88701857fd82f7ae/r2/default/buckets/nightynight-audio?prefix=sounds%2F', 'infra', 'Infra'),
        ('NightyNight app', 'https://nightynight-1.onrender.com/', 'infra', 'App'),
        ('Neon SQL editor', 'https://console.neon.tech/app/projects/dark-bird-95700205/branches/br-fragrant-heart-aqq8z4bv/sql-editor?database=neondb', 'infra', 'Infra'),
        ('Boson Higgs Audio v2.5', 'https://www.boson.ai/blog/higgs-audio-v2.5', 'research', 'Research'),
        ('f.inc', 'https://f.inc/', 'research', 'Research'),
    ]
    quiet_links_html = ''
    for title, url, kind, label in quiet_links:
        brand_class, icon = link_visual(url)
        quiet_links_html += (
            f'<a class="quiet-card {esc(kind)} {brand_class}" href="{esc(url)}" target="_blank" rel="noopener noreferrer">'
            f'{icon}<em>{esc(label)}</em><b>{esc(title)}</b><span class="link-url">{esc(url)}</span></a>'
        )
    now = dt.datetime.now(TZ).strftime('%Y-%m-%d %H:%M')

    write_dashboard_snapshot({
        'date': TODAY.isoformat(),
        'generated_at': dt.datetime.now(TZ).isoformat(timespec='seconds'),
        'weekly_plan': {'title': WEEKLY_PLAN_TITLE, 'url': WEEKLY_PLAN_URL},
        'metrics': {
            'calendar_events': len(events),
            'notion_tasks': task_count,
            'fresh_jobs': len(jobs),
        },
        'source_status': [
            {
                'name': source,
                'ok': bool(SOURCE_STATUS.get(source, {}).get('ok')),
                'detail': SOURCE_STATUS.get(source, {}).get('detail', 'Not checked'),
            }
            for source in ('Calendar', 'Notion', 'Brave Search')
        ],
        'events': [{**event, 'key': stable_event_key(event)} for event in events],
        'links': links,
        'weekly': weekly,
        'notion': notion,
        'jobs': jobs,
        'news': news,
        'discover_events': discovered_events,
        'job_groups': job_groups,
        'quick_actions': [
            {'title': title, 'subtitle': subtitle, 'url': url, 'kind': kind}
            for title, subtitle, url, kind in quick_actions
        ],
        'quiet_links': [
            {'title': title, 'url': url, 'kind': kind, 'label': label}
            for title, url, kind, label in quiet_links
        ],
        'target_copy': TARGET_COPY,
        'target_copy_cn': TARGET_COPY_CN,
    })

    document = f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Daily Dashboard {TODAY}</title><link rel="icon" href="assets/todo-favicon.svg" type="image/svg+xml"><link rel="alternate icon" href="assets/todo-favicon.svg">
<style>
:root{{--bg:#f5efe4;--card:#fffaf1;--ink:#20262f;--muted:#6f766f;--navy:#071225;--navy2:#0d1b2f;--teal:#1f8a7a;--green:#2d7d4f;--red:#a9444b;--gold:#b08a2e;--line:#e3d7c4;--soft:#fbf6ed}}
*{{box-sizing:border-box}}body{{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;max-width:1220px;margin:0 auto;padding:24px 22px 44px;background:var(--bg);color:var(--ink);line-height:1.48}}body:before{{content:"";position:fixed;inset:0;z-index:-1;background:linear-gradient(135deg,rgba(7,18,37,.96),rgba(13,27,47,.92)),repeating-linear-gradient(45deg,transparent 0 58px,rgba(45,125,79,.38) 60px 66px,transparent 69px 126px),repeating-linear-gradient(-45deg,transparent 0 86px,rgba(169,68,75,.30) 88px 94px,transparent 96px 160px),repeating-linear-gradient(45deg,transparent 0 118px,rgba(31,138,122,.34) 120px 124px,transparent 128px 210px),repeating-linear-gradient(-45deg,transparent 0 150px,rgba(176,138,46,.28) 152px 157px,transparent 160px 240px);opacity:.92}}h1{{font-size:42px;margin:0 0 8px;letter-spacing:-.03em}}h2{{font-size:25px;margin:0 0 12px;letter-spacing:-.015em}}h3{{font-size:18px;margin:18px 0 8px}}section,.side{{background:rgba(255,250,241,.94);border:1px solid rgba(227,215,196,.9);border-radius:24px;padding:22px;margin:0 0 18px;box-shadow:0 18px 46px #0000001a;backdrop-filter:blur(10px)}}.hero{{background:rgba(7,18,37,.82);color:#fffaf1;border-color:rgba(255,255,255,.14);margin-bottom:18px}}.hero p{{color:#e9ddcb}}.sub{{color:var(--muted);margin:4px 0}}.status-row{{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}}.status-chip{{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:999px;font-size:12px;background:#ffffff12;border:1px solid #ffffff24;color:#e9ddcb}}.status-chip i{{font-style:normal}}.status-chip.ok i{{color:#78d6a8}}.status-chip.warn i{{color:#f1b36a}}.page{{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;align-items:start}}.main{{min-width:0}}.side{{position:sticky;top:18px;padding:18px;background:rgba(255,250,241,.91)}}.side h2{{font-size:21px}}.grid{{display:grid;grid-template-columns:1.05fr .95fr;gap:18px}}.event{{padding:16px;border-radius:18px;background:#fff7e8;margin:12px 0;border:1px solid #ead9bd}}.check-row{{display:flex;gap:10px;align-items:flex-start;font-size:18px;cursor:pointer}}input[type=checkbox]{{width:20px;height:20px;flex:0 0 20px;margin-top:3px;accent-color:var(--green)}}input:checked+span{{text-decoration:line-through;color:#7b817a}}.check-item{{list-style:none;margin:8px 0}}.check-item .check-row{{font-size:16px}}.meta{{color:var(--muted);font-size:13px;margin:6px 0 10px}}.no-link{{display:inline-block;color:var(--muted);font-size:13px}}a{{color:#315f56;text-decoration:none}}a:hover{{text-decoration:underline}}a:focus-visible,input:focus-visible{{outline:3px solid #d1953f;outline-offset:3px}}.btn{{display:inline-block;background:#315f56;color:#fffaf1;padding:9px 13px;border-radius:12px;font-weight:750}}.btn:hover{{text-decoration:none;background:#254b44}}.pillbox{{display:flex;flex-wrap:wrap;gap:10px}}.pill{{display:inline-block;border:1px solid #d7c8b2;background:#fff4df;border-radius:999px;padding:9px 13px;font-weight:700;color:#315f56}}.pill.important{{background:#fff1ea;border-color:#e6b9aa;color:#8b3d34}}.job-link-group{{background:#fff8eb;border:1px solid #ead9bd;border-radius:18px;padding:14px;margin:12px 0}}.job-link-group h4{{font-size:15px;margin:0 0 10px;color:#6f4b31}}.job-link-row{{display:flex;flex-wrap:wrap;gap:9px}}.job-pill{{display:inline-block;border-radius:999px;padding:9px 12px;font-weight:750;background:#fff1ea;border:1px solid #e6b9aa;color:#8b3d34}}.job-link-group:nth-of-type(2) .job-pill{{background:#eef7ed;border-color:#c9dfc3;color:#2d5f3d}}.job-link-group:nth-of-type(3) .job-pill{{background:#eef3f8;border-color:#c8d6e2;color:#34547a}}.job-link-group:nth-of-type(4) .job-pill{{background:#f7eef3;border-color:#dfc8d5;color:#6e4159}}.job,.news{{list-style:none;padding:14px;border-radius:18px;margin:10px 0;background:#fff8eb;border:1px solid #ead9bd}}.job a{{font-size:19px;font-weight:850;color:#7e373b}}.news a{{font-size:18px;font-weight:800;color:#315f56}}.job p,.news p{{margin:6px 0 0;color:#5f655f}}.callout{{border-left:5px solid var(--gold);padding-left:14px;font-size:17px}}.cn{{font-weight:750}}ul.clean{{padding-left:20px}}.quick{{display:grid;grid-template-columns:1fr;gap:11px}}.quiet-grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}.quiet-card{{display:block;padding:12px 13px;border-radius:14px;background:#f7efe2;border:1px solid #e3d7c4;color:#59615b;position:relative;border-left-width:6px}}.quiet-card em{{display:inline-block;font-style:normal;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6f766f;background:#ffffff9c;border-radius:999px;padding:2px 7px;margin-bottom:7px}}.quiet-card b{{display:block;font-size:14px;color:#3f4842;margin-bottom:3px}}.quiet-card span{{display:block;font-size:11px;color:#7b817a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}.quiet-card:hover{{text-decoration:none;background:#fff4df}}.quiet-card.billing{{border-left-color:#b08a2e;background:#fbf1da}}.quiet-card.ideas{{border-left-color:#1f8a7a;background:#edf7f3}}.quiet-card.jobs{{border-left-color:#a9444b;background:#fff0eb}}.quiet-card.profile{{border-left-color:#34547a;background:#eef3f8}}.quiet-card.study{{border-left-color:#2d7d4f;background:#eef7ed}}.quiet-card.infra{{border-left-color:#59606b;background:#f1f2f2}}.quiet-card.research{{border-left-color:#7a4f61;background:#f7eef3}}.bigbtn{{min-height:82px;border-radius:18px;padding:14px 15px;color:#fffaf1;text-decoration:none;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 10px 24px #00000014;transform:translateY(0);transition:.12s ease;border:1px solid #ffffff1f}}.bigbtn:hover{{text-decoration:none;transform:translateY(-1px);filter:brightness(1.03)}}.bigbtn b{{font-size:20px;line-height:1.05}}.bigbtn span{{font-size:13px;opacity:.9;margin-top:8px}}.bigbtn.hot{{background:linear-gradient(135deg,#8c343b,#bd6f43)}}.bigbtn.blue{{background:linear-gradient(135deg,#233b67,#2f7970)}}.bigbtn.green{{background:linear-gradient(135deg,#285b42,#5d7e42)}}.bigbtn.purple{{background:linear-gradient(135deg,#44345f,#7a4f61)}}.priority{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:14px}}.priority div{{background:#ffffff12;border:1px solid #ffffff24;border-radius:16px;padding:14px}}.priority b{{display:block;font-size:17px;color:#fffaf1}}@media(max-width:960px){{.page{{grid-template-columns:1fr}}.side{{position:static;order:-1}}.quick{{grid-template-columns:1fr 1fr}}.priority,.grid{{grid-template-columns:1fr}}h1{{font-size:34px}}}}@media(max-width:640px){{body{{padding:12px 10px 30px}}section,.side{{border-radius:18px;padding:17px}}h1{{font-size:30px}}h2{{font-size:22px}}.quick,.quiet-grid{{grid-template-columns:1fr}}.status-chip{{max-width:100%}}}}@media(prefers-reduced-motion:reduce){{*{{scroll-behavior:auto!important;transition:none!important}}}}
{theme_css}
</style></head><body>
<div class="retro-page"><header class="topbar"><div class="brand"><span class="brand-mark"></span><span>Bruce / Daily OS</span></div><nav class="topnav" aria-label="Dashboard sections"><button type="button" data-scroll-target="today">Today</button><button type="button" data-scroll-target="plan">Plan</button><a href="https://neetcode.io/practice/practice/neetcode150" target="_blank" rel="noopener noreferrer">NeetCode ↗</a><button type="button" data-scroll-target="history">History</button><button type="button" data-scroll-target="jobs">Jobs</button><button type="button" data-scroll-target="news">Signal</button></nav><div class="link-search" role="search"><span class="search-glyph" aria-hidden="true">⌕</span><input id="link-search-input" type="search" placeholder="Search links or problems…" aria-label="Search dashboard links and NeetCode problems" aria-controls="link-search-results" aria-expanded="false" autocomplete="off" spellcheck="false"><kbd>⌘K</kbd><div id="link-search-results" class="search-results" role="listbox" hidden></div></div><div class="sync-state"><span>{esc(sync_label)} · <b id="dashboard-clock">--:--</b></span></div></header>
<section class="hero"><div class="hero-copy"><p class="eyebrow">Personal operating system // {TODAY}</p><h1>Daily<br><span>Control</span></h1><p class="hero-lede">把今天真正要做的事情放到同一个控制台：先完成 Calendar，再推进投递，最后沿着本周路线学习。</p><p class="hero-meta">Generated {esc(now)} · <a href="{esc(NOTION_URL)}" target="_blank" rel="noopener noreferrer">Notion / 变得更强</a> · <a href="{esc(WEEKLY_PLAN_URL)}" target="_blank" rel="noopener noreferrer">{esc(WEEKLY_PLAN_TITLE)}</a></p></div><div class="hero-readout"><div class="metrics"><div class="metric"><b>{len(events):02d}</b><span>Calendar events</span></div><div class="metric"><b>{task_count:02d}</b><span>Notion tasks</span></div><div class="metric"><b>{len(jobs):02d}</b><span>Fresh jobs</span></div></div><div class="priority"><div><b>01 / Ship</b><span>按 Calendar 做，不空刷网页</span></div><div><b>02 / Apply</b><span>2027 NG + internship / co-op</span></div><div><b>03 / Learn</b><span>NeetCode + current week plan</span></div></div><div class="status-row" aria-label="Data source status">{source_status_html}</div></div></section>

<section class="coach" id="coach" data-index="00 / NEETCODE 150"><div class="coach-head"><div><p class="section-tag">Problem coach</p><h2>Do Now / 现在刷这题</h2><p class="coach-intro">一次只做一道 NeetCode 150。完成后记录 solution 和心得，全部只保存在这台 Mac。</p></div><div class="coach-progress"><b id="coach-done-count">0</b><span>problems today</span></div></div><div class="time-budget" role="group" aria-label="Available problem-solving time"><span>我现在有</span><button type="button" data-minutes="15">15 min</button><button type="button" data-minutes="30" class="active">30 min</button><button type="button" data-minutes="45">45 min</button><button type="button" data-minutes="60">60 min</button></div><article class="coach-card" id="coach-card"><div class="coach-card-top"><span class="coach-source" id="coach-source">Topic</span><span class="coach-difficulty" id="coach-difficulty">Easy</span><span class="coach-duration" id="coach-duration">30 min</span></div><h3 id="coach-title">正在选择下一道题…</h3><p class="coach-why" id="coach-why"></p><div class="coach-contract"><span>DONE WHEN</span><p id="coach-done-when"></p></div><div class="coach-actions"><a class="coach-start" id="coach-start" href="#">Open problem / 开始刷题</a><button type="button" class="coach-stuck" id="coach-stuck" aria-expanded="false">不会做 / 卡住了</button><button type="button" class="coach-finish" id="coach-finish">完成并写心得</button><button type="button" class="coach-skip" id="coach-skip">换一题</button></div><div class="coach-help" id="coach-help" hidden><p class="coach-help-label">IF STUCK / 按顺序，不要立刻看答案</p><ol id="coach-help-steps"></ol><a id="coach-help-link" href="https://neetcode.io/practice/practice/neetcode150" target="_blank" rel="noopener noreferrer">打开 NeetCode 150 ↗</a></div></article><div class="coach-empty" id="coach-empty" hidden><b>NeetCode 150 已经全部完成。</b><span>去 History 复习旧题和心得。</span></div><div class="coach-next"><span>UP NEXT</span><ol id="coach-next-list"></ol></div><div class="roadmap" aria-labelledby="roadmap-title"><div class="roadmap-head"><div><p class="section-tag">All problems</p><h3 id="roadmap-title">NeetCode 150 / 路线图</h3></div><p>选择 Topic 查看完整题单；节点数字会随本地完成记录更新。</p></div><div class="roadmap-scroll"><div class="roadmap-canvas" id="roadmap-graph"><svg class="roadmap-edges" viewBox="0 0 1060 850" aria-hidden="true"><path d="M530 86 C530 104 330 102 330 120 M530 86 C530 104 730 102 730 120 M330 186 C330 205 140 201 140 220 M330 186 C330 205 350 201 350 220 M330 186 C330 205 690 201 690 220 M140 286 C140 306 530 300 530 320 M690 286 C690 306 530 300 530 320 M530 386 C530 406 130 400 130 420 M530 386 C530 406 340 400 340 420 M530 386 C530 406 760 400 760 420 M340 486 C340 515 110 515 110 550 M340 486 C340 515 300 515 300 550 M340 486 C340 515 490 515 490 550 M760 486 C760 515 680 515 680 550 M760 486 C760 515 870 515 870 550 M680 616 C680 641 670 641 670 670 M870 616 C870 641 670 641 670 670 M870 616 C870 641 880 641 880 670 M670 736 C670 758 780 750 780 770 M880 736 C880 758 780 750 780 770" /></svg><div id="roadmap-topic-nodes"></div></div></div><section class="roadmap-list-panel" aria-live="polite"><div class="roadmap-list-head"><div><span>SELECTED TOPIC</span><h4 id="roadmap-list-title">Arrays &amp; Hashing</h4></div><b id="roadmap-list-count">0 / 9</b></div><ol class="roadmap-problem-list" id="roadmap-problem-list"></ol></section></div><script id="coach-tasks" type="application/json">{coach_tasks_json}</script></section>

<dialog class="problem-dialog" id="problem-complete-dialog" aria-labelledby="problem-dialog-title"><form id="problem-complete-form"><div class="problem-dialog-head"><div><p class="section-tag">Save attempt</p><h2 id="problem-dialog-title">完成题目</h2></div><button type="button" id="problem-dialog-close" aria-label="Close">×</button></div><label for="problem-solution">Solution / 你的解法</label><textarea id="problem-solution" rows="10" placeholder="贴代码、伪代码，或写关键步骤…" spellcheck="false"></textarea><label for="problem-reflection">Comment / 心得</label><textarea id="problem-reflection" rows="5" placeholder="哪里卡住？核心模式是什么？下次要注意什么？"></textarea><div class="problem-dialog-actions"><button type="button" id="problem-dialog-cancel">取消</button><button type="submit" id="problem-save-complete">保存并完成</button></div></form></dialog>

<div class="page"><main class="main">
<section id="today" data-index="01 / TODAY"><p class="section-tag">Execution queue</p><h2>Calendar / 今天该做什么</h2>{event_cards or '<p>No events today.</p>'}</section>

<section id="plan" data-index="02 / PLAN"><p class="section-tag">Learning trajectory</p><h2>Notion Plan / 学习路线</h2><p><a class="btn" href="{esc(WEEKLY_PLAN_URL)}" target="_blank" rel="noopener noreferrer">Open current week: {esc(WEEKLY_PLAN_TITLE)}</a></p><div class="grid"><div><h3>Current week checklist</h3><ul class="clean">{weekly_html or '<li>No current week content found.</li>'}</ul></div><div><h3>变得更强 top notes</h3><ul class="clean">{notion_html or '<li>No notes found.</li>'}</ul></div></div><h3>Study links / 学习入口</h3><div class="pillbox">{study_html}</div></section>

<section id="jobs" data-index="03 / JOBS"><p class="section-tag">Opportunity radar</p><h2>Job Hunt / 投简历入口</h2><p class="callout"><b>{esc(TARGET_COPY)}</b><br><span class="cn">{esc(TARGET_COPY_CN)}</span></p><h3>Open these first / 先打开这些</h3><div class="pillbox">{job_links_html}</div><h3>Fresh-ish openings scan / 最近岗位扫描</h3><ol>{jobs_html or '<li>No job results from Brave today.</li>'}</ol></section>

<section id="news" data-index="04 / SIGNAL"><p class="section-tag">Industry signal</p><h2>Tech News / 科技圈速览</h2><p class="sub">Short scan only. 看标题即可，除非和 AI / jobs / full-stack 直接相关。</p><ol>{news_html or '<li>No Brave results.</li>'}</ol></section>

<section id="links" data-index="05 / ARCHIVE"><p class="section-tag">Utility archive</p><h2>Lower Priority / 低优先级链接</h2><p class="sub">需要时再打开。Jobs · Study · Infra · Billing · Ideas · Profile · Research。</p><div class="quiet-grid">{quiet_links_html}</div></section>
</main><aside class="side"><p class="section-tag">Quick launch</p><h2>Start Here</h2><p class="side-copy">高频入口 / click one thing and act</p><div class="quick">{quick_actions_html}</div></aside></div>
<section class="problem-history" id="history" data-index="HISTORY / 150"><div class="history-head"><div><p class="section-tag">Local problem database</p><h2>History / 刷题记录</h2><p>按 Topic 看 NeetCode 150 进度，展开每道题即可复习 solution 和心得。</p></div><div class="history-stats" aria-label="Problem history summary"><div><b id="history-completed">0</b><span>completed</span></div><div><b id="history-total">150</b><span>total</span></div><div><b id="history-stuck">0</b><span>stuck taps</span></div><div><b id="history-today">0</b><span>today</span></div></div></div><div class="history-topic-grid" id="history-topic-grid" aria-label="Progress by topic"></div><div class="problem-history-list" id="problem-history-list"></div><p class="problem-history-empty" id="problem-history-empty">还没有完成记录。完成第一道题后会出现在这里。</p></section>
<footer class="marquee" aria-hidden="true"><span>calendar synchronized / notion loaded / opportunity radar active / neetcode linked / ship one thing today / calendar synchronized / notion loaded / opportunity radar active / neetcode linked / ship one thing today / </span></footer></div>

<script>
document.querySelectorAll('input[type=checkbox][data-key]').forEach(cb=>{{
  try {{
    const saved=localStorage.getItem('todo:'+cb.dataset.key);
    cb.checked=saved===null ? cb.dataset.initial==='1' : saved==='1';
    cb.addEventListener('change',()=>localStorage.setItem('todo:'+cb.dataset.key,cb.checked?'1':'0'));
  }} catch (error) {{ cb.checked=cb.dataset.initial==='1'; }}
}});
window.dashboardProblemStore = (()=>{{
  const endpoint=location.protocol==='http:' || location.protocol==='https:' ? '/api/problems' : 'http://127.0.0.1:8765/api/problems';
  const state=new Map();
  let latest={{items:{{}},today_count:0}};
  try {{
    JSON.parse(document.getElementById('coach-tasks')?.textContent || '[]').forEach(problem=>{{
      state.set(problem.key,localStorage.getItem('problem:'+problem.key)==='1');
    }});
  }} catch (error) {{}}
  const save=async(problem,status,notes={{}})=>{{
    if (status==='completed' || status==='reopened') state.set(problem.key,status==='completed');
    try {{ localStorage.setItem('problem:'+problem.key,state.get(problem.key)?'1':'0'); }} catch (error) {{}}
    if (!endpoint) return {{ok:false,today_count:null}};
    try {{
      const response=await fetch(endpoint,{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{problem_key:problem.key,status,title:problem.title,topic:problem.topic,url:problem.start_url,solution:notes.solution || '',reflection:notes.reflection || ''}})}});
      if (!response.ok) return {{ok:false,today_count:null}};
      const result=await response.json();
      if (result.item) latest.items[problem.key]=result.item;
      if (Number.isInteger(result.today_count)) latest.today_count=result.today_count;
      return result;
    }} catch (error) {{ return {{ok:false,today_count:null}}; }}
  }};
  const refresh=async()=>{{
    if (!endpoint) return latest;
    try {{
      const response=await fetch(endpoint,{{cache:'no-store'}});
      if (!response.ok) return latest;
      const data=await response.json();
      Object.entries(data.items || {{}}).forEach(([key,item])=>{{
        state.set(key,Boolean(item.completed));
      }});
      latest=data;
      return latest;
    }} catch (error) {{ return latest; }}
  }};
  const ready=refresh();
  return {{ready,save,refresh,isCompleted:(key)=>state.get(key)===true,getItem:(key)=>latest.items?.[key] || null}};
}})();
{theme_js}
</script></body></html>'''
    tmp = OUT.with_suffix('.html.tmp')
    tmp.write_text(document, encoding='utf-8')
    os.replace(tmp, OUT)


def main(open_page=True, schedule_reminders=True):
    global WEEKLY_PLAN_TITLE, WEEKLY_PLAN_URL, WEEKLY_PLAN_ID
    SOURCE_STATUS.clear()
    WEEKLY_PLAN_TITLE, WEEKLY_PLAN_URL, WEEKLY_PLAN_ID = current_week_page()
    events = agenda_events()
    links = links_to_visit()
    weekly = weekly_plan_digest()
    notion = high_level_notion_digest()
    jobs = job_posts()
    news = tech_news()
    discovered_events = discover_events()
    render(events, news, jobs, links, weekly, notion, discovered_events)
    if schedule_reminders:
        schedule_events(events)
    if open_page:
        subprocess.run(['open', ensure_dashboard_server()], check=False)
    print(OUT)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate the daily dashboard.')
    parser.add_argument('--no-open', action='store_true', help='Generate without opening the page.')
    parser.add_argument('--no-reminders', action='store_true', help='Skip launchd event reminders.')
    args = parser.parse_args()
    main(open_page=not args.no_open, schedule_reminders=not args.no_reminders)
