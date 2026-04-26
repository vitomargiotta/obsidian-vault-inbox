export type WatchEvent = 'create';

export interface FolderRule {
	id: string;
	type: 'folder';
	folder: string;
	recursive: boolean;
}

export type WatchRule = FolderRule;

export interface InboxNotification {
	id: string;
	path: string;
	event: WatchEvent;
	timestamp: number;
	read: boolean;
	ruleId: string;
}

export interface VaultInboxSettings {
	rules: WatchRule[];
	notifications: InboxNotification[];
	maxNotifications: number;
}

export const DEFAULT_SETTINGS: VaultInboxSettings = {
	rules: [],
	notifications: [],
	maxNotifications: 500,
};

export const VIEW_TYPE_INBOX = 'vault-inbox-view';
