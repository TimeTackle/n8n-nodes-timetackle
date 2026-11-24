// Choices and dropdown loaders shared by the TimeTackle node and the TimeTackle Trigger node.

import type { ILoadOptionsFunctions, INodeListSearchResult, INodePropertyOptions } from 'n8n-workflow';
import { flattenProperties, getCalendars, getMembers, getProperties, getTeams } from './resources';

export const VARIETIES: INodePropertyOptions[] = [
	{ name: 'Checkbox', value: 'CHECKBOX' },
	{ name: 'Multi Select', value: 'MULTI_SELECT' },
	{ name: 'Number', value: 'NUMBER' },
	{ name: 'Rating', value: 'RATING' },
	{ name: 'Single Select', value: 'SINGLE_SELECT' },
	{ name: 'Tag', value: 'TAG' },
	{ name: 'Text', value: 'TEXT' },
];

export const COLORS: INodePropertyOptions[] = [
	'Tomato', 'Flamingo', 'Tangerine', 'Banana', 'Sage', 'Basil',
	'Peacock', 'Blueberry', 'Lavender', 'Grape', 'Graphite',
].map((color) => ({ name: color, value: color }));

export const ASSIGNABLE_ROLES: INodePropertyOptions[] = [
	{ name: 'Admin', value: 'ADMIN' },
	{ name: 'Contributor', value: 'CONTRIBUTOR' },
	{ name: 'Editor', value: 'EDITOR' },
	{ name: 'Viewer', value: 'VIEWER' },
];

export const ALL_ROLES: INodePropertyOptions[] = [
	{ name: 'Admin', value: 'ADMIN' },
	{ name: 'Billing Admin', value: 'BILLING_ADMIN' },
	{ name: 'Contributor', value: 'CONTRIBUTOR' },
	{ name: 'Editor', value: 'EDITOR' },
	{ name: 'Owner', value: 'OWNER' },
	{ name: 'Viewer', value: 'VIEWER' },
];

export const MEMBER_STATUSES: INodePropertyOptions[] = [
	{ name: 'Invited or Joined', value: 'all' },
	{ name: 'Invited, Not Joined Yet', value: 'pending' },
	{ name: 'Joined', value: 'active' },
];

const byName = (a: INodePropertyOptions, b: INodePropertyOptions) => a.name.localeCompare(b.name);

export const loadOptions = {
	async getCalendars(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return (await getCalendars.call(this))
			.map((calendar) => ({ name: String(calendar.title), value: String(calendar.id) }))
			.sort(byName);
	},

	async getTeams(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return (await getTeams.call(this))
			.map((team) => ({ name: String(team.name), value: Number(team.id) }))
			.sort(byName);
	},

	async getMembers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return (await getMembers.call(this, { type: 'all' }))
			.map((member) => ({
				name: member.name ? `${member.name} (${member.email})` : String(member.email),
				value: Number(member.id),
			}))
			.sort(byName);
	},

	// Tags, properties, sub-tags and options by id.
	async getProperties(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return flattenProperties(await getProperties.call(this))
			.map((item) => ({
				name: item.isOption ? `${item.parentName} > ${item.name}` : String(item.name),
				value: String(item.id),
			}))
			.sort(byName);
	},

	// Event tag filters take `Name` or `Name:Value`.
	async getTags(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return flattenProperties(await getProperties.call(this))
			.map((item) => {
				const value = item.isOption ? `${item.parentName}:${item.name}` : String(item.name);
				return { name: value, value };
			})
			.sort(byName);
	},
};

const matching = (options: INodePropertyOptions[], filter?: string): INodeListSearchResult => {
	const text = (filter || '').trim().toLowerCase();
	return { results: text ? options.filter((option) => option.name.toLowerCase().includes(text)) : options };
};

// Searchable lists behind the Tag or Property and Member pickers.
export const listSearch = {
	async searchProperties(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
		return matching(await loadOptions.getProperties.call(this), filter);
	},

	async searchMembers(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
		return matching(await loadOptions.getMembers.call(this), filter);
	},
};
