import nock from 'nock';
import type { IDataObject, IPollFunctions } from 'n8n-workflow';

import { TimeTackleTrigger } from '../nodes/TimeTackle/TimeTackleTrigger.node';
import { takeNew } from '../nodes/TimeTackle/shared/seen';
import { API, BASE, exportPage, fakeContext, jsonOf, type FakeOptions } from './harness';

const trigger = new TimeTackleTrigger();
const poll = async (options: FakeOptions) =>
	jsonOf(await trigger.poll.call(fakeContext(options) as unknown as IPollFunctions));

afterEach(() => nock.cleanAll());

describe('New Event', () => {
	it('polls recent changes, follows pages and gives each calendar copy its own id', async () => {
		const bodies: IDataObject[] = [];
		nock(API, { reqheaders: { 'x-tackle-api-key': 'test-key' } })
			.post(`${BASE}/export-sheets`, (body) => bodies.push(body) > 0)
			.query({ page: '1', limit: '100' })
			.reply(200, exportPage([{ calendarId: 'a@x.com', eventId: 'e1', subject: 'Sync' }], true))
			.post(`${BASE}/export-sheets`, (body) => bodies.push(body) > 0)
			.query({ page: '2', limit: '100' })
			.reply(200, exportPage([{ calendarId: 'b@x.com', eventId: 'e1', subject: 'Sync' }]));

		const staticData = { signature: 'other trigger' };
		const params = { event: 'newEvent', calendarIds: ['a@x.com', 'b@x.com'], timezone: 'Europe/Berlin' };
		await poll({ params, staticData });

		expect(Object.keys((staticData as IDataObject).seen as object)).toEqual(['a@x.com:e1', 'b@x.com:e1']);
		expect(bodies[0]).toMatchObject({ mergeAll: true, calendarIds: ['a@x.com', 'b@x.com'], timezone: 'Europe/Berlin' });
		expect(bodies[0].since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect((bodies[0].startDate as string) < (bodies[0].endDate as string)).toBe(true);
	});

	it('reads every page, so an event on a late page still fires', async () => {
		const staticData = {};
		const params = { event: 'newEvent' };
		const page = (n: number) => [{ calendarId: 'a@x.com', eventId: `old${n}` }];
		const scope = nock(API).post(`${BASE}/export-sheets`).query(true).reply(200, exportPage([]));
		expect(await poll({ params, staticData })).toEqual([]);

		[1, 2, 3, 4].forEach((n) =>
			scope.post(`${BASE}/export-sheets`).query({ page: String(n), limit: '100' }).reply(200, exportPage(page(n), true)),
		);
		scope.post(`${BASE}/export-sheets`).query({ page: '5', limit: '100' })
			.reply(200, exportPage([{ calendarId: 'a@x.com', eventId: 'late' }]));

		const fired = await poll({ params, staticData });

		expect(fired.map((e) => e.eventId)).toEqual(['old1', 'old2', 'old3', 'old4', 'late']);
	});

	it('does not fire for events that already exist when the workflow is activated', async () => {
		nock(API).post(`${BASE}/export-sheets`).query(true)
			.reply(200, exportPage([{ calendarId: 'a@x.com', eventId: 'e1' }]));

		expect(await poll({ params: { event: 'newEvent' }, staticData: {} })).toEqual([]);
	});

	it('fires once per event: a later poll returns only events it has not sent', async () => {
		const staticData = {};
		const params = { event: 'newEvent' };
		const first = [{ calendarId: 'a@x.com', eventId: 'e1' }];
		const second = [...first, { calendarId: 'a@x.com', eventId: 'e2', subject: 'New' }];
		nock(API)
			.post(`${BASE}/export-sheets`).query(true).reply(200, exportPage(first))
			.post(`${BASE}/export-sheets`).query(true).reply(200, exportPage(second))
			.post(`${BASE}/export-sheets`).query(true).reply(200, exportPage(second));

		expect(await poll({ params, staticData })).toEqual([]);
		expect((await poll({ params, staticData })).map((e) => e.id)).toEqual(['a@x.com:e2']);
		expect(await poll({ params, staticData })).toEqual([]);
	});

	it('a test run returns the latest event and does not mark anything as sent', async () => {
		const staticData = {};
		nock(API).post(`${BASE}/export-sheets`).query(true)
			.reply(200, exportPage([{ calendarId: 'a@x.com', eventId: 'e1' }, { calendarId: 'a@x.com', eventId: 'e2' }]));

		const results = await poll({ params: { event: 'newEvent' }, staticData, mode: 'manual' });

		expect(results.map((e) => e.id)).toEqual(['a@x.com:e1']);
		expect(staticData).toEqual({});
	});

	it('skips the poll when the endpoint is busy, and keeps what it remembers', async () => {
		const staticData = { signature: 'x', seen: { 'a@x.com:e1': 1 } };
		nock(API).post(`${BASE}/export-sheets`).query(true)
			.reply(413, { errors: { code: 'QUOTA_LIMIT_EXCEEDED', message: 'a request already processing' }, statusCode: 429 });

		const output = await trigger.poll.call(
			fakeContext({ params: { event: 'newEvent' }, staticData }) as unknown as IPollFunctions,
		);

		expect(output).toBeNull();
		expect(staticData).toEqual({ signature: 'x', seen: { 'a@x.com:e1': 1 } });
	});

	it('reports an invalid API key', async () => {
		nock(API).post(`${BASE}/export-sheets`).query(true)
			.reply(401, { errors: { code: 'UNAUTHORIZED', message: 'Invalid API key' }, statusCode: 401 });

		await expect(poll({ params: { event: 'newEvent' } })).rejects.toMatchObject({
			message: 'Your TimeTackle API key is invalid or inactive.',
			httpCode: '401',
		});
	});
});

describe('New Tagged Event', () => {
	it('filters by the chosen tag and team, and fires once per event', async () => {
		const bodies: IDataObject[] = [];
		const staticData = {};
		const params = { event: 'newTaggedEvent', tag: 'Client:Acme', teamId: 12, calendarIds: ['a@x.com'] };
		nock(API)
			.post(`${BASE}/export-sheets`, (body) => bodies.push(body) > 0).query(true).reply(200, exportPage([]))
			.post(`${BASE}/export-sheets`).query(true).times(2)
			.reply(200, exportPage([{ calendarId: 'a@x.com', eventId: 'e5', tags: 'Client:Acme' }]));

		expect(await poll({ params, staticData })).toEqual([]);
		expect((await poll({ params, staticData })).map((e) => e.id)).toEqual(['a@x.com:e5']);
		expect(await poll({ params, staticData })).toEqual([]);

		expect(bodies[0].filters).toEqual({ tag: ['Client:Acme'] });
		expect(bodies[0].groupId).toBe(12);
		expect(bodies[0].calendarIds).toBeUndefined();
	});
});

describe('New Tag or Property', () => {
	const properties = (extra: IDataObject[] = []) => ({
		success: true,
		data: [
			{ id: '10', name: 'Client', variety: 'TAG', children: [{ id: '11', name: 'Acme' }, ...extra] },
			{ id: '20', name: 'Region', variety: 'SINGLE_SELECT', children: [] },
		],
	});

	it('can include sub-tags and filter by type, and fires once per tag', async () => {
		const staticData = {};
		const params = { event: 'newProperty', variety: 'TAG', includeOptions: true };
		nock(API)
			.get(`${BASE}/properties`).query({ format: 'flat' }).reply(200, properties())
			.get(`${BASE}/properties`).query({ format: 'flat' }).times(2)
			.reply(200, properties([{ id: '12', name: 'Globex' }]));

		expect(await poll({ params, staticData })).toEqual([]);
		const fired = await poll({ params, staticData });
		expect(fired.map((p) => [p.id, p.parentName])).toEqual([['12', 'Client']]);
		expect(await poll({ params, staticData })).toEqual([]);
	});

	it('leaves sub-tags out unless asked', async () => {
		nock(API).get(`${BASE}/properties`).query({ format: 'flat' }).reply(200, properties());

		const results = await poll({ params: { event: 'newProperty' }, mode: 'manual' });

		expect(results.map((p) => p.id)).toEqual(['20']);
	});
});

describe('New Member', () => {
	it('passes the filters and fires once per member', async () => {
		const staticData = {};
		const params = { event: 'newMember', status: 'pending', role: 'EDITOR' };
		nock(API)
			.get(`${BASE}/users`).query({ type: 'pending', role: 'EDITOR' }).reply(200, { success: true, data: [{ id: 3 }, { id: 5 }] })
			.get(`${BASE}/users`).query({ type: 'pending', role: 'EDITOR' }).times(2)
			.reply(200, { success: true, data: [{ id: 3 }, { id: 9 }, { id: 5 }] });

		expect(await poll({ params, staticData })).toEqual([]);
		expect((await poll({ params, staticData })).map((m) => m.id)).toEqual([9]);
		expect(await poll({ params, staticData })).toEqual([]);
	});
});

describe('New Team', () => {
	it('fires once per team', async () => {
		const staticData = {};
		const params = { event: 'newTeam' };
		nock(API)
			.get(`${BASE}/calendars/groups`).reply(200, [{ id: 12, name: 'Sales' }])
			.get(`${BASE}/calendars/groups`).times(2).reply(200, [{ id: 12, name: 'Sales' }, { id: 15, name: 'Support' }]);

		expect(await poll({ params, staticData })).toEqual([]);
		expect((await poll({ params, staticData })).map((t) => t.name)).toEqual(['Support']);
		expect(await poll({ params, staticData })).toEqual([]);
	});

	it('a test run with nothing to show says so', async () => {
		nock(API).get(`${BASE}/calendars/groups`).reply(200, []);

		await expect(poll({ params: { event: 'newTeam' }, mode: 'manual' })).rejects.toThrow(
			'No data with the current filter could be found',
		);
	});
});

describe('what the trigger remembers', () => {
	const day = 86_400_000;

	it('starts over when the trigger or its filters change', () => {
		const state: IDataObject = {};
		takeNew(state, [{ id: 1 }], { signature: 'a' });

		expect(takeNew(state, [{ id: 1 }, { id: 2 }], { signature: 'b' })).toEqual([]);
		expect(takeNew(state, [{ id: 1 }, { id: 2 }, { id: 3 }], { signature: 'b' })).toEqual([{ id: 3 }]);
	});

	it('forgets an event only after it has left the polling window', () => {
		const state: IDataObject = {};
		const options = { signature: 'a', forgetAfterDays: 121 };
		takeNew(state, [{ id: 'old' }], { ...options, now: 0 });
		takeNew(state, [{ id: 'kept' }], { ...options, now: 100 * day });

		expect(takeNew(state, [{ id: 'old' }], { ...options, now: 121 * day })).toEqual([]);
		takeNew(state, [], { ...options, now: 250 * day });
		expect(Object.keys(state.seen as object)).toEqual([]);
	});
});
