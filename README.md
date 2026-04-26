# Vault Inbox

An Obsidian plugin that gives you a sidebar **inbox** of new files appearing in folders or [Bases](https://help.obsidian.md/bases) views you're watching.

If you sync your vault across devices, capture notes from external tools (web clipper, mobile capture, Readwise, etc.), or have automation dropping files into your vault, Vault Inbox surfaces those new arrivals so you don't have to go looking for them.

## What it does

- Watch any number of folders (recursively or not).
- Watch any number of `.base` files — Vault Inbox parses the base's filters and only notifies you when a new file actually matches them.
- New arrivals show up in a sidebar list with read/unread state.
- Click a notification to open the file. It's marked as read automatically.
- Optional native desktop notifications (macOS Notification Center, Windows toast, Linux libnotify).
- Notifications survive app restarts and follow files when you rename them.

## Why "external-only"?

The plugin tries hard to **not** notify you about files *you* just created from inside Obsidian (otherwise the inbox would fill up with your own typing). Two heuristics:

1. **Startup grace period** — no notifications for the first 5 seconds after the plugin loads (kills the initial sync flood).
2. **Self-create suppression** — if a newly-created file becomes the active editor within 500 ms, it's assumed to be one you just made, and the notification is suppressed.

The result: Vault Inbox is most useful for files that arrive from *outside* your current Obsidian session — sync from another device, an external tool writing to the vault folder, etc.

## Installation

The plugin isn't on the official Obsidian community plugin list yet. Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. In Obsidian, install and enable the **BRAT** community plugin.
2. Open BRAT settings → **Add Beta Plugin**.
3. Paste: `vitomargiotta/obsidian-vault-inbox`
4. Settings → Community plugins → enable **Vault Inbox**.

BRAT will keep the plugin up to date as new releases are tagged.

### Manual install

Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/vitomargiotta/obsidian-vault-inbox/releases) and drop them into `<vault>/.obsidian/plugins/vault-inbox/`.

## Configuration

Settings → **Vault Inbox**.

### Watched folders

Click **Add folder**, type or pick a folder path, and toggle **Recursive** if you want subfolders included. A new file created in any of these folders fires a notification.

### Watched bases

Click **Add base** and pick a `.base` file. Vault Inbox parses the base's filter and only notifies you when a new file matches *all* of the filter's conditions.

The filter language supported in v0.1:

- `==`, `!=` operators
- `and:`, `or:` combinators
- `file.folder`, `file.name`, `file.path` references
- Frontmatter property names (e.g. `type`, `status`, `product`)

Anything outside this subset (functions, regex, comparisons other than `==`/`!=`) generates a one-time warning notice and is ignored — files that *would* match those parts of the filter are still considered candidates and may trigger notifications.

> **Important caveat:** Only files whose frontmatter is **set at creation time** (typically via a template) reliably trigger base notifications. If you create a file blank and fill in `type`/`product`/etc. afterwards, Vault Inbox will likely time out and not notify you. Manually-created files are a planned improvement.

### OS notifications

Toggle **Show OS notifications** to also fire native desktop banners. Click the banner to focus Obsidian and open the file.

This is **desktop-only** — Obsidian's mobile platform doesn't provide a reliable native-notification API to plugins. The toggle is disabled on mobile.

## Sidebar inbox

Open from the **inbox icon** in the left ribbon, or via the command palette: *Vault Inbox: Open inbox*.

- Click a row → opens the file, marks read.
- Click the **dot** → toggles read/unread without opening the file.
- Right-click a row → menu with **Mark as read/unread** and **Remove**.
- Header buttons: **Mark all read**, **Clear read** (deletes all read notifications).
- The ribbon icon shows a small dot when there are unread notifications.

## Storage

Notifications are persisted in the plugin's `data.json` and survive app restarts. The default cap is 500 — once exceeded, oldest read notifications are dropped first, then oldest overall. Configurable in settings.

## Limitations

- v0.1 only watches `create` events. `modify`, `delete`, and `rename` are not watch triggers (renames *do* update existing notifications' paths automatically).
- Base watching requires frontmatter to be present at file-create time (see caveat above).
- OS notifications are desktop-only.
- The base filter language supported is a subset; complex expressions are ignored with a warning.

## License

MIT — see [LICENSE](LICENSE).
