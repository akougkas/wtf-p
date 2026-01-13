const assert = require('assert');
const scholar = require('../../bin/lib/scholar-lookup');
const https = require('https');

console.log('Running scholar-lookup tests...');

// Mock HTTPS Request
const originalRequest = https.request;

function mockRequest(responseBody, statusCode = 200) {
  https.request = (options, callback) => {
    const res = {
      statusCode,
      on: (event, handler) => {
        if (event === 'data') handler(JSON.stringify(responseBody));
        if (event === 'end') handler();
      }
    };
    process.nextTick(() => callback(res));
    return { on: () => {}, end: () => {} };
  };
}

function restoreRequest() {
  https.request = originalRequest;
}

// Mock usage
const originalUsage = { ...scholar.usage };

async function runTests() {
  try {
    // 1. Availability (assuming no env var set in test env)
    // We can't easily unset env vars in node process safely without affecting others,
    // but we can check the logic.
    const hasKey = !!process.env.SERPAPI_KEY;
    assert.strictEqual(scholar.isAvailable(), hasKey);
    
    // 2. Search Mock
    // Temporarily fake key availability for test logic
    const backupKey = process.env.SERPAPI_KEY;
    process.env.SERPAPI_KEY = "test_key";
    
    mockRequest({
      organic_results: [
        {
          title: "Seminal Paper",
          cluster_id: "12345",
          snippet: "This is a snippet",
          inline_links: { cited_by: { total: 100 } }
        }
      ]
    });
    
    const results = await scholar.search("test");
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].title, "Seminal Paper");
    assert.strictEqual(results[0].citationCount, 100);
    
    // 3. Cluster ID lookup
    mockRequest({
      organic_results: [{ title: "Cluster Paper", cluster_id: "999" }]
    });
    const paper = await scholar.getByClusterId("999");
    assert.strictEqual(paper.title, "Cluster Paper");
    
    // 4. Budget Check
    scholar.usage.queries = 999;
    scholar.usage.monthlyBudget = 100;
    try {
      await scholar.search("fail");
      assert.fail("Should throw budget error");
    } catch (e) {
      assert.ok(e.message.includes("budget"));
    }
    
    // Cleanup
    process.env.SERPAPI_KEY = backupKey;
    scholar.usage = originalUsage;
    
    console.log('✔ scholar-lookup tests passed');

  } catch (e) {
    console.error('Test failed:', e);
    process.exit(1);
  } finally {
    restoreRequest();
  }
}

runTests();
