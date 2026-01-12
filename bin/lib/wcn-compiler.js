/**
 * WCN Compiler (Workflow Compression Notation)
 * A robust, state-machine based compiler for converting Verbose Markdown to Compressed WCN.
 */

const FLUFF_PATTERNS = [
  /This ensures[^.]*\./g,
  /This is important[^.]*\./g,
  /Note that[^.]*\./g,
  /Keep in mind[^.]*\./g,
  /Remember that[^.]*\./g,
  /As mentioned[^.]*\./g,
  /It is important to[^.]*\./g,
];

class WCNCompiler {
  constructor() {
    this.lines = [];
    this.output = [];
    this.state = 'ROOT'; // ROOT, STEP, BASH
    this.context = {};
  }

  compile(markdown) {
    // 1. Pre-process: Remove fluff and normalize
    let cleanMd = markdown;
    FLUFF_PATTERNS.forEach(p => cleanMd = cleanMd.replace(p, ''));
    
    this.lines = cleanMd.split('\n');
    this.output = [];
    this.state = 'ROOT';
    
    // 2. Parse Line by Line
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i].trim();
      this.processLine(line, i);
    }

    // 3. Post-process: Clean up excessive newlines
    return this.output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  processLine(line, index) {
    // Handle State Transitions
    if (this.state === 'ROOT') {
      if (line.startsWith('<step')) {
        this.enterStep(line);
      } else if (line.startsWith('<context>')) {
        this.enterContext();
      } else if (line.startsWith('**If') && line.endsWith(':**')) {
        // Handle standalone conditionals (outside steps, rare but possible)
        this.parseConditional(line, index);
      } else if (line.startsWith('**Route')) {
        this.parseRoute(line, index);
      } else if (!line.startsWith('</')) {
        // Pass through other content, but minimal
        // We generally skip prose outside steps in WCN unless it's structural
        if (line.startsWith('#') || line.startsWith('---')) {
          this.output.push(line);
        }
      }
    } else if (this.state === 'STEP') {
      if (line.startsWith('</step>')) {
        this.exitStep();
      } else if (line.startsWith('```bash')) {
        this.state = 'BASH';
      } else if (line.startsWith('**If') && line.endsWith(':**')) {
        this.parseConditional(line, index);
      } else if (line.toLowerCase().startsWith('parse and internalize:')) {
        this.parseParseBlock(index);
      } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        // Capture bullet points as instructions
        this.output.push(line.trim());
      } else if (line.trim().startsWith('**') && !line.includes('If')) {
        // Capture bold instructions
        this.output.push(line.trim());
      }
    } else if (this.state === 'BASH') {
      if (line.startsWith('```')) {
        this.state = 'STEP';
      } else {
        // Capture bash command (first line usually sufficient for WCN)
        if (line && !line.startsWith('#')) {
          this.output.push(`RUN: ${line}`);
          // Skip rest of bash block for WCN brevity? 
          // Current logic captures all commands. Let's capture all.
        }
      }
    }
  }

  enterStep(line) {
    this.state = 'STEP';
    // Parse attributes: name="foo" priority="bar"
    const nameMatch = line.match(/name="([^"]+)"/);
    const priorityMatch = line.match(/priority="([^"]+)"/);
    
    const name = nameMatch ? nameMatch[1] : 'unknown';
    const pAttr = priorityMatch ? ` p=${priorityMatch[1] === 'first' ? '1' : priorityMatch[1]}` : '';
    
    this.output.push(`[step:${name}${pAttr}]`);
  }

  exitStep() {
    this.output.push('[/step]');
    this.state = 'ROOT';
  }

  enterContext() {
    // Context is usually multiline, handled by looking ahead or buffering
    // For simplicity, we'll scan ahead here since we have full lines access
    // But sticking to line-by-line:
    // Actually, Regex is better for Context blocks as they are simple <context>...</context>
    // Let's defer this to a specialized Regex pass *before* line processing?
    // Or just look ahead now.
    // Let's skip for now and rely on a pre-pass replacement for Context, similar to current tool.
    // Why? Because Context is global metadata, usually at top.
  }

  parseConditional(line, index) {
    // **If mode="yolo":**
    const condition = line.replace(/\*\*If\s+/, '').replace(/:\*\*/, '').trim().replace(/["']/g, '');
    
    // Look ahead for the action
    // Usually the next line or the line after
    let action = '';
    for (let i = 1; i < 5; i++) {
      const next = this.lines[index + i];
      if (next && next.trim()) {
        action = next.trim();
        break;
      }
    }

    if (action) {
      // Simplify action text
      if (action.length > 50) action = action.substring(0, 47) + '...';
      this.output.push(`IF ${condition} → ${action}`);
    }
  }

  parseParseBlock(index) {
    // Parse and internalize:
    // - Item 1
    // - Item 2
    const fields = [];
    for (let i = 1; i < 10; i++) {
      const next = this.lines[index + i];
      if (!next || (!next.trim().startsWith('-') && !next.trim().startsWith('*'))) break;
      
      const field = next.replace(/^[-*]\s+/, '').trim().split(' ')[0].toLowerCase().replace(/\s+/g, '_');
      fields.push(field);
    }
    
    if (fields.length > 0) {
      this.output.push(`PARSE: ${fields.join(', ')}`);
    }
  }

  parseRoute(line, index) {
    // **Route A: Title**
    const match = line.match(/\*\*Route\s+([A-Z]):\s*([^*]+)\*\*/);
    if (!match) return;

    // We need to buffer the route table
    // This is hard to do line-by-line without buffering.
    // Let's assume we handle Routes via Regex pre-pass like the original, 
    // OR we detect the start of a route block and switch state.
    // Given the complexity, let's stick to the Regex for Routes/Modes/Context
    // and use State Machine for the detailed STEP logic which is where the fragility usually is.
  }
}

/**
 * Hybrid Compiler:
 * 1. Uses Regex for high-level blocks (Context, Routes, Modes)
 * 2. Uses State Machine for Steps (the most complex part)
 */
function compile(markdown) {
  let result = markdown;

  // 1. Remove fluff
  FLUFF_PATTERNS.forEach(p => result = result.replace(p, ''));

  // 2. Compress Context (Regex is fine here)
  result = result.replace(/<context>\s*([\s\S]*?)<\/context>/g, (match, content) => {
    const files = content.match(/@[^\s\n]+/g) || [];
    if (files.length === 0) return '';
    const simplified = files.map(f => f.replace('@.planning/', ''));
    return `@context{${simplified.join(',')}}`;
  });

  // 3. Compress Routes (Regex is fine here)
  const routes = [];
  result = result.replace(/\*\*Route\s+([A-Z]):\s*([^*]+)\*\*\s*([\s\S]*?)(?=\*\*Route|<step|$)/g, (match, id, title, content) => {
    // Extract next step logic
    const nextMatch = content.match(/\`\/wtfp:([^`]+)\`/);
    const next = nextMatch ? `/wtfp:${nextMatch[1]}` : 'continue';
    routes.push(`  ${title.trim().toLowerCase().replace(/\s+/g, '_')} → "${title.trim()}" → ${next}`);
    return '';
  });
  if (routes.length > 0) {
    result = result + '\n\nROUTE{condition → output → next}:\n' + routes.join('\n');
  }

  // 4. Compress Modes (Regex is fine here)
  const modes = [];
  result = result.replace(/\*\*If\s+mode="([^"]+)":\*\*\s*\n((?:[-*]\s+[^\n]+\n?)+)/g, (match, mode, items) => {
    const itemList = items.split('\n').filter(l => l.trim()).map(l => l.replace(/^[-*]\s+/, '').trim());
    modes.push(`  ${mode} | ${itemList[0] || ''}`);
    return '';
  });
  if (modes.length > 0) {
    result = 'MODE{name,action}:\n' + modes.join('\n') + '\n\n' + result;
  }

  // 5. Compress Steps using State Machine (The Core Logic)
  const compiler = new WCNCompiler();
  // We only run the compiler on the text that remains (which should be mostly steps)
  // But wait, the compiler expects full text to find steps.
  // Let's pass the text to the compiler, but the compiler only outputs Step blocks and structural elements.
  
  return compiler.compile(result);
}

module.exports = { compile, WCNCompiler };
