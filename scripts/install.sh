#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
if [[ ${XDG_SESSION_TYPE:-} != wayland || ${XDG_CURRENT_DESKTOP:-} != *KDE* ]]; then
    echo 'Run this installer from a KDE Plasma Wayland session.' >&2
    exit 1
fi
installation=${XDG_DATA_HOME:-$HOME/.local/share}/kwin/scripts/gitify
if [[ -f "$installation/metadata.json" ]]; then
    kpackagetool6 --type KWin/Script --upgrade "$PWD/gitify"
else
    kpackagetool6 --type KWin/Script --install "$PWD/gitify"
fi
kwriteconfig6 --file kwinrc --group Plugins --key gitifyEnabled true
qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript gitify >/dev/null
qdbus6 org.kde.KWin /KWin org.kde.KWin.reconfigure
qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.start
printf 'Gitify positioning enabled. Open Gitify from its tray icon.\n'
