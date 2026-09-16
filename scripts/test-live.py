#!/usr/bin/env python3
"""Exercise the packaged script against a real KWin session and installed Gitify."""

import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time

from gi.repository import Gio, GLib

ROOT = Path(__file__).resolve().parents[1]
BUS = Gio.bus_get_sync(Gio.BusType.SESSION, None)
SERVICE = f"io.gitify.PositionTest.p{os.getpid()}"
INTERFACE = "io.gitify.PositionTest"
reports = []


def call(service, path, interface, method, signature=None, args=()):
    parameters = GLib.Variant(signature, args) if signature else None
    return BUS.call_sync(service, path, interface, method, parameters, None,
                         Gio.DBusCallFlags.NONE, 5000, None).unpack()


def scripting(method, signature=None, args=()):
    return call("org.kde.KWin", "/Scripting", "org.kde.kwin.Scripting", method, signature, args)


def load_script(path, name):
    script_id, = scripting("loadScript", "(ss)", (str(path), name))
    if script_id < 0:
        raise RuntimeError(f"KWin did not load {path}")
    call("org.kde.KWin", f"/Scripting/Script{script_id}", "org.kde.kwin.Script", "run")


def receive(_connection, _sender, _path, _interface, _method, parameters, invocation):
    reports.append(json.loads(parameters.unpack()[0]))
    invocation.return_value(None)


def until(predicate, description, seconds=10):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        while GLib.MainContext.default().pending():
            GLib.MainContext.default().iteration(False)
        result = predicate()
        if result:
            return result
        time.sleep(0.1)
    raise AssertionError(f"Timed out waiting for {description}")


