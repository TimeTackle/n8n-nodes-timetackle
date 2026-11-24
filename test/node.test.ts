import nock from 'nock';
import type { IDataObject, IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';

import { TimeTackleApi } from '../credentials/TimeTackleApi.credentials';
import { TimeTackle } from '../nodes/TimeTackle/TimeTackle.node';
import { API, BASE, exportPage, fakeContext, jsonOf, picked, sendWithCredential, type FakeOptions } from './harness';

const node = new TimeTackle();
const run = async (params: IDataObject, options: FakeOptions = {}) =>
	jsonOf(await node.execute.call(fakeContext({ params, ...options }) as unknown as IExecuteFunctions));
const dropdown = (name: keyof typeof node.methods.loadOptions) =>
	node.methods.loadOptions[name].call(fakeContext() as unknown as ILoadOptionsFunctions);

afterEach(() => nock.cleanAll());

describe('credential', () => {
	const credential = new TimeTackleApi();
	const test = () => sendWithCredential(credential.test.request as never);

	it('keeps the name saved credentials and workflows use', () => {
		expect(credential.name).toBe('timeTackleApi');
		expect(credential.properties[0].name).toBe('apiKey');
		expect(credential.properties[0].typeOptions).toEqual({ password: true });
	});

	it('tests the key by reading the workspace owner, with the key in the header only', async () => {
		const scope = nock(API, { reqheaders: { 'x-tackle-api-key': 'test-key' } })
			.get(`${BASE}/users`)
			.query({ type: 'active', role: 'OWNER' })
			.reply(200, { success: true, data: [{ id: 1, email: 'ann@acme.com', role: 'OWNER' }] });

		await test();

		expect(scope.isDone()).toBe(true);
	});

	it('fails the test on an invalid key', async () => {
		nock(API).get(`${BASE}/users`).query(true)
			.reply(401, { errors: { code: 'UNAUTHORIZED', message: 'Invalid API key' }, statusCode: 401 });

		await expect(test()).rejects.toMatchObject({ httpCode: '401' });
	});
});

describe('node definition', () => {
	const { description } = node;
	const resourceField = description.properties.find((p) => p.name === 'resource');
	const operationsOf = (resource: string) =>
		description.properties
			.filter((p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes(resource))
			.flatMap((p) => (p.options as Array<{ value: string }>).map((o) => o.value));

	it('keeps the node name and the 0.2.1 resources and operations, so saved workflows keep working', () => {
		expect(description.name).toBe('timeTackle');
		expect(description.version).toEqual([1, 2]);
		expect(operationsOf('export')).toEqual(['exportSheets']);
		expect(operationsOf('property')).toEqual(['create', 'delete', 'getAll', 'update']);
	});

	it('offers events, members and teams next to export and properties', () => {
		expect((resourceField?.options as Array<{ value: string }>).map((o) => o.value)).toEqual([
			'event', 'export', 'member', 'property', 'team',
		]);
		expect(operationsOf('event')).toEqual(['getAll']);
		expect(operationsOf('member')).toEqual(['getAll', 'invite', 'remove', 'update']);
		expect(operationsOf('team')).toEqual(['getAll']);
	});

	it('every dropdown a field names exists', () => {
		const named = JSON.stringify(description.properties).match(/"loadOptionsMethod":"(\w+)"/g) || [];
		const methods = [...new Set(named.map((m) => m.split('"')[3]))].sort();
		expect(methods).toEqual(['getCalendars', 'getMembers', 'getTags', 'getTeams']);
		methods.forEach((method) => expect(node.methods.loadOptions).toHaveProperty(method));

		const searches = JSON.stringify(description.properties).match(/"searchListMethod":"(\w+)"/g) || [];
		expect([...new Set(searches.map((m) => m.split('"')[3]))].sort()).toEqual(
			Object.keys(node.methods.listSearch).sort(),
		);
	});
});

describe('Event', () => {
	it('Get Many searches the date range with the filters and stops at the limit', async () => {
		let sent: IDataObject = {};
		nock(API).post(`${BASE}/export-sheets`, (body) => { sent = body; return true; })
			.query({ page: '1', limit: '100' })
			.reply(200, exportPage([{ calendarId: 'a@x.com', eventId: 'e1' }, { calendarId: 'a@x.com', eventId: 'e2' }], true));

		const results = await run({
			resource: 'event',
			operation: 'getAll',
			startDate: '2026-11-01T00:00:00',
			endDate: '2026-11-07T00:00:00',
			limit: 1,
			filters: { search: 'Acme', tag: 'Client:Acme', calendarIds: ['a@x.com'] },
		});

		expect(results.map((e) => e.id)).toEqual(['a@x.com:e1']);
		expect(sent).toMatchObject({
			startDate: '2026-11-01',
			endDate: '2026-11-07',
			timezone: 'UTC',
			calendarIds: ['a@x.com'],
			filters: { search: ['Acme'], tag: ['Client:Acme'] },
		});
		expect(sent.since).toBeUndefined();
	});

	it('Get Many with Return All follows every page', async () => {
		nock(API)
			.post(`${BASE}/export-sheets`).query({ page: '1', limit: '100' })
			.reply(200, exportPage([{ calendarId: 'a@x.com', eventId: 'e1' }], true))
			.post(`${BASE}/export-sheets`).query({ page: '2', limit: '100' })
			.reply(200, exportPage([{ calendarId: 'a@x.com', eventId: 'e2' }]));

		const results = await run({
			resource: 'event', operation: 'getAll', startDate: '2026-11-01', endDate: '2026-11-07', returnAll: true,
		});

		expect(results).toHaveLength(2);
	});
});

describe('Export', () => {
	const exported = async (params: IDataObject, version: number) => {
		let limit = '';
		nock(API).post(`${BASE}/export-sheets`).query((query) => { limit = String(query.limit); return true; })
			.reply(200, exportPage([]));
		await run({ resource: 'export', operation: 'exportSheets', page: 1, mergeAll: true, startDate: '', endDate: '', ...params }, { version });
		return limit;
	};

	it('keeps 100 rows per page for workflows saved with version 1 that never set Limit', async () => {
		expect(await exported({}, 1)).toBe('100');
		expect(await exported({ limit: 50 }, 1)).toBe('50');
		expect(await exported({ limit: 50 }, 2)).toBe('50');
	});
});

describe('Property', () => {
	const flat = {
		success: true,
		data: [
			{ id: '10', name: 'Client', variety: 'TAG', children: [{ id: '11', name: 'acme' }] },
			{ id: '40', name: 'Acme', variety: 'TAG', children: [] },
			{ id: '50', name: 'Region', variety: 'SINGLE_SELECT', children: [] },
		],
	};

	it('Create sends one flat property with its options', async () => {
		let sent: IDataObject = {};
		nock(API).post(`${BASE}/properties`, (body) => { sent = body; return true; })
			.reply(200, { success: true, data: [{ id: '30', name: 'Region', variety: 'SINGLE_SELECT' }] });

		const results = await run({
			resource: 'property',
			operation: 'create',
			name: 'Region',
			variety: 'SINGLE_SELECT',
			additionalFields: { options: ['EMEA', 'APAC'] },
		});

		expect(sent).toEqual({
			properties: [{ name: 'Region', variety: 'SINGLE_SELECT', children: [{ name: 'EMEA' }, { name: 'APAC' }] }],
		});
		expect(results).toEqual([{ id: '30', name: 'Region', variety: 'SINGLE_SELECT' }]);
	});

	it('Update sends only what changed', async () => {
		let sent: IDataObject = {};
		nock(API).post(`${BASE}/property/10/update`, (body) => { sent = body; return true; }).reply(200, { success: true });

		const results = await run({
			resource: 'property', operation: 'update', propertyId: picked('10'), updateFields: { name: 'Customer' },
		});

		expect(sent).toEqual({ name: 'Customer' });
		expect(results).toEqual([{ id: '10', name: 'Customer', updated: true }]);
	});

	it('Update refuses an empty change without calling the API', async () => {
		await expect(run({ resource: 'property', operation: 'update', propertyId: picked('10'), updateFields: {} }))
			.rejects.toThrow('Set a new name or a new color.');
	});

	it('Delete removes by id', async () => {
		const scope = nock(API).post(`${BASE}/property/10/delete`).reply(200, { success: true });

		expect(await run({ resource: 'property', operation: 'delete', propertyId: picked('10') })).toEqual([
			{ id: '10', deleted: true },
		]);
		expect(scope.isDone()).toBe(true);
	});

	it('Get Many matches a name case-insensitively, tags before options', async () => {
		nock(API).get(`${BASE}/properties`).query({ format: 'flat' }).reply(200, flat);

		const results = await run({
			resource: 'property', operation: 'getAll', returnAll: true, filters: { name: ' ACME ' },
		});

		expect(results.map((p) => p.id)).toEqual(['40', '11']);
		expect(results[1]).toMatchObject({ isOption: true, parentName: 'Client' });
	});

	it('Get Many filters by type', async () => {
		nock(API).get(`${BASE}/properties`).query({ format: 'flat' }).reply(200, flat);

		const results = await run({
			resource: 'property', operation: 'getAll', returnAll: true, filters: { variety: 'SINGLE_SELECT' },
		});

		expect(results.map((p) => p.id)).toEqual(['50']);
	});

	it('version 1 keeps its requests: the old list shape and the primary/secondary create', async () => {
		let sent: IDataObject = {};
		nock(API)
			.get(`${BASE}/properties`).reply(200, { success: true, data: { primary: [], secondary: [] } })
			.post(`${BASE}/properties/create`, (body) => { sent = body; return true; }).reply(200, { success: true });

		const listed = await run({ resource: 'property', operation: 'getAll' }, { version: 1 });
		await run(
			{
				resource: 'property',
				operation: 'create',
				primaryProperties: { items: [{ name: 'Client', color: 'Basil', children: '[]' }] },
				secondaryProperties: {},
			},
			{ version: 1 },
		);

		expect(listed).toEqual([{ success: true, data: { primary: [], secondary: [] } }]);
		expect(sent).toEqual({ primary: [{ name: 'Client', color: 'Basil' }], secondary: [] });
	});
});

describe('Member', () => {
	it('Invite sends calendar access only when it is set', async () => {
		const bodies: IDataObject[] = [];
		nock(API)
			.post(`${BASE}/users/invite`, (body) => bodies.push(body) > 0).reply(200, { success: true, data: { id: 1, status: 'PENDING' } })
			.post(`${BASE}/users/invite`, (body) => bodies.push(body) > 0).reply(200, { success: true, data: { id: 2 } });

		const invited = await run({
			resource: 'member', operation: 'invite', name: 'Jane', email: 'jane@acme.com', role: 'EDITOR',
			access: { teamIds: [12, 15], connectOwnCalendar: true },
		});
		await run({
			resource: 'member', operation: 'invite', name: 'Alex', email: 'alex@acme.com', role: 'ADMIN',
			access: { allCalendars: false },
		});

		expect(invited).toEqual([{ id: 1, status: 'PENDING' }]);
		expect(bodies[0]).toEqual({
			name: 'Jane', email: 'jane@acme.com', role: 'EDITOR', access: { connectOwnCalendar: true, teamIds: [12, 15] },
		});
		expect(bodies[1]).toEqual({ name: 'Alex', email: 'alex@acme.com', role: 'ADMIN' });
	});

	it('Update sends a switch turned off, so it can be cleared', async () => {
		let sent: IDataObject = {};
		nock(API).post(`${BASE}/users/7/update`, (body) => { sent = body; return true; })
			.reply(200, { success: true, data: { id: 7 } });

		const results = await run({
			resource: 'member', operation: 'update', memberId: picked(7), updateFields: {}, access: { connectOwnCalendar: false },
		});

		expect(sent).toEqual({ access: { connectOwnCalendar: false } });
		expect(results).toEqual([{ id: 7 }]);
	});

	it('Update refuses an empty change without calling the API', async () => {
		await expect(run({ resource: 'member', operation: 'update', memberId: picked(7), updateFields: {}, access: {} }))
			.rejects.toThrow('Set at least one of name, role or calendar access.');
	});

	it('Remove deletes the member', async () => {
		const scope = nock(API).post(`${BASE}/users/7/delete`).reply(200, { success: true });

		expect(await run({ resource: 'member', operation: 'remove', memberId: picked(7) })).toEqual([{ id: 7, removed: true }]);
		expect(scope.isDone()).toBe(true);
	});

	it('Get Many finds a member by email', async () => {
		nock(API).get(`${BASE}/users`).query({ type: 'all', email: 'jane@acme.com' })
			.reply(200, { success: true, data: [{ id: 345, email: 'jane@acme.com' }] });

		const results = await run({ resource: 'member', operation: 'getAll', filters: { email: 'jane@acme.com' } });

		expect(results).toEqual([{ id: 345, email: 'jane@acme.com' }]);
	});
});

describe('Team', () => {
	it('Get Many finds a team by name', async () => {
		nock(API).get(`${BASE}/calendars/groups`).reply(200, [{ id: 12, name: 'Sales' }, { id: 15, name: 'Support' }]);

		const results = await run({ resource: 'team', operation: 'getAll', filters: { name: 'sales' } });

		expect(results).toEqual([{ id: 12, name: 'Sales' }]);
	});
});

describe('errors', () => {
	it('shows the API message when TimeTackle rejects a request', async () => {
		nock(API).post(`${BASE}/users/7/delete`).reply(400, { code: 'BAD_REQUEST', message: 'OWNER members cannot be removed' });

		await expect(run({ resource: 'member', operation: 'remove', memberId: picked(7) })).rejects.toMatchObject({
			message: 'OWNER members cannot be removed',
			httpCode: '400',
		});
	});

	it('treats a 200 with success false as a failure', async () => {
		nock(API).post(`${BASE}/property/10/delete`).reply(200, { success: false, error: 'Property not found' });

		await expect(run({ resource: 'property', operation: 'delete', propertyId: picked('10') })).rejects.toThrow(
			'Property not found',
		);
	});

	it('says to try again when the endpoint is busy', async () => {
		nock(API).post(`${BASE}/users/invite`)
			.reply(413, { errors: { code: 'QUOTA_LIMIT_EXCEEDED', message: 'a request already processing' }, statusCode: 429 });

		await expect(
			run({ resource: 'member', operation: 'invite', name: 'J', email: 'j@acme.com', role: 'EDITOR', access: {} }),
		).rejects.toMatchObject({ message: 'a request already processing', description: expect.stringContaining('Try again') });
	});

	it('with Continue On Fail, returns the error as the item', async () => {
		nock(API).post(`${BASE}/users/7/delete`).reply(400, { code: 'BAD_REQUEST', message: 'OWNER members cannot be removed' });

		const results = await run({ resource: 'member', operation: 'remove', memberId: picked(7) }, { continueOnFail: true });

		expect(results).toEqual([{ error: 'OWNER members cannot be removed' }]);
	});
});

describe('dropdowns', () => {
	const properties = {
		success: true,
		data: [{ id: '10', name: 'Client', variety: 'TAG', children: [{ id: '11', name: 'Acme' }] }],
	};
	const teams = [
		{ id: 15, name: 'Support', calendars: [{ calendarId: 'sam@acme.com', title: 'Sam Lee' }] },
		{ id: 12, name: 'Sales', calendars: [{ calendarId: 'jane@acme.com', title: 'Jane Doe' }, { calendarId: 'sam@acme.com', title: 'Sam Lee' }] },
	];

	it('tags are offered in the event filter format', async () => {
		nock(API).get(`${BASE}/properties`).query({ format: 'flat' }).reply(200, properties);

		expect((await dropdown('getTags')).map((o) => o.value)).toEqual(['Client', 'Client:Acme']);
	});

	it('tags and properties are offered by id, options under their parent', async () => {
		nock(API).get(`${BASE}/properties`).query({ format: 'flat' }).reply(200, properties);

		expect(await dropdown('getProperties')).toEqual([
			{ name: 'Client', value: '10' },
			{ name: 'Client > Acme', value: '11' },
		]);
	});

	it('teams, and calendars listed once each', async () => {
		nock(API).get(`${BASE}/calendars/groups`).times(2).reply(200, teams);

		expect(await dropdown('getTeams')).toEqual([{ name: 'Sales', value: 12 }, { name: 'Support', value: 15 }]);
		expect(await dropdown('getCalendars')).toEqual([
			{ name: 'Jane Doe', value: 'jane@acme.com' },
			{ name: 'Sam Lee', value: 'sam@acme.com' },
		]);
	});

	it('the tag or property picker searches by name', async () => {
		nock(API).get(`${BASE}/properties`).query({ format: 'flat' }).reply(200, properties);

		const found = await node.methods.listSearch.searchProperties.call(
			fakeContext() as unknown as ILoadOptionsFunctions,
			'acme',
		);

		expect(found).toEqual({ results: [{ name: 'Client > Acme', value: '11' }] });
	});

	it('the member picker searches by name or email', async () => {
		nock(API).get(`${BASE}/users`).query({ type: 'all' })
			.reply(200, { success: true, data: [{ id: 345, name: 'Jane Doe', email: 'jane@acme.com' }, { id: 346, email: 'new@acme.com' }] });

		const found = await node.methods.listSearch.searchMembers.call(
			fakeContext() as unknown as ILoadOptionsFunctions,
			'JANE',
		);

		expect(found).toEqual({ results: [{ name: 'Jane Doe (jane@acme.com)', value: 345 }] });
	});

	it('members by name and email', async () => {
		nock(API).get(`${BASE}/users`).query({ type: 'all' })
			.reply(200, { success: true, data: [{ id: 345, name: 'Jane Doe', email: 'jane@acme.com' }, { id: 346, email: 'new@acme.com' }] });

		expect(await dropdown('getMembers')).toEqual([
			{ name: 'Jane Doe (jane@acme.com)', value: 345 },
			{ name: 'new@acme.com', value: 346 },
		]);
	});
});
