/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hugo Almeida. All rights reserved.
 *  Project: Kyubi Code - https://github.com/hugoalmeidahh/kyubi-code
 *  License: MIT - https://github.com/hugoalmeidahh/kyubi-code/blob/main/LICENSE.txt
 *  Author: Hugo Almeida - https://github.com/hugoalmeidahh
 *  Forked from: Microsoft Code - https://github.com/microsoft/vscode
 *--------------------------------------------------------------------------------------------*/

import { AsyncIterableSource } from '../../../../../base/common/async.js';
import { VSBuffer, VSBufferReadableStream } from '../../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { listenStream } from '../../../../../base/common/stream.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { asText, IRequestService } from '../../../../../platform/request/common/request.js';
import { ISecretStorageService } from '../../../../../platform/secrets/common/secrets.js';
import {
	ChatMessageRole,
	IChatMessage,
	IChatResponsePart,
	ILanguageModelChatInfoOptions,
	ILanguageModelChatMetadata,
	ILanguageModelChatMetadataAndIdentifier,
	ILanguageModelChatProvider,
	ILanguageModelChatRequestOptions,
	ILanguageModelChatResponse,
} from '../../common/languageModels.js';

export const NINE_ROUTER_VENDOR = '9router';
export const NINE_ROUTER_API_KEY_SECRET = 'nineRouter.apiKey';
export const NINE_ROUTER_BASE_URL_SETTING = 'chat.nineRouter.baseUrl';

interface IOpenAIModel {
	readonly id: string;
	readonly owned_by?: string;
}

interface IOpenAIToolCallDelta {
	index: number;
	id?: string;
	function?: { name?: string; arguments?: string };
}

/**
 * Language model provider backed by a local/remote 9Router gateway
 * (OpenAI-compatible API). Lists models from `GET /v1/models` and streams
 * completions from `POST /v1/chat/completions`.
 *
 * All HTTP goes through {@link IRequestService} (node-side) rather than the
 * renderer `fetch` — avoids CORS entirely (`vscode-file://` origin would
 * require the gateway to answer preflights).
 */
export class NineRouterLanguageModelProvider extends Disposable implements ILanguageModelChatProvider {

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ISecretStorageService private readonly _secretStorageService: ISecretStorageService,
		@IRequestService private readonly _requestService: IRequestService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();

