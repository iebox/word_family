#!/bin/bash

echo "Starting Word Family in development mode..."

# Kill any existing processes on ports 3440 and 3441
lsof -ti:3440 | xargs kill -9 2>/dev/null || true
lsof -ti:3441 | xargs kill -9 2>/dev/null || true

# Start backend in background
echo "Starting backend on port 3441..."
cd backend
npm run dev > ../logs/backend-dev.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../pids/backend-dev.pid
cd ..

# Wait a bit for backend to start
sleep 2

# Start frontend in background
echo "Starting frontend on port 3440..."
cd frontend
npm run dev > ../logs/frontend-dev.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../pids/frontend-dev.pid
cd ..

echo "Development servers started!"
echo "Frontend: http://localhost:3440"
echo "Backend API: http://localhost:3441"
echo ""
echo "Backend PID: $BACKEND_PID (saved to pids/backend-dev.pid)"
echo "Frontend PID: $FRONTEND_PID (saved to pids/frontend-dev.pid)"
echo ""
echo "To view logs:"
echo "  Backend: tail -f logs/backend-dev.log"
echo "  Frontend: tail -f logs/frontend-dev.log"
echo ""
echo "To stop servers, run: ./stop.sh"
