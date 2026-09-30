# Gitify for KDE Plasma

[![Install from the KDE Store](https://img.shields.io/badge/KDE_Store-Install-1D99F3?logo=kde&logoColor=white)](https://store.kde.org/p/2371508/)

A KWin script that places Gitify beside the panel on native Wayland.

When you click Gitify's tray icon, the popup opens next to the click position. Keyboard opens reuse the last panel anchor. Before the first tray click, it opens at the end of a panel on the pointer's display, or in the top-right corner when no panel is available.

The script supports horizontal and vertical panels, floating and auto-hide panels, and multiple displays. It keeps the popup inside the usable display area and repositions it when Gitify changes size. Dialogs and other applications are left alone.

KWin does not expose individual system-tray icon rectangles to scripts. The script therefore uses the pointer position at the panel when Gitify opens, rather than reading private Plasma widget internals. Icons opened from the tray overflow and startup opens use the remembered position or panel fallback.

## Install

Requires KDE Plasma 6 on Wayland and Gitify 7.8 or newer. Tested with Plasma 6.7.5 and Gitify 7.8.0. Keep Gitify's **Use X11 backend** setting off.

Install Gitify first. On Arch Linux and derivatives, use [`gitify-bin` from the AUR](https://aur.archlinux.org/packages/gitify-bin). For other distributions, use a [Gitify release](https://github.com/gitify-app/gitify/releases).

### From the KDE Store

Get [Gitify for KDE Plasma on the KDE Store](https://store.kde.org/p/2371508/):

1. Open **System Settings → Window Management → KWin Scripts → Get New Scripts**.
2. Search for **Gitify for KDE Plasma** and install it.
3. Enable **Gitify** in KWin Scripts and apply.

You can also download `gitify.kwinscript` from the Store page and import it with **Install from File** in KWin Scripts, then enable Gitify and apply.

Click Gitify's tray icon to check the placement.

### From source

Clone this repository and run the installer from your Plasma session:

```sh
git clone https://github.com/gitify-app/kde.git
cd kde
bash scripts/install.sh
```

The installer uses `kpackagetool6`, `kwriteconfig6`, and `qdbus6`. It installs for your user and enables the script without restarting Plasma. Click Gitify's tray icon to check the placement.

To update, run `git pull --ff-only` in this checkout and rerun `bash scripts/install.sh`.

Alternatively, run `npm run bundle` and import `dist/gitify.kwinscript` through **System Settings → Window Management → KWin Scripts → Install from File**. Enable Gitify and apply.

### Disable or uninstall

To disable, uncheck Gitify in KWin Scripts. To uninstall:

```sh
kwriteconfig6 --file kwinrc --group Plugins --key gitifyEnabled false
qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript gitify
kpackagetool6 --type KWin/Script --remove gitify
```

## Development

```sh
npm test
npm run bundle
```

Tests run the same script in a JavaScript VM with compositor events and cover panel placement, display boundaries, resizing, repeated opens, and window filtering.

With Gitify installed, run `npm run test:live` inside a Plasma Wayland session. This needs Node 24, Python 3, and PyGObject, provided by `python-gobject` on Arch. It launches Gitify with a temporary profile, measures the window through KWin, and checks placement, resizing, and tray hide/reopen. It tests the installed script if enabled; otherwise, it temporarily loads this checkout's script. It unloads its temporary script and closes the test app when finished.

Building the `.kwinscript` bundle requires Python 3. The bundle contains only the metadata and JavaScript; users do not need Node or Python to run the installed script.

## License

MIT
