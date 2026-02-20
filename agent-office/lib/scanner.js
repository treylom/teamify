const fs = require('fs');
const path = require('path');
const { CLAUDE_DIR } = require('../config');

function scanDirectory(dirPath, ext = '.md') {
  if (!fs.existsSync(dirPath)) return [];
  try {
    return fs.readdirSync(dirPath)
      .filter(f => f.endsWith(ext) && !f.startsWith('CHANGELOG') && !f.startsWith('BUGS'))
      .map(f => {
        const fullPath = path.join(dirPath, f);
        const stat = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const frontmatter = extractFrontmatter(content);
        return {
          name: f.replace(ext, ''),
          file: f,
          path: fullPath,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          description: frontmatter.description || extractFirstLine(content),
          tags: frontmatter.tags || [],
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  match[1].split('\n').forEach(line => {
    const [key, ...val] = line.split(':');
    if (key && val.length) result[key.trim()] = val.join(':').trim();
  });
  return result;
}

function extractFirstLine(content) {
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('---') && !l.startsWith('#'));
  return (lines[0] || '').slice(0, 120);
}

function getAgents() {
  return scanDirectory(path.join(CLAUDE_DIR, 'agents'));
}

function getSkills() {
  return scanDirectory(path.join(CLAUDE_DIR, 'skills'));
}

function getCommands() {
  return scanDirectory(path.join(CLAUDE_DIR, 'commands'));
}

module.exports = { scanDirectory, getAgents, getSkills, getCommands };
