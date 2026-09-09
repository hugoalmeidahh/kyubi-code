/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hugo Almeida. All rights reserved.
 *  Project: Kyubi Code - https://github.com/hugoalmeidahh/kyubi-code
 *  License: MIT - https://github.com/hugoalmeidahh/kyubi-code/blob/main/LICENSE.txt
 *  Author: Hugo Almeida - https://github.com/hugoalmeidahh
 *  Forked from: Microsoft Code - https://github.com/microsoft/vscode
 *--------------------------------------------------------------------------------------------*/

import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService, ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ISecretStorageService } from '../../../../../platform/secrets/common/secrets.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../../common/contributions.js';
import { ILanguageModelsService } from '../../common/languageModels.js';
import { ILanguageModelsConfigurationService } from '../../common/languageModelsConfiguration.js';
import { NINE_ROUTER_API_KEY_SECRET, NINE_ROUTER_BASE_URL_SETTING, NINE_ROUTER_VENDOR, NineRouterLanguageModelProvider } from './nineRouterLanguageModelProvider.js';

// --- 1) Setting: appears in the Settings UI / settings.json -----------------

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'chatNineRouter',
	title: localize('nineRouter.configTitle', "9Router"),
	type: 'object',
	properties: {
		[NINE_ROUTER_BASE_URL_SETTING]: {
			type: 'string',
			default: 'http://localhost:20127',
			description: localize('nineRouter.baseUrl', "Base URL of the 9Router gateway (OpenAI-compatible API)."),
		},
	},
});

// --- 2) Command: stores the API key in the OS keychain (never settings.json) -

registerAction2(class SetNineRouterApiKeyAction extends Action2 {
	constructor() {
		super({
			id: 'chat.nineRouter.setApiKey',
			title: localize2('nineRouter.setApiKey', "9Router: Set API Key"),
			f1: true, // shows in the Command Palette
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const secretStorageService = accessor.get(ISecretStorageService);
		const key = await quickInputService.input({
			title: localize('nineRouter.apiKeyPrompt', "9Router API Key"),
			password: true,
			ignoreFocusLost: true,
		});
		if (key !== undefined) {
			if (key === '') {
				await secretStorageService.delete(NINE_ROUTER_API_KEY_SECRET);
			} else {
				await secretStorageService.set(NINE_ROUTER_API_KEY_SECRET, key);
			}
			// The provider listens to onDidChangeSecret and refreshes its model list.
		}
	}
});

// --- 3) Command: clears all 9Router configuration (API key + base URL) ------

registerAction2(class ClearNineRouterConfigAction extends Action2 {
	constructor() {
		super({
			id: 'chat.nineRouter.clearConfiguration',
			title: localize2('nineRouter.clearConfiguration', "9Router: Clear Configuration"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const secretStorageService = accessor.get(ISecretStorageService);
		const configurationService = accessor.get(IConfigurationService);
		const dialogService = accessor.get(IDialogService);

		const { confirmed } = await dialogService.confirm({
			message: localize('nineRouter.clearConfirm', "Clear all 9Router configuration?"),
			detail: localize('nineRouter.clearConfirmDetail', "This removes the stored API key and resets the base URL. The 9Router models will disappear from the model picker."),
			primaryButton: localize('nineRouter.clearConfirmButton', "Clear"),
		});
		if (!confirmed) {
			return;
		}

		await secretStorageService.delete(NINE_ROUTER_API_KEY_SECRET);
		await configurationService.updateValue(NINE_ROUTER_BASE_URL_SETTING, undefined);
		// The provider listens to both changes and re-resolves (now empty) models.
	}
});

// --- 4) Workbench contribution: registers vendor + provider on startup ------

class NineRouterContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.nineRouterModels';

	constructor(
		@ILanguageModelsService languageModelsService: ILanguageModelsService,
		@IInstantiationService instantiationService: IInstantiationService,
		@ILanguageModelsConfigurationService languageModelsConfigurationService: ILanguageModelsConfigurationService,
	) {
		super();

		// Vendor descriptor first: tells the service (and the model picker UI)
		// that a vendor named "9router" exists and how to display it.
		const vendorDescriptor = { vendor: NINE_ROUTER_VENDOR, displayName: '9Router', configuration: undefined, managementCommand: undefined, when: undefined };
		languageModelsService.deltaLanguageModelChatProviderDescriptors([vendorDescriptor], []);
		this._register(toDisposable(() => languageModelsService.deltaLanguageModelChatProviderDescriptors([], [vendorDescriptor])));

		// Then the provider: the object that actually lists models and streams
		// completions. Order matters — descriptor before provider, so the
		// service can attribute the provider to a known vendor.
		const provider = this._register(instantiationService.createInstance(NineRouterLanguageModelProvider));
		this._register(languageModelsService.registerLanguageModelProvider(NINE_ROUTER_VENDOR, provider));

		// Kick the initial model resolution — the service only resolves a
		// vendor when the provider fires onDidChange or something asks for it.
		provider.refresh();

		// Ensure a "9router" provider group exists in the language-models
		// configuration. This is what flips the BYOK context key
		// (`github.copilot.hasByokModels`) which hides the Copilot sign-in
		// gate and unlocks the model picker for non-Copilot vendors.
		languageModelsConfigurationService.whenReady.then(() => {
			if (this._store.isDisposed) {
				return;
			}
			const groups = languageModelsConfigurationService.getLanguageModelsProviderGroups();
			if (!groups.some(g => g.vendor === NINE_ROUTER_VENDOR)) {
				languageModelsConfigurationService.addLanguageModelsProviderGroup({ name: '9Router', vendor: NINE_ROUTER_VENDOR });
			}
		});
	}
}

registerWorkbenchContribution2(NineRouterContribution.ID, NineRouterContribution, WorkbenchPhase.AfterRestored);
