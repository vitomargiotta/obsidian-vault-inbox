import { App, TAbstractFile, TFile, Plugin, CachedMetadata, Notice } from 'obsidian';
import { NotificationStore } from './store';
import { BaseRule, FolderRule, WatchRule } from './types';
import { ParsedBase, parseBase } from './baseParser';
import { evalFilter, EvalContext } from './filterEval';

const STARTUP_GRACE_MS = 5000;
const SELF_CREATE_WINDOW_MS = 500;
const BASE_PENDING_TIMEOUT_MS = 5000;

interface PendingBaseEval {
	file: TFile;
	ruleId: string;
	parsed: ParsedBase;
	expiresAt: number;
}

export class Watcher {
	private app: App;
	private plugin: Plugin;
	private store: NotificationStore;
	private getRules: () => WatchRule[];
	private startedAt = 0;

	private parsedBases = new Map<string, ParsedBase>(); // basePath -> parsed
	private pending = new Map<string, PendingBaseEval>(); // file.path -> pending eval

	constructor(plugin: Plugin, store: NotificationStore, getRules: () => WatchRule[]) {
		this.app = plugin.app;
		this.plugin = plugin;
		this.store = store;
		this.getRules = getRules;
	}

	start(): void {
		this.startedAt = Date.now();
		this.refreshBases();

		this.plugin.registerEvent(
			this.app.vault.on('create', (file) => this.onCreate(file))
		);
		this.plugin.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				void this.store.handleRename(oldPath, file.path);
				if (file instanceof TFile && file.extension === 'base') this.refreshBases();
			})
		);
		this.plugin.registerEvent(
			this.app.vault.on('delete', (file) => {
				void this.store.handleDelete(file.path);
				if (file instanceof TFile && file.extension === 'base') this.refreshBases();
			})
		);
		this.plugin.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file instanceof TFile && file.extension === 'base') this.refreshBases();
			})
		);
		this.plugin.registerEvent(
			this.app.metadataCache.on('changed', (file, _data, cache) => this.onMetadataChanged(file, cache))
		);
	}

	// Re-parse all .base files referenced by base rules. Called on rule change
	// and when any .base file is modified.
	refreshBases(): void {
		this.parsedBases.clear();
		for (const rule of this.getRules()) {
			if (rule.type !== 'base') continue;
			const baseFile = this.app.vault.getAbstractFileByPath(rule.basePath);
			if (!(baseFile instanceof TFile)) continue;
			void this.app.vault.read(baseFile).then(content => {
				const parsed = parseBase(content);
				this.parsedBases.set(rule.basePath, parsed);
				if (parsed.warnings.length > 0) {
					new Notice(`Vault Inbox: ${rule.basePath} — ${parsed.warnings[0]}`, 6000);
				}
			});
		}
	}

	private onCreate(file: TAbstractFile): void {
		if (Date.now() - this.startedAt < STARTUP_GRACE_MS) return;
		if (!(file instanceof TFile)) return;

		// Folder rules: synchronous check after self-create window.
		const folderRule = this.firstMatchingFolderRule(file.path);
		if (folderRule) {
			window.setTimeout(() => {
				if (this.isActiveFile(file)) return;
				void this.store.add({ path: file.path, event: 'create', ruleId: folderRule.id });
			}, SELF_CREATE_WINDOW_MS);
			return;
		}

		// Base rules: queue for deferred frontmatter evaluation.
		const baseRule = this.firstMatchingBaseRule(file);
		if (!baseRule) return;
		const parsed = this.parsedBases.get(baseRule.basePath);
		if (!parsed) return;

		window.setTimeout(() => {
			if (this.isActiveFile(file)) return;
			this.evaluateBase(file, baseRule, parsed);
		}, SELF_CREATE_WINDOW_MS);
	}

	private evaluateBase(file: TFile, rule: BaseRule, parsed: ParsedBase): void {
		const cache = this.app.metadataCache.getFileCache(file);
		const result = evalFilter(parsed.filter, this.contextFor(file, cache));
		if (result === 'match') {
			void this.store.add({ path: file.path, event: 'create', ruleId: rule.id });
			return;
		}
		if (result === 'no-match') return;
		// pending: queue and wait for metadataCache.changed.
		this.pending.set(file.path, {
			file, ruleId: rule.id, parsed,
			expiresAt: Date.now() + BASE_PENDING_TIMEOUT_MS,
		});
		window.setTimeout(() => {
			const entry = this.pending.get(file.path);
			if (!entry || entry.ruleId !== rule.id) return;
			if (Date.now() >= entry.expiresAt) this.pending.delete(file.path);
		}, BASE_PENDING_TIMEOUT_MS + 50);
	}

	private onMetadataChanged(file: TFile, cache: CachedMetadata): void {
		const entry = this.pending.get(file.path);
		if (!entry) return;
		if (Date.now() > entry.expiresAt) {
			this.pending.delete(file.path);
			return;
		}
		const result = evalFilter(entry.parsed.filter, this.contextFor(file, cache));
		if (result === 'match') {
			this.pending.delete(file.path);
			void this.store.add({ path: file.path, event: 'create', ruleId: entry.ruleId });
		} else if (result === 'no-match') {
			this.pending.delete(file.path);
		}
		// pending: keep waiting (frontmatter could still arrive).
	}

	private contextFor(file: TFile, cache: CachedMetadata | null): EvalContext {
		return {
			filePath: file.path,
			fileFolder: file.parent?.path ?? '',
			fileName: file.basename,
			frontmatter: cache?.frontmatter as Record<string, unknown> | undefined,
		};
	}

	private isActiveFile(file: TFile): boolean {
		return this.app.workspace.getActiveFile()?.path === file.path;
	}

	private firstMatchingFolderRule(path: string): FolderRule | undefined {
		for (const rule of this.getRules()) {
			if (rule.type === 'folder' && this.folderMatches(path, rule.folder, rule.recursive)) {
				return rule;
			}
		}
		return undefined;
	}

	private firstMatchingBaseRule(file: TFile): BaseRule | undefined {
		for (const rule of this.getRules()) {
			if (rule.type !== 'base') continue;
			const parsed = this.parsedBases.get(rule.basePath);
			if (!parsed) continue;
			if (parsed.scopeFolders.length === 0) return rule; // vault-wide
			if (parsed.scopeFolders.some(f => this.folderMatches(file.path, f, true))) return rule;
		}
		return undefined;
	}

	private folderMatches(filePath: string, folder: string, recursive: boolean): boolean {
		const f = normalizeFolder(folder);
		if (f === '') return recursive ? true : !filePath.includes('/');
		if (recursive) return filePath === f || filePath.startsWith(f + '/');
		const parent = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
		return parent === f;
	}
}

function normalizeFolder(folder: string): string {
	return folder.replace(/^\/+|\/+$/g, '');
}
