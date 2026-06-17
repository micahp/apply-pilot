#!/bin/bash

# Memory-efficient test runner for AutoApply extension
set -e

echo "🚀 Starting memory-efficient E2E tests..."

# Set memory limits for Node.js
export NODE_OPTIONS="--max-old-space-size=512"

# Monitor memory usage in background
if command -v top >/dev/null 2>&1; then
    echo "📊 Starting memory monitoring..."
    # Monitor Chrome processes every 5 seconds
    (while true; do
        echo "$(date): Memory usage:"
        ps aux | grep -E "(chrome|Chrome)" | head -5 || true
        sleep 5
    done) &
    MONITOR_PID=$!
fi

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up processes..."
    
    # Kill memory monitor
    if [ ! -z "$MONITOR_PID" ]; then
        kill $MONITOR_PID 2>/dev/null || true
    fi
    
    # Kill any remaining Chrome processes
    pkill -f "Google Chrome for Testing" 2>/dev/null || true
    pkill -f "chrome" 2>/dev/null || true
    
    # Clean up temp directories
    rm -rf /tmp/test-user-data-* 2>/dev/null || true
    
    echo "✅ Cleanup completed"
}

# Set trap for cleanup on script exit
trap cleanup EXIT INT TERM

# Build the extension first
echo "🔨 Building extension..."
npm run build

# Run tests with single worker and reduced parallelism
echo "🧪 Running tests..."
npx playwright test \
    --workers=1 \
    --project=chrome-extension-tests \
    --timeout=60000 \
    --reporter=line \
    --output=test-results

echo "✅ Tests completed successfully!" 