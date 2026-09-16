import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../gitify/contents/code/main.js', import.meta.url), 'utf8');

function signal() {
  const handlers = [];
  return { connect: (handler) => handlers.push(handler), emit: (...args) => handlers.forEach((handler) => handler(...args)) };
}

function fixture() {
  const output = { geometry: { x: 0, y: 0, width: 1920, height: 1080 } };
  const panel = { dock: true, resourceClass: 'plasmashell', output, frameGeometry: { x: 0, y: 1040, width: 1920, height: 40 } };
  let frame = { x: 710, y: 340, width: 500, height: 400 };
  const window = {
    resourceClass: 'gitify', caption: 'Gitify', normalWindow: true, dialog: false,
    hidden: false, deleted: false, output,
    windowShown: signal(), hiddenChanged: signal(), frameGeometryChanged: signal(), closed: signal(),
    get frameGeometry() { return frame; },
    set frameGeometry(value) {
      const previous = frame;
      frame = value;
      this.frameGeometryChanged.emit(previous);
    },
  };
  const allWindows = [panel];
  const workspace = {
    cursorPos: { x: 1500, y: 1060 }, currentDesktop: {}, screens: [output],
    windowList: () => allWindows,
    screenAt: () => output,
    clientArea: (_option, screen) => screen.geometry,
    windowAdded: signal(), windowRemoved: signal(), screensChanged: signal(),
  };
  const context = vm.createContext({ workspace, KWin: { MaximizeArea: 0 } });
  vm.runInContext(`${source}\nglobalThis.api = { placement, edgeOf, isGitify, windows };`, context);
  const add = () => { allWindows.push(window); workspace.windowAdded.emit(window); };
  return { ...context.api, window, panel, output, workspace, allWindows, add };
}

test('anchors a tray click above a bottom panel', () => {
  const f = fixture();
  f.add();
  assert.equal(f.window.frameGeometry.x, 1250);
  assert.equal(f.window.frameGeometry.y, 632);
});

test('top, left, and right panels open toward the display interior', () => {
  for (const [panel, cursor, expected] of [
    [{ x: 0, y: 0, width: 1920, height: 40 }, { x: 1000, y: 20 }, [750, 48]],
    [{ x: 0, y: 0, width: 40, height: 1080 }, { x: 20, y: 500 }, [48, 300]],
    [{ x: 1880, y: 0, width: 40, height: 1080 }, { x: 1900, y: 500 }, [1372, 300]],
  ]) {
    const f = fixture();
    f.panel.frameGeometry = panel;
    f.workspace.cursorPos = cursor;
    f.add();
    assert.deepEqual([f.window.frameGeometry.x, f.window.frameGeometry.y], expected);
  }
});

test('clamps the popup near a display edge', () => {
  const f = fixture();
  f.workspace.cursorPos.x = 1915;
  f.add();
  assert.equal(f.window.frameGeometry.x, 1412);
});

test('uses logical coordinates on a display with a negative origin', () => {
  const f = fixture();
  f.output.geometry = { x: -1600, y: -100, width: 1600, height: 900 };
  f.panel.frameGeometry = { x: -1600, y: 760, width: 1600, height: 40 };
  f.workspace.cursorPos = { x: -250, y: 780 };
  f.add();
  assert.deepEqual([f.window.frameGeometry.x, f.window.frameGeometry.y], [-508, 352]);
});

test('follows a floating auto-hide panel even though it reserves no work area', () => {
  const f = fixture();
  f.panel.hidden = true;
  f.panel.frameGeometry = { x: 500, y: 1010, width: 920, height: 50 };
  f.workspace.cursorPos = { x: 1300, y: 1030 };
  f.add();
  assert.equal(f.window.frameGeometry.y, 602);
});

test('remembers the tray anchor across a hide and keyboard reopen', () => {
  const f = fixture();
  f.add();
  f.window.hidden = true;
  f.workspace.cursorPos = { x: 300, y: 300 };
  f.window.hidden = false;
  f.window.frameGeometry = { x: 710, y: 340, width: 500, height: 400 };
  f.window.windowShown.emit();
  assert.deepEqual([f.window.frameGeometry.x, f.window.frameGeometry.y], [1250, 632]);
});

test('reanchors size changes without recursive geometry updates', () => {
  const f = fixture();
  f.add();
  f.window.frameGeometry = { ...f.window.frameGeometry, height: 700 };
  assert.equal(f.window.frameGeometry.y, 332);
  assert.equal(f.window.frameGeometry.height, 700);
});

test('handles visibility changes on newer KWin without windowShown', () => {
  const f = fixture();
  delete f.window.windowShown;
  f.add();
  f.window.hidden = true;
  f.window.hiddenChanged.emit();
  f.window.frameGeometry = { x: 710, y: 340, width: 500, height: 400 };
  f.window.hidden = false;
  f.window.hiddenChanged.emit();
  assert.deepEqual([f.window.frameGeometry.x, f.window.frameGeometry.y], [1250, 632]);
});

test('uses a panel fallback before the first tray click', () => {
  const f = fixture();
  f.workspace.cursorPos = { x: 900, y: 400 };
  f.add();
  assert.deepEqual([f.window.frameGeometry.x, f.window.frameGeometry.y], [1412, 632]);
});

test('uses a corner when there is no panel and releases removed panel references', () => {
  const f = fixture();
  f.add();
  f.allWindows.splice(f.allWindows.indexOf(f.panel), 1);
  f.workspace.windowRemoved.emit(f.panel);
  assert.deepEqual([f.window.frameGeometry.x, f.window.frameGeometry.y], [1412, 8]);
});

test('ignores dialogs, developer tools, and other applications', () => {
  const f = fixture();
  for (const override of [{ dialog: true }, { caption: 'DevTools - Gitify' }, { resourceClass: 'not-gitify' }]) {
    assert.equal(f.isGitify({ ...f.window, ...override }), false);
  }
});

test('does not move fullscreen windows or windows being dragged', () => {
  for (const override of [{ fullScreen: true }, { move: true }, { resize: true }]) {
    const f = fixture();
    Object.assign(f.window, override);
    f.add();
    assert.equal(f.window.frameGeometry.x, 710);
    assert.equal(f.window.frameGeometry.y, 340);
  }
});

test('registers each window once and releases it on close', () => {
  const f = fixture();
  f.add();
  f.workspace.windowAdded.emit(f.window);
  assert.equal(f.windows.size, 1);
  f.window.closed.emit();
  assert.equal(f.windows.size, 0);
});
