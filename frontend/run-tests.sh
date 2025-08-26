#!/bin/bash

# Vibegrapher Test Runner Script
# Runs comprehensive E2E tests with evidence collection

echo "======================================"
echo "Vibegrapher E2E Test Suite"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
EVIDENCE_DIR=".playwright-test-evidence"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="${EVIDENCE_DIR}/report_${TIMESTAMP}"

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install Node.js and npm.${NC}"
    exit 1
fi

# Check if Playwright is installed
if ! npm list @playwright/test &> /dev/null; then
    echo -e "${BLUE}Installing Playwright...${NC}"
    npm install -D @playwright/test
    npx playwright install
fi

# Check if the frontend server is running
if ! curl -s http://localhost:5173 > /dev/null; then
    echo -e "${RED}Frontend server is not running on http://localhost:5173${NC}"
    echo "Please run 'npm run dev' in another terminal first."
    exit 1
fi

# Check if the backend API is accessible
if ! curl -s http://kui-vibes:8000/health > /dev/null 2>&1; then
    echo -e "${BLUE}Warning: Backend API may not be accessible at http://kui-vibes:8000${NC}"
    echo "Some tests may fail without backend connectivity."
    echo ""
fi

# Create evidence directory
echo -e "${BLUE}Creating evidence directory...${NC}"
mkdir -p "$REPORT_DIR"

# Clean previous test results
if [ -d "$EVIDENCE_DIR" ]; then
    echo -e "${BLUE}Archiving previous test results...${NC}"
    mv "$EVIDENCE_DIR"/*.png "$REPORT_DIR" 2>/dev/null || true
    mv "$EVIDENCE_DIR"/*.json "$REPORT_DIR" 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}Starting E2E Tests...${NC}"
echo "======================================"

# Run the comprehensive test suite
npx playwright test tests/e2e/vibegrapher-full.spec.ts \
    --reporter=list \
    --workers=1 \
    --retries=1 \
    --timeout=30000

TEST_EXIT_CODE=$?

# Run individual test file if comprehensive suite doesn't exist
if [ $TEST_EXIT_CODE -ne 0 ] && [ ! -f "tests/e2e/vibegrapher-full.spec.ts" ]; then
    echo -e "${BLUE}Running alternative test suite...${NC}"
    npx playwright test tests/e2e/vibegrapher.test.ts \
        --reporter=list \
        --workers=1 \
        --retries=1 \
        --timeout=30000
    
    TEST_EXIT_CODE=$?
fi

echo ""
echo "======================================"

# Generate HTML report
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}Tests completed successfully!${NC}"
    
    # Generate Playwright HTML report
    if command -v npx &> /dev/null; then
        echo -e "${BLUE}Generating HTML report...${NC}"
        npx playwright show-report
    fi
else
    echo -e "${RED}Some tests failed. Check the output above for details.${NC}"
fi

# Count evidence files
SCREENSHOT_COUNT=$(find "$EVIDENCE_DIR" -name "*.png" 2>/dev/null | wc -l)
JSON_COUNT=$(find "$EVIDENCE_DIR" -name "*.json" 2>/dev/null | wc -l)

echo ""
echo "======================================"
echo -e "${BLUE}Test Evidence Summary:${NC}"
echo "Screenshots captured: $SCREENSHOT_COUNT"
echo "Data files generated: $JSON_COUNT"
echo "Evidence location: $EVIDENCE_DIR"
echo "Report archive: $REPORT_DIR"
echo "======================================"

# Open evidence folder in file manager (if available)
if command -v xdg-open &> /dev/null; then
    echo ""
    echo -e "${BLUE}Opening evidence folder...${NC}"
    xdg-open "$EVIDENCE_DIR" 2>/dev/null || true
elif command -v open &> /dev/null; then
    open "$EVIDENCE_DIR" 2>/dev/null || true
fi

exit $TEST_EXIT_CODE