def main():
    call("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
         "RequestName", "(su)", (SERVICE, 0))
    xml = f'<node><interface name="{INTERFACE}"><method name="Report"><arg type="s" direction="in"/></method></interface></node>'
    registration = BUS.register_object("/Test", Gio.DBusNodeInfo.new_for_xml(xml).interfaces[0], receive, None, None)
    plugin = f"gitify-live-test-{os.getpid()}"
    probe_name = f"{plugin}-probe"
    installed, = scripting("isScriptLoaded", "(s)", ("gitify",))
    process = None
    try:
        with tempfile.TemporaryDirectory(prefix="gitify-kwin-test-") as directory:
            temporary = Path(directory)
            env = dict(os.environ, XDG_CONFIG_HOME=str(temporary / "config"),
                       XDG_CACHE_HOME=str(temporary / "cache"), XDG_DATA_HOME=str(temporary / "data"))
            env.pop("ELECTRON_RUN_AS_NODE", None)
            with (temporary / "app.log").open("w+") as log:
                process = subprocess.Popen(["gitify", "--inspect=127.0.0.1:0"], env=env, stdout=log, stderr=log)

                def inspect(mutation=""):
                    reports.clear()
                    source = f"""
const targets = workspace.windowList().filter(w => w.pid === {process.pid} && w.caption === 'Gitify');
{mutation}
function rect(r) {{ return {{ x:r.x, y:r.y, width:r.width, height:r.height }}; }}
callDBus('{SERVICE}', '/Test', '{INTERFACE}', 'Report', JSON.stringify({{
  windows: targets.map(w => ({{ frame:rect(w.frameGeometry), hidden:w.hidden, screen:rect(w.output.geometry), type:String(w), appId:String(w.resourceClass), normalWindow:w.normalWindow, dialog:w.dialog, move:w.move, resize:w.resize, fullScreen:w.fullScreen }})),
  panels: workspace.windowList().filter(w => w.dock && String(w.resourceClass) === 'plasmashell').map(w => rect(w.frameGeometry))
}}));
"""
                    probe = temporary / "probe.js"
                    probe.write_text(source)
                    try:
                        load_script(probe, probe_name)
                        until(lambda: reports, "KWin report", 5)
                        return reports[-1]
                    finally:
                        scripting("unloadScript", "(s)", (probe_name,))

                def visible():
                    return next((window for window in inspect()["windows"] if not window["hidden"]), None)

                def tray_item():
                    items, = call("org.kde.StatusNotifierWatcher", "/StatusNotifierWatcher",
                                  "org.freedesktop.DBus.Properties", "Get", "(ss)",
                                  ("org.kde.StatusNotifierWatcher", "RegisteredStatusNotifierItems"))
                    for item in items:
                        service, _, path = item.partition("/")
                        try:
                            pid, = call("org.freedesktop.DBus", "/org/freedesktop/DBus",
                                        "org.freedesktop.DBus", "GetConnectionUnixProcessID", "(s)", (service,))
                            if pid == process.pid:
                                return service, "/" + path
                        except GLib.Error:
                            continue
                    return None

                tray_service, tray_path = until(tray_item, "Gitify's tray icon", 20)
                def activate():
                    call(tray_service, tray_path, "org.kde.StatusNotifierItem", "Activate", "(ii)", (0, 0))

                if not visible():
                    activate()
                before = until(visible, "Gitify's initial window", 20)
                print('Before:', json.dumps(before), flush=True)
                if not installed:
                    load_script(ROOT / "gitify/contents/code/main.js", plugin)
                print('After loading script:', json.dumps(inspect()), flush=True)

                def beside_panel():
                    report = inspect()
                    for window in report["windows"]:
                        frame = window["frame"]
                        if window["hidden"]:
                            continue
                        for panel in report["panels"]:
                            gaps = [frame["y"] - panel["y"] - panel["height"],
                                    panel["y"] - frame["y"] - frame["height"],
                                    frame["x"] - panel["x"] - panel["width"],
                                    panel["x"] - frame["x"] - frame["width"]]
                            if any(abs(gap - 8) < 1 for gap in gaps):
                                return window
                    return None

                after = until(beside_panel, "panel placement")
                screen, frame = after["screen"], after["frame"]
                assert frame["x"] >= screen["x"] and frame["y"] >= screen["y"]
                assert frame["x"] + frame["width"] <= screen["x"] + screen["width"]
                assert frame["y"] + frame["height"] <= screen["y"] + screen["height"]
                if not installed:
                    assert after["frame"] != before["frame"], "Script did not change placement"

                log.flush()
                endpoint = re.search(r"ws://127\.0\.0\.1:\d+/[\w-]+", (temporary / "app.log").read_text()).group()
                expression = f"""(() => {{
const electron = process.getBuiltinModule('module').createRequire(process.resourcesPath + '/app.asar/package.json')('electron');
electron.BrowserWindow.getAllWindows()[0].setSize({frame['width']}, {frame['height'] + 100});
}})()"""
                subprocess.run(["node", "--input-type=module", "-e", """
const socket = new WebSocket(process.argv[1]);
const timeout = setTimeout(() => { console.error('Inspector timed out'); process.exit(1); }, 5000);
socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: process.argv[2] } }));
socket.onmessage = ({ data }) => {
  const result = JSON.parse(data);
  if (result.id !== 1) return;
  clearTimeout(timeout);
  socket.close();
  if (result.error || result.result.exceptionDetails) {
    console.error(JSON.stringify(result));
    process.exitCode = 1;
  }
};
""", endpoint, expression], check=True)
                resized = until(lambda: (window := beside_panel()) and window["frame"]["height"] != frame["height"] and window, "anchored resize")
                activate()
                until(lambda: not visible(), "Gitify to hide")
                activate()
                reopened = until(beside_panel, "Gitify to reopen beside the panel")
                print(json.dumps({"before": before, "after": after, "resized": resized, "reopened": reopened}, indent=2))
                print("Native KWin placement, resize, and tray reopen passed. Gitify ran with normal sandboxing.")
    finally:
        scripting("unloadScript", "(s)", (plugin,))
        if process is not None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        BUS.unregister_object(registration)


if __name__ == "__main__":
    main()
