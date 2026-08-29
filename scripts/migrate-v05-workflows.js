#!/usr/bin/env node

/**
 * One-way migration of the detailed v0.5 Claude command bodies into the
 * host-neutral workflow layer. This is intentionally separate from adapter
 * generation: once protocol/workflows exists, generated vendor files are
 * never accepted as compiler input.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'vendors', 'claude', 'commands', 'wtfp');
const DESTINATION = path.join(ROOT, 'protocol', 'workflows');

function stripFrontmatter(source) {
  if (!source.startsWith('---\n')) return source;
  const end = source.indexOf('\n---\n', 4);
  if (end === -1) throw new Error('unterminated command frontmatter');
  return source.slice(end + 5);
}

function normalizePortableText(source) {
  return source
    .replaceAll('@~/.claude/write-the-f-paper/', '@protocol://core/')
    .replaceAll('~/.claude/write-the-f-paper/', 'protocol://core/')
    .replace(/~\/\.claude\/agents\/wtfp\/([a-z0-9-]+)\.md/g, 'protocol://roles/$1.md')
    .replaceAll("$HOME/.claude/bin/lib/", 'protocol://tools/')
    .replaceAll('~/.claude/bin/', 'protocol://tools/')
    .replaceAll('@~/.claude/CONTRIBUTING.md', '@protocol://repository/CONTRIBUTING.md')
    .replaceAll('AskUserQuestion', 'the host user-interaction capability')
    .replaceAll('Task tool', 'specialist delegation')
    .replaceAll('Task agents', 'specialist agents')
    .replaceAll('Task agent', 'specialist agent')
    .replaceAll('Task(', 'delegate(')
    .replaceAll('subagent_type=', 'role_class=')
    .replaceAll('role_class=', 'role=')
    .replaceAll('model=', 'profile=')
    .replaceAll('$ARGUMENTS', '{{arguments}}')
    .replace(/^@(\.planning\/\S+)$/gm, '@project://$1')
    .replace(/^@(paper\/\S+)$/gm, '@project://$1')
    .replace(/^@\{paper content file\}$/gm, '@project://paper/{section}.md')
    .replaceAll('claude_mode', 'assistant_mode')
    .replaceAll('allowed-tools:', 'required-capabilities:')
    .replaceAll('protocol://core/references/[relevant].md', 'protocol://core/references/{reference}.md')
    .replaceAll('project://paper/[section].md', 'project://paper/{section}.md')
    .replaceAll('Claude Code', 'the active agent host')
    .replace(/\bClaude's\b/g, "the assistant's")
    .replace(/\bClaude\b/g, 'the assistant')
    .replace(/\b(?:sonnet|opus|haiku)\b/gi, 'the configured model profile')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function portableBody(source) {
  return normalizePortableText(stripFrontmatter(source));
}

function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`v0.5 command source not found: ${SOURCE}`);
  fs.mkdirSync(DESTINATION, { recursive: true });
  const files = fs.readdirSync(SOURCE)
    .filter((file) => file.endsWith('.md'))
    .sort();
  if (files.length !== 36) throw new Error(`expected 36 v0.5 commands, found ${files.length}`);

  for (const file of files) {
    const destination = path.join(DESTINATION, file);
    if (fs.existsSync(destination)) {
      throw new Error(`refusing to replace canonical workflow: ${destination}`);
    }
    const body = portableBody(fs.readFileSync(path.join(SOURCE, file), 'utf8'));
    const action = path.basename(file, '.md');
    const migrated = [
      '---',
      'schema: wtfp.workflow/v1',
      `action: ${action}`,
      'source: wtfp.protocol',
      '---',
      '',
      `<!-- Migrated from the v0.5 workflow and normalized for host-neutral compilation. -->`,
      '',
      body,
      ''
    ].join('\n');
    fs.writeFileSync(destination, migrated, 'utf8');
  }
  process.stdout.write(`Migrated ${files.length} workflows into protocol/workflows.\n`);
}

function normalizeExisting() {
  if (!fs.existsSync(DESTINATION)) throw new Error(`canonical workflow directory not found: ${DESTINATION}`);
  const files = fs.readdirSync(DESTINATION).filter((file) => file.endsWith('.md')).sort();
  for (const file of files) {
    const target = path.join(DESTINATION, file);
    fs.writeFileSync(target, `${normalizePortableText(fs.readFileSync(target, 'utf8'))}\n`, 'utf8');
  }
  process.stdout.write(`Normalized ${files.length} existing canonical workflows.\n`);
}

if (require.main === module) {
  try {
    if (process.argv.includes('--normalize-existing')) normalizeExisting();
    else main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { normalizePortableText, portableBody, stripFrontmatter };
