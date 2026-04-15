import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TimeTackleApi implements ICredentialType {
	name = 'timeTackleApi';
	displayName = 'TimeTackle API Key';
	documentationUrl = 'https://timetackle.gitbook.io/tackle';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your TimeTackle API key. Find it in Settings → API Keys in your TimeTackle dashboard.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-Tackle-Api-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.timetackle.com/external-api/v1',
			url: '/properties',
			method: 'GET',
		},
	};
}
