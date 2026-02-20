const fs = require('fs');
const { MCP_CONFIG, SETTINGS_FILE } = require('../config');

function getMCPServers() {
  if (!fs.existsSync(MCP_CONFIG)) return [];
  try {
    const config = JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf-8'));
    const servers = config.mcpServers || {};
    return Object.entries(servers).map(([name, cfg]) => ({
      name,
      command: cfg.command || '',
      args: (cfg.args || []).join(' '),
      type: cfg.type || 'stdio',
      hasEnv: !!(cfg.env && Object.keys(cfg.env).length),
    }));
  } catch {
    return [];
  }
}

function getSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) return { hooks: [], permissions: [], plugins: [], env: {} };
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));

    const hooks = [];
    if (settings.hooks) {
      for (const [event, hookArr] of Object.entries(settings.hooks)) {
        for (const h of hookArr) {
          for (const hook of (h.hooks || [])) {
            hooks.push({ event, type: hook.type, command: hook.command, timeout: hook.timeout });
          }
        }
      }
    }

    const permissions = (settings.permissions?.allow || []).map(p => {
      const match = p.match(/^(\w+)\((.+)\)$/);
      return match ? { tool: match[1], pattern: match[2] } : { tool: p, pattern: '' };
    });

    const plugins = settings.enabledMcpjsonServers || [];
    const env = settings.env || {};
    const teammateMode = settings.teammateMode || 'auto';

    return { hooks, permissions, plugins, env, teammateMode };
  } catch {
    return { hooks: [], permissions: [], plugins: [], env: {}, teammateMode: 'unknown' };
  }
}

module.exports = { getMCPServers, getSettings };
