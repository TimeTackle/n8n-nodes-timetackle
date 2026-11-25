// A stand-in for the n8n runtime: it gives a node its parameters and sends its HTTP requests the way n8n does
// (the credential adds the API key header), so nock can answer them offline.

import type { IDataObject, INodeExecutionData } from 'n8n-workflow';
import { TimeTackleApi } from '../credentials/TimeTackleApi.credentials';

export const API = 'https://api.timetackle.com';
export const BASE = '/external-api/v1';

interface RequestOptions {
	url: string;
	baseURL?: string;
	method?: string;
	qs?: IDataObject;
	body?: unknown;
	returnFullResponse?: boolean;
	ignoreHttpStatusErrors?: boolean;
}

const credentialHeaders = (apiKey: string): Record<string, string> => {
	const declared = new TimeTackleApi().authenticate.properties.headers as Record<string, string>;
	return Object.fromEntries(
		Object.entries(declared).map(([name, value]) => [name, value.replace('={{$credentials.apiKey}}', apiKey)]),
	);
};

export async function sendWithCredential(options: RequestOptions, apiKey = 'test-key'): Promise<unknown> {
	const url = new URL(`${options.baseURL || ''}${options.url}`);
	Object.entries(options.qs || {}).forEach(([key, value]) => url.searchParams.set(key, String(value)));

	const hasBody = options.body !== undefined && options.method !== 'GET';
	const response = await fetch(url, {
		method: options.method || 'GET',
		headers: {
			...credentialHeaders(apiKey),
			Accept: 'application/json',
			...(hasBody ? { 'Content-Type': 'application/json' } : {}),
		},
		body: hasBody ? JSON.stringify(options.body) : undefined,
	});
	const text = await response.text();
	let body: unknown = text;
	try {
		body = JSON.parse(text);
	} catch {
		// not JSON
	}

	if (response.status >= 400 && !options.ignoreHttpStatusErrors) {
		throw Object.assign(new Error(`Request failed with status code ${response.status}`), {
			httpCode: String(response.status),
		});
	}
	return options.returnFullResponse ? { statusCode: response.status, body } : body;
}

export interface FakeOptions {
	params?: IDataObject;
	version?: number;
	mode?: 'manual' | 'trigger';
	staticData?: IDataObject;
	continueOnFail?: boolean;
	items?: number;
}

// The parts of IExecuteFunctions, IPollFunctions and ILoadOptionsFunctions the nodes use.
export function fakeContext(options: FakeOptions = {}) {
	const params = options.params || {};
	const staticData = options.staticData || {};
	return {
		getNode: () => ({
			id: '1',
			name: 'TimeTackle',
			type: 'timeTackle',
			typeVersion: options.version ?? 2,
			position: [0, 0],
			parameters: params,
		}),
		getNodeParameter: (name: string, second?: unknown, third?: unknown, fourth?: { extractValue?: boolean }) => {
			// execute(): (name, itemIndex, fallback, options); poll(): (name, fallback)
			const fallback = typeof second === 'number' ? third : second;
			const value = name in params ? params[name] : fallback;
			// A picker saves {mode, value}; n8n hands the node the value when asked to extract it.
			const picked = value as { __rl?: boolean; value?: unknown } | undefined;
			return fourth?.extractValue && picked?.__rl ? picked.value : value;
		},
		getInputData: () => Array.from({ length: options.items ?? 1 }, () => ({ json: {} })),
		getMode: () => options.mode || 'trigger',
		getWorkflowStaticData: () => staticData,
		continueOnFail: () => options.continueOnFail === true,
		helpers: {
			httpRequestWithAuthentication: async function (_credential: string, request: RequestOptions) {
				return sendWithCredential(request);
			},
			returnJsonArray: (data: IDataObject | IDataObject[]): INodeExecutionData[] =>
				(Array.isArray(data) ? data : [data]).map((json) => ({ json })),
			constructExecutionMetaData: (
				items: INodeExecutionData[],
				meta: { itemData: { item: number } },
			): INodeExecutionData[] => items.map((item) => ({ ...item, pairedItem: meta.itemData })),
		},
	};
}

export const exportPage = (rows: IDataObject[], hasNext = false) => ({
	success: true,
	data: { data: rows, pagination: { hasNext } },
});

export const picked = (value: string | number) => ({ __rl: true, mode: 'list', value });

export const jsonOf = (output: INodeExecutionData[][] | null): IDataObject[] =>
	(output?.[0] || []).map((item) => item.json);
