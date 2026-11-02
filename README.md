# Gitify for KDE Plasma

[![Install from the KDE Store](https://img.shields.io/badge/KDE_Store-Install-1D99F3?logo=kde&logoColor=white)](https://store.kde.org/p/2371508/)

A KWin script that places Gitify beside the panel on native Wayland.

When you click Gitify's tray icon, the popup opens next to the click position. Keyboard opens reuse the last panel anchor. Before the first tray click, it opens at the end of a panel on the pointer's display, or in the top-right corner when no panel is available.

The script supports horizontal and vertical panels, floating and auto-hide panels, and multiple displays. It also works with bars from other shells, such as Caelestia, including bars drawn inside a surface that covers the whole display; there it places the popup beside the clicked tray icon. It keeps the popup inside the usable display area, keeps it above other windows, and repositions it when Gitify changes size. Dialogs and other applications are left alone.

KWin does not expose individual system-tray icon rectangles to scripts. The script therefore uses the pointer position at the panel when Gitify opens, rather than reading private Plasma widget internals. Icons opened from the tray overflow and startup opens use the remembered position or panel fallback.

## 🚀 Install

Requires KWin 6 on Wayland, the window manager of KDE Plasma 6, and Gitify 7.8 or newer. It works with Plasma's own panels and with bars from other shells that run on KWin, such as Caelestia.

Keep Gitify's **Use X11 backend** setting off. That setting runs Gitify under XWayland so it can place its own popup, at the cost of native Wayland scaling. This script places the popup for Gitify's native Wayland window instead.

Install Gitify first. On Arch Linux and derivatives, use [`gitify-bin` from the AUR](https://aur.archlinux.org/packages/gitify-bin). For other distributions, use a [Gitify release](https://github.com/gitify-app/gitify/releases).

### 🛍️ From the KDE Store

Get [Gitify for KDE Plasma on the KDE Store](https://store.kde.org/p/2371508/):

1. Open **System Settings → Window Management → KWin Scripts → Get New…**.
2. Search for **Gitify for KDE Plasma** and install it.
3. Enable **Gitify** in KWin Scripts and apply.

You can also download `gitify.kwinscript` from the Store page and import it with **Install from File** in KWin Scripts, then enable Gitify and apply.

Updates appear in the same **Get New…** dialog.

### 🧰 From source

Clone this repository and run the installer from your Plasma session:

```sh
git clone https://github.com/gitify-app/kde.git
cd kde
bash scripts/install.sh
```

The installer uses `kpackagetool6`, `kwriteconfig6`, and `qdbus6`. It installs for your user and enables the script without restarting Plasma.

To update, run `git pull --ff-only` in this checkout and rerun `bash scripts/install.sh`.

Alternatively, build the bundle with `pnpm bundle`. The Node version is pinned in `.nvmrc`; Python 3 is provided by your system. Import `dist/gitify.kwinscript` through **System Settings → Window Management → KWin Scripts → Install from File**, then enable Gitify and apply.

### ✅ Check that it works

Click Gitify's tray icon. The popup should open next to the icon, on the side facing the middle of the display, and stay above other windows.

If it opens in a corner of the display instead:

1. Check that the script is running. This prints `true` when it is:

   ```sh
   qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.isScriptLoaded gitify
   ```

   If it prints `false`, enable Gitify in KWin Scripts and apply.
2. Check that Gitify's **Use X11 backend** setting is off, then restart Gitify.
3. Open Gitify from its tray icon rather than a keyboard shortcut. Until the first tray click, the script has no icon position and uses a fallback: the end of a panel, or the top-right corner when it finds no panel.

### 🚫 Disable or uninstall

To disable, uncheck Gitify in KWin Scripts and apply. To uninstall, remove it in KWin Scripts, or run:

```sh
kwriteconfig6 --file kwinrc --group Plugins --key gitifyEnabled false
qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript gitify
kpackagetool6 --type KWin/Script --remove gitify
```

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development, testing, and
release instructions.

## 📄 License

MIT
