import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class TimeTackleApi implements ICredentialType {
	name = 'timeTackleApi';
	displayName = 'TimeTackle API';
	documentationUrl = 'https://timetackle.gitbook.io/tackle';
	icon: Icon = { light: 'file:../icons/timetackle.svg', dark: 'file:../icons/timetackle.svg' };

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'An owner or admin finds the key in TimeTackle under Settings > Developer. API access is included in every paid plan.',
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
			url: '/users',
			qs: { type: 'active', role: 'OWNER' },
			method: 'GET',
		},
	};
}
