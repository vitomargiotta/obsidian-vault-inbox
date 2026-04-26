import { App, PluginSettingTab, Platform, Setting, AbstractInputSuggest, TFolder, TFile } from 'obsidian';
import VaultInboxPlugin from './main';
import { BaseRule, FolderRule } from './types';

export class VaultInboxSettingTab extends PluginSettingTab {
	plugin: VaultInboxPlugin;

	constructor(app: App, plugin: VaultInboxPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Watched folders')
			.setDesc('Get a notification when a new file is created in any of these folders.')
			.setHeading();

		for (const rule of this.plugin.settings.rules) {
			if (rule.type === 'folder') this.renderFolderRule(containerEl, rule);
		}

		new Setting(containerEl)
			.addButton(btn => btn
				.setButtonText('Add folder')
				.setCta()
				.onClick(async () => {
					const newRule: FolderRule = {
						id: `r-${Date.now().toString(36)}`,
						type: 'folder',
						folder: '',
						recursive: true,
					};
					this.plugin.settings.rules.push(newRule);
					await this.plugin.saveSettings();
					this.display();
				})
			);

		new Setting(containerEl)
			.setName('Watched bases')
			.setDesc('Watch new files that match a .base file\'s filters; requires frontmatter set at creation time, such as via a template.')
			.setHeading();

		for (const rule of this.plugin.settings.rules) {
			if (rule.type === 'base') this.renderBaseRule(containerEl, rule);
		}

		new Setting(containerEl)
			.addButton(btn => btn
				.setButtonText('Add base')
				.setCta()
				.onClick(async () => {
					const newRule: BaseRule = {
						id: `r-${Date.now().toString(36)}`,
						type: 'base',
						basePath: '',
					};
					this.plugin.settings.rules.push(newRule);
					await this.plugin.saveSettings();
					this.display();
				})
			);

		new Setting(containerEl)
			.setName('Desktop notifications')
			.setHeading();

		const osDesc = Platform.isDesktop
			? 'Show a native desktop notification (macOS Notification Center, Windows toast, Linux libnotify) when a new item lands in the inbox. Click the notification to open the file.'
			: 'Native desktop notifications are desktop-only. On mobile, only the in-app sidebar inbox is available.';

		new Setting(containerEl)
			.setName('Show desktop notifications')
			.setDesc(`${osDesc} (Desktop only.)`)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.osNotifications)
				.setDisabled(!Platform.isDesktop)
				.onChange(async (value) => {
					this.plugin.settings.osNotifications = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Storage')
			.setHeading();

		new Setting(containerEl)
			.setName('Maximum notifications')
			.setDesc('Older notifications are dropped (read ones first) once the limit is reached.')
			.addText(text => text
				.setValue(String(this.plugin.settings.maxNotifications))
				.onChange(async (value) => {
					const n = parseInt(value, 10);
					if (Number.isFinite(n) && n > 0) {
						this.plugin.settings.maxNotifications = n;
						await this.plugin.saveSettings();
					}
				})
			);
	}

	private renderFolderRule(container: HTMLElement, rule: FolderRule): void {
		new Setting(container)
			.setName(rule.folder || '(no folder selected)')
			.addText(text => {
				new FolderSuggest(this.app, text.inputEl);
				text
					.setPlaceholder('Folder path')
					.setValue(rule.folder)
					.onChange(async (value) => {
						rule.folder = value.trim();
						await this.plugin.saveSettings();
					});
			})
			.addExtraButton(btn => btn
				.setIcon('trash')
				.setTooltip('Remove')
				.onClick(async () => {
					this.plugin.settings.rules = this.plugin.settings.rules.filter(r => r.id !== rule.id);
					await this.plugin.saveSettings();
					this.display();
				})
			);
	}

	private renderBaseRule(container: HTMLElement, rule: BaseRule): void {
		new Setting(container)
			.setName(rule.basePath || '(no base selected)')
			.addText(text => {
				new BaseFileSuggest(this.app, text.inputEl);
				text
					.setPlaceholder('path/to/view.base')
					.setValue(rule.basePath)
					.onChange(async (value) => {
						rule.basePath = value.trim();
						await this.plugin.saveSettings();
					});
			})
			.addExtraButton(btn => btn
				.setIcon('trash')
				.setTooltip('Remove')
				.onClick(async () => {
					this.plugin.settings.rules = this.plugin.settings.rules.filter(r => r.id !== rule.id);
					await this.plugin.saveSettings();
					this.display();
				})
			);
	}
}

class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(query: string): TFolder[] {
		const q = query.toLowerCase();
		const folders: TFolder[] = [];
		const visit = (folder: TFolder) => {
			folders.push(folder);
			for (const child of folder.children) {
				if (child instanceof TFolder) visit(child);
			}
		};
		visit(this.app.vault.getRoot());
		return folders.filter(f => f.path.toLowerCase().includes(q)).slice(0, 50);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path || '/');
	}

	selectSuggestion(folder: TFolder): void {
		this.inputEl.value = folder.path;
		this.inputEl.trigger('input');
		this.close();
	}
}

class BaseFileSuggest extends AbstractInputSuggest<TFile> {
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(query: string): TFile[] {
		const q = query.toLowerCase();
		return this.app.vault.getFiles()
			.filter(f => f.extension === 'base' && f.path.toLowerCase().includes(q))
			.slice(0, 50);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.inputEl.value = file.path;
		this.inputEl.trigger('input');
		this.close();
	}
}
