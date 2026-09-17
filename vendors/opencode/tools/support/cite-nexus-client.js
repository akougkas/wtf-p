'use strict';

// Optional companion to citation.fetch, never a separately executable tool.
const { spawn } = require('child_process');
const path = require('path');
const SCHEMA = 'cite-nexus.wtfp/v1';
const MAX_BYTES = 2 * 1024 * 1024;
const PROVIDERS = Object.freeze({
  crossref: ['CITE_NEXUS_CONTACT_EMAIL'], datacite: [], europe_pmc: [], arxiv: [],
  semantic_scholar: ['SEMANTIC_SCHOLAR_API_KEY'], openalex: ['OPENALEX_API_KEY'],
  serpapi: ['SERPAPI_API_KEY'], scopus: ['SCOPUS_API_KEY', 'SCOPUS_INSTTOKEN'], wos: ['WOS_API_KEY']
});
const RUNTIME_ENV = ['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'LANG', 'LC_ALL', 'TMPDIR', 'TEMP', 'TMP'];

function timedOut() {
  return Object.assign(new Error('CiteNexus request timed out'), { code: 'WTFP_TIMEOUT' });
}

function requestFor(query, options) {
  if (process.env.WTFP_TOOL_OFFLINE === '1' || process.env.WTFP_TOOL_OFFLINE === 'true') {
    throw new Error('CiteNexus is unavailable in offline mode');
  }
  if (typeof query !== 'string' || !query.trim() || query.length > 512) throw new Error('CiteNexus query must contain 1-512 characters');
  const limit = options.limit === undefined ? 10 : options.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('CiteNexus limit must be an integer between 1 and 25');
  const providers = options.providers || ['crossref', 'datacite', 'europe_pmc'];
  if (!Array.isArray(providers) || providers.length < 1 || providers.length > 9 ||
      providers.some((p) => typeof p !== 'string' || !Object.hasOwn(PROVIDERS, p))) {
    throw new Error('CiteNexus providers must be a nonempty list of supported provider IDs');
  }
  const timeout = options.timeoutSeconds === undefined ? 20 : options.timeoutSeconds;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 600) throw new Error('CiteNexus timeout must be an integer between 1 and 600 seconds');
  const request = { schema_version: SCHEMA, operation: 'search', query, limit, providers: [...new Set(providers)], timeout_seconds: timeout };
  if (options.year != null) {
    if (!/^\d{4}$/.test(String(options.year)) || Number(options.year) < 1000 || Number(options.year) > 2200) throw new Error('CiteNexus year must be between 1000 and 2200');
    request.year = Number(options.year);
  }
  if (options.intent && options.intent !== 'balanced') throw new Error('CiteNexus preserves provider ordering; use --intent=balanced');
  return request;
}

function validateResponse(text, limit) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('CiteNexus returned malformed JSON'); }
  const stack = [[data, 0]];
  while (stack.length) {
    const [value, depth] = stack.pop();
    if (depth > 32) throw new Error('CiteNexus response nesting exceeds 32 levels');
    if (value && typeof value === 'object') for (const child of Object.values(value)) stack.push([child, depth + 1]);
  }
  if (!data || data.schema_version !== SCHEMA || !Array.isArray(data.results) || data.results.length > limit ||
      !data.metadata || data.metadata.backend !== 'cite-nexus' || !Array.isArray(data.metadata.errors) ||
      data.metadata.returned !== data.results.length ||
      data.results.some((p) => !p || p.verification !== 'candidate' || typeof p.title !== 'string' ||
        typeof p.bibtex !== 'string' || !p.citeNexus || !Array.isArray(p.citeNexus.sources) || !Array.isArray(p.citeNexus.metrics))) {
    throw new Error('CiteNexus returned an incompatible response; update both companions');
  }
  return data;
}

async function search(query, options = {}) {
  const request = requestFor(query, options);
  if (options.signal && options.signal.aborted) throw new Error('CiteNexus request cancelled');
  const command = process.env.WTFP_CITE_NEXUS_COMMAND || 'cite-nexus-wtfp';
  if (command !== 'cite-nexus-wtfp' && !path.isAbsolute(command)) {
    throw new Error('WTFP_CITE_NEXUS_COMMAND must name an absolute installed executable');
  }
  const allowed = [...RUNTIME_ENV, ...request.providers.flatMap((p) => PROVIDERS[p])];
  const env = Object.fromEntries(allowed.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
  return new Promise((resolve, reject) => {
    // No shell, command arguments, URL or executable can arrive from source data.
    const child = spawn(command, [], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let settled = false, bytes = 0;
    const chunks = [];
    const stop = () => { if (child.exitCode === null) child.kill('SIGTERM'); };
    const onExit = () => stop();
    const onSignal = () => { stop(); process.exit(130); };
    const finish = (error, data) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.removeListener('exit', onExit);
      process.removeListener('SIGTERM', onSignal);
      process.removeListener('SIGINT', onSignal);
      if (options.signal) options.signal.removeEventListener('abort', cancel);
      if (error) {
        stop();
        // The Python bridge cancels MCP and closes the SDK-owned server group.
        const kill = setTimeout(() => child.kill('SIGKILL'), 7000);
        kill.unref();
        child.once('close', () => clearTimeout(kill));
        reject(error);
      } else resolve(data);
    };
    const cancel = () => finish(new Error('CiteNexus request cancelled'));
    const timer = setTimeout(() => finish(timedOut()), request.timeout_seconds * 1000);
    process.once('exit', onExit);
    process.once('SIGTERM', onSignal);
    process.once('SIGINT', onSignal);
    if (options.signal) options.signal.addEventListener('abort', cancel, { once: true });
    child.on('error', () => finish(new Error('CiteNexus companion unavailable; install cite-nexus-mcp 0.2.0 separately and run cite-nexus-wtfp --check')));
    child.stdin.on('error', () => finish(new Error('CiteNexus companion closed its input')));
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) return finish(new Error('CiteNexus response exceeds 2 MiB'));
      if (!settled) chunks.push(chunk);
    });
    // Drain, but never relay child stderr (it may contain sensitive diagnostics).
    child.stderr.on('data', () => {});
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) return finish(code === 124 ? timedOut() : new Error('CiteNexus companion failed; run cite-nexus-wtfp --check'));
      try { finish(null, validateResponse(Buffer.concat(chunks).toString('utf8'), request.limit)); }
      catch (error) { finish(error); }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

module.exports = { search, requestFor, validateResponse };
