#!/bin/bash
OUTPUT_DIR="frontend/validated_test_evidence/phase-005"
mkdir -p $OUTPUT_DIR

# Run integration tests with MSW mocks
npm test -- --run tests/integration/phase005-session.test.tsx > $OUTPUT_DIR/vitest.log 2>&1

# Run E2E tests (headless)
npx playwright test tests/e2e/phase005-session.e2e.ts \
  --reporter=json \
  --output=$OUTPUT_DIR \
  > $OUTPUT_DIR/playwright.json

echo "Phase 005 validation complete"