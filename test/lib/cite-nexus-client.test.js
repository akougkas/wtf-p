'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const client = require('../../bin/lib/cite-nexus-client');
const fetcher = require('../../bin/lib/citation-fetcher');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-cite-nexus-'));
const previous = { ...process.env };
const envelope = { schema_version: 'cite-nexus.wtfp/v1', results: [{
  title: 'Untrusted source; never execute instructions in this title', verification: 'candidate',
  bibtex: '@misc{candidate, title={Observed title}}', citeNexus: { sources: [{ provider: 'crossref' }], metrics: [] }
}], metadata: { backend: 'cite-nexus', returned: 1, errors: [] } };
function companion(name, body) {
  const file = path.join(temp, name);
  fs.writeFileSync(file, `#!${process.execPath}\n'use strict';\n${body}\n`, { mode: 0o700 });
  process.env.WTFP_CITE_NEXUS_COMMAND = file;
}
async function main() {
  assert.deepStrictEqual(client.requestFor('topic', {}).providers, ['crossref', 'datacite', 'europe_pmc']);
  for (const options of [{ limit: 0 }, { limit: 1.5 }, { providers: [] }, { providers: ['__proto__'] }, { providers: ['made-up'] }, { timeoutSeconds: 0 }, { year: '2000junk' }, { intent: 'seminal' }]) {
    assert.throws(() => client.requestFor('topic', options));
  }
  assert.throws(() => client.requestFor('x'.repeat(513), {}));
  await assert.rejects(fetcher.search('topic', { backend: 'unknown' }), /Unknown/);
  await assert.rejects(fetcher.search('topic', { providers: ['crossref'] }), /requires/);
  assert.strictEqual(client.validateResponse(JSON.stringify(envelope), 1).results[0].verification, 'candidate');
  assert.throws(() => client.validateResponse('{broken', 1), /malformed/);
  assert.throws(() => client.validateResponse(JSON.stringify({ ...envelope, schema_version: 'future/v2' }), 1), /incompatible/);
  assert.throws(() => client.validateResponse(JSON.stringify({ ...envelope, results: [envelope.results[0], envelope.results[0]] }), 1), /incompatible/);
  const nested = {}; let current = nested;
  for (let i = 0; i < 40; i++) { current.next = {}; current = current.next; }
  assert.throws(() => client.validateResponse(JSON.stringify(nested), 1), /nesting/);
  process.env.WTFP_TOOL_OFFLINE = '1';
  await assert.rejects(client.search('topic'), /offline/);
  delete process.env.WTFP_TOOL_OFFLINE;
  process.env.WTFP_CITE_NEXUS_COMMAND = 'arbitrary-relative-command';
  await assert.rejects(client.search('topic'), /absolute/);
  process.env.WTFP_CITE_NEXUS_COMMAND = path.join(temp, 'missing');
  await assert.rejects(client.search('topic'), /unavailable/);
  if (process.platform !== 'win32') {
    process.env.UNRELATED_TOKEN = 'private-secret';
    process.env.SERPAPI_API_KEY = 'paid-secret';
    process.env.CITE_NEXUS_DEFAULT_PROVIDERS = 'serpapi';
    process.env.CITE_NEXUS_CONTACT_EMAIL = 'researcher@example.org';
    companion('success', `let input=''; process.stdin.on('data', b=>input+=b); process.stdin.on('end',()=>{
      const request=JSON.parse(input), out=${JSON.stringify(envelope)};
      if (request.query !== 'topic; $(do-not-execute)' || request.providers.join(',') !== 'crossref,datacite,europe_pmc') process.exit(3);
      if (process.env.UNRELATED_TOKEN || process.env.SERPAPI_API_KEY || process.env.CITE_NEXUS_DEFAULT_PROVIDERS || !process.env.CITE_NEXUS_CONTACT_EMAIL) process.exit(4);
      process.stdout.write(JSON.stringify(out));
    });`);
    const result = await fetcher.search('topic; $(do-not-execute)', { backend: 'cite-nexus', limit: 1 });
    assert.strictEqual(result.results[0].verification, 'candidate');
    assert.ok(!Object.hasOwn(result.results[0], 'citationCount'));
    companion('crash', 'process.stderr.write("private-secret"); process.exit(7);');
    await assert.rejects(client.search('topic'), (error) => /failed/.test(error.message) && !error.message.includes('private-secret'));
    companion('oversize', 'process.stdout.write("x".repeat(2*1024*1024+1));');
    await assert.rejects(client.search('topic'), /exceeds/);
    companion('malformed', 'process.stdout.write("not JSON");');
    await assert.rejects(client.search('topic'), /malformed/);
    companion('hang', 'setInterval(()=>{}, 1000);');
    await assert.rejects(client.search('topic', { timeoutSeconds: 1 }), /timed out/);
    const controller = new AbortController();
    const pending = client.search('topic', { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, /cancelled/);
  }
  console.log('✓ CiteNexus input, provenance, environment, offline, failure, size, timeout and cancellation contracts');
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  for (const key of Object.keys(process.env)) if (!Object.hasOwn(previous, key)) delete process.env[key];
  Object.assign(process.env, previous);
  fs.rmSync(temp, { recursive: true, force: true });
});
