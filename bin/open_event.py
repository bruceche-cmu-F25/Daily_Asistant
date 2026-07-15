#!/usr/bin/env python3
import subprocess, sys
from pathlib import Path
base=Path.home()/'daily-dashboard'/'today.html'
title=sys.argv[1] if len(sys.argv)>1 else 'Calendar event'
url=sys.argv[2] if len(sys.argv)>2 else str(base)
subprocess.run(['open', str(base)])
if url:
    subprocess.run(['open', url])
