#!/bin/bash

set -e  # Exit on error
set -o pipefail  # Exit if any command in a pipeline fails

echo "======================================="
echo "Word Family - Production Build Script"
echo "======================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Create release directory
RELEASE_DIR="$SCRIPT_DIR/release"
BUILD_TIME=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}[INFO]${NC} Starting production build at $BUILD_TIME"
echo ""

# Clean previous builds
echo -e "${BLUE}[STEP 1/5]${NC} Cleaning previous builds..."
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
echo -e "${GREEN}✓${NC} Clean complete"
echo ""

# Build Backend
echo -e "${BLUE}[STEP 2/5]${NC} Building backend (production)..."
cd "$SCRIPT_DIR/backend"

# Clean backend build artifacts
rm -rf .next node_modules/.cache

# Set production environment
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

# Install dependencies (production only)
echo "  Installing backend dependencies..."
npm ci --production=false --silent 2>&1 | grep -v "warn Unknown user config" || true

# Build backend
echo "  Building backend Next.js app..."
npm run build

# Copy backend build to release
echo "  Copying backend to release directory..."
mkdir -p "$RELEASE_DIR/backend"
cp -r .next "$RELEASE_DIR/backend/"
cp -r node_modules "$RELEASE_DIR/backend/"
cp -r pages "$RELEASE_DIR/backend/"
cp -r lib "$RELEASE_DIR/backend/"
cp package.json "$RELEASE_DIR/backend/"
cp package-lock.json "$RELEASE_DIR/backend/"

# Create backend production package.json (only production deps)
echo "  Creating production dependencies list..."
cd "$RELEASE_DIR/backend"
npm prune --production

echo -e "${GREEN}✓${NC} Backend build complete"
echo ""

# Build Frontend
echo -e "${BLUE}[STEP 3/5]${NC} Building frontend (production)..."
cd "$SCRIPT_DIR/frontend"

# Clean frontend build artifacts
rm -rf .next node_modules/.cache

# Set production environment
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

# Install dependencies (production only)
echo "  Installing frontend dependencies..."
npm ci --production=false --silent 2>&1 | grep -v "warn Unknown user config" || true

# Build frontend
echo "  Building frontend Next.js app..."
npm run build

# Copy frontend build to release
echo "  Copying frontend to release directory..."
mkdir -p "$RELEASE_DIR/frontend"
cp -r .next "$RELEASE_DIR/frontend/"
cp -r node_modules "$RELEASE_DIR/frontend/"
cp -r app "$RELEASE_DIR/frontend/"
[ -d public ] && cp -r public "$RELEASE_DIR/frontend/" || echo "    No public directory (skipped)"
cp package.json "$RELEASE_DIR/frontend/"
cp package-lock.json "$RELEASE_DIR/frontend/"
cp next.config.ts "$RELEASE_DIR/frontend/"
cp tsconfig.json "$RELEASE_DIR/frontend/"

# Create frontend production package.json (only production deps)
echo "  Creating production dependencies list..."
cd "$RELEASE_DIR/frontend"
npm prune --production

echo -e "${GREEN}✓${NC} Frontend build complete"
echo ""

# Create deployment scripts
echo -e "${BLUE}[STEP 4/5]${NC} Creating deployment scripts..."
cd "$RELEASE_DIR"

# Create start script for production
cat > start.sh << 'EOF'
#!/bin/bash

# Production start script for Word Family application

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Set production environment
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

# Start backend
echo "Starting backend on port 3441..."
cd backend
nohup npm start -- -p 3441 > ../logs/backend-prod.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid
echo "Backend started with PID: $BACKEND_PID"

# Wait a bit for backend to start
sleep 2

# Start frontend
echo "Starting frontend on port 3440..."
cd ../frontend
nohup npm start -- -p 3440 > ../logs/frontend-prod.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid
echo "Frontend started with PID: $FRONTEND_PID"

echo ""
echo "Word Family application started successfully!"
echo "Frontend: http://localhost:3440"
echo "Backend: http://localhost:3441"
echo ""
echo "Logs:"
echo "  Backend: logs/backend-prod.log"
echo "  Frontend: logs/frontend-prod.log"
echo ""
echo "PIDs:"
echo "  Backend: $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
EOF

chmod +x start.sh

