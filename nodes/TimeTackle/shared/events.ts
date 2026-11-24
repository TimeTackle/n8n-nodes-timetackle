// Calendar events come from POST /export-sheets: one row per event per calendar.

import type { IDataObject } from 'n8n-workflow';
import { apiRequest, splitList, type TimeTackleContext } from './api';

export const PAGE_SIZE = 100;
const POLL_PAGES = 3;

export const EVENT_FIELDS = {
	tags: true,
	subject: true,
	startDate: true,
	startTime: true,
	endDate: true,
	endTime: true,
	duration: true,
	description: true,
	location: true,
	createdDate: true,
	createdTime: true,
	organizedByEmail: true,
	allAttendeesByEmail: true,
	crmAccountName: true,
	crmOpportunityName: true,
};

export interface EventFilters {
	calendarIds?: unknown;
	teamId?: unknown;
	tag?: unknown;
	search?: unknown;
	timezone?: unknown;
}

export const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

export const daysFromNow = (days: number): Date => {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + days);
	return date;
};

export function buildExportBody(input: EventFilters, dates: IDataObject): IDataObject {
	const body: IDataObject = { mergeAll: true, fields: EVENT_FIELDS, timezone: input.timezone || 'UTC' };

	if (input.teamId) {
		body.groupId = parseInt(String(input.teamId), 10);
	} else if (splitList(input.calendarIds).length) {
		body.calendarIds = splitList(input.calendarIds);
	}

	const filters: IDataObject = {};
	if (splitList(input.tag).length) filters.tag = splitList(input.tag);
	if (input.search) filters.search = [String(input.search)];
	if (Object.keys(filters).length) body.filters = filters;

	return { ...body, ...dates };
}

// Polling window: events starting from 30 days ago to 90 days ahead that changed in the last 2 days.
export const POLL_WINDOW_DAYS = 120;

export function pollingBody(input: EventFilters): IDataObject {
	return buildExportBody(input, {
		startDate: isoDate(daysFromNow(-30)),
		endDate: isoDate(daysFromNow(90)),
		since: isoDate(daysFromNow(-2)),
	});
}

// The same meeting can appear on several calendars, so the id combines calendar and event.
const withId = (row: IDataObject): IDataObject => ({ id: `${row.calendarId}:${row.eventId}`, ...row });

export async function fetchEvents(
	this: TimeTackleContext,
	body: IDataObject,
	maxRows: number = POLL_PAGES * PAGE_SIZE,
): Promise<IDataObject[]> {
	const rows: IDataObject[] = [];
	for (let page = 1; rows.length < maxRows; page += 1) {
		const response = (await apiRequest.call(this, 'POST', '/export-sheets', body, {
			page,
			limit: PAGE_SIZE,
		})) as IDataObject;
		const data = (response.data as IDataObject) || {};
		rows.push(...((data.data as IDataObject[]) || []));
		if (!(data.pagination as IDataObject | undefined)?.hasNext) break;
	}
	return rows.slice(0, maxRows).map(withId);
}
