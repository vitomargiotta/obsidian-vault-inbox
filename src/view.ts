import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { NotificationStore } from './store';
import { InboxNotification, VIEW_TYPE_INBOX } from './types';

export class InboxView extends ItemView {
	private store: NotificationStore;
	private listEl!: HTMLElement;
	private detach?: () => void;

	constructor(leaf: WorkspaceLeaf, store: NotificationStore) {
		super(leaf);
		this.store = store;
	}

	getViewType(): string { return VIEW_TYPE_INBOX; }
	getDisplayText(): string { return 'Vault Inbox'; }
	getIcon(): string { return 'inbox'; }

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass('vault-inbox-view');

		const header = root.createDiv({ cls: 'vault-inbox-header' });
		header.createEl('div', { cls: 'vault-inbox-title', text: 'Inbox' });
		const actions = header.createDiv({ cls: 'vault-inbox-actions' });
		actions.createEl('button', { text: 'Mark all read' })
			.addEventListener('click', () => { void this.store.markAllRead(); });
		actions.createEl('button', { text: 'Clear read' })
			.addEventListener('click', () => { void this.store.clearRead(); });

		this.listEl = root.createDiv({ cls: 'vault-inbox-list' });

		this.render();
		const onChange = () => this.render();
		this.store.on('change', onChange);
		this.detach = () => this.store.off('change', onChange);
	}

	async onClose(): Promise<void> {
		this.detach?.();
	}

	private render(): void {
		this.listEl.empty();
		const items = this.store.all();
		if (items.length === 0) {
			this.listEl.createDiv({ cls: 'vault-inbox-empty', text: 'No notifications yet.' });
			return;
		}
		for (const n of items) {
			this.renderItem(n);
		}
	}

	private renderItem(n: InboxNotification): void {
		const row = this.listEl.createDiv({
			cls: `vault-inbox-item ${n.read ? 'is-read' : 'is-unread'}`,
		});
		const dot = row.createDiv({ cls: 'vault-inbox-dot' });
		dot.toggleClass('is-unread', !n.read);

		const main = row.createDiv({ cls: 'vault-inbox-main' });
		const basename = n.path.split('/').pop() ?? n.path;
		main.createEl('div', { cls: 'vault-inbox-name', text: basename.replace(/\.md$/, '') });
		main.createEl('div', {
			cls: 'vault-inbox-meta',
			text: `${labelForEvent(n.event)} · ${formatRelative(n.timestamp)} · ${parentOf(n.path) || '/'}`,
		});

		row.addEventListener('click', () => {
			const file = this.app.vault.getAbstractFileByPath(n.path);
			if (!file) {
				new Notice(`File not found: ${n.path}`);
				return;
			}
			void this.app.workspace.openLinkText(n.path, '', false);
			void this.store.markRead(n.id);
		});
	}
}

function labelForEvent(e: 'create'): string {
	return e === 'create' ? 'created' : e;
}

function parentOf(path: string): string {
	const i = path.lastIndexOf('/');
	return i === -1 ? '' : path.slice(0, i);
}

function formatRelative(ts: number): string {
	const diff = Date.now() - ts;
	const sec = Math.floor(diff / 1000);
	if (sec < 60) return 'just now';
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.floor(hr / 24);
	if (day < 7) return `${day}d ago`;
	return new Date(ts).toLocaleDateString();
}
