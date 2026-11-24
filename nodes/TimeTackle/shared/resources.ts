// Readers for properties, members and teams, shared by the trigger, the dropdowns and the Get Many operations.

import type { IDataObject } from 'n8n-workflow';
import { apiRequest, isSet, type TimeTackleContext } from './api';

export async function getProperties(this: TimeTackleContext): Promise<IDataObject[]> {
	const response = (await apiRequest.call(this, 'GET', '/properties', undefined, { format: 'flat' })) as IDataObject;
	return (response.data as IDataObject[]) || [];
}

// Top-level properties plus their sub-tags/options, each option carrying its parent.
export function flattenProperties(properties: IDataObject[]): IDataObject[] {
	return properties.flatMap((property) => [
		{ ...property, isOption: false },
		...((property.children as IDataObject[]) || []).map((child) => ({
			...child,
			variety: property.variety,
			parentId: property.id,
			parentName: property.name,
			isOption: true,
		})),
	]);
}

export async function getMembers(this: TimeTackleContext, params: IDataObject = {}): Promise<IDataObject[]> {
	const qs: IDataObject = {};
	Object.entries(params).forEach(([key, value]) => {
		if (isSet(value)) qs[key] = value;
	});
	const response = (await apiRequest.call(this, 'GET', '/users', undefined, qs)) as IDataObject;
	return (response.data as IDataObject[]) || [];
}

export async function getTeams(this: TimeTackleContext): Promise<IDataObject[]> {
	const response = await apiRequest.call(this, 'GET', '/calendars/groups');
	if (Array.isArray(response)) return response as IDataObject[];
	return ((response as IDataObject | undefined)?.data as IDataObject[]) || [];
}

// Calendars are listed through teams; a calendar outside every team can still be given by an expression.
export async function getCalendars(this: TimeTackleContext): Promise<IDataObject[]> {
	const seen = new Map<string, IDataObject>();
	(await getTeams.call(this)).forEach((team) =>
		((team.calendars as IDataObject[]) || []).forEach((calendar) => {
			const id = String(calendar.calendarId);
			if (!seen.has(id)) seen.set(id, { id, title: calendar.title || id });
		}),
	);
	return [...seen.values()];
}
