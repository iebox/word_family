#!/bin/bash

echo "Stopping Word Family servers..."

# Function to kill process by PID file
kill_by_pid_file() {
  local pid_file=$1
  if [ -f "$pid_file" ]; then
    PID=$(cat "$pid_file")
    if ps -p $PID > /dev/null 2>&1; then
      echo "Killing process $PID from $pid_file"
      kill $PID 2>/dev/null || kill -9 $PID 2>/dev/null
      rm "$pid_file"
    else
      echo "Process $PID from $pid_file is not running"
      rm "$pid_file"
    fi
  fi
}

# Kill processes from PID files
kill_by_pid_file "pids/backend-dev.pid"
kill_by_pid_file "pids/frontend-dev.pid"
kill_by_pid_file "pids/backend-prod.pid"
kill_by_pid_file "pids/frontend-prod.pid"

# Kill any remaining processes on ports 3440 and 3441
echo "Killing any remaining processes on ports 3440 and 3441..."
lsof -ti:3440 | xargs kill -9 2>/dev/null || true
lsof -ti:3441 | xargs kill -9 2>/dev/null || true

# Also kill any node processes that might be related
pkill -f "next dev -p 3440" 2>/dev/null || true
pkill -f "next dev -p 3441" 2>/dev/null || true
pkill -f "next start -p 3440" 2>/dev/null || true
pkill -f "next start -p 3441" 2>/dev/null || true

echo "All servers stopped!"
