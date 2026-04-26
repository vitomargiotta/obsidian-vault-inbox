import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, VaultInboxSettings, VIEW_TYPE_INBOX } from './types';
import { NotificationStore } from './store';
import { Watcher } from './watcher';
import { InboxView } from './view';
import { VaultInboxSettingTab } from './settings';

export default class VaultInboxPlugin extends Plugin {
	settings!: VaultInboxSettings;
	store!: NotificationStore;
	private watcher!: Watcher;
	private ribbonEl?: HTMLElement;
	private ribbonBadge?: HTMLElement;

	async onload() {
		await this.loadSettings();

		this.store = new NotificationStore(this.settings, () => this.saveData(this.settings));
		this.watcher = new Watcher(this, this.store, () => this.settings.rules);
		this.watcher.start();

		this.registerView(VIEW_TYPE_INBOX, (leaf) => new InboxView(leaf, this.store));

		this.ribbonEl = this.addRibbonIcon('inbox', 'Vault Inbox', () => { void this.activateView(); });
		this.ribbonEl.addClass('vault-inbox-ribbon');
		this.ribbonEl.style.position = 'relative';
		this.ribbonBadge = this.ribbonEl.createDiv({ cls: 'vault-inbox-ribbon-badge' });

		this.addCommand({
			id: 'open-inbox',
			name: 'Open inbox',
			callback: () => { void this.activateView(); },
		});
		this.addCommand({
			id: 'mark-all-read',
			name: 'Mark all notifications as read',
			callback: () => { void this.store.markAllRead(); },
		});

		this.addSettingTab(new VaultInboxSettingTab(this.app, this));

		this.store.on('change', () => this.refreshBadge());
		this.refreshBadge();
	}

	onunload() {
		// View instances are cleaned up by Obsidian; nothing else to do.
	}

	private refreshBadge(): void {
		if (!this.ribbonBadge) return;
		const unread = this.store.unreadCount();
		this.ribbonBadge.style.display = unread > 0 ? 'block' : 'none';
	}

	private async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_INBOX)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			if (leaf) await leaf.setViewState({ type: VIEW_TYPE_INBOX, active: true });
		}
		if (leaf) workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<VaultInboxSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
		// Defensive: ensure arrays are arrays.
		if (!Array.isArray(this.settings.rules)) this.settings.rules = [];
		if (!Array.isArray(this.settings.notifications)) this.settings.notifications = [];
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
