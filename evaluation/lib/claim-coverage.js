'use strict';

// Structural claim coverage for a portable WTF-P project. It checks that each
// section claim links to evidence that resolves, belongs to the project,
// names the claim, rests on a usable source, and was inspected deeply enough
// to support anything. It never judges whether a passage actually supports a
// sentence: that semantic question belongs to an independent reviewer, and
// every report says so. The adapter compiler copies this file into the Clio
// desk as runtime/claim-coverage.cjs, so it stays dependency-free and pure.

const STRUCTURAL_SCOPE = 'Structural check of claim, evidence and source records only; whether a cited passage supports its claim needs independent review.';

// `primary-data` is direct inspection of the material itself and supports a
// claim as fully as full text, but only a source inspected as primary data can
// stand behind it: reading a paper is not inspecting its data.
const INSPECTION_RANK = Object.freeze({ metadata: 0, abstract: 1, 'full-text': 2, 'primary-data': 3 });

const SEVERITY_ORDER = Object.freeze(['blocker', 'error', 'warning', 'info']);

function finding(severity, code, subject, message) {
  return { severity, code, subject, message };
}

function rank(depth) {
  return Object.prototype.hasOwnProperty.call(INSPECTION_RANK, depth) ? INSPECTION_RANK[depth] : -1;
}

// Citation keys in Markdown (`[@key]`, `@key`), LaTeX (`\cite{a,b}` and its
// variants) and Typst (`@key`, `#cite(<key>)`). Code spans and blocks are
// removed first so code never reads as a citation.
function citationKeys(text, file) {
  const keys = new Set();
  let body = String(text)
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/`[^`\n]*`/gu, ' ')
    .replace(/<!--[\s\S]*?-->/gu, ' ');
  if (/\.tex$/u.test(file)) {
    body = body.replace(/(^|[^\\])%.*$/gmu, '$1');
    for (const match of body.matchAll(/\\[a-zA-Z]*cite[a-zA-Z]*\*?(?:\[[^\]]*\])*\{([^}]*)\}/gu)) {
      for (const key of match[1].split(',')) if (key.trim()) keys.add(key.trim());
    }
    return [...keys].sort();
  }
  for (const match of body.matchAll(/#cite\(\s*<([A-Za-z0-9:_-]+)>/gu)) keys.add(match[1]);
  // A bare `@` preceded by a word character is an e-mail address, not a citation.
  for (const match of body.matchAll(/(^|[^\w@])@([A-Za-z0-9][A-Za-z0-9:_-]*[A-Za-z0-9]|[A-Za-z0-9])/gmu)) keys.add(match[2]);
  return [...keys].sort();
}

/**
 * Records keyed by logical URI. An id carried by more than one record names
 * none of them, so every one is left out and reported instead of one winning
 * by file order. `entries` are `{ file, record }`.
 */
function indexRecords(entries, collection) {
  const groups = new Map();
  for (const entry of entries) {
    const id = entry.record && entry.record.id;
    if (typeof id !== 'string') continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(entry);
  }
  const byUri = {};
  const ignored = [];
  for (const [id, group] of [...groups.entries()].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))) {
    if (group.length === 1) byUri[`project://${collection}/${id}`] = group[0].record;
    else ignored.push(...group.map(entry => ({ file: entry.file, reason: `${group.length} records carry the id ${id}, so none of them counts` })));
  }
  ignored.sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0));
  return { byUri, ignored };
}

/**
 * Analyze one project's claims. `input` holds already-loaded records:
 *   projectId: the manifest id
 *   outline: the outline record, or null
 *   sections: [{ uri, record }]
 *   evidence: { [uri]: record }
 *   sources: { [uri]: record }
 *   manuscripts: [{ section, file, text }] for citation-key resolution (optional)
 *   ignored: [{ file, reason }] records the loader left out (optional)
 * Unreadable records are the caller's to report; a missing URI here is dangling.
 */
