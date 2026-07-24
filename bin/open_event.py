#!/usr/bin/env python3
import os
import subprocess
import sys

base = os.environ.get('DASHBOARD_URL', 'http://127.0.0.1:8766/')
title=sys.argv[1] if len(sys.argv)>1 else 'Calendar event'
url=sys.argv[2] if len(sys.argv)>2 else base
subprocess.run(['open', base])
if url and url != base:
    subprocess.run(['open', url])
