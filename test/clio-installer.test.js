#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { sha256Buffer } = require('../bin/lib/ownership');
const { detectInstallation } = require('../bin/lib/utils');
const MANIFEST = require('../bin/lib/manifest');
const ROOT = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-clio-installer-'));
const fakeBin = path.join(scratch, 'bin');
fs.mkdirSync(fakeBin);
// Emulate Clio's plugin lifecycle, not merely a successful exit code: the
// destination tree is owned and replaced by the client, `state.json` records
// the content digest, and `inspect` reports the installed entry.
fs.writeFileSync(path.join(fakeBin, 'clio-coder'), `#!${process.execPath}
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const args = process.argv.slice(2), command = args[1];
if (args[0] !== 'plugins') { console.error('unsupported collection ' + args[0]); process.exit(2); }
const scope = args.includes('--project') ? 'project' : 'user';
const config = scope === 'project' ? path.join(process.cwd(), '.clio-coder') : process.env.CLIO_CODER_CONFIG_DIR;
const base = path.join(config, 'plugins'), root = path.join(base, 'wtfp'), stateFile = path.join(base, 'state.json');
const read = () => fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : {version:1,disabled:[],installed:{}};
const save = state => { fs.mkdirSync(base,{recursive:true});fs.writeFileSync(stateFile,JSON.stringify(state)); };
function digest(directory) {
 const hash = crypto.createHash('sha256');
 function visit(dir) { for(const name of fs.readdirSync(dir).sort()) { const file=path.join(dir,name); if(fs.statSync(file).isDirectory())visit(file); else {hash.update(path.relative(directory,file));hash.update(fs.readFileSync(file));} } }
 visit(directory);return hash.digest('hex');
}
function entryFor(selectedScope) {
 const selectedConfig=selectedScope==='project'?path.join(process.cwd(),'.clio-coder'):process.env.CLIO_CODER_CONFIG_DIR;
 const selectedRoot=path.join(selectedConfig,'plugins','wtfp'), sf=path.join(selectedConfig,'plugins','state.json');
 if(!fs.existsSync(selectedRoot))return null;
 const s=fs.existsSync(sf)?JSON.parse(fs.readFileSync(sf)):{installed:{},disabled:[]};
 const valid=s.installed.wtfp?.contentDigest===digest(selectedRoot),enabled=!s.disabled.includes('wtfp');
 return {id:'wtfp',version:'0.6.0-rc.3',scope:selectedScope,rootPath:selectedRoot,valid,enabled,compatible:true,loadable:valid&&enabled,diagnostics:valid?[]:[{type:'error',message:'unregistered/digest mismatch'}]};
}
if(process.env.FAKE_CLIO_LOG) fs.appendFileSync(process.env.FAKE_CLIO_LOG, JSON.stringify({args,cwd:process.cwd(),config})+'\\n');
const state=read();
if(command==='install') {
 if(fs.existsSync(root)&&!args.includes('--force'))throw Error('library destination already exists: '+root);
 fs.rmSync(root,{recursive:true,force:true});
 fs.cpSync(args[2],root,{recursive:true});
 state.installed.wtfp={installedAt:new Date().toISOString(),source:args[2],contentDigest:digest(root)};
 state.disabled=state.disabled.filter(id=>id!=='wtfp');save(state);
 if(process.env.FAKE_RECEIPT_FAILURE)fs.mkdirSync(path.join(config,'.wtfp-version'));
 if(process.env.FAKE_PARTIAL_FAILURE)process.exit(1);
 if(process.env.FAKE_CONCURRENT_EDIT){fs.writeFileSync(path.join(root,'concurrent-note.txt'),'keep concurrent work');process.exit(1);}
 if(process.env.FAKE_VERIFY_FAILURE)fs.writeFileSync(path.join(base,'fail-next-inspect'),'');
 console.log('ok: installed wtfp ('+scope+')');
} else if(command==='list') {
 const plugins=[];
 for(const selectedScope of ['user','project']) { const entry=entryFor(selectedScope); if(entry)plugins.push(entry); }
 console.log(JSON.stringify({plugins}));
} else if(command==='inspect') {
 if(fs.existsSync(path.join(base,'fail-next-inspect'))){fs.unlinkSync(path.join(base,'fail-next-inspect'));process.exit(1);}
 const entry=entryFor('project')||entryFor('user');
 if(!entry){console.log(JSON.stringify({ok:false,error:'plugin not installed: wtfp'}));process.exit(1);}
 console.log(JSON.stringify(entry));
} else if(command==='remove') {
 fs.rmSync(root,{recursive:true,force:true});delete state.installed.wtfp;state.disabled=state.disabled.filter(id=>id!=='wtfp');save(state);
 console.log('ok: removed wtfp');
} else throw Error('unexpected native command '+args.join(' '));
`, { mode: 0o755 });
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }
function context(name, project = false) {
 const cwd = path.join(scratch,name);fs.mkdirSync(cwd);
 const target = path.join(cwd, project ? '.clio-coder' : 'config');
 return { cwd,target,env:{...process.env,PATH:fakeBin,HOME:cwd,USERPROFILE:cwd,CLIO_CODER_CONFIG_DIR:target,FAKE_CLIO_LOG:path.join(cwd,'calls.jsonl'),NO_COLOR:'1'} };
}
function run(ctx, entry, args, env={}) {
 return spawnSync(process.execPath,[path.join(ROOT,'bin',entry),...args],{cwd:ctx.cwd,env:{...ctx.env,...env},encoding:'utf8',timeout:30000});
}
function install(ctx, env={}) { return run(ctx,'install.js',['install','clio','--config-dir',ctx.target,'--advanced','--force'],env); }
function uninstall(ctx) { return run(ctx,'uninstall.js',['--clio','--config-dir',ctx.target,'--yes']); }
function ok(result) { assert.ifError(result.error);assert.strictEqual(result.status,0,result.stdout+'\n'+result.stderr); }
function state(ctx) { return JSON.parse(fs.readFileSync(path.join(ctx.target,'plugins/state.json'))); }
function calls(ctx) { return fs.readFileSync(ctx.env.FAKE_CLIO_LOG,'utf8').trim().split('\n').map(JSON.parse); }
function verifyReceipt(ctx) {
 const receipt=JSON.parse(fs.readFileSync(path.join(ctx.target,'.wtfp-version')));
 assert.strictEqual(receipt.schemaVersion,2);assert.strictEqual(receipt.runtime,'clio');
 assert.ok(receipt.files.length>0);
 for(const item of receipt.files) {
  assert.ok(item.path.startsWith('plugins/wtfp/'));
  assert.strictEqual(sha256Buffer(fs.readFileSync(path.join(ctx.target,item.path))),item.sha256);
 }
 assert.ok(!receipt.files.some(f=>f.path==='plugins/state.json'));
 return receipt;
}
try {
 test('clio config root follows Clio: CLIO_CODER_CONFIG_DIR, then CLIO_CODER_HOME/config, then the platform default',()=>{
  const resolve=MANIFEST.clio.resolveConfigRoot;
  assert.strictEqual(resolve({CLIO_CODER_CONFIG_DIR:'/explicit',CLIO_CODER_HOME:'/home-root',XDG_CONFIG_HOME:'/xdg'},'linux','/h'),'/explicit');
  assert.strictEqual(resolve({CLIO_CODER_CONFIG_DIR:'  ',CLIO_CODER_HOME:'/home-root',XDG_CONFIG_HOME:'/xdg'},'linux','/h'),path.join('/home-root','config'));
  assert.strictEqual(resolve({XDG_CONFIG_HOME:'/xdg'},'linux','/h'),path.join('/xdg','clio-coder'));
  assert.strictEqual(resolve({},'linux','/h'),path.join('/h','.config','clio-coder'));
  assert.strictEqual(resolve({XDG_CONFIG_HOME:'/xdg'},'darwin','/h'),path.join('/h','Library','Application Support','clio-coder','config'));
  assert.strictEqual(resolve({APPDATA:'/appdata'},'win32','/h'),path.join('/appdata','clio-coder','config'));
 });
 test('XDG_CONFIG_HOME without CLIO_CODER_CONFIG_DIR installs into the profile Clio reads',()=>{
  const cwd=path.join(scratch,'xdg');fs.mkdirSync(cwd);
  const xdg=path.join(cwd,'xdg-config');const target=path.join(xdg,'clio-coder');
  const env={...process.env,PATH:fakeBin,HOME:cwd,USERPROFILE:cwd,XDG_CONFIG_HOME:xdg,FAKE_CLIO_LOG:path.join(cwd,'calls.jsonl'),NO_COLOR:'1'};
  delete env.CLIO_CODER_CONFIG_DIR;delete env.CLIO_CODER_HOME;
  const result=spawnSync(process.execPath,[path.join(ROOT,'bin','install.js'),'install','clio','--advanced','--force'],{cwd,env,encoding:'utf8',timeout:30000});
  ok(result);
  assert.ok(fs.existsSync(path.join(target,'plugins/wtfp/plugin.json')),'bundle must land under $XDG_CONFIG_HOME/clio-coder');
  assert.ok(!fs.existsSync(path.join(cwd,'.config')),'must not fall back to ~/.config when XDG_CONFIG_HOME is set');
  const ctx={cwd,target,env};
  assert.strictEqual(verifyReceipt(ctx).scope,'user');
  for(const call of calls(ctx)) assert.strictEqual(call.config,target,'native CLI must be pointed at the same profile');
  const removal=spawnSync(process.execPath,[path.join(ROOT,'bin','uninstall.js'),'--clio','--yes'],{cwd,env,encoding:'utf8',timeout:30000});ok(removal);
  assert.ok(!fs.existsSync(path.join(target,'plugins/wtfp')));
 });
 test('missing binary stages the canonical plugin with a v2 receipt and explicit activation instructions',()=>{
  const ctx=context('pending');const result=install(ctx,{PATH:''});ok(result);
  const pendingText=result.stdout+result.stderr;
  assert.match(pendingText,/Activation is pending: once clio-coder is on PATH, re-run npx wtf-p install clio --config-dir '.*' from this directory to register the user-scope plugin/);
  assert.ok(!/plugins install/.test(pendingText),'must not tell the operator to run plugins install against the managed root');
  assert.ok(fs.existsSync(path.join(ctx.target,'plugins/wtfp/plugin.json')));
  assert.ok(!fs.existsSync(path.join(ctx.target,'extensions/wtfp')));
  assert.ok(!fs.existsSync(path.join(ctx.target,'plugins/state.json')));verifyReceipt(ctx);
  ok(run(ctx,'uninstall.js',['--clio','--config-dir',ctx.target,'--yes'],{PATH:''}));
  assert.ok(!fs.existsSync(path.join(ctx.target,'plugins/wtfp')));
 });
 for(const project of [false,true]) test(`native ${project?'project':'user'} install/inspect/remove preserves other registrations`,()=>{
  const ctx=context(project?'project':'user',project);fs.mkdirSync(path.join(ctx.target,'plugins'),{recursive:true});
  const other={installedAt:'2026-09-01T00:00:00Z',source:'/other',contentDigest:'a'.repeat(64)};
  fs.writeFileSync(path.join(ctx.target,'plugins/state.json'),JSON.stringify({version:1,disabled:['other'],installed:{other}}));
  ok(install(ctx));assert.strictEqual(verifyReceipt(ctx).scope,project?'project':'custom');assert.deepStrictEqual(state(ctx).installed.other,other);
  assert.ok(state(ctx).installed.wtfp.contentDigest);
  const detected=detectInstallation(ctx.target);
  assert.strictEqual(detected.partial,false);
  assert.strictEqual(detected.hasCommands,true);assert.strictEqual(detected.hasSkills,true);assert.strictEqual(detected.hasAgents,true);
  const nativeInstall=calls(ctx).find(c=>c.args[1]==='install');
  assert.ok(nativeInstall.args.includes(project?'--project':'--user'));assert.ok(!nativeInstall.args.includes('--force'));
  assert.ok(calls(ctx).some(c=>JSON.stringify(c.args)===JSON.stringify(['plugins','inspect','wtfp','--json'])));
  ok(install(ctx));assert.strictEqual(calls(ctx).filter(c=>c.args[1]==='install').length,1,'unchanged active install must be idempotent');
  ok(uninstall(project?{...ctx,cwd:scratch}:ctx));assert.ok(!state(ctx).installed.wtfp);assert.deepStrictEqual(state(ctx).installed.other,other);
  assert.deepStrictEqual(state(ctx).disabled,['other']);assert.ok(calls(ctx).some(c=>c.args[1]==='remove'));
  assert.ok(!fs.existsSync(path.join(ctx.target,'.wtfp-version')));
 });
 test('native verification failure rolls back created files and shared registration',()=>{
  const ctx=context('verify-failure');const result=install(ctx,{FAKE_VERIFY_FAILURE:'1'});assert.notStrictEqual(result.status,0,result.stdout+result.stderr);
  assert.ok(!fs.existsSync(path.join(ctx.target,'plugins/wtfp')));
  assert.ok(!fs.existsSync(path.join(ctx.target,'.wtfp-version')));
 });
 test('receipt failure compensates native registration before rolling back file identities',()=>{
  const ctx=context('receipt-failure');const result=install(ctx,{FAKE_RECEIPT_FAILURE:'1'});assert.notStrictEqual(result.status,0);
  assert.ok(!fs.existsSync(path.join(ctx.target,'plugins/wtfp')));
  assert.ok(calls(ctx).some(c=>c.args[1]==='remove'));
 });
 test('existing plugin retains its receipt path when the native binary disappears',()=>{
  const ctx=context('plugin-offline');ok(install(ctx));const original=state(ctx);
  const pending=install(ctx,{PATH:''});ok(pending);
  assert.match(pending.stdout+pending.stderr,/Activation is pending: once clio-coder is on PATH, re-run npx wtf-p install clio/);
  assert.ok(!fs.existsSync(path.join(ctx.target,'extensions/wtfp')));verifyReceipt(ctx);
  ok(run(ctx,'uninstall.js',['--clio','--config-dir',ctx.target,'--yes'],{PATH:''}));
  assert.ok(!fs.existsSync(path.join(ctx.target,'plugins/wtfp')));assert.deepStrictEqual(state(ctx),original);
 });
 test('partial native installation is compensated',()=>{
  const ctx=context('partial-native');const result=install(ctx,{FAKE_PARTIAL_FAILURE:'1'});
  assert.notStrictEqual(result.status,0);assert.ok(!fs.existsSync(path.join(ctx.target,'plugins/wtfp')));
  assert.ok(!fs.existsSync(path.join(ctx.target,'.wtfp-version')));
 });
 test('concurrent native content is preserved with explicit recovery diagnostics',()=>{
  const ctx=context('concurrent-native');const result=install(ctx,{FAKE_CONCURRENT_EDIT:'1'});
  assert.notStrictEqual(result.status,0);assert.match(result.stdout+result.stderr,/changed concurrently.*recovery tree preserved/);
  assert.strictEqual(fs.readFileSync(path.join(ctx.target,'plugins/wtfp/concurrent-note.txt'),'utf8'),'keep concurrent work');
  assert.ok(fs.readdirSync(path.join(ctx.target,'plugins')).some(name=>name.startsWith('.wtfp-staged-')));
 });
 test('uninstall preserves unowned siblings instead of allowing recursive native removal',()=>{
  const ctx=context('unowned');ok(install(ctx));const extra=path.join(ctx.target,'plugins/wtfp/author-note.txt');fs.writeFileSync(extra,'keep');
  ok(uninstall(ctx));assert.strictEqual(fs.readFileSync(extra,'utf8'),'keep');
  assert.ok(!calls(ctx).some(c=>c.args[1]==='remove'));assert.ok(state(ctx).installed.wtfp);
 });
 test('modified owned files preserve native registration during partial uninstall',()=>{
  const ctx=context('modified');ok(install(ctx));const file=path.join(ctx.target,'plugins/wtfp/ai.iowarp.clio/prompts/wtfp/new-paper.md');fs.appendFileSync(file,'\nlocal edit\n');
  ok(uninstall(ctx));assert.match(fs.readFileSync(file,'utf8'),/local edit/);
  assert.ok(!calls(ctx).some(c=>c.args[1]==='remove'));assert.ok(state(ctx).installed.wtfp);
 });
 console.log(`\nClio installer tests: ${passed} passed.`);
} finally { fs.rmSync(scratch,{recursive:true,force:true}); }
