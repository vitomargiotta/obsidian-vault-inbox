import { App, TAbstractFile, TFile, Plugin } from 'obsidian';
import { NotificationStore } from './store';
import { WatchRule } from './types';

const STARTUP_GRACE_MS = 5000;
const SELF_CREATE_WINDOW_MS = 500;

export class Watcher {
	private app: App;
	private plugin: Plugin;
	private store: NotificationStore;
	private getRules: () => WatchRule[];
	private startedAt = 0;

	constructor(plugin: Plugin, store: NotificationStore, getRules: () => WatchRule[]) {
		this.app = plugin.app;
		this.plugin = plugin;
		this.store = store;
		this.getRules = getRules;
	}

	start(): void {
		this.startedAt = Date.now();
		this.plugin.registerEvent(
			this.app.vault.on('create', (file) => this.onCreate(file))
		);
		this.plugin.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				void this.store.handleRename(oldPath, file.path);
			})
		);
		this.plugin.registerEvent(
			this.app.vault.on('delete', (file) => {
				void this.store.handleDelete(file.path);
			})
		);
	}

	private onCreate(file: TAbstractFile): void {
		if (Date.now() - this.startedAt < STARTUP_GRACE_MS) return;
		if (!(file instanceof TFile)) return;

		const matchingRule = this.firstMatchingRule(file.path);
		if (!matchingRule) return;

		// Self-create heuristic: if the file becomes the active editor within
		// SELF_CREATE_WINDOW_MS, assume the user just made it and skip.
		window.setTimeout(() => {
			if (this.isActiveFile(file)) return;
			void this.store.add({
				path: file.path,
				event: 'create',
				ruleId: matchingRule.id,
			});
		}, SELF_CREATE_WINDOW_MS);
	}

	private isActiveFile(file: TFile): boolean {
		const active = this.app.workspace.getActiveFile();
		return active?.path === file.path;
	}

	private firstMatchingRule(path: string): WatchRule | undefined {
		for (const rule of this.getRules()) {
			if (rule.type === 'folder' && this.folderMatches(path, rule.folder, rule.recursive)) {
				return rule;
			}
		}
		return undefined;
	}

	private folderMatches(filePath: string, folder: string, recursive: boolean): boolean {
		const f = normalizeFolder(folder);
		if (f === '') {
			// Vault root.
			return recursive ? true : !filePath.includes('/');
		}
		if (recursive) {
			return filePath === f || filePath.startsWith(f + '/');
		}
		const parent = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
		return parent === f;
	}
}

function normalizeFolder(folder: string): string {
	return folder.replace(/^\/+|\/+$/g, '');
}
