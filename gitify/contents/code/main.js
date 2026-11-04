const GAP = 8;
// How far from a display edge a tray click can be when no panel is found there.
const EDGE_REACH = 64;
const windows = new Map();
let lastAnchor = null;

function isGitify(window) {
  const appId = String(window.resourceClass).toLowerCase();
  return (
    (appId === 'gitify' || appId === 'com.electron.gitify') &&
    window.caption === 'Gitify' &&
    window.normalWindow &&
    !window.dialog
  );
}

function contains(rect, point) {
  return (
    point.x >= rect.x && point.x < rect.x + rect.width &&
    point.y >= rect.y && point.y < rect.y + rect.height
  );
}

function edgeOf(panel, screen) {
  if (panel.width >= panel.height) {
    return Math.abs(panel.y - screen.y) < Math.abs(screen.y + screen.height - panel.y - panel.height)
      ? 'top' : 'bottom';
  }
  return Math.abs(panel.x - screen.x) < Math.abs(screen.x + screen.width - panel.x - panel.width)
    ? 'left' : 'right';
}

function clamp(value, start, end) {
  return Math.max(start, Math.min(value, Math.max(start, end)));
}

function placement(size, area, anchor) {
  let x = area.x + area.width - size.width - GAP;
  let y = area.y + GAP;
  if (anchor) {
    const panel = anchor.panel.frameGeometry;
    switch (anchor.edge) {
      case 'top':
        x = anchor.point.x - size.width / 2;
        y = panel.y + panel.height + GAP;
        break;
      case 'bottom':
        x = anchor.point.x - size.width / 2;
        y = panel.y - size.height - GAP;
        break;
      case 'left':
        x = panel.x + panel.width + GAP;
        y = anchor.point.y - size.height / 2;
        break;
      case 'right':
        x = panel.x - size.width - GAP;
        y = anchor.point.y - size.height / 2;
        break;
    }
  }
  return {
    x: Math.round(clamp(x, area.x + GAP, area.x + area.width - size.width - GAP)),
    y: Math.round(clamp(y, area.y + GAP, area.y + area.height - size.height - GAP)),
    width: size.width,
    height: size.height,
  };
}

// Shells such as Caelestia draw their bar inside one dock surface that covers
// the whole display, which gives no panel edge to anchor to.
function isFullDisplayDock(window) {
  const rect = window.frameGeometry;
  const screen = window.output?.geometry;
  return Boolean(
    window.dock && screen && rect.width > screen.width / 2 && rect.height > screen.height / 2,
  );
}

function isPanel(window) {
  const rect = window.frameGeometry;
  return window.dock && rect.width > 0 && rect.height > 0 && !isFullDisplayDock(window);
}

function panelWindows() {
  return workspace.windowList().filter(isPanel);
}

function unmeasuredDockAt(point) {
  return workspace.windowList().some((window) =>
    isFullDisplayDock(window) && contains(window.frameGeometry, point),
  );
}

// Edge anchors only stand in for a bar KWin cannot measure, so they lapse
// once that output gains a measurable panel or loses its full-display dock.
function edgeAnchorUsable(output, panels, removed) {
  return workspace.screens.includes(output) &&
    !panels.some((panel) => panel.output === output && panel !== removed) &&
    workspace.windowList().some((window) =>
      window !== removed && isFullDisplayDock(window) && window.output === output);
}

// A bar beside a display edge that KWin cannot measure, rebuilt from the
// display's current geometry so it follows resolution and scale changes.
// `along` is the click's position along the edge and `distance` its distance
// from the edge.
function edgeAnchor(output, edge, along, distance) {
  const screen = output.geometry;
  const horizontal = edge === 'top' || edge === 'bottom';
  const start = horizontal ? screen.x : screen.y;
  const length = horizontal ? screen.width : screen.height;
  if (along < start || along >= start + length) {
    return null;
  }
  const thickness = Math.max(1, Math.round(distance * 2));
  const frameGeometry = {
    top: { x: screen.x, y: screen.y, width: screen.width, height: thickness },
    bottom: { x: screen.x, y: screen.y + screen.height - thickness, width: screen.width, height: thickness },
    left: { x: screen.x, y: screen.y, width: thickness, height: screen.height },
    right: { x: screen.x + screen.width - thickness, y: screen.y, width: thickness, height: screen.height },
  }[edge];
  const point = {
    top: { x: along, y: screen.y + distance },
    bottom: { x: along, y: screen.y + screen.height - distance },
    left: { x: screen.x + distance, y: along },
    right: { x: screen.x + screen.width - distance, y: along },
  }[edge];
  return { panel: { frameGeometry, output }, edge, point, pointer: { output, edge, along, distance } };
}