function analyzeCoverage(input) {
  const projectId = input.projectId;
  const evidence = input.evidence || {};
  const sources = input.sources || {};
  const findings = [];
  const claims = [];
  const researchRequired = new Map(
    ((input.outline && Array.isArray(input.outline.sections)) ? input.outline.sections : [])
      .map(entry => [entry.id, Boolean(entry.research && entry.research.required)])
  );
  for (const item of input.ignored || []) {
    findings.push(finding('error', 'record-ignored', item.file, `${item.file} was left out of coverage: ${item.reason}.`));
  }
  // Evidence names its claim by id alone, so a claim id must name one claim in the whole project.
  const claimCount = new Map();
  for (const { record } of input.sections || []) {
    for (const claim of Array.isArray(record.claims) ? record.claims : []) claimCount.set(claim.id, (claimCount.get(claim.id) || 0) + 1);
  }
  const reused = new Set([...claimCount].filter(([, count]) => count > 1).map(([id]) => id));
  // Contradictions on record for a claim, linked from it or not.
  const contradictionsOnRecord = new Map();
  for (const [evidenceUri, item] of Object.entries(evidence)) {
    if (!item || item.relation !== 'contradicts' || item.project_id !== projectId) continue;
    if (!contradictionsOnRecord.has(item.claim_id)) contradictionsOnRecord.set(item.claim_id, []);
    contradictionsOnRecord.get(item.claim_id).push(evidenceUri);
  }

  for (const { uri, record } of input.sections || []) {
    const sectionId = record.id;
    for (const claim of Array.isArray(record.claims) ? record.claims : []) {
      const subject = `${uri}#${claim.id}`;
      const drafted = claim.status === 'drafted' || claim.status === 'verified';
      let best = -1;
      let supports = 0;
      let contradicts = 0;
      if (reused.has(claim.id)) {
        findings.push(finding('error', 'claim-id-duplicate', subject, `Another claim in the project also has the id ${claim.id}, so no evidence can say which one it supports; give each claim its own id.`));
        claims.push({ section: sectionId, claim: claim.id, status: claim.status, evidence_required: claim.evidence_required === true, support: 'none', contested: false, research_required: researchRequired.get(sectionId) === true });
        continue;
      }
      const linked = new Set(Array.isArray(claim.evidence_uris) ? claim.evidence_uris : []);
      for (const evidenceUri of contradictionsOnRecord.get(claim.id) || []) {
        if (linked.has(evidenceUri)) continue;
        contradicts += 1;
        findings.push(finding(claim.status === 'verified' ? 'blocker' : drafted ? 'error' : 'warning', 'evidence-contradicts-unlinked', subject, `${evidenceUri} records that its source contradicts the claim, but the claim does not link it; the claim is contested until the author resolves it.`));
      }
      for (const evidenceUri of linked) {
        const item = evidence[evidenceUri];
        if (!item) {
          findings.push(finding('error', 'evidence-dangling', subject, `${evidenceUri} does not resolve to an evidence record.`));
          continue;
        }
        if (item.project_id !== projectId) {
          findings.push(finding('error', 'evidence-cross-project', subject, `${evidenceUri} belongs to project ${item.project_id}, not ${projectId}.`));
          continue;
        }
        if (item.claim_id !== claim.id) {
          findings.push(finding('error', 'evidence-claim-mismatch', subject, `${evidenceUri} interprets claim ${item.claim_id}, not ${claim.id}.`));
          continue;
        }
        const source = sources[item.source_uri];
        if (!source) {
          findings.push(finding('error', 'source-dangling', subject, `${evidenceUri} cites ${item.source_uri}, which does not resolve.`));
          continue;
        }
        if (source.project_id !== projectId) {
          findings.push(finding('error', 'source-cross-project', subject, `${item.source_uri} belongs to project ${source.project_id}, not ${projectId}.`));
          continue;
        }
        if (item.relation === 'contradicts') {
          contradicts += 1;
          findings.push(finding(claim.status === 'verified' ? 'blocker' : drafted ? 'error' : 'warning', 'evidence-contradicts', subject, `${evidenceUri} records that ${item.source_uri} contradicts the claim; the claim is contested until the author resolves it.`));
          continue;
        }
        if (item.relation !== 'supports') continue;
        if (source.status === 'retracted' || source.status === 'unavailable') {
          findings.push(finding(claim.status === 'verified' ? 'blocker' : 'error', `source-${source.status}`, subject, `${item.source_uri} is ${source.status}; it cannot support the claim.`));
          continue;
        }
        if (source.status !== 'verified') {
          findings.push(finding('warning', 'source-provisional', subject, `${item.source_uri} is ${source.status}; a search candidate or unverified identity cannot support a claim until its record is verified.`));
          continue;
        }
        const depth = rank(item.inspection_depth);
        const sourceDepth = rank(source.provenance && source.provenance.inspection_depth);
        if (depth > sourceDepth) {
          findings.push(finding('error', 'inspection-exceeds-source', subject, `${evidenceUri} claims ${item.inspection_depth} inspection, but ${item.source_uri} records only ${source.provenance ? source.provenance.inspection_depth : 'no'} inspection.`));
          continue;
        }
        if (depth < 1) {
          findings.push(finding('warning', 'inspection-metadata-only', subject, `${evidenceUri} rests on metadata alone; a resolvable identifier is not support for a claim.`));
          continue;
        }
        supports += 1;
        best = Math.max(best, depth);
      }

      const support = best >= INSPECTION_RANK['full-text'] ? 'full' : best === INSPECTION_RANK.abstract ? 'partial' : 'none';
      const required = claim.evidence_required === true && claim.status !== 'rejected';
      if (required && support === 'none') {
        const none = !Array.isArray(claim.evidence_uris) || claim.evidence_uris.length === 0;
        findings.push(finding(
          claim.status === 'verified' ? 'blocker' : drafted ? 'error' : 'warning',
          none ? 'evidence-missing' : 'support-missing',
          subject,
          none
            ? `The claim requires evidence and links none.`
            : `The claim requires evidence and none of its links qualifies as support.`
        ));
      } else if (required && support === 'partial') {
        findings.push(finding('info', 'support-abstract-only', subject, 'The strongest support was inspected at abstract depth; keep the sentence no stronger than the abstract states.'));
      }
      if (claim.status === 'verified' && contradicts > 0 && supports === 0) {
        findings.push(finding('blocker', 'verified-against-evidence', subject, 'The claim is marked verified while its only linked evidence contradicts it.'));
      }
      claims.push({
        section: sectionId,
        claim: claim.id,
        status: claim.status,
        evidence_required: claim.evidence_required === true,
        support,
        contested: contradicts > 0,
        research_required: researchRequired.get(sectionId) === true
      });
    }
  }

  const keys = new Map();
  for (const source of Object.values(sources)) {
    if (!source || typeof source.citation_key !== 'string') continue;
    if (!keys.has(source.citation_key)) keys.set(source.citation_key, []);
    keys.get(source.citation_key).push(source);
  }
  for (const manuscript of input.manuscripts || []) {
    for (const key of citationKeys(manuscript.text, manuscript.file)) {
      const carriers = keys.get(key) || [];
      const source = carriers[0];
      const subject = `project://sections/${manuscript.section}`;
      if (!source) findings.push(finding('error', 'citation-unresolved', subject, `${manuscript.file} cites ${key}, which no source record carries.`));
      else if (carriers.length > 1) findings.push(finding('error', 'citation-ambiguous', subject, `${manuscript.file} cites ${key}, which ${carriers.length} source records carry.`));
      else if (source.project_id !== projectId) {
        findings.push(finding('error', 'citation-cross-project', subject, `${manuscript.file} cites ${key}, whose source belongs to project ${source.project_id}.`));
      } else if (source.status === 'retracted' || source.status === 'unavailable') {
        findings.push(finding('error', `citation-${source.status}`, subject, `${manuscript.file} cites ${key}, whose source is ${source.status}.`));
      } else if (source.status !== 'verified') {
        findings.push(finding('error', 'citation-provisional', subject, `${manuscript.file} cites ${key}, whose source is ${source.status}; a candidate is not a citation until its record is verified.`));
      }
    }
  }

  findings.sort((left, right) =>
    SEVERITY_ORDER.indexOf(left.severity) - SEVERITY_ORDER.indexOf(right.severity) ||
    left.subject.localeCompare(right.subject) ||
    left.code.localeCompare(right.code));
  return { scope: STRUCTURAL_SCOPE, findings, claims };
}

/** Required claims of one section that have no qualifying support or stand contested, by claim id. */
function unsupportedRequired(report, sectionId) {
  return report.claims
    .filter(claim => claim.section === sectionId && claim.evidence_required && claim.status !== 'rejected' && (claim.support === 'none' || claim.contested))
    .map(claim => claim.claim);
}

module.exports = {
  INSPECTION_RANK,
  STRUCTURAL_SCOPE,
  analyzeCoverage,
  citationKeys,
  indexRecords,
  unsupportedRequired
};
