'use strict';

// Whether a checkpoint's recorded answer is the author's, decided from the
// project's own records and the desk's seal key. The Clio desk and the
// campaign collector share this one implementation: the adapter compiler
// copies it into the desk as runtime/desk-trust.cjs, so it stays pure and
// depends on nothing but node:crypto.
//
// `attested` means an interaction sealed under this key, given at the desk's
// interview, still matches the checkpoint it answered; `unattested` is a
// resolution no such interaction stands behind; `foreign` was sealed under
// another key and cannot be checked here.

const crypto = require('crypto');

const SEAL_METHOD = 'hmac-sha256';
const CHANNEL = 'attested-interview';

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** JSON with object keys in code-unit order and no insignificant whitespace; the input to every digest and seal. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** What a checkpoint asks, independent of whether and how it was answered. */
function checkpointDigest(record) {
  const asked = { ...record };
  for (const key of ['status', 'resolution', 'file', 'trust', 'answer']) delete asked[key];
  return sha256(canonical(asked));
}

function keyId(key) {
  return sha256(key).slice(0, 16);
}

function mac(body, key) {
  return crypto.createHmac('sha256', key).update(canonical(body)).digest('hex');
}

/** The desk's seal over an interaction record: an HMAC of its canonical form under this machine's key. */
function seal(record, key) {
  const body = { ...record };
  delete body.seal;
  return { ...body, seal: { method: SEAL_METHOD, key_id: keyId(key), mac: mac(body, key) } };
}

/** Checks a seal in exactly the form `seal` writes it; any other spelling is invalid, never valid. */
function sealState(record, key) {
  const value = record.seal;
  if (value === undefined) return 'unsealed';
  if (
    value === null || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).length !== 3 ||
    value.method !== SEAL_METHOD ||
    typeof value.key_id !== 'string' || !/^[a-f0-9]{16}$/u.test(value.key_id) ||
    typeof value.mac !== 'string' || !/^[a-f0-9]{64}$/u.test(value.mac)
  ) return 'invalid';
  if (!key || value.key_id !== keyId(key)) return 'foreign';
  const body = { ...record };
  delete body.seal;
  const expected = Buffer.from(mac(body, key), 'hex');
  const actual = Buffer.from(value.mac, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) ? 'valid' : 'invalid';
}

/** The outcome an interaction must carry to stand behind a checkpoint's recorded resolution. */
function matchesResolution(interaction, checkpoint) {
  if (interaction.kind !== 'checkpoint-answer' || interaction.channel !== CHANNEL) return false;
  if (interaction.subject_uri !== `project://checkpoints/${checkpoint.id}`) return false;
  if (checkpoint.status === 'waived') return interaction.outcome === 'waived';
  const option = checkpoint.resolution && checkpoint.resolution.selected_option;
  return option ? interaction.outcome === 'selected' && interaction.selected_option === option : interaction.outcome === 'done';
}

/**
 * The trust of one checkpoint's recorded state: `snapshot`, `pending`,
 * `expired` and `policy` come from the checkpoint alone; a resolution is
 * `attested` only by the newest matching interaction with a valid seal, for
 * this project and for exactly what the checkpoint asks.
 */
function trustOf(checkpoint, interactions, key, projectId) {
  if (checkpoint.kind === 'state-snapshot') return { trust: 'snapshot' };
  const status = checkpoint.status || 'pending';
  if (status === 'pending') return { trust: 'pending' };
  if (status === 'expired') return { trust: 'expired' };
  if (checkpoint.resolution && checkpoint.resolution.resolved_by === 'policy') return { trust: 'policy' };
  const digest = checkpointDigest(checkpoint);
  let foreign = false;
  const answers = interactions
    .filter(interaction =>
      matchesResolution(interaction, { ...checkpoint, status }) &&
      interaction.project_id === projectId &&
      interaction.presented && interaction.presented.content_sha256 === digest)
    .sort((a, b) => String(b.answered_at || '').localeCompare(String(a.answered_at || '')));
  for (const interaction of answers) {
    const state = sealState(interaction, key);
    if (state === 'valid') return { trust: 'attested', answer: interaction };
    if (state === 'foreign') foreign = true;
  }
  return { trust: foreign ? 'foreign' : 'unattested' };
}

module.exports = { CHANNEL, SEAL_METHOD, canonical, checkpointDigest, keyId, matchesResolution, seal, sealState, trustOf };