		// Re-resolve models when the base URL or the stored API key changes.
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(NINE_ROUTER_BASE_URL_SETTING)) {
				this._onDidChange.fire();
			}
		}));
		this._register(this._secretStorageService.onDidChangeSecret(key => {
			if (key === NINE_ROUTER_API_KEY_SECRET) {
				this._onDidChange.fire();
			}
		}));
	}

	/**
	 * Kicks an initial model resolution. The language models service only
	 * resolves a vendor when its provider fires `onDidChange` (or on demand),
	 * so without this the model list would stay empty until a config change.
	 */
	refresh(): void {
		this._onDidChange.fire();
	}

	private get _baseUrl(): string {
		const value = this._configurationService.getValue<string>(NINE_ROUTER_BASE_URL_SETTING);
		// Accept both "https://host" and "https://host/v1" (Cursor-style) — we append /v1 ourselves.
		return (value || 'http://localhost:20127').replace(/\/+$/, '').replace(/\/v1$/, '');
	}

	private async _headers(): Promise<Record<string, string>> {
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		const apiKey = await this._secretStorageService.get(NINE_ROUTER_API_KEY_SECRET);
		if (apiKey) {
			headers.Authorization = `Bearer ${apiKey}`;
		}
		return headers;
	}

	async provideLanguageModelChatInfo(options: ILanguageModelChatInfoOptions, token: CancellationToken): Promise<ILanguageModelChatMetadataAndIdentifier[]> {
		try {
			const context = await this._requestService.request({
				type: 'GET',
				url: `${this._baseUrl}/v1/models`,
				headers: await this._headers(),
				callSite: 'nineRouter.provideLanguageModelChatInfo',
			}, token);
			if (context.res.statusCode !== 200) {
				throw new Error(`9Router /v1/models returned ${context.res.statusCode}`);
			}
			const text = await asText(context);
			const json = JSON.parse(text ?? '{}') as { data?: IOpenAIModel[] };
			const models = json.data ?? [];
			this._logService.info(`[9Router] Resolved ${models.length} models from ${this._baseUrl}`);
			return models.map(model => this._toMetadata(model));
		} catch (error) {
			// `silent: true` means background resolution (e.g. startup); don't spam.
			if (!options.silent) {
				this._logService.error('[9Router] Failed to list models', error);
			} else {
				this._logService.warn('[9Router] Failed to list models (silent)', String(error));
			}
			return [];
		}
	}

	private _toMetadata(model: IOpenAIModel): ILanguageModelChatMetadataAndIdentifier {
		// 9Router ids look like "provider-slug/model-name" — keep it verbatim so
		// the picker shows exactly that.
		const family = model.id.includes('/') ? model.id.split('/')[0] : (model.owned_by ?? NINE_ROUTER_VENDOR);
		const metadata: ILanguageModelChatMetadata = {
			extension: new ExtensionIdentifier('core.nineRouter'),
			id: model.id,
			name: model.id,
			vendor: NINE_ROUTER_VENDOR,
			family,
			version: '1.0',
			maxInputTokens: 128_000,
			maxOutputTokens: 16_384,
			isUserSelectable: true,
			isBYOK: true,
			isDefaultForLocation: {},
			capabilities: { toolCalling: true, vision: true, agentMode: true },
		};
		return { metadata, identifier: `${NINE_ROUTER_VENDOR}|${model.id}` };
	}

	async sendChatRequest(modelId: string, messages: IChatMessage[], _from: ExtensionIdentifier | undefined, options: ILanguageModelChatRequestOptions, token: CancellationToken): Promise<ILanguageModelChatResponse> {
		const body: Record<string, unknown> = {
			model: modelId,
			messages: messages.map(m => this._toOpenAIMessage(m)).flat(),
			stream: true,
			...(options.modelOptions ?? {}),
		};
		if (Array.isArray(options.tools) && options.tools.length) {
			body.tools = options.tools.map((tool: { name: string; description?: string; inputSchema?: object }) => ({
				type: 'function',
				function: { name: tool.name, description: tool.description, parameters: tool.inputSchema ?? { type: 'object', properties: {} } },
			}));
		}

		const context = await this._requestService.request({
			type: 'POST',
			url: `${this._baseUrl}/v1/chat/completions`,
			headers: await this._headers(),
			data: JSON.stringify(body),
			callSite: 'nineRouter.sendChatRequest',
		}, token);

		if (context.res.statusCode !== 200) {
			const text = await asText(context).catch(() => '');
			throw new Error(`9Router request failed (${context.res.statusCode}): ${(text ?? '').slice(0, 500)}`);
		}

		const source = new AsyncIterableSource<IChatResponsePart>();
		const result = this._pumpSse(context.stream, source, token);

		return { stream: source.asyncIterable, result };
	}

	/** Reads the SSE body, emitting response parts, until `[DONE]` or stream end. */
	private _pumpSse(bodyStream: VSBufferReadableStream, source: AsyncIterableSource<IChatResponsePart>, token: CancellationToken): Promise<unknown> {
		// Accumulate tool call deltas keyed by index — OpenAI streams
		// arguments as string fragments across many chunks.
		const toolCalls = new Map<number, { id: string; name: string; args: string }>();
		let buffer = '';
		let done = false;

		return new Promise<unknown>((resolve, reject) => {
			const finish = () => {
				if (done) { return; }
				done = true;
				this._flushToolCalls(toolCalls, source);
				source.resolve();
				resolve({});
			};
			const fail = (error: Error) => {
				if (done) { return; }
				done = true;
				source.reject(error);
				reject(error);
			};

			listenStream(bodyStream, {
				onData: chunk => {
					buffer += chunk.toString();
					const lines = buffer.split('\n');
					buffer = lines.pop() ?? '';
					for (const line of lines) {
						const data = line.startsWith('data:') ? line.slice(5).trim() : undefined;
						if (!data) {
							continue;
						}
						if (data === '[DONE]') {
							finish();
							return;
						}
						this._handleSseChunk(data, toolCalls, source);
					}
				},
				onEnd: finish,
				onError: fail,
			}, token);
		});
	}

	private _handleSseChunk(data: string, toolCalls: Map<number, { id: string; name: string; args: string }>, source: AsyncIterableSource<IChatResponsePart>): void {
		let parsed: { choices?: { delta?: { content?: string; reasoning_content?: string; tool_calls?: IOpenAIToolCallDelta[] }; finish_reason?: string | null }[] };
		try {
			parsed = JSON.parse(data);
		} catch {
			return; // tolerate malformed keep-alive chunks
		}
		const choice = parsed.choices?.[0];
		if (!choice) {
			return;
		}
		const delta = choice.delta;
		if (delta?.reasoning_content) {
			source.emitOne({ type: 'thinking', value: delta.reasoning_content });
		}
		if (delta?.content) {
			source.emitOne({ type: 'text', value: delta.content });
		}
		for (const toolDelta of delta?.tool_calls ?? []) {
			const existing = toolCalls.get(toolDelta.index) ?? { id: '', name: '', args: '' };
			existing.id = toolDelta.id ?? existing.id;
			existing.name = toolDelta.function?.name ?? existing.name;
			existing.args += toolDelta.function?.arguments ?? '';
			toolCalls.set(toolDelta.index, existing);
		}
		if (choice.finish_reason === 'tool_calls') {
			this._flushToolCalls(toolCalls, source);
		}
	}

	private _flushToolCalls(toolCalls: Map<number, { id: string; name: string; args: string }>, source: AsyncIterableSource<IChatResponsePart>): void {
		for (const call of toolCalls.values()) {
			if (!call.id || !call.name) {
				continue;
			}
			let parameters: unknown = {};
			try {
				parameters = call.args ? JSON.parse(call.args) : {};
			} catch {
				parameters = { raw: call.args };
			}
			source.emitOne({ type: 'tool_use', name: call.name, toolCallId: call.id, parameters });
		}
		toolCalls.clear();
	}

	/** Converts an internal chat message into one or more OpenAI-format messages. */
	private _toOpenAIMessage(message: IChatMessage): object[] {
		const role = message.role === ChatMessageRole.System ? 'system' : message.role === ChatMessageRole.Assistant ? 'assistant' : 'user';

		const out: object[] = [];
		const contentParts: object[] = [];
		const toolCalls: object[] = [];

		for (const part of message.content) {
			switch (part.type) {
				case 'text':
					contentParts.push({ type: 'text', text: part.value });
					break;
				case 'image_url': {
					const base64 = encodeBase64(part.value.data);
					contentParts.push({ type: 'image_url', image_url: { url: `data:${part.value.mimeType};base64,${base64}` } });
					break;
				}
				case 'tool_use':
					toolCalls.push({
						id: part.toolCallId,
						type: 'function',
						function: { name: part.name, arguments: JSON.stringify(part.parameters ?? {}) },
					});
					break;
				case 'tool_result': {
					// OpenAI wants tool results as standalone `role: 'tool'` messages.
					const text = part.value.map(v => v.type === 'text' ? v.value : '').join('');
					out.push({ role: 'tool', tool_call_id: part.toolCallId, content: text });
					break;
				}
				// thinking/data parts are not forwarded — the gateway model re-derives reasoning.
			}
		}

		if (contentParts.length || toolCalls.length) {
			const single = contentParts.length === 1 && (contentParts[0] as { type?: string }).type === 'text';
			out.unshift({
				role,
				content: single ? (contentParts[0] as { text: string }).text : (contentParts.length ? contentParts : null),
				...(toolCalls.length ? { tool_calls: toolCalls } : {}),
			});
		}
		return out;
	}

	async provideTokenCount(_modelId: string, message: string | IChatMessage, _token: CancellationToken): Promise<number> {
		// Cheap heuristic (~4 chars/token) — good enough for budgeting UI.
		const text = typeof message === 'string'
			? message
			: message.content.map(p => p.type === 'text' ? p.value : '').join('');
		return Math.ceil(text.length / 4);
	}
}

function encodeBase64(buffer: VSBuffer): string {
	let binary = '';
	const bytes = buffer.buffer;
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}
