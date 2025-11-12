#!/bin/bash

echo "Starting Word Family in production mode..."

# Kill any existing processes on ports 3440 and 3441
lsof -ti:3440 | xargs kill -9 2>/dev/null || true
lsof -ti:3441 | xargs kill -9 2>/dev/null || true

# Build backend
echo "Building backend..."
cd backend
npm run build
cd ..

# Build frontend
echo "Building frontend..."
cd frontend
npm run build
cd ..

# Start backend in background
echo "Starting backend on port 3441..."
cd backend
npm start > ../logs/backend-prod.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../pids/backend-prod.pid
cd ..

# Wait a bit for backend to start
sleep 2

# Start frontend in background
echo "Starting frontend on port 3440..."
cd frontend
npm start > ../logs/frontend-prod.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../pids/frontend-prod.pid
cd ..

echo "Production servers started!"
echo "Frontend: http://localhost:3440"
echo "Backend API: http://localhost:3441"
echo ""
echo "Backend PID: $BACKEND_PID (saved to pids/backend-prod.pid)"
echo "Frontend PID: $FRONTEND_PID (saved to pids/frontend-prod.pid)"
echo ""
echo "To view logs:"
echo "  Backend: tail -f logs/backend-prod.log"
echo "  Frontend: tail -f logs/frontend-prod.log"
echo ""
echo "To stop servers, run: ./stop.sh"
