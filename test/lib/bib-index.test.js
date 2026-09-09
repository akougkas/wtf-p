const assert = require('assert');
const bibIndex = require('../../bin/lib/bib-index');

console.log('Running bib-index tests...');

const content = [
  '@article{k1,\n  title={A},\n  author={B},\n  year={2020}\n}',
  '@inproceedings{k1,\n  title={A2},\n  author={C},\n  year={2021}\n}',
  '@inproceedings{k2,\n  title={Only},\n  author={D},\n  year={2019}\n}'
].join('\n');

const rows = JSON.parse(bibIndex.index(content));
assert.strictEqual(rows.length, 3);
assert.deepStrictEqual(rows.filter(r => r.duplicate).map(r => r.key), ['k1', 'k1'], 'both rows of a repeated key are flagged');
assert.ok(!('duplicate' in rows[2]), 'a unique key carries no flag');
assert.deepStrictEqual(bibIndex.duplicateKeys(content), [{ key: 'k1', count: 2 }]);
assert.deepStrictEqual(bibIndex.duplicateKeys('@misc{solo,\n title={S}\n}'), []);
assert.strictEqual(bibIndex.findEntries(content, 'k1').length, 2);
assert.strictEqual(bibIndex.findEntries(content, 'k2').length, 1);
assert.deepStrictEqual(bibIndex.findEntries(content, 'absent'), []);
assert.ok(bibIndex.getEntry(content, 'k1').includes('title={A}'), 'getEntry keeps returning the first match');
const hits = JSON.parse(bibIndex.search(content, 'a2'));
assert.deepStrictEqual(hits.map(h => [h.key, h.duplicate === true]), [['k1', true]]);

console.log('✔ bib-index tests passed');
