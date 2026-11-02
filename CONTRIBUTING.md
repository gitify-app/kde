# Contributing to Gitify for KDE Plasma

Thanks for your interest in contributing to Gitify for KDE Plasma!

This repository holds the KWin script only. See the [README](README.md) for what
it does and how to install it, and [Gitify][gitify-repo] for the app itself.

## 🛠️ Development

Install dependencies (Node version from `.nvmrc`):

```sh
pnpm install
```

```sh
pnpm lint:check
pnpm test
pnpm bundle
```

CI runs `pnpm lint:ci`, which adds GitHub annotations to lint findings.

Tests run the same script in a JavaScript VM with compositor events and cover panel placement, display boundaries, resizing, repeated opens, and window filtering.

With Gitify installed, run `pnpm test:live` inside a Plasma Wayland session. This needs Node (see `.nvmrc`), plus system Python 3 and PyGObject, provided by `python-gobject` on Arch. Python is intentionally system-managed because the live test imports the distro's PyGObject. It launches Gitify with a temporary profile, measures the window through KWin, and checks placement, resizing, and tray hide/reopen. It tests the installed script if enabled; otherwise, it temporarily loads this checkout's script. It unloads its temporary script and closes the test app when finished.

Building the `.kwinscript` bundle requires Python 3. The bundle contains only the metadata and JavaScript; users do not need Node or Python to run the installed script.

<!-- LINK LABELS -->
[gitify-repo]: https://github.com/gitify-app/gitify
