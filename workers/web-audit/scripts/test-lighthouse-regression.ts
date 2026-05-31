/**
 * Regression guards for Lighthouse finding mappers (run: npm run test:regression).
 */
import { mapDetailedLighthouseFindings } from "../src/scoring/mapDetailedLighthouseFindings.js";

let passed = 0;
let failed = 0;

const assert = (name: string, condition: boolean) => {
  if (condition) {
    passed += 1;
    console.log(`✅ ${name}`);
  } else {
    failed += 1;
    console.error(`❌ ${name}`);
  }
};

const malformedItems = {
  categories: {
    performance: {
      score: 0.6,
      auditRefs: [{ id: "broken-items", weight: 1 }],
    },
  },
  audits: {
    "broken-items": {
      id: "broken-items",
      title: "Malformed items table",
      score: 0.4,
      scoreDisplayMode: "numeric",
      description: "items is an object, not array",
      details: { items: { url: "https://example.com" } },
    },
  },
};

const malformedRefs = {
  categories: {
    seo: {
      score: 0.7,
      auditRefs: { id: "not-an-array" },
    },
  },
  audits: {},
};

try {
  const findings = mapDetailedLighthouseFindings(malformedItems, "Mobile", 0);
  assert("handles non-array details.items", findings.length === 1);
  assert(
    "finding has title",
    findings[0]?.title.includes("Malformed items table"),
  );
} catch (cause) {
  failed += 1;
  console.error("❌ handles non-array details.items — threw", cause);
}

try {
  const findings = mapDetailedLighthouseFindings(malformedRefs, "Desktop", 0);
  assert("handles non-array auditRefs", findings.length === 0);
} catch (cause) {
  failed += 1;
  console.error("❌ handles non-array auditRefs — threw", cause);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
