import { Events } from 'obsidian';
import { InboxNotification, VaultInboxSettings, WatchEvent } from './types';

export class NotificationStore extends Events {
	private settings: VaultInboxSettings;
	private persist: () => Promise<void>;

	constructor(settings: VaultInboxSettings, persist: () => Promise<void>) {
		super();
		this.settings = settings;
		this.persist = persist;
	}

	all(): InboxNotification[] {
		return this.settings.notifications;
	}

	unreadCount(): number {
		return this.settings.notifications.reduce((n, x) => n + (x.read ? 0 : 1), 0);
	}

	async add(input: { path: string; event: WatchEvent; ruleId: string }): Promise<void> {
		const note: InboxNotification = {
			id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
			path: input.path,
			event: input.event,
			timestamp: Date.now(),
			read: false,
			ruleId: input.ruleId,
		};
		this.settings.notifications.unshift(note);
		this.enforceCap();
		await this.persist();
		this.trigger('added', note);
		this.trigger('change');
	}

	async markRead(id: string): Promise<void> {
		const n = this.settings.notifications.find(x => x.id === id);
		if (!n || n.read) return;
		n.read = true;
		await this.persist();
		this.trigger('change');
	}

	async markUnread(id: string): Promise<void> {
		const n = this.settings.notifications.find(x => x.id === id);
		if (!n || !n.read) return;
		n.read = false;
		await this.persist();
		this.trigger('change');
	}

	async toggleRead(id: string): Promise<void> {
		const n = this.settings.notifications.find(x => x.id === id);
		if (!n) return;
		n.read = !n.read;
		await this.persist();
		this.trigger('change');
	}

	async markAllRead(): Promise<void> {
		let changed = false;
		for (const n of this.settings.notifications) {
			if (!n.read) { n.read = true; changed = true; }
		}
		if (changed) {
			await this.persist();
			this.trigger('change');
		}
	}

	async remove(id: string): Promise<void> {
		const before = this.settings.notifications.length;
		this.settings.notifications = this.settings.notifications.filter(n => n.id !== id);
		if (this.settings.notifications.length !== before) {
			await this.persist();
			this.trigger('change');
		}
	}

	async clearRead(): Promise<void> {
		const before = this.settings.notifications.length;
		this.settings.notifications = this.settings.notifications.filter(n => !n.read);
		if (this.settings.notifications.length !== before) {
			await this.persist();
			this.trigger('change');
		}
	}

	async handleRename(oldPath: string, newPath: string): Promise<void> {
		let changed = false;
		for (const n of this.settings.notifications) {
			if (n.path === oldPath) { n.path = newPath; changed = true; }
		}
		if (changed) {
			await this.persist();
			this.trigger('change');
		}
	}

	async handleDelete(path: string): Promise<void> {
		// v1: leave deleted-file notifications in place; click will show a notice.
		// Hook reserved for future use.
		void path;
	}

	private enforceCap(): void {
		const cap = this.settings.maxNotifications;
		if (this.settings.notifications.length <= cap) return;
		// Drop oldest read first, then oldest overall.
		this.settings.notifications.sort((a, b) => b.timestamp - a.timestamp);
		while (this.settings.notifications.length > cap) {
			const oldestReadIdx = [...this.settings.notifications]
				.map((n, i) => ({ n, i }))
				.reverse()
				.find(x => x.n.read)?.i;
			if (oldestReadIdx !== undefined) {
				this.settings.notifications.splice(oldestReadIdx, 1);
			} else {
				this.settings.notifications.pop();
			}
		}
	}
}
