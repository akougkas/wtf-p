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
const { nativeEnvironment } = require('../bin/lib/native-registration');
const ROOT = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wtfp-clio-installer-'));
const fakeBin = path.join(scratch, 'bin');
fs.mkdirSync(fakeBin);
// Emulate Clio's library lifecycle, not merely a successful exit code: the
// destination tree is owned and replaced by the client, `state.json` records
// the content digest, and `inspect` reports the installed entry.
fs.writeFileSync(path.join(fakeBin, 'clio-coder'), `#!${process.execPath}
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const args = process.argv.slice(2), command = args[1];
if (args[0] !== 'library' || args.includes('--yes')) { console.error('unsupported library command'); process.exit(2); }
if(command==='list' && JSON.stringify(args)!==JSON.stringify(['library','list','--kind','plugin','--json']))throw Error('incorrect list contract');
if(command!=='list' && (!args.includes('--json') || (!args.includes('--user') && !args.includes('--project'))))throw Error('explicit scope and JSON required');
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
 return {id:'wtfp',kind:'plugin',trust:'trusted',version:JSON.parse(fs.readFileSync(path.join(selectedRoot,'plugin.json'))).version,scope:selectedScope,rootPath:selectedRoot,valid,enabled,compatible:true,loadable:valid&&enabled,diagnostics:valid?[]:[{type:'error',message:'unregistered/digest mismatch'}]};
}
if(process.env.FAKE_CLIO_LOG) fs.appendFileSync(process.env.FAKE_CLIO_LOG, JSON.stringify({args,cwd:process.cwd(),config})+'\\n');
const state=read();
if(command==='install') {
 if(fs.existsSync(root)&&!args.includes('--force'))throw Error('library destination already exists: '+root);
 fs.rmSync(root,{recursive:true,force:true});
 fs.cpSync(args[2],root,{recursive:true});
 const previouslyInstalled=Boolean(state.installed.wtfp);
 state.installed.wtfp={installedAt:new Date().toISOString(),source:args[2],contentDigest:digest(root)};
 if(!previouslyInstalled)state.disabled=state.disabled.filter(id=>id!=='wtfp');save(state);
 if(process.env.FAKE_RECEIPT_FAILURE)fs.mkdirSync(path.join(config,'.wtfp-version'));
 if(process.env.FAKE_PARTIAL_FAILURE)process.exit(1);
 if(process.env.FAKE_CONCURRENT_EDIT){fs.writeFileSync(path.join(root,'concurrent-note.txt'),'keep concurrent work');process.exit(1);}
 if(process.env.FAKE_VERIFY_FAILURE)fs.writeFileSync(path.join(base,'fail-next-inspect'),'');
 console.log(JSON.stringify({ok:true,confirmed:true,id:'wtfp',path:root,sha256:digest(root),writes:[{ref:'plugin:wtfp',path:root,sha256:digest(root),sourceUrl:args[2]}],results:[{}]}));
} else if(command==='list') {
 const installed=[];
 for(const selectedScope of ['user','project']) { const entry=entryFor(selectedScope); if(entry)installed.push(entry); }
 const entry={kind:'plugin',name:'wtfp',description:'Writing workflows',sourceUrl:root,origin:'installed',installed};
 // The catalog may also contain packages with no installed copies.
 const available={kind:'plugin',name:'available-only',description:'Available package',sourceUrl:'/catalog/available',origin:'catalog',installed:[]};
 let listing={entries:[available,entry],diagnostics:[]};
 if(process.env.FAKE_LIST_JSON)listing=JSON.parse(process.env.FAKE_LIST_JSON);
 if(process.env.FAKE_REMOVE_RESIDUE && fs.existsSync(path.join(base,'removed')))entry.installed.push({id:'wtfp',kind:'plugin',scope,rootPath:root,valid:false,enabled:true,diagnostics:[]});
 console.log(JSON.stringify(listing));
} else if(command==='inspect') {
 if(fs.existsSync(path.join(base,'fail-next-inspect'))){fs.unlinkSync(path.join(base,'fail-next-inspect'));process.exit(1);}
 const entry=entryFor(scope);
 if(!entry){console.log(JSON.stringify({ok:false,error:'plugin not installed: wtfp'}));process.exit(1);}
 console.log(JSON.stringify(process.env.FAKE_INSPECT_JSON?JSON.parse(process.env.FAKE_INSPECT_JSON):entry));
} else if(command==='remove') {
 if(process.env.FAKE_REMOVE_NOOP){console.log(JSON.stringify({ok:true}));process.exit(0);}
 fs.rmSync(root,{recursive:true,force:true});delete state.installed.wtfp;state.disabled=state.disabled.filter(id=>id!=='wtfp');save(state);
 if(process.env.FAKE_REMOVE_RESIDUE)fs.writeFileSync(path.join(base,'removed'),'');
 console.log(JSON.stringify({ok:true,removed:'plugin:wtfp'}));
} else throw Error('unexpected native command '+args.join(' '));
`, { mode: 0o755 });
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }
function context(name, project = false) {
 const cwd = path.join(scratch,name);fs.mkdirSync(cwd);
 const target = path.join(cwd, project ? '.clio-coder' : 'config');
 return { cwd,target,env:{...process.env,PATH:fakeBin,HOME:cwd,USERPROFILE:cwd,CLIO_CODER_CONFIG_DIR:project?path.join(cwd,'user-profile'):target,FAKE_CLIO_LOG:path.join(cwd,'calls.jsonl'),NO_COLOR:'1'} };
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
 test('project native registration preserves the independent user configuration root',()=>{
  const userRoot=path.join(scratch,'user-profile');
  const projectRoot=path.join(scratch,'project-environment');
  const base={CLIO_CODER_CONFIG_DIR:userRoot,CLIO_CODER_HOME:path.join(scratch,'profile')};
  const projected=nativeEnvironment('clio',path.join(projectRoot,'.clio-coder'),base,{cwd:projectRoot,scope:'project'});
  assert.strictEqual(projected.CLIO_CODER_CONFIG_DIR,userRoot,'project scope must not alias the user installation lock/state');
  assert.deepStrictEqual(base,{CLIO_CODER_CONFIG_DIR:userRoot,CLIO_CODER_HOME:path.join(scratch,'profile')});
  const defaultRoot=nativeEnvironment('clio',path.join(projectRoot,'.clio-coder'),{CLIO_CODER_HOME:path.join(scratch,'profile')},{cwd:projectRoot});
  assert.strictEqual(defaultRoot.CLIO_CODER_CONFIG_DIR,undefined,'preserve Clio default profile resolution');
  assert.strictEqual(nativeEnvironment('clio',userRoot,base,{cwd:projectRoot,scope:'user'}).CLIO_CODER_CONFIG_DIR,userRoot);
 });
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
  assert.ok(!/(?:plugins|library) install/.test(pendingText),'must not tell the operator to run library install against the managed root');
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
  assert.ok(calls(ctx).some(c=>JSON.stringify(c.args)===JSON.stringify(['library','inspect','wtfp',project?'--project':'--user','--json'])));
  ok(install(ctx));assert.strictEqual(calls(ctx).filter(c=>c.args[1]==='install').length,1,'unchanged active install must be idempotent');
  ok(uninstall(project?{...ctx,cwd:scratch}:ctx));assert.ok(!state(ctx).installed.wtfp);assert.deepStrictEqual(state(ctx).installed.other,other);
  assert.deepStrictEqual(state(ctx).disabled,['other']);assert.ok(calls(ctx).some(c=>c.args[1]==='remove'));
  assert.ok(!fs.existsSync(path.join(ctx.target,'.wtfp-version')));
 });
 test('user registration and removal select the user copy while a project copy coexists',()=>{
  const user=context('coexist');
  const project={...user,target:path.join(user.cwd,'.clio-coder')};
  ok(install(project));
  const projectReceipt=fs.readFileSync(path.join(project.target,'.wtfp-version'));
  const projectState=fs.readFileSync(path.join(project.target,'plugins/state.json'));
  ok(install(user));verifyReceipt(user);verifyReceipt(project);
  assert.ok(calls(user).some(c=>c.args[1]==='inspect'&&c.args.includes('--user')));
  ok(uninstall(user));
  assert.ok(!fs.existsSync(path.join(user.target,'plugins/wtfp')));
  assert.ok(projectReceipt.equals(fs.readFileSync(path.join(project.target,'.wtfp-version'))));
  assert.ok(projectState.equals(fs.readFileSync(path.join(project.target,'plugins/state.json'))));
  verifyReceipt(project);ok(uninstall(project));
 });
 for(const project of [false,true]) test(`disabled ${project?'project':'user'} copies remain disabled through idempotence and re-registration`,()=>{
  const ctx=context(project?'disabled-project':'disabled-user',project);ok(install(ctx));
  const file=path.join(ctx.target,'plugins/state.json'), saved=state(ctx);
  saved.disabled.push('wtfp');fs.writeFileSync(file,JSON.stringify(saved));
  const before=fs.readFileSync(file),result=install(ctx);ok(result);
  assert.match(result.stdout+result.stderr,new RegExp('library enable wtfp --'+(project?'project':'user')));
  assert.ok(before.equals(fs.readFileSync(file)),'idempotence must not change disabled state');
  saved.installed.wtfp.contentDigest='0'.repeat(64);fs.writeFileSync(file,JSON.stringify(saved));
  const repaired=install(ctx);ok(repaired);
  assert.match(repaired.stdout+repaired.stderr,/installed but disabled/);
  assert.ok(state(ctx).disabled.includes('wtfp'));verifyReceipt(ctx);
  assert.strictEqual(calls(ctx).filter(c=>c.args[1]==='install').length,2);
  ok(uninstall(ctx));
 });
 test('available catalog entries and installed copies of other kinds never count as registration',()=>{
  const ctx=context('catalog-only');
  const copy={id:'wtfp',scope:'user',rootPath:path.join(ctx.target,'plugins/wtfp'),valid:true,enabled:true,diagnostics:[]};
  const listing={entries:[{kind:'plugin',name:'wtfp',...copy,installed:[]},{kind:'skill',name:'wtfp',installed:[copy]}],diagnostics:[]};
  ok(install(ctx,{FAKE_LIST_JSON:JSON.stringify(listing)}));
  assert.strictEqual(calls(ctx).filter(c=>c.args[1]==='install').length,1);verifyReceipt(ctx);
  ok(uninstall(ctx));
 });
 for(const coordinate of ['id','scope','rootPath']) test(`installed copy with a different ${coordinate} does not authorize registration`,()=>{
  const ctx=context('different-'+coordinate);
  const copy={id:'wtfp',scope:'user',rootPath:path.join(ctx.target,'plugins/wtfp'),valid:true,enabled:true,diagnostics:[]};
  copy[coordinate]=coordinate==='id'?'other':coordinate==='scope'?'project':path.join(ctx.cwd,'foreign','wtfp');
  const listing={entries:[{kind:'plugin',name:copy.id,installed:[copy]}],diagnostics:[]};
  ok(install(ctx,{FAKE_LIST_JSON:JSON.stringify(listing)}));
  assert.strictEqual(calls(ctx).filter(c=>c.args[1]==='install').length,1);verifyReceipt(ctx);ok(uninstall(ctx));
 });
 const malformedListings=[null,{}, {plugins:[]},{entries:[],diagnostics:null},
  {entries:[null],diagnostics:[]},{entries:[{kind:'plugin',name:'wtfp'}],diagnostics:[]},
  ...[null,{}, {id:'wtfp',scope:'user',rootPath:'relative',valid:true,enabled:true,diagnostics:[]}].map(copy=>({entries:[{kind:'plugin',name:'wtfp',installed:[copy]}],diagnostics:[]}))];
 malformedListings.forEach((listing,index)=>test(`malformed library JSON fails closed before native mutation (${index})`,()=>{
  const ctx=context('malformed-'+index),result=install(ctx,{FAKE_LIST_JSON:JSON.stringify(listing)});
  assert.notStrictEqual(result.status,0);assert.match(result.stdout+result.stderr,/Clio library list/);
  assert.ok(calls(ctx).every(c=>c.args[1]==='list'));
  assert.ok(!fs.existsSync(path.join(ctx.target,'plugins/wtfp')));
  assert.ok(!fs.existsSync(path.join(ctx.target,'.wtfp-version')));
 }));
 test('duplicate matching installed copies fail closed',()=>{
  const ctx=context('duplicates');
  const copy={id:'wtfp',scope:'user',rootPath:path.join(ctx.target,'plugins/wtfp'),valid:true,enabled:true,diagnostics:[]};
  const listing={entries:[{kind:'plugin',name:'wtfp',installed:[copy,copy]}],diagnostics:[]};
  const result=install(ctx,{FAKE_LIST_JSON:JSON.stringify(listing)});
  assert.notStrictEqual(result.status,0);assert.match(result.stdout+result.stderr,/duplicate installed plugin identities/);
  assert.ok(calls(ctx).every(c=>c.args[1]==='list'));
 });
 for(const coordinate of ['id','scope','rootPath','valid','diagnostics','enabled']) test(`inspect verifies exact installed ${coordinate} before accepting registration`,()=>{
  const ctx=context('inspect-'+coordinate);
  const copy={id:'wtfp',scope:'user',rootPath:path.join(ctx.target,'plugins/wtfp'),valid:true,enabled:true,diagnostics:[]};
  const wrong={id:'other',scope:'project',rootPath:path.join(ctx.cwd,'foreign'),valid:false,diagnostics:[{type:'error',message:'invalid'}],enabled:'false'};
  copy[coordinate]=wrong[coordinate];
  const result=install(ctx,{FAKE_INSPECT_JSON:JSON.stringify(copy)});
  assert.notStrictEqual(result.status,0);assert.match(result.stdout+result.stderr,/exact WTF-P plugin/);
  assert.ok(!fs.existsSync(path.join(ctx.target,'plugins/wtfp')));
  assert.ok(!state(ctx).installed.wtfp);assert.ok(!fs.existsSync(path.join(ctx.target,'.wtfp-version')));
 });
 test('native verification failure rolls back created files and shared registration',()=>{
  const ctx=context('verify-failure');const result=install(ctx,{FAKE_VERIFY_FAILURE:'1'});assert.notStrictEqual(result.status,0,result.stdout+result.stderr);
  assert.ok(!fs.existsSync(path.join(ctx.target,'plugins/wtfp')));
  assert.ok(!fs.existsSync(path.join(ctx.target,'.wtfp-version')));
  assert.ok(!state(ctx).installed.wtfp);
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
 for(const failure of ['FAKE_REMOVE_NOOP','FAKE_REMOVE_RESIDUE']) test(`rollback verifies native removal and preserves recovery on ${failure}`,()=>{
  const ctx=context('rollback-'+failure),result=install(ctx,{FAKE_VERIFY_FAILURE:'1',[failure]:'1'});
  assert.notStrictEqual(result.status,0);assert.match(result.stdout+result.stderr,/native rollback also failed.*Clio rollback did not/);
  const staged=fs.readdirSync(path.join(ctx.target,'plugins')).find(name=>name.startsWith('.wtfp-staged-'));
  assert.ok(staged);assert.ok(fs.existsSync(path.join(ctx.target,'plugins',staged,'wtfp/plugin.json')));
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