// A tray click on a display with no measurable panel, such as a bar drawn
// inside a full-display surface. The pointer sits on the icon, so the bar is
// assumed to span from the display edge to as far past the pointer as the
// edge is before it.
function pointerAnchor(cursor, panels) {
  const output = workspace.screenAt(cursor);
  if (!output || panels.some((panel) => panel.output === output) || !unmeasuredDockAt(cursor)) {
    return null;
  }
  const screen = output.geometry;
  const distances = {
    top: cursor.y - screen.y,
    bottom: screen.y + screen.height - cursor.y,
    left: cursor.x - screen.x,
    right: screen.x + screen.width - cursor.x,
  };
  const edge = Object.keys(distances).reduce((a, b) => (distances[b] < distances[a] ? b : a));
  if (distances[edge] > EDGE_REACH) {
    return null;
  }
  const along = edge === 'top' || edge === 'bottom' ? cursor.x : cursor.y;
  return edgeAnchor(output, edge, along, distances[edge]);
}

function selectAnchor(window) {
  const panels = panelWindows();
  const cursor = { x: workspace.cursorPos.x, y: workspace.cursorPos.y };
  const clickedPanel = panels.find((panel) => contains(panel.frameGeometry, cursor));
  if (clickedPanel) {
    lastAnchor = {
      panel: clickedPanel,
      edge: edgeOf(clickedPanel.frameGeometry, clickedPanel.output.geometry),
      point: cursor,
    };
    return lastAnchor;
  }

  const clickedEdge = pointerAnchor(cursor, panels);
  if (clickedEdge) {
    lastAnchor = clickedEdge;
    return lastAnchor;
  }

  if (lastAnchor?.pointer) {
    const { output, edge, along, distance } = lastAnchor.pointer;
    lastAnchor = edgeAnchorUsable(output, panels) ? edgeAnchor(output, edge, along, distance) : null;
    if (lastAnchor) {
      return lastAnchor;
    }
  }

  if (lastAnchor && panels.includes(lastAnchor.panel)) {
    const panel = lastAnchor.panel;
    const edge = edgeOf(panel.frameGeometry, panel.output.geometry);
    if (edge === lastAnchor.edge && contains(panel.frameGeometry, lastAnchor.point)) {
      return lastAnchor;
    }
  }
  lastAnchor = null;

  const output = workspace.screenAt(cursor) || window.output;
  const onOutput = panels.filter((candidate) => candidate.output === output);
  const panel = onOutput.find((candidate) => String(candidate.resourceClass) === 'plasmashell') || onOutput[0];
  if (!panel) {
    return null;
  }
  const rect = panel.frameGeometry;
  return {
    panel,
    edge: edgeOf(rect, panel.output.geometry),
    point: { x: rect.x + rect.width - GAP, y: rect.y + rect.height - GAP },
  };
}

function place(entry) {
  const window = entry.window;
  if (entry.moving || window.deleted || window.hidden || window.fullScreen || window.move || window.resize) {
    return;
  }
  const frame = window.frameGeometry;
  if (frame.width <= 0 || frame.height <= 0) {
    return;
  }
  const output = entry.anchor ? entry.anchor.panel.output : window.output;
  const area = workspace.clientArea(KWin.MaximizeArea, output, workspace.currentDesktop);
  const target = placement(frame, area, entry.anchor);
  if (frame.x === target.x && frame.y === target.y) {
    return;
  }
  entry.moving = true;
  try {
    window.frameGeometry = target;
  } finally {
    entry.moving = false;
  }
}

function track(window) {
  if (!isGitify(window) || windows.has(window)) {
    return;
  }
  const entry = { window, anchor: null, moving: false };
  windows.set(window, entry);
  // Electron cannot keep a window above others on Wayland, so a popup opened
  // from the tray would otherwise open behind the window that has focus.
  window.keepAbove = true;
  const onShow = () => {
    entry.anchor = selectAnchor(window);
    place(entry);
  };
  // Newer KWin exposes visibility through hiddenChanged instead of windowShown.
  const visibilityChanged = window.windowShown || window.hiddenChanged;
  visibilityChanged.connect(() => {
    if (!window.hidden) {
      onShow();
    }
  });
  window.frameGeometryChanged.connect((previous) => {
    const current = window.frameGeometry;
    if (previous.width !== current.width || previous.height !== current.height) {
      place(entry);
    }
  });
  window.closed.connect(() => windows.delete(window));
  onShow();
}

workspace.windowAdded.connect(track);
// KWin may still list a window while announcing its removal, so it is
// excluded explicitly when checking whether an edge anchor still has a dock.
function anchoredTo(anchor, window) {
  if (!anchor) {
    return false;
  }
  if (anchor.pointer) {
    return Boolean(window.dock) && !edgeAnchorUsable(anchor.pointer.output, panelWindows(), window);
  }
  return anchor.panel === window;
}

workspace.windowRemoved.connect((window) => {
  if (anchoredTo(lastAnchor, window)) {
    lastAnchor = null;
  }
  for (const entry of windows.values()) {
    if (anchoredTo(entry.anchor, window)) {
      entry.anchor = entry.anchor.pointer ? null : selectAnchor(entry.window);
      place(entry);
    }
  }
});
workspace.screensChanged.connect(() => {
  for (const entry of windows.values()) {
    entry.anchor = selectAnchor(entry.window);
    place(entry);
  }
});
workspace.windowList().forEach(track);
