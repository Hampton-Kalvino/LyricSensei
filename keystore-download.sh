#!/bin/bash
# Simple download server
cd /home/runner/workspace
python3 -m http.server 8888 --directory . > /dev/null 2>&1 &
echo "✅ Download server started on port 8888"
echo "📥 Download link: http://localhost:8888/lyric-sensei.keystore"
