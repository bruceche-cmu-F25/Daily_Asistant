#!/usr/bin/env python3
"""Sync public NeetCode 150 metadata from neetcode.io's current web bundle."""

import json
import re
import urllib.request
from pathlib import Path


BASE = Path(__file__).resolve().parent.parent
LIST_URL = 'https://neetcode.io/practice/practice/neetcode150'
OUT = BASE / 'data' / 'problem_bank.json'


def fetch_text(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'DailyDashboard/1.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read().decode('utf-8')


def field(block, name):
    match = re.search(rf'{re.escape(name)}:"((?:\\.|[^"\\])*)"', block)
    if not match:
        return ''
    return bytes(match.group(1), 'utf-8').decode('unicode_escape')


def extract_problems(bundle):
    problems = []
    seen = set()
    for match in re.finditer(r'\{problem:"(?:\\.|[^"\\])*".*?\}', bundle):
        block = match.group(0)
        if 'neetcode150:!0' not in block:
            continue
        title = field(block, 'problem')
        topic = field(block, 'pattern')
        difficulty = field(block, 'difficulty')
        leetcode_slug = field(block, 'link').strip('/')
        neetcode_slug = field(block, 'ncLink').strip('/')
        if not all((title, topic, difficulty, leetcode_slug, neetcode_slug)):
            continue
        key = 'leetcode:' + leetcode_slug
        if key in seen:
            continue
        seen.add(key)
        minutes = {'Easy': 25, 'Medium': 45, 'Hard': 60}.get(difficulty, 45)
        problems.append({
            'key': key,
            'title': title,
            'topic': topic,
            'difficulty': difficulty,
            'pattern': topic,
            'minutes': minutes,
            'start_url': f'https://neetcode.io/problems/{neetcode_slug}/question?list=neetcode150',
            'leetcode_url': f'https://leetcode.com/problems/{leetcode_slug}/',
            'why': f'推进 NeetCode 150 的 {topic} 路线，一次只解决一道题。',
            'done_when': '独立通过全部测试，并写下复杂度、核心思路和一个容易出错的点。',
            'starter': '先写输入输出示例、暴力思路，以及准备使用的数据结构。',
        })
    return problems


def main():
    page = fetch_text(LIST_URL)
    bundle_match = re.search(r'<script src="(main\.[^"]+\.js)" type="module"></script>', page)
    if not bundle_match:
        raise RuntimeError('Could not locate the current NeetCode application bundle')
    bundle = fetch_text('https://neetcode.io/' + bundle_match.group(1))
    problems = extract_problems(bundle)
    if len(problems) != 150:
        raise RuntimeError(f'Expected 150 NeetCode problems, found {len(problems)}; refusing to overwrite')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUT.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(problems, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(OUT)
    print(f'{OUT} ({len(problems)} problems)')


if __name__ == '__main__':
    main()
