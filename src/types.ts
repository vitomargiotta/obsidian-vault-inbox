export type WatchEvent = 'create';

export interface FolderRule {
	id: string;
	type: 'folder';
	folder: string;
	recursive: boolean;
}

export interface BaseRule {
	id: string;
	type: 'base';
	basePath: string;
}

export type WatchRule = FolderRule | BaseRule;

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
	osNotifications: boolean;
}

export const DEFAULT_SETTINGS: VaultInboxSettings = {
	rules: [],
	notifications: [],
	maxNotifications: 500,
	osNotifications: false,
};

export const VIEW_TYPE_INBOX = 'vault-inbox-view';
