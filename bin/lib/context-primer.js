/**
 * Context Primer - Section-specific context extraction
 *
 * Reduces context burn for long papers by loading only relevant
 * portions of PROJECT.md, argument-map.md, etc. for each task.
 */

const fs = require('fs');
const path = require('path');

/**
 * Section type → relevant context files mapping
 */
const SECTION_CONTEXT_MAP = {
  abstract: ['argument-map.md', 'outline.md', 'narrative-arc.md'],
  introduction: ['argument-map.md', 'narrative-arc.md'],
  'literature-review': ['argument-map.md'],
  'related-work': ['argument-map.md'],
  methods: ['argument-map.md'],
  results: ['argument-map.md'],
  discussion: ['argument-map.md', 'narrative-arc.md'],
  conclusion: ['argument-map.md', 'narrative-arc.md'],
  // Grant-specific
  'specific-aims': ['argument-map.md'],
  background: ['argument-map.md', 'narrative-arc.md'],
  approach: ['argument-map.md'],
};

/**
 * Extract relevant sections from PROJECT.md based on task type
 * @param {string} projectContent - Full PROJECT.md content
 * @param {string} taskType - Type of task (plan, write, review, research)
 * @returns {string} - Filtered PROJECT.md content
 */
function filterProject(projectContent, taskType) {
  if (!projectContent) return '';

  // Always include: What This Is, Core Argument
  const alwaysSections = ['What This Is', 'Core Argument'];

  // Task-specific sections
  const taskSections = {
    plan: ['Requirements', 'Target Audience', 'Constraints'],
    write: ['Core Argument', 'Target Audience'],
    review: ['Requirements', 'Core Argument', 'Constraints'],
    research: ['Core Argument', 'Target Audience', 'Key Decisions'],
    polish: ['Target Audience'],
  };

  const needed = [...alwaysSections, ...(taskSections[taskType] || alwaysSections)];
  return extractSections(projectContent, needed);
}

/**
 * Extract relevant structure files for a section type
 * @param {string} planningDir - Path to .planning directory
 * @param {string} sectionSlug - Section slug (e.g., 'introduction', 'methods')
 * @returns {Object} - Map of filename → content
 */
function getStructureContext(planningDir, sectionSlug) {
  const structureDir = path.join(planningDir, 'structure');
  const result = {};

  // Normalize section slug for lookup
  const normalized = sectionSlug.toLowerCase().replace(/\d+-/, '').replace(/\s+/g, '-');

  // Find matching context files
  const relevantFiles = SECTION_CONTEXT_MAP[normalized] || ['argument-map.md'];

  for (const file of relevantFiles) {
    const filePath = path.join(structureDir, file);
    if (fs.existsSync(filePath)) {
      result[file] = fs.readFileSync(filePath, 'utf8');
    }
  }

  return result;
}

/**
 * Load section-specific context (CONTEXT.md + RESEARCH.md)
 * @param {string} sectionDir - Path to section directory
 * @returns {Object} - { context, research }
 */
function getSectionContext(sectionDir) {
  const result = { context: '', research: '' };

  if (!fs.existsSync(sectionDir)) return result;

  const files = fs.readdirSync(sectionDir);
  for (const f of files) {
    if (f.endsWith('-CONTEXT.md')) {
      result.context = fs.readFileSync(path.join(sectionDir, f), 'utf8');
    }
    if (f.endsWith('-RESEARCH.md')) {
      result.research = fs.readFileSync(path.join(sectionDir, f), 'utf8');
    }
  }

  return result;
}

/**
 * Get prior section summaries relevant to current section
 * @param {string} sectionsDir - Path to .planning/sections/
 * @param {number} currentSection - Current section number
 * @param {number} limit - Max characters to return
 * @returns {string} - Concatenated relevant summaries
 */
function getPriorSummaries(sectionsDir, currentSection, limit = 3000) {
  if (!fs.existsSync(sectionsDir)) return '';

  const dirs = fs.readdirSync(sectionsDir)
    .filter(d => {
      const num = parseInt(d.split('-')[0], 10);
      return !isNaN(num) && num < currentSection;
    })
    .sort();

  let output = '';
  // Work backwards from most recent, within limit
  for (const dir of dirs.reverse()) {
    const dirPath = path.join(sectionsDir, dir);
    const summaries = fs.readdirSync(dirPath).filter(f => f.endsWith('-SUMMARY.md'));

    for (const s of summaries) {
      const content = fs.readFileSync(path.join(dirPath, s), 'utf8');
      // Extract just the header section (up to first ---)
      const header = content.split('---')[0] || content.slice(0, 500);
      if (output.length + header.length > limit) return output;
      output = header + '\n---\n' + output;
    }
  }

  return output;
}

/**
 * Build complete primed context for an agent spawn
 * @param {Object} options
 * @param {string} options.planningDir - Path to .planning/
 * @param {string} options.sectionDir - Path to section directory
 * @param {number} options.sectionNumber - Section number
 * @param {string} options.sectionSlug - Section slug
 * @param {string} options.taskType - plan|write|review|research|polish
 * @returns {Object} - All context pieces, filtered for relevance
 */
function primeContext({ planningDir, sectionDir, sectionNumber, sectionSlug, taskType }) {
  const projectPath = path.join(planningDir, 'PROJECT.md');
  const statePath = path.join(planningDir, 'STATE.md');
  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  const sectionsDir = path.join(planningDir, 'sections');

  const projectContent = fs.existsSync(projectPath)
    ? fs.readFileSync(projectPath, 'utf8') : '';

  return {
    project: filterProject(projectContent, taskType),
    state: fs.existsSync(statePath) ? fs.readFileSync(statePath, 'utf8') : '',
    roadmap: fs.existsSync(roadmapPath) ? fs.readFileSync(roadmapPath, 'utf8') : '',
    structure: getStructureContext(planningDir, sectionSlug),
    section: getSectionContext(sectionDir),
    priorSummaries: getPriorSummaries(sectionsDir, sectionNumber),
  };
}

// --- Helpers ---

/**
 * Extract named sections from markdown content
 * @param {string} content - Markdown content
 * @param {string[]} sectionNames - Section heading names to extract
 * @returns {string} - Extracted sections joined
 */
function extractSections(content, sectionNames) {
  if (!content) return '';

  const lines = content.split('\n');
  const extracted = [];
  let capturing = false;
  let currentLevel = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const name = headingMatch[2].trim();

      if (sectionNames.some(s => name.includes(s))) {
        capturing = true;
        currentLevel = level;
        extracted.push(line);
      } else if (capturing && level <= currentLevel) {
        capturing = false;
      } else if (capturing) {
        extracted.push(line);
      }
    } else if (capturing) {
      extracted.push(line);
    }
  }

  return extracted.join('\n');
}

module.exports = {
  filterProject,
  getStructureContext,
  getSectionContext,
  getPriorSummaries,
  primeContext,
  SECTION_CONTEXT_MAP,
};
