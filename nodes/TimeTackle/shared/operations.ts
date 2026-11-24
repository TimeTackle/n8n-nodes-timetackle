// What each operation of the Event, Member and Team resources does, and of the Property resource from node
// version 2. Each returns the records to output for one input item.

import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { apiRequest, isSet, sameName, splitList, toIntList } from './api';
import { buildExportBody, fetchEvents } from './events';
import { flattenProperties, getMembers, getProperties, getTeams } from './resources';

type Operation = (this: IExecuteFunctions, i: number) => Promise<IDataObject | IDataObject[]>;

function limited(this: IExecuteFunctions, i: number, records: IDataObject[]): IDataObject[] {
	if (this.getNodeParameter('returnAll', i, false) as boolean) return records;
	return records.slice(0, this.getNodeParameter('limit', i, 50) as number);
}

// Builds `access` from the Calendar Access fields, or returns undefined when none is set. An invite only needs the
// switches that are on; an update also sends switches turned off (`keepOff`), e.g. to stop a pending admin
// connecting a calendar.
export function buildAccess(input: IDataObject, { keepOff = false } = {}): IDataObject | undefined {
	const access: IDataObject = {};
	const setSwitch = (key: string) => {
		if (input[key] === true) access[key] = true;
		else if (keepOff && input[key] === false) access[key] = false;
	};
	setSwitch('allCalendars');
	setSwitch('connectOwnCalendar');
	if (toIntList(input.teamIds).length) access.teamIds = toIntList(input.teamIds);
	if (splitList(input.calendarIds).length) access.calendarIds = splitList(input.calendarIds);
	if (toIntList(input.userIds).length) access.userIds = toIntList(input.userIds);
	return Object.keys(access).length ? access : undefined;
}

const eventGetAll: Operation = async function (i) {
	const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
	const body = buildExportBody(filters, {
		startDate: String(this.getNodeParameter('startDate', i)).slice(0, 10),
		endDate: String(this.getNodeParameter('endDate', i)).slice(0, 10),
	});
	const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
	const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i, 50) as number);
	return fetchEvents.call(this, body, limit);
};

const propertyCreate: Operation = async function (i) {
	const additional = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
	const property: IDataObject = {
		name: this.getNodeParameter('name', i) as string,
		variety: (this.getNodeParameter('variety', i, 'TAG') as string) || 'TAG',
	};
	if (additional.color) property.color = additional.color;
	const children = splitList(additional.options);
	if (children.length) property.children = children.map((name) => ({ name }));

	const response = (await apiRequest.call(this, 'POST', '/properties', { properties: [property] })) as IDataObject;
	return ((response.data as IDataObject[]) || [])[0] || property;
};

const propertyUpdate: Operation = async function (i) {
	const id = this.getNodeParameter('propertyId', i, '', { extractValue: true }) as string;
	const fields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
	const body: IDataObject = {};
	if (fields.name) body.name = fields.name;
	if (fields.color) body.color = fields.color;
	if (!Object.keys(body).length) {
		throw new NodeOperationError(this.getNode(), 'Set a new name or a new color.', { itemIndex: i });
	}
	await apiRequest.call(this, 'POST', `/property/${encodeURIComponent(id)}/update`, body);
	return { id, ...body, updated: true };
};

const propertyDelete: Operation = async function (i) {
	const id = this.getNodeParameter('propertyId', i, '', { extractValue: true }) as string;
	await apiRequest.call(this, 'POST', `/property/${encodeURIComponent(id)}/delete`);
	return { id, deleted: true };
};

// Tags and properties come first, then sub-tags and options.
const propertyGetAll: Operation = async function (i) {
	const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
	const matches = flattenProperties(await getProperties.call(this))
		.filter((item) => !isSet(filters.name) || sameName(item.name, filters.name))
		.filter((item) => !filters.variety || item.variety === filters.variety)
		.sort((a, b) => Number(a.isOption) - Number(b.isOption));
	return limited.call(this, i, matches);
};

const memberInvite: Operation = async function (i) {
	const body: IDataObject = {
		name: this.getNodeParameter('name', i) as string,
		email: this.getNodeParameter('email', i) as string,
		role: this.getNodeParameter('role', i) as string,
	};
	const access = buildAccess(this.getNodeParameter('access', i, {}) as IDataObject);
	if (access) body.access = access;

	const response = (await apiRequest.call(this, 'POST', '/users/invite', body)) as IDataObject;
	return response.data as IDataObject;
};

const memberUpdate: Operation = async function (i) {
	const id = this.getNodeParameter('memberId', i, '', { extractValue: true }) as string | number;
	const fields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
	const body: IDataObject = {};
	if (fields.name) body.name = fields.name;
	if (fields.role) body.role = fields.role;
	const access = buildAccess(this.getNodeParameter('access', i, {}) as IDataObject, { keepOff: true });
	if (access) body.access = access;
	if (!Object.keys(body).length) {
		throw new NodeOperationError(this.getNode(), 'Set at least one of name, role or calendar access.', {
			itemIndex: i,
		});
	}

	const response = (await apiRequest.call(
		this,
		'POST',
		`/users/${encodeURIComponent(String(id))}/update`,
		body,
	)) as IDataObject;
	return response.data as IDataObject;
};

const memberRemove: Operation = async function (i) {
	const id = this.getNodeParameter('memberId', i, '', { extractValue: true }) as string | number;
	await apiRequest.call(this, 'POST', `/users/${encodeURIComponent(String(id))}/delete`);
	return { id, removed: true };
};

const memberGetAll: Operation = async function (i) {
	const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
	const members = await getMembers.call(this, {
		type: filters.status || 'all',
		role: filters.role,
		email: filters.email,
	});
	return limited.call(this, i, members);
};

const teamGetAll: Operation = async function (i) {
	const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
	const teams = (await getTeams.call(this)).filter(
		(team) => !isSet(filters.name) || sameName(team.name, filters.name),
	);
	return limited.call(this, i, teams);
};

const always: Record<string, Operation> = {
	'event:getAll': eventGetAll,
	'member:invite': memberInvite,
	'member:update': memberUpdate,
	'member:remove': memberRemove,
	'member:getAll': memberGetAll,
	'team:getAll': teamGetAll,
};

const fromVersion2: Record<string, Operation> = {
	'property:create': propertyCreate,
	'property:update': propertyUpdate,
	'property:delete': propertyDelete,
	'property:getAll': propertyGetAll,
};

export function findOperation(resource: string, operation: string, nodeVersion: number): Operation | undefined {
	const key = `${resource}:${operation}`;
	return always[key] || (nodeVersion >= 2 ? fromVersion2[key] : undefined);
}
