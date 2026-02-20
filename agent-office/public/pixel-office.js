// === Pixel Office v1.1 — Stardew Valley-style Agent Visualization (Scaled Up) ===

const PixelOffice = (() => {
  // --- Config ---
  const PIXEL = 4;
  const CANVAS_W = 380;
  const CANVAS_H = 230;

  // --- Stardew Valley Color Palette ---
  const PALETTE = {
    wall:       '#d4b896',
    wallDark:   '#c4a47a',
    floor:      '#c4a882',
    floorDark:  '#b89b76',
    carpet:     '#3b5998',
    carpetLt:   '#4a6ab0',
    desk:       '#8B6914',
    deskDark:   '#6B4F0A',
    monitor:    '#1a1a2e',
    monitorOn:  '#22d3ee',
    monitorDim: '#0e4f5c',
    chair:      '#4a4a4a',
    chairDark:  '#3a3a3a',
    bookshelf:  '#6B4423',
    bookshelfDk:'#4a2e15',
    plant:      '#34d399',
    plantDark:  '#22a67a',
    pot:        '#a0522d',
    skin:       '#f5c6a0',
    skinDark:   '#e0a878',
    whiteboard: '#e8e8e8',
    whiteboardBd: '#999',
    clockFace:  '#eeeecc',
    clockHand:  '#333',
    cooler:     '#88bbdd',
    coolerDk:   '#6699bb',
    waterDrop:  '#aaddff',
    // Book colors
    bookRed:    '#c0392b',
    bookBlue:   '#2980b9',
    bookGreen:  '#27ae60',
    bookYellow: '#f1c40f',
    bookPurple: '#8e44ad',
    // Lead / Boss
    mahogany:   '#5c3d11',
    mahoganyDk: '#3d2808',
    gold:       '#ffd700',
    goldDark:   '#daa520',
    bossChair:  '#2a2a2a',
    bossChairDk:'#1a1a1a',
    // Extra decorations
    frameWood:  '#8B7355',
    glass:      '#87ceeb',
    curtainDk:  '#6d3a15',
    curtainLt:  '#a0522d',
    fluorescent:'rgba(255,255,240,0.08)',
    coffee:     '#3e2723',
    coffeeLt:   '#5d4037',
    door:       '#654321',
    doorGlass:  '#a8c8d8',
    doorHandle: '#c0c0c0',
    moldingDk:  '#9a7b5a',
    herringbone1:'#c9a87c',
    herringbone2:'#b89468',
    herringbone3:'#d4b896',
    // Time overlays
    morning:    'rgba(255,200,100,0.1)',
    afternoon:  'rgba(255,255,255,0)',
    evening:    'rgba(255,150,50,0.15)',
    night:      'rgba(20,20,60,0.3)',
  };

  // CJK-safe font stack (Korean/Japanese/Chinese support)
  const PX_FONT = "'JetBrains Mono', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif, monospace";

  // Same ICON_COLORS as app.js
  const ICON_COLORS = ['#22d3ee','#34d399','#a78bfa','#fbbf24','#f472b6','#60a5fa','#f97316','#e879f9'];

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // --- State ---
  let canvas, ctx;
  let agents = [];
  let bulletinEntries = [];
  let timeOfDay = 'afternoon';
  let animFrame = 0;
  let isActive = false;
  let rafId = null;
  let hoveredAgent = -1;

  // --- Desk positions (computed) ---
  let deskPositions = [];

  // --- Init ---
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_W * PIXEL;
    canvas.height = CANVAS_H * PIXEL;
    ctx.imageSmoothingEnabled = false;

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', () => { hoveredAgent = -1; });
  }

  // --- Pixel drawing helpers ---
  function px(x, y, w, h) {
    ctx.fillRect(x * PIXEL, y * PIXEL, (w || 1) * PIXEL, (h || 1) * PIXEL);
  }

  function setColor(c) {
    ctx.fillStyle = c;
  }

  // --- Data update ---
  function updateAgents(kmData) {
    if (!kmData) {
      // Team deleted or no data → clear all cached state
      agents = [];
      bulletinEntries = [];
      deskPositions = [];
      updateLegend();
      return;
    }
    let progressAgents = kmData.progress?.agents || [];
    const planTeam = kmData.plan?.team || [];
    const allBulletinEntries = kmData.bulletin?.entries || [];

    // Fallback: progress가 비어있으면 plan.team에서 에이전트 생성
    if (!progressAgents.length && planTeam.length) {
      progressAgents = planTeam.map(m => {
        const cleanName = (m.name || '').replace(/^@/, '');
        const recentEntry = allBulletinEntries.find(e =>
          e.agent && cleanName && e.agent.toLowerCase().includes(cleanName.toLowerCase())
        );
        const isCompleted = recentEntry && (recentEntry.status || '').toLowerCase() === 'completed';
        const isActive = recentEntry && !isCompleted;
        return {
          agent: m.name || '',
          task: recentEntry?.task || m.role || '',
          progress: isCompleted ? 100 : (isActive ? 50 : 0),
          updated: recentEntry?.time || '',
          note: recentEntry?.status || m.status || 'pending',
        };
      });
    }

    const newAgents = progressAgents.map((a, i) => {
      const meta = planTeam.find(t => t.name === a.agent) || {};
      const hash = simpleHash(a.agent || 'agent');
      const color = ICON_COLORS[hash % ICON_COLORS.length];
      const status = detectStatus(a);
      const roleLower = (meta.role || '').toLowerCase();
      const nameLower = (a.agent || '').toLowerCase();
      const modelLower = (meta.model || '').toLowerCase();
      const isLead = roleLower.includes('lead') || roleLower.includes('총괄') ||
                     nameLower.includes('lead') || nameLower.includes('main') ||
                     modelLower.includes('opus');

      // Detect roleType for character accessories
      // Check both roleLower (subagent_type) AND nameLower (actual role name)
      // DA must be detected BEFORE isLead (DA on opus gets isLead=true)
      const combined = roleLower + ' ' + nameLower;
      let roleType = 'worker';
      if (combined.includes('devil') || combined.includes('advocate')) roleType = 'da';
      else if (isLead) roleType = 'lead';
      else if (combined.includes('analyst') || combined.includes('분석')) roleType = 'analyst';
      else if (combined.includes('research') || combined.includes('explore')) roleType = 'researcher';
      else if (combined.includes('writer') || combined.includes('content')) roleType = 'writer';
      else if (combined.includes('coder') || combined.includes('developer')) roleType = 'coder';
      else if (combined.includes('review') || combined.includes('qa')) roleType = 'reviewer';

      return {
        name: a.agent || `Agent ${i}`,
        task: a.task || '',
        progress: parseInt(a.progress) || 0,
        status,
        color,
        role: meta.role || '',
        model: meta.model || '',
        isLead,
        roleType,
        idx: i,
      };
    });

    agents = newAgents;

    // Capture bulletin entries for work log display
    bulletinEntries = allBulletinEntries.slice(0, 8).map(e => ({
      agent: e.agent || '',
      text: e.findings || e.task || '',
      time: e.time || '',
    }));

    computeDeskPositions();
    updateLegend();
  }

  function detectStatus(a) {
    const p = parseInt(a.progress) || 0;
    const note = (a.note || '').toLowerCase();
    if (p >= 100 || note.includes('complete') || note.includes('done')) return 'completed';
    // 80-99%: wrapping up (results sent, shutdown pending, etc.)
    if (p >= 80) return 'wrapping-up';
    if (p > 0 || note.includes('progress') || note.includes('working') || note.includes('idle') || note.includes('active')) return 'active';
    return 'idle';
  }

  // --- Team zone data for multi-team rendering ---
  let teamZones = []; // { name, startX, endX, y, agents[] }

  // --- Desk layout computation (scaled, with team zone support) ---
  function computeDeskPositions() {
    deskPositions = [];
    teamZones = [];
    const n = agents.length;
    if (n === 0) return;

    // Separate leads and workers
    const leads = [];
    const workers = [];
    agents.forEach((a, i) => {
      if (a.isLead) leads.push(i);
      else workers.push(i);
    });

    const deskW = 26;
    const leadDeskW = 34;
    const deskSpacingX = 14;

    // Lead row (centered, top)
    if (leads.length > 0) {
      const leadTotalW = leads.length * leadDeskW + (leads.length - 1) * (deskSpacingX + 6);
      const leadStartX = Math.floor((CANVAS_W - leadTotalW) / 2);
      const leadY = 78;
      leads.forEach((agentIdx, i) => {
        deskPositions[agentIdx] = {
          x: leadStartX + i * (leadDeskW + deskSpacingX + 6),
          y: leadY,
        };
      });
    }

    // Worker rows (below leads)
    if (workers.length > 0) {
      const cols = workers.length <= 4 ? workers.length : Math.min(4, Math.ceil(workers.length / 2));
      const rows = Math.ceil(workers.length / cols);
      const totalRowW = cols * deskW + (cols - 1) * deskSpacingX;
      const workerStartY = leads.length > 0 ? 125 : 85;

      workers.forEach((agentIdx, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const currentCols = row < rows - 1 ? cols : workers.length - row * cols;
        const currentRowW = currentCols * deskW + (currentCols - 1) * deskSpacingX;
        const rowStartX = Math.floor((CANVAS_W - currentRowW) / 2);
        deskPositions[agentIdx] = {
          x: rowStartX + col * (deskW + deskSpacingX),
          y: workerStartY + row * 42,
        };
      });
    }

    // Build team zone for label rendering (single zone for single team)
    if (workers.length > 0) {
      const workerPositions = workers.map(i => deskPositions[i]).filter(Boolean);
      const minX = Math.min(...workerPositions.map(p => p.x));
      const maxX = Math.max(...workerPositions.map(p => p.x)) + deskW;
      const minY = Math.min(...workerPositions.map(p => p.y));
      teamZones.push({
        name: agents[0]?.teamName || '',
        startX: minX - 4,
        endX: maxX + 4,
        y: minY - 6,
        agentCount: workers.length,
      });
    }
  }

  // --- Legend ---
  function updateLegend() {
    const el = document.getElementById('pixel-office-legend');
    if (!el) return;
    el.innerHTML = agents.map(a => {
      const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${a.color};margin-right:4px"></span>`;
      return `<span>${dot}${escHtml(a.name)}</span>`;
    }).join('');
  }

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // --- Main render loop ---
  function render() {
    if (!isActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawOffice();
    drawDecorations();
    drawDesks();
    drawAgentCharacters();
    drawStatusBubbles();
    drawTimeOverlay();
    drawTitle();

    if (agents.length === 0) drawEmptyState();

    animFrame++;
    rafId = requestAnimationFrame(render);
  }

  // --- Office background ---
  function drawOffice() {
    // Wall with panel pattern
    for (let x = 0; x < CANVAS_W; x++) {
      const panelIdx = Math.floor(x / 40);
      const isLight = panelIdx % 2 === 0;
      setColor(isLight ? PALETTE.wall : PALETTE.wallDark);
      px(x, 0, 1, 70);
    }
    // Wall molding (2px wood trim)
    setColor(PALETTE.moldingDk);
    px(0, 70, CANVAS_W, 2);
    setColor(PALETTE.wall);
    px(0, 70, CANVAS_W, 1);

    // Floor with herringbone pattern
    for (let y = 72; y < CANVAS_H; y++) {
      for (let x = 0; x < CANVAS_W; x++) {
        const blockX = Math.floor(x / 6);
        const blockY = Math.floor((y - 72) / 3);
        const isDiag = (blockX + blockY) % 3;
        if (isDiag === 0) setColor(PALETTE.herringbone1);
        else if (isDiag === 1) setColor(PALETTE.herringbone2);
        else setColor(PALETTE.herringbone3);
        px(x, y, 1, 1);
      }
    }

    // Carpet (center) with diamond pattern
    const carpetX = 110, carpetW = 160, carpetY = 95, carpetH = 100;
    for (let y = carpetY; y < carpetY + carpetH && y < CANVAS_H; y++) {
      setColor(y % 3 === 0 ? PALETTE.carpetLt : PALETTE.carpet);
      px(carpetX, y, carpetW, 1);
    }
    // Diamond pattern on carpet
    for (let dy = 0; dy < carpetH; dy += 10) {
      for (let dx = 0; dx < carpetW; dx += 10) {
        const cx = carpetX + dx + 5;
        const cy = carpetY + dy + 5;
        if (cy < carpetY + carpetH && cx < carpetX + carpetW) {
          setColor('rgba(255,255,255,0.04)');
          px(cx, cy, 1, 1);
          px(cx - 1, cy + 1, 1, 1);
          px(cx + 1, cy + 1, 1, 1);
          px(cx, cy + 2, 1, 1);
        }
      }
    }
    // Carpet border
    setColor('#2d4373');
    px(carpetX, carpetY, carpetW, 1);
    px(carpetX, carpetY + carpetH - 1, carpetW, 1);
    px(carpetX, carpetY, 1, carpetH);
    px(carpetX + carpetW - 1, carpetY, 1, carpetH);
    // Inner carpet border (decorative)
    setColor('#3d5393');
    px(carpetX + 2, carpetY + 2, carpetW - 4, 1);
    px(carpetX + 2, carpetY + carpetH - 3, carpetW - 4, 1);
    px(carpetX + 2, carpetY + 2, 1, carpetH - 4);
    px(carpetX + carpetW - 3, carpetY + 2, 1, carpetH - 4);
  }

  // --- Decorations ---
  function drawDecorations() {
    // === WALL LAYOUT (X: 0→380, Y: 0→~65) ===
    // [Whiteboard 8-118] [Clock 120] [Window 132-152] ... [WorkLog 175-315] [Frames 320-355] [Door 362]

    // Whiteboard (team goal) — large, left wall
    drawWhiteboard(8, 8);

    // Clock (small, between whiteboard and window)
    drawClock(120, 12);

    // Window (compact, left-center wall)
    drawWindow(132, 14);

    // Large work log monitor (center-right wall, narrower to avoid door)
    drawWorkLogMonitor(175, 4);

    // Picture frames (between work log and door)
    drawPictureFrame(322, 12);
    drawPictureFrame(342, 20);

    // Bookshelves on left wall (below whiteboard)
    drawBookshelf(8, 70);
    drawBookshelf(22, 70);

    // Door (far right wall — clear of work log)
    drawDoor(CANVAS_W - 18, 36);

    // Fluorescent lights (ceiling)
    drawFluorescentLight(80, 0);
    drawFluorescentLight(220, 0);

    // Plants (upgraded)
    drawPlant(5, 200);
    drawPlant(370, 200);
    drawPlant(5, 165);
    drawPlant(370, 165);

    // Water cooler + Coffee machine
    drawCooler(55, 185);
    drawCoffeeMachine(65, 185);
  }

  function drawBookshelf(x, y) {
    // Frame
    setColor(PALETTE.bookshelf);
    px(x, y, 10, 14);
    setColor(PALETTE.bookshelfDk);
    px(x, y, 10, 1);
    px(x, y + 5, 10, 1);
    px(x, y + 10, 10, 1);
    // Books row 1
    const colors1 = [PALETTE.bookRed, PALETTE.bookBlue, PALETTE.bookGreen, PALETTE.bookYellow, PALETTE.bookPurple];
    for (let i = 0; i < 5; i++) {
      setColor(colors1[i]);
      px(x + 1 + i * 2, y + 1, 1, 4);
    }
    // Books row 2
    const colors2 = [PALETTE.bookPurple, PALETTE.bookRed, PALETTE.bookBlue, PALETTE.bookGreen, PALETTE.bookYellow];
    for (let i = 0; i < 5; i++) {
      setColor(colors2[i]);
      px(x + 1 + i * 2, y + 6, 1, 4);
    }
    // Books row 3
    const colors3 = [PALETTE.bookYellow, PALETTE.bookPurple, PALETTE.bookRed, PALETTE.bookBlue, PALETTE.bookGreen];
    for (let i = 0; i < 5; i++) {
      setColor(colors3[i]);
      px(x + 1 + i * 2, y + 11, 1, 2);
    }
  }

  function drawWhiteboard(x, y) {
    const w = 108;
    const h = 58;
    // Border
    setColor(PALETTE.whiteboardBd);
    px(x, y, w, h);
    // White surface
    setColor(PALETTE.whiteboard);
    px(x + 1, y + 1, w - 2, h - 2);

    ctx.save();
    // Title — large and bold
    ctx.font = `bold ${PIXEL * 4.5}px ${PX_FONT}`;
    ctx.fillStyle = '#1a1a2e';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('TEAM GOAL', (x + 4) * PIXEL, (y + 2) * PIXEL);

    // Divider line (thicker)
    setColor('#bbb');
    px(x + 3, y + 12, w - 6, 1);

    // Agent summary — bigger
    ctx.font = `bold ${PIXEL * 3.2}px ${PX_FONT}`;
    ctx.fillStyle = '#444';
    const goalText = agents.length > 0 ? `${agents.length} agents assigned` : 'Waiting for team...';
    ctx.fillText(goalText, (x + 4) * PIXEL, (y + 15) * PIXEL);

    // Status counts — bigger and bolder (wrapping-up counts as active)
    const activeN = agents.filter(a => a.status === 'active' || a.status === 'wrapping-up').length;
    const doneN = agents.filter(a => a.status === 'completed').length;
    const idleN = agents.filter(a => a.status === 'idle').length;
    ctx.font = `bold ${PIXEL * 3}px ${PX_FONT}`;
    ctx.fillStyle = PALETTE.monitorOn;
    ctx.fillText(`Active: ${activeN}`, (x + 4) * PIXEL, (y + 23) * PIXEL);
    ctx.fillStyle = '#34d399';
    ctx.fillText(`Done: ${doneN}`, (x + 38) * PIXEL, (y + 23) * PIXEL);
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Idle: ${idleN}`, (x + 65) * PIXEL, (y + 23) * PIXEL);

    // Per-agent status list (up to 6) — bigger
    ctx.font = `bold ${PIXEL * 2.5}px ${PX_FONT}`;
    agents.slice(0, 6).forEach((a, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const ax = (x + 4 + col * 50) * PIXEL;
      const ay = (y + 31 + row * 7) * PIXEL;
      const statusDot = a.status === 'active' ? '\u25CF' : a.status === 'completed' ? '\u2713' : '\u25CB';
      ctx.fillStyle = a.color || '#94a3b8';
      ctx.fillText(`${statusDot} ${truncStr(a.name, 10)}`, ax, ay);
    });

    ctx.restore();
  }

  // --- Large Work Log Monitor (center-right wall) ---
  function drawWorkLogMonitor(x, y) {
    const w = 140;
    const h = 60;

    // Monitor frame (dark)
    setColor('#1a1a2e');
    px(x, y, w, h);
    // Screen bezel
    setColor('#111');
    px(x, y, w, 1);
    px(x, y + h - 1, w, 1);
    px(x, y, 1, h);
    px(x + w - 1, y, 1, h);
    // Screen background (dark blue-grey)
    setColor('#0f172a');
    px(x + 1, y + 1, w - 2, h - 2);

    // Header bar
    setColor('#1e293b');
    px(x + 1, y + 1, w - 2, 6);
    // Header text
    ctx.save();
    ctx.font = `bold ${PIXEL * 3}px ${PX_FONT}`;
    ctx.fillStyle = PALETTE.monitorOn;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('WORK LOG', (x + 4) * PIXEL, (y + 2) * PIXEL);
    // Live dot (animated)
    const liveDot = Math.floor(animFrame / 30) % 2;
    if (liveDot) {
      setColor('#22d3ee');
      px(x + w - 8, y + 3, 4, 2);
    }

    // Entry count badge
    ctx.font = `${PIXEL * 2}px ${PX_FONT}`;
    ctx.fillStyle = '#475569';
    ctx.fillText(`${bulletinEntries.length} entries`, (x + w - 40) * PIXEL, (y + 2) * PIXEL);

    // Monitor stand
    setColor('#333');
    px(x + Math.floor(w / 2) - 6, y + h, 12, 2);
    px(x + Math.floor(w / 2) - 8, y + h + 2, 16, 1);

    // Work log entries
    ctx.font = `${PIXEL * 2.5}px ${PX_FONT}`;
    const maxEntries = 8;
    const entryH = 6.5;

    if (bulletinEntries.length === 0) {
      ctx.fillStyle = '#475569';
      ctx.font = `${PIXEL * 2.8}px ${PX_FONT}`;
      ctx.fillText('Waiting for activity...', (x + 4) * PIXEL, (y + 12) * PIXEL);
    } else {
      bulletinEntries.slice(0, maxEntries).forEach((entry, i) => {
        const ey = y + 9 + i * entryH;
        // Agent name color
        const agentHash = simpleHash(entry.agent || '');
        const agentColor = ICON_COLORS[agentHash % ICON_COLORS.length];

        // Separator line
        if (i > 0) {
          setColor('#1e293b');
          px(x + 3, ey - 1, w - 6, 1);
        }

        // Agent name
        ctx.fillStyle = agentColor;
        const agentName = truncStr(entry.agent, 14);
        ctx.fillText(agentName, (x + 4) * PIXEL, (ey + 1) * PIXEL);

        // Log text
        ctx.fillStyle = '#94a3b8';
        const logText = truncStr(entry.text, 50);
        const nameWidth = agentName.length * PIXEL * 1.2 + PIXEL * 3;
        ctx.fillText(logText, (x + 4) * PIXEL + nameWidth, (ey + 1) * PIXEL);
      });
    }

    // Scrolling indicator if more entries
    if (bulletinEntries.length > maxEntries) {
      ctx.fillStyle = '#475569';
      ctx.font = `${PIXEL * 2}px ${PX_FONT}`;
      ctx.fillText(`+${bulletinEntries.length - maxEntries} more`, (x + 4) * PIXEL, (y + h - 5) * PIXEL);
    }

    ctx.restore();
  }

  function drawClock(x, y) {
    setColor(PALETTE.clockFace);
    px(x, y, 6, 6);
    setColor('#666');
    px(x, y, 6, 1);
    px(x, y + 5, 6, 1);
    px(x, y, 1, 6);
    px(x + 5, y, 1, 6);
    // Hands (animated)
    setColor(PALETTE.clockHand);
    px(x + 3, y + 3, 1, 1); // center
    const tick = Math.floor(animFrame / 30) % 4;
    if (tick === 0) px(x + 3, y + 1, 1, 1);
    else if (tick === 1) px(x + 4, y + 3, 1, 1);
    else if (tick === 2) px(x + 3, y + 4, 1, 1);
    else px(x + 1, y + 3, 1, 1);
  }

  function drawPlant(x, y) {
    // Pot
    setColor(PALETTE.pot);
    px(x, y + 4, 5, 4);
    px(x + 1, y + 3, 3, 1);
    // Leaves (animated sway)
    const sway = Math.floor(animFrame / 40) % 2;
    setColor(PALETTE.plant);
    px(x + 1, y, 3, 3);
    if (sway === 0) {
      px(x, y, 1, 2);
      px(x + 4, y + 1, 1, 2);
    } else {
      px(x + 4, y, 1, 2);
      px(x, y + 1, 1, 2);
    }
    setColor(PALETTE.plantDark);
    px(x + 2, y + 1, 1, 2);
  }

  function drawCooler(x, y) {
    setColor(PALETTE.coolerDk);
    px(x, y, 5, 9);
    setColor(PALETTE.cooler);
    px(x + 1, y + 1, 3, 4);
    // Water drop animation
    if (Math.floor(animFrame / 90) % 3 === 0) {
      setColor(PALETTE.waterDrop);
      const dropY = y + 5 + (Math.floor(animFrame / 10) % 3);
      if (dropY < y + 9) px(x + 2, dropY, 1, 1);
    }
  }

  function drawWindow(x, y) {
    const w = 22, h = 38;
    // Window frame
    setColor(PALETTE.frameWood);
    px(x, y, w, h);
    // Glass
    const skyColor = timeOfDay === 'night' ? '#1a1a3e' :
                     timeOfDay === 'evening' ? '#e87d3e' :
                     timeOfDay === 'morning' ? '#87ceeb' : '#a8d8ea';
    setColor(skyColor);
    px(x + 2, y + 2, w - 4, h - 4);
    // Window cross
    setColor(PALETTE.frameWood);
    px(x + Math.floor(w / 2) - 1, y, 2, h);
    px(x, y + Math.floor(h / 2) - 1, w, 2);
    // Curtains
    setColor(PALETTE.curtainDk);
    px(x - 3, y, 3, h);
    px(x + w, y, 3, h);
    setColor(PALETTE.curtainLt);
    px(x - 2, y, 1, h);
    px(x + w + 1, y, 1, h);

    // Scenery (time-dependent)
    if (timeOfDay === 'night') {
      // Moon
      setColor('#ffffcc');
      px(x + 5, y + 5, 3, 3);
      // Stars
      setColor('rgba(255,255,200,0.7)');
      px(x + 18, y + 8, 1, 1);
      px(x + 10, y + 15, 1, 1);
      px(x + 22, y + 20, 1, 1);
    } else if (timeOfDay === 'morning' || timeOfDay === 'afternoon') {
      // Sun hint
      setColor('rgba(255,220,100,0.5)');
      px(x + 20, y + 5, 4, 4);
      // Clouds
      setColor('rgba(255,255,255,0.4)');
      px(x + 5, y + 10, 6, 2);
      px(x + 15, y + 18, 5, 2);
    } else if (timeOfDay === 'evening') {
      // Sunset colors
      setColor('rgba(255,100,50,0.4)');
      px(x + 2, y + h - 15, w - 4, 10);
    }
  }

  function drawPictureFrame(x, y) {
    // Frame
    setColor(PALETTE.frameWood);
    px(x, y, 14, 12);
    // Inner (mini landscape)
    setColor('#5b8c5a');  // green hills
    px(x + 1, y + 1, 12, 10);
    setColor('#87ceeb');  // sky
    px(x + 1, y + 1, 12, 5);
    setColor('#f4d03f');  // sun
    px(x + 9, y + 2, 2, 2);
    setColor('#2e7d32');  // tree
    px(x + 3, y + 5, 2, 3);
    px(x + 4, y + 4, 1, 1);
  }

  function drawDoor(x, y) {
    const dw = 14, dh = 34;
    // Door frame
    setColor(PALETTE.frameWood);
    px(x - 1, y - 1, dw + 2, dh + 1);
    // Door body
    setColor(PALETTE.door);
    px(x, y, dw, dh);
    // Door panel detail
    setColor(darkenColor(PALETTE.door, 0.85));
    px(x + 2, y + 3, dw - 4, 12);
    px(x + 2, y + 18, dw - 4, 12);
    // Glass window
    setColor(PALETTE.doorGlass);
    px(x + 3, y + 4, dw - 6, 6);
    // Handle
    setColor(PALETTE.doorHandle);
    px(x + dw - 3, y + 16, 1, 3);
  }

  function drawFluorescentLight(x, y) {
    // Light fixture
    setColor('#888');
    px(x, y, 40, 2);
    // Light tube
    setColor('#e8e8e0');
    px(x + 2, y + 2, 36, 1);
    // Glow effect (subtle)
    ctx.fillStyle = PALETTE.fluorescent;
    ctx.fillRect((x + 2) * PIXEL, (y + 3) * PIXEL, 36 * PIXEL, 12 * PIXEL);
  }

  function drawCoffeeMachine(x, y) {
    // Body
    setColor(PALETTE.coffee);
    px(x, y, 6, 8);
    // Top
    setColor(PALETTE.coffeeLt);
    px(x, y, 6, 2);
    // Cup slot
    setColor('#111');
    px(x + 1, y + 4, 4, 2);
    // Red light
    const blink = Math.floor(animFrame / 45) % 2;
    if (blink) {
      setColor('#ff4444');
      px(x + 5, y + 1, 1, 1);
    }
  }

  // --- Desks (scaled up) ---
  function drawDesks() {
    agents.forEach((agent, i) => {
      if (i >= deskPositions.length) return;
      const pos = deskPositions[i];
      drawDesk(pos.x, pos.y, agent.status, agent.color, agent.isLead);
    });
  }

  function drawDesk(x, y, status, color, isLead) {
    if (isLead) {
      // Boss chair (larger, darker)
      setColor(PALETTE.bossChairDk);
      px(x + 9, y + 14, 14, 3);
      setColor(PALETTE.bossChair);
      px(x + 10, y + 6, 12, 8);
      // Chair back (tall)
      setColor(PALETTE.bossChairDk);
      px(x + 10, y + 4, 12, 2);
      // Chair arms
      setColor(PALETTE.bossChairDk);
      px(x + 8, y + 8, 2, 5);
      px(x + 22, y + 8, 2, 5);

      // Mahogany desk (wider)
      setColor(PALETTE.mahogany);
      px(x - 2, y + 17, 36, 5);
      // Desk legs
      setColor(PALETTE.mahoganyDk);
      px(x - 1, y + 22, 3, 4);
      px(x + 30, y + 22, 3, 4);
      // Desk front panel
      setColor(PALETTE.mahoganyDk);
      px(x - 2, y + 22, 36, 1);
      // Gold trim on desk
      setColor(PALETTE.goldDark);
      px(x - 2, y + 17, 36, 1);

      // Ultra-wide monitor
      drawMonitor(x + 6, y + 9, status, true);
    } else {
      // Regular chair
      setColor(PALETTE.chairDark);
      px(x + 8, y + 14, 8, 2);
      setColor(PALETTE.chair);
      px(x + 9, y + 8, 6, 6);
      setColor(PALETTE.chairDark);
      px(x + 9, y + 7, 6, 1);

      // Regular desk
      setColor(PALETTE.desk);
      px(x, y + 16, 24, 4);
      setColor(PALETTE.deskDark);
      px(x + 1, y + 20, 3, 4);
      px(x + 20, y + 20, 3, 4);
      setColor(PALETTE.deskDark);
      px(x, y + 20, 24, 1);

      // Regular monitor
      drawMonitor(x + 8, y + 10, status, false);
    }
  }

  function drawMonitor(x, y, status, isWide) {
    const mw = isWide ? 20 : 8;
    const mh = isWide ? 6 : 5;
    // Monitor body
    setColor('#222');
    px(x, y, mw, mh);
    // Screen
    const isOn = status === 'active';
    const flicker = Math.floor(animFrame / 15) % 2;

    if (isOn) {
      setColor(flicker ? PALETTE.monitorOn : PALETTE.monitorDim);
    } else if (status === 'completed') {
      setColor('#34d399');
    } else {
      setColor('#333');
    }
    px(x + 1, y + 1, mw - 2, mh - 2);
    // Monitor stand
    setColor('#444');
    if (isWide) {
      px(x + Math.floor(mw / 2) - 2, y + mh, 4, 1);
    } else {
      px(x + 3, y + mh, 2, 1);
    }
  }

  // --- Agent characters (scaled up: 6 wide x 10 tall) ---
  function drawAgentCharacters() {
    agents.forEach((agent, i) => {
      if (i >= deskPositions.length) return;
      const pos = deskPositions[i];
      const charX = pos.x + 9;
      const charY = pos.y - 4;
      drawCharacter(charX, charY, agent.color, agent.status, animFrame, agent.isLead, agent.roleType);
    });
  }

  function drawCharacter(x, y, color, status, frame, isLead, roleType) {
    // DA special: override body color to dark reddish
    const bodyColor = roleType === 'da' ? '#8b2252' : color;
    if (isLead) {
      // Larger head (5x5)
      setColor(PALETTE.skin);
      px(x, y - 1, 4, 1);     // top of head wider
      px(x - 1, y, 6, 3);     // face wider
      px(x, y + 3, 4, 1);     // chin
      // Eyes
      setColor('#333');
      px(x, y + 1, 1, 1);
      px(x + 3, y + 1, 1, 1);
      // Mouth
      setColor(PALETTE.skinDark);
      px(x + 1, y + 3, 2, 1);

      // Crown (gold)
      setColor(PALETTE.gold);
      px(x - 1, y - 3, 6, 1);
      px(x - 1, y - 4, 1, 1);
      px(x + 1, y - 4, 1, 1);
      px(x + 4, y - 4, 1, 1);
      setColor(PALETTE.goldDark);
      px(x, y - 4, 1, 1);
      px(x + 2, y - 4, 1, 1);
      px(x + 3, y - 4, 1, 1);

      // Body (larger, 7x5)
      setColor(color);
      px(x - 2, y + 4, 8, 5);

      // Tie (gold)
      setColor(PALETTE.gold);
      px(x + 1, y + 4, 2, 1);
      setColor(PALETTE.goldDark);
      px(x + 1, y + 5, 2, 2);
      px(x + 1, y + 7, 1, 1);

      // Arms (animation based on status)
      const typing = status === 'active';
      const completed = status === 'completed';
      const armFrame = Math.floor(frame / 15) % 2;

      if (completed) {
        setColor(PALETTE.skin);
        px(x - 3, y + 2, 1, 2);
        px(x + 6, y + 2, 1, 2);
      } else if (typing) {
        setColor(PALETTE.skin);
        if (armFrame === 0) {
          px(x - 3, y + 5, 1, 2);
          px(x + 6, y + 6, 1, 2);
        } else {
          px(x - 3, y + 6, 1, 2);
          px(x + 6, y + 5, 1, 2);
        }
      } else {
        setColor(PALETTE.skin);
        px(x - 3, y + 8, 1, 1);
        px(x + 6, y + 8, 1, 1);
      }

      // Legs (seated)
      setColor(darkenColor(color, 0.7));
      px(x - 1, y + 9, 3, 2);
      px(x + 2, y + 9, 3, 2);
    } else {
      // Original worker character (unchanged)
      // Head (skin) - 4 wide x 4 tall
      setColor(PALETTE.skin);
      px(x + 1, y, 2, 1);
      px(x, y + 1, 4, 2);
      px(x + 1, y + 3, 2, 1);
      // Eyes
      setColor('#333');
      px(x + 1, y + 2, 1, 1);
      px(x + 2, y + 2, 1, 1);
      // Mouth hint
      setColor(PALETTE.skinDark);
      px(x + 1, y + 3, 2, 1);

      // Body (agent color or DA override)
      setColor(bodyColor);
      px(x - 1, y + 4, 6, 4);

      // Arms
      const typing = status === 'active';
      const completed = status === 'completed';
      const armFrame = Math.floor(frame / 15) % 2;

      if (completed) {
        setColor(PALETTE.skin);
        px(x - 2, y + 2, 1, 2);
        px(x + 5, y + 2, 1, 2);
      } else if (typing) {
        setColor(PALETTE.skin);
        if (armFrame === 0) {
          px(x - 2, y + 5, 1, 2);
          px(x + 5, y + 6, 1, 2);
        } else {
          px(x - 2, y + 6, 1, 2);
          px(x + 5, y + 5, 1, 2);
        }
      } else {
        setColor(PALETTE.skin);
        px(x - 2, y + 7, 1, 1);
        px(x + 5, y + 7, 1, 1);
      }

      // Legs (seated)
      setColor(darkenColor(bodyColor, 0.7));
      px(x, y + 8, 2, 2);
      px(x + 2, y + 8, 2, 2);

      // --- Role-specific accessories ---
      if (roleType === 'da') {
        // Devil horns (red) on head sides
        setColor('#cc3333');
        px(x - 1, y - 1, 1, 2);  // left horn
        px(x + 4, y - 1, 1, 2);  // right horn
        px(x - 1, y - 2, 1, 1);  // left horn tip
        px(x + 4, y - 2, 1, 1);  // right horn tip
      } else if (roleType === 'analyst') {
        // Blue glasses
        setColor('#4488ff');
        px(x, y + 1, 2, 1);      // left lens frame
        px(x + 2, y + 1, 2, 1);  // right lens frame
        px(x + 2, y + 2, 0, 1);  // bridge
      } else if (roleType === 'researcher') {
        // Brown book under arm
        setColor('#8B4513');
        px(x - 2, y + 5, 1, 3);  // book spine
        setColor('#A0522D');
        px(x - 3, y + 5, 1, 3);  // book cover
      } else if (roleType === 'writer') {
        // Gold-tipped pen
        setColor('#333');
        px(x + 5, y + 4, 1, 2);  // pen stem
        setColor('#ffd700');
        px(x + 5, y + 3, 1, 1);  // gold tip
      } else if (roleType === 'coder') {
        // Headphones
        setColor('#555');
        px(x - 1, y + 1, 1, 1);  // left earpiece
        px(x + 4, y + 1, 1, 1);  // right earpiece
        setColor('#444');
        px(x, y - 1, 4, 1);      // headband
      } else if (roleType === 'reviewer') {
        // Clipboard
        setColor('#ddd');
        px(x + 5, y + 4, 2, 3);  // board
        setColor('#888');
        px(x + 5, y + 3, 2, 1);  // clip
      }
    }
  }

  function darkenColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
  }

  // --- Status bubbles (ENHANCED — all content inside card, no character overlap) ---
  function drawStatusBubbles() {
    agents.forEach((agent, i) => {
      if (i >= deskPositions.length) return;
      const pos = deskPositions[i];
      const bx = pos.x + 12;
      // Card positioned close above character (charY = pos.y - 4)
      const cardTop = pos.y - 24;
      const cardH = 18;  // compact: name + task + progress bar all inside
      const isHovered = hoveredAgent === i;

      // === Hover highlight ===
      if (isHovered) {
        ctx.save();
        ctx.strokeStyle = agent.isLead ? PALETTE.gold : PALETTE.monitorOn;
        ctx.lineWidth = 2;
        ctx.shadowColor = agent.isLead ? PALETTE.gold : PALETTE.monitorOn;
        ctx.shadowBlur = 10;
        ctx.strokeRect((pos.x - 5) * PIXEL, (cardTop - 1) * PIXEL, 34 * PIXEL, (cardH + 2) * PIXEL);
        ctx.restore();
      }

      ctx.save();

      // --- Card background (contains ALL info) ---
      const cX = (pos.x - 4) * PIXEL;
      const cY = cardTop * PIXEL;
      const cW = 32 * PIXEL;
      const cH = cardH * PIXEL;
      ctx.fillStyle = isHovered ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.62)';
      ctx.fillRect(cX, cY, cW, cH);
      ctx.strokeStyle = isHovered ? (agent.isLead ? PALETTE.gold : PALETTE.monitorOn) : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cX, cY, cW, cH);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Row 1: Name (top of card, +1px padding)
      const nameText = agent.isLead ? `★ ${truncStr(agent.name, 14)}` : truncStr(agent.name, 16);
      ctx.font = agent.isLead ? `bold ${PIXEL * 3.8}px ${PX_FONT}` : `bold ${PIXEL * 3.5}px ${PX_FONT}`;
      ctx.fillStyle = agent.isLead ? PALETTE.gold : '#e2e8f0';
      if (agent.isLead) { ctx.shadowColor = PALETTE.gold; ctx.shadowBlur = 6; }
      ctx.fillText(nameText, bx * PIXEL, (cardTop + 1) * PIXEL);
      ctx.shadowBlur = 0;

      // Row 2: Model (below name, instead of task)
      if (agent.model) {
        ctx.font = `bold ${PIXEL * 2.8}px ${PX_FONT}`;
        ctx.fillStyle = isHovered ? '#a5b4fc' : '#818cf8';
        ctx.fillText(truncStr(agent.model, 22), bx * PIXEL, (cardTop + 5.5) * PIXEL);
      }

      // Row 3: Progress bar + percentage (inside card bottom)
      const barW = 20;
      const barX = pos.x;
      const barY = cardTop + 10;
      // Track
      setColor('#1e293b');
      px(barX, barY, barW, 2);
      // Fill — color changes at wrapping-up threshold
      const fillW = Math.max(1, Math.floor(barW * agent.progress / 100));
      const barColor = agent.progress >= 100 ? '#34d399' : agent.progress >= 80 ? '#fbbf24' : PALETTE.monitorOn;
      setColor(barColor);
      px(barX, barY, fillW, 2);
      // Percentage (right of bar, inside card) — granular label
      const pctLabel = agent.progress >= 100 ? 'Done' : agent.progress >= 80 ? 'Wrap' : `${agent.progress}%`;
      ctx.font = `bold ${PIXEL * 2.2}px ${PX_FONT}`;
      ctx.fillStyle = barColor;
      ctx.textAlign = 'left';
      ctx.fillText(pctLabel, (barX + barW + 1) * PIXEL, (barY) * PIXEL);

      // Row 4: Task snippet (smallest, bottom of card)
      if (agent.task) {
        ctx.font = `${PIXEL * 1.8}px ${PX_FONT}`;
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText(truncStr(agent.task, 20), bx * PIXEL, (cardTop + 13.5) * PIXEL);
      }

      ctx.restore();

      // --- Typing dots BELOW card (above character head) ---
      if (agent.status === 'active' || agent.status === 'wrapping-up') {
        const dotPhase = Math.floor(animFrame / 18) % 4;
        ctx.save();
        ctx.font = `bold ${PIXEL * 2.5}px ${PX_FONT}`;
        ctx.fillStyle = PALETTE.monitorOn;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const dots = '●'.repeat(dotPhase + 1) + '○'.repeat(3 - dotPhase);
        ctx.fillText(dots, bx * PIXEL, (cardTop + cardH + 1) * PIXEL);
        ctx.restore();
      }

      // --- Hover hint BELOW card ---
      if (isHovered) {
        ctx.save();
        ctx.font = `${PIXEL * 2}px ${PX_FONT}`;
        ctx.fillStyle = PALETTE.monitorOn;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('▸ Click for log', bx * PIXEL, (cardTop + cardH + (agent.status === 'active' ? 4 : 1)) * PIXEL);
        ctx.restore();
      }
    });
  }

  function truncStr(str, max) {
    return str && str.length > max ? str.slice(0, max - 1) + '..' : (str || '');
  }

  // --- Time overlay ---
  function drawTimeOverlay() {
    const overlayColor = PALETTE[timeOfDay] || PALETTE.afternoon;
    if (overlayColor === 'rgba(255,255,255,0)') return;

    ctx.fillStyle = overlayColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Night: stars
    if (timeOfDay === 'night') {
      ctx.fillStyle = 'rgba(255,255,200,0.5)';
      const stars = [[15,5],[45,8],[120,3],[200,7],[85,2],[170,10],[30,12],[210,4],[150,6],[60,10]];
      stars.forEach(([sx, sy]) => {
        const twinkle = Math.sin(animFrame * 0.05 + sx) > 0.3;
        if (twinkle) px(sx, sy, 1, 1);
      });
    }

    // Morning: warm glow from right
    if (timeOfDay === 'morning') {
      const grad = ctx.createLinearGradient(canvas.width * 0.7, 0, canvas.width, canvas.height * 0.5);
      grad.addColorStop(0, 'rgba(255,220,150,0.12)');
      grad.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  // --- Title ---
  function drawTitle() {
    ctx.save();
    ctx.font = `bold ${PIXEL * 3.5}px ${PX_FONT}`;
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Agent Office', 8 * PIXEL, 3 * PIXEL);
    ctx.restore();
  }

  // --- Empty state ---
  function drawEmptyState() {
    ctx.save();
    ctx.font = `${PIXEL * 3.5}px ${PX_FONT}`;
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No active team', (CANVAS_W / 2) * PIXEL, (CANVAS_H / 2 + 15) * PIXEL);
    ctx.font = `${PIXEL * 2.5}px ${PX_FONT}`;
    ctx.fillText('Start a team workflow to see agents here', (CANVAS_W / 2) * PIXEL, (CANVAS_H / 2 + 25) * PIXEL);
    ctx.restore();
  }

  // --- Click interaction (scaled hitbox) ---
  function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = (CANVAS_W * PIXEL) / rect.width;
    const scaleY = (CANVAS_H * PIXEL) / rect.height;
    const cx = (e.clientX - rect.left) * scaleX / PIXEL;
    const cy = (e.clientY - rect.top) * scaleY / PIXEL;

    for (let i = 0; i < agents.length && i < deskPositions.length; i++) {
      const pos = deskPositions[i];
      if (cx >= pos.x - 6 && cx <= pos.x + 30 && cy >= pos.y - 22 && cy <= pos.y + 28) {
        if (typeof showAgentModal === 'function') {
          showAgentModal(agents[i].idx);
        }
        return;
      }
    }
  }

  function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = (CANVAS_W * PIXEL) / rect.width;
    const scaleY = (CANVAS_H * PIXEL) / rect.height;
    const cx = (e.clientX - rect.left) * scaleX / PIXEL;
    const cy = (e.clientY - rect.top) * scaleY / PIXEL;

    let found = -1;
    for (let i = 0; i < agents.length && i < deskPositions.length; i++) {
      const pos = deskPositions[i];
      if (cx >= pos.x - 6 && cx <= pos.x + 30 && cy >= pos.y - 22 && cy <= pos.y + 28) {
        found = i;
        break;
      }
    }
    if (hoveredAgent !== found) {
      hoveredAgent = found;
      canvas.style.cursor = found >= 0 ? 'pointer' : 'default';
    }
  }

  // --- Time of day ---
  function setTimeOfDay(time) {
    timeOfDay = time;
  }

  // --- Start/Stop ---
  function start() {
    if (isActive) return;
    isActive = true;
    animFrame = 0;
    render();
  }

  function stop() {
    isActive = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // --- Public API ---
  return { init, updateAgents, setTimeOfDay, start, stop };
})();