# Create stop script
cat > stop.sh << 'EOF'
#!/bin/bash

# Stop script for Word Family application

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

if [ -f backend.pid ]; then
    BACKEND_PID=$(cat backend.pid)
    echo "Stopping backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || echo "Backend already stopped"
    rm backend.pid
fi

if [ -f frontend.pid ]; then
    FRONTEND_PID=$(cat frontend.pid)
    echo "Stopping frontend (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null || echo "Frontend already stopped"
    rm frontend.pid
fi

echo "Word Family application stopped"
EOF

chmod +x stop.sh

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'wf-backend',
      cwd: './backend',
      script: 'npm',
      args: 'start -- -p 3441',
      env: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'wf-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'start -- -p 3440',
      env: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
EOF

# Create logs directory
mkdir -p logs

# Create README
cat > README.md << 'EOF'
# Word Family - Production Release

This is a production-optimized build of the Word Family application.

## Deployment Options

### Option 1: Using the start script (simple)

```bash
./start.sh
```

To stop:
```bash
./stop.sh
```

### Option 2: Using PM2 (recommended for production)

Start:
```bash
pm2 start ecosystem.config.js
```

Stop:
```bash
pm2 stop ecosystem.config.js
```

Restart:
```bash
pm2 restart ecosystem.config.js
```

View logs:
```bash
pm2 logs wf-backend
pm2 logs wf-frontend
```

Monitor:
```bash
pm2 monit
```

## Ports

- Frontend: 3440
- Backend: 3441

## Requirements

- Node.js 18+
- MySQL database with `wf` database configured
- Nginx (optional, for reverse proxy)

## Database Configuration

Update `backend/lib/db.ts` with your production database credentials before deploying.

## Logs

Application logs are stored in the `logs/` directory.

## Build Information

Built on: DATE_PLACEHOLDER
EOF

# Replace date placeholder
sed -i.bak "s/DATE_PLACEHOLDER/$BUILD_TIME/" README.md
rm README.md.bak

echo -e "${GREEN}✓${NC} Deployment scripts created"
echo ""

# Create build info
echo -e "${BLUE}[STEP 5/5]${NC} Creating build information..."
cat > BUILD_INFO.txt << EOF
Build Information
=================

Build Date: $BUILD_TIME
Build Host: $(hostname)
Build User: $(whoami)
Node Version: $(node --version)
NPM Version: $(npm --version)

Frontend:
- Next.js Build: Optimized for production
- Source: $SCRIPT_DIR/frontend
- Output: $RELEASE_DIR/frontend/.next

Backend:
- Next.js Build: Optimized for production
- Source: $SCRIPT_DIR/backend
- Output: $RELEASE_DIR/backend/.next

Deployment:
- Frontend Port: 3440
- Backend Port: 3441

Optimizations Applied:
- Production mode enabled
- Debug info removed
- Source maps disabled
- Telemetry disabled
- Dependencies pruned to production only
- Code minified and optimized
EOF

echo -e "${GREEN}✓${NC} Build info created"
echo ""

# Calculate build sizes
FRONTEND_SIZE=$(du -sh "$RELEASE_DIR/frontend/.next" | cut -f1)
BACKEND_SIZE=$(du -sh "$RELEASE_DIR/backend/.next" | cut -f1)
TOTAL_SIZE=$(du -sh "$RELEASE_DIR" | cut -f1)

echo "======================================="
echo -e "${GREEN}Build Complete!${NC}"
echo "======================================="
echo ""
echo "Build Information:"
echo "  Frontend build size: $FRONTEND_SIZE"
echo "  Backend build size:  $BACKEND_SIZE"
echo "  Total release size:  $TOTAL_SIZE"
echo ""
echo "Release directory: $RELEASE_DIR"
echo ""
echo "Next steps:"
echo "  1. Review BUILD_INFO.txt for build details"
echo "  2. Update database configuration in backend/lib/db.ts"
echo "  3. Deploy the release/ directory to your production server"
echo "  4. Run ./start.sh or use PM2 with ecosystem.config.js"
echo ""
echo -e "${BLUE}For PM2 deployment:${NC}"
echo "  cd $RELEASE_DIR"
echo "  pm2 start ecosystem.config.js"
echo ""

cd "$SCRIPT_DIR"
