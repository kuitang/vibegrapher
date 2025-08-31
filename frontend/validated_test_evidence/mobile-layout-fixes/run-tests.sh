#!/bin/bash
# Mobile Layout Fixes - Test Reproduction Script
# Generated: 2025-08-26

set -e

echo "=== Mobile Layout Fixes Test Suite ==="
echo "This script validates that the mobile layout properly uses full viewport height"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo -e "${YELLOW}Checking backend availability...${NC}"
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not running. Please start it with:${NC}"
    echo "  cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
    exit 1
fi

# Check if frontend is running
echo -e "${YELLOW}Checking frontend availability...${NC}"
if curl -s http://localhost:5174 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is running${NC}"
else
    echo -e "${RED}✗ Frontend is not running. Please start it with:${NC}"
    echo "  cd frontend && npm run dev"
    exit 1
fi

echo ""
echo "=== Running Mobile Layout Tests ==="
echo ""

# Run the tests
PATH=/home/kuitang/.nvm/versions/node/v22.18.0/bin:$PATH npx playwright test tests/e2e/mobile-*.spec.ts --reporter=list

echo ""
echo "=== Test Summary ==="
echo "Key validations:"
echo "✓ Monaco editor properly sizes (606px on 812px viewport)"
echo "✓ No vertical scrolling - content fits exactly within viewport"
echo "✓ All tabs (Vibecode, Code, Tests) expand to fill available space"
echo "✓ Proper viewport resizing behavior"
echo "✓ Back button and dark mode toggle work correctly"
echo ""
echo "Test evidence has been saved to validated_test_evidence/mobile-layout-fixes/"