import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INode,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const BASE_URL = 'https://api.timetackle.com/external-api/v1';
export const CREDENTIAL = 'timeTackleApi';

export type TimeTackleContext = IExecuteFunctions | IPollFunctions | ILoadOptionsFunctions;

// Set on the error when another request to the same endpoint is still running for the workspace.
export const BUSY_CODE = 'QUOTA_LIMIT_EXCEEDED';

export function isBusyError(error: unknown): boolean {
	return (error as { timeTackleCode?: string } | undefined)?.timeTackleCode === BUSY_CODE;
}

// Errors come back as {errors: {code, message}, statusCode} or {code, message}; some 200s carry {success: false}.
export function checkResponse(node: INode, status: number, body: unknown): unknown {
	const data = body && typeof body === 'object' ? (body as IDataObject) : {};

	if (status < 400) {
		if (data.success === false) {
			const failure = data.error as IDataObject | string | undefined;
			const message =
				(typeof failure === 'object' ? failure?.message : failure) ||
				'TimeTackle could not complete the request.';
			throw new NodeApiError(node, data as JsonObject, { message: String(message), httpCode: String(status) });
		}
		return body;
	}

	const err = (data.errors as IDataObject | undefined) || data;
	const code = err.code ? String(err.code) : undefined;
	let message = err.message ? String(err.message) : `TimeTackle returned HTTP ${status}.`;
	let description: string | undefined;

	if (status === 401) {
		message = 'Your TimeTackle API key is invalid or inactive.';
		description = 'Update the credential with the key from Settings > Developer in TimeTackle.';
	} else if (code === BUSY_CODE) {
		description = 'TimeTackle handles one request per endpoint at a time for a workspace. Try again in a minute.';
	}

	const error = new NodeApiError(node, data as JsonObject, { message, description, httpCode: String(status) });
	(error as NodeApiError & { timeTackleCode?: string }).timeTackleCode = code;
	throw error;
}

export async function apiRequest(
	this: TimeTackleContext,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<unknown> {
	const options: IHttpRequestOptions = {
		method,
		url: `${BASE_URL}${path}`,
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (body !== undefined) options.body = body;
	if (qs && Object.keys(qs).length) options.qs = qs;

	const response = (await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIAL, options)) as {
		statusCode: number;
		body: unknown;
	};
	return checkResponse(this.getNode(), response.statusCode, response.body);
}

// Accepts a list, or one string with commas between the values.
export function splitList(value: unknown): string[] {
	if (value === undefined || value === null || value === '') return [];
	const items = Array.isArray(value) ? value : String(value).split(',');
	return items.map((item) => String(item).trim()).filter(Boolean);
}

export function toIntList(value: unknown): number[] {
	return splitList(value)
		.map((item) => parseInt(item, 10))
		.filter((n) => !Number.isNaN(n));
}

export function isSet(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '';
}

export function byIdDesc(a: IDataObject, b: IDataObject): number {
	return Number(b.id) - Number(a.id);
}

export function sameName(a: unknown, b: unknown): boolean {
	return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}
