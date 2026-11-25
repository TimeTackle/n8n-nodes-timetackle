// Fields of the Event, Member and Team resources, and of the Property resource from node version 2.

import type { INodeProperties } from 'n8n-workflow';
import { ALL_ROLES, ASSIGNABLE_ROLES, COLORS, MEMBER_STATUSES, VARIETIES } from './options';

const V2 = { '@version': [{ _cnd: { gte: 2 } }] };

const show = (resource: string, operation: string[], extra: object = {}) => ({
	show: { resource: [resource], operation, ...extra },
});

const returnAllAndLimit = (resource: string, extra: object = {}): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: show(resource, ['getAll'], extra),
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		description: 'Max number of results to return',
		displayOptions: { show: { resource: [resource], operation: ['getAll'], returnAll: [false], ...extra } },
	},
];

const eventCalendarsField: INodeProperties = {
	displayName: 'Calendar Names or IDs',
	name: 'calendarIds',
	type: 'multiOptions',
	typeOptions: { loadOptionsMethod: 'getCalendars' },
	default: [],
	description:
		'Only events from these calendars. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
};

const eventTeamField: INodeProperties = {
	displayName: 'Team Name or ID',
	name: 'teamId',
	type: 'options',
	typeOptions: { loadOptionsMethod: 'getTeams' },
	default: '',
	description:
		'Only events from calendars in this team. Overrides Calendars. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
};

// ─── Event ───

export const eventFields: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['event'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Find calendar events in a date range, by calendar, team, tag or text',
				action: 'Get many events',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'From',
		name: 'startDate',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'First day to include',
		displayOptions: show('event', ['getAll']),
	},
	{
		displayName: 'To',
		name: 'endDate',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'Last day to include',
		displayOptions: show('event', ['getAll']),
	},
	...returnAllAndLimit('event'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('event', ['getAll']),
		options: [
			eventCalendarsField,
			{
				displayName: 'Tag Name or ID',
				name: 'tag',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getTags' },
				default: '',
				description: 'A tag or property, or one of its values, e.g. Client or Client:Acme. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			eventTeamField,
			{
				displayName: 'Text',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Only events whose title contains this text',
			},
			{
				displayName: 'Time Zone',
				name: 'timezone',
				type: 'string',
				default: 'UTC',
				placeholder: 'America/New_York',
				description: 'IANA time zone for event dates and times',
			},
		],
	},
];

// ─── Property (node version 2) ───

const propertyIdField = (operation: string[]): INodeProperties => ({
	displayName: 'Tag or Property',
	name: 'propertyId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'A tag, property, sub-tag or option',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select a tag or property...',
			typeOptions: { searchListMethod: 'searchProperties', searchable: true },
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 2093114',
			validation: [{ type: 'regex', properties: { regex: '^[0-9]+$', errorMessage: 'Not a valid ID' } }],
		},
	],
	displayOptions: show('property', operation, V2),
});

export const propertyFields: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: "Cannot contain ':' or ','. A tag or property with the same name is updated instead of duplicated.",
		displayOptions: show('property', ['create'], V2),
	},
	{
		displayName: 'Type',
		name: 'variety',
		type: 'options',
		required: true,
		default: 'TAG',
		options: VARIETIES,
		displayOptions: show('property', ['create'], V2),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show('property', ['create'], V2),
		options: [
			{ displayName: 'Color', name: 'color', type: 'options', default: 'Blueberry', options: COLORS },
			{
				displayName: 'Sub-Tags or Options',
				name: 'options',
				type: 'string',
				typeOptions: { multipleValues: true },
				default: [],
				description: 'Sub-tags of a tag, or options of a single or multi select property. One level deep.',
			},
		],
	},
	propertyIdField(['update', 'delete']),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show('property', ['update'], V2),
		options: [
			{ displayName: 'Color', name: 'color', type: 'options', default: 'Blueberry', options: COLORS },
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: "Cannot contain ':' or ','",
			},
		],
	},
	...returnAllAndLimit('property', V2),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('property', ['getAll'], V2),
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Only the tag, property, sub-tag or option with this name. Upper and lower case are treated the same.',
			},
			{
				displayName: 'Type',
				name: 'variety',
				type: 'options',
				default: 'TAG',
				options: VARIETIES,
			},
		],
	},
];

// ─── Member ───

const memberIdField: INodeProperties = {
	displayName: 'Member',
	name: 'memberId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select a member...',
			typeOptions: { searchListMethod: 'searchMembers', searchable: true },
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 345',
			validation: [{ type: 'regex', properties: { regex: '^[0-9]+$', errorMessage: 'Not a valid user ID' } }],
		},
	],
	displayOptions: show('member', ['update', 'remove']),
};

const accessField = (operation: string, description: string): INodeProperties => ({
	displayName: 'Calendar Access',
	name: 'access',
	type: 'collection',
	placeholder: 'Add Access',
	default: {},
	description,
	displayOptions: show('member', [operation]),
	options: [
		{
			displayName: 'Calendar Names or IDs',
			name: 'calendarIds',
			type: 'multiOptions',
			typeOptions: { loadOptionsMethod: 'getCalendars' },
			default: [],
			description:
				'Calendars they see. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		},
		{
			displayName: 'Connects Their Own Calendar',
			name: 'connectOwnCalendar',
			type: 'boolean',
			default: true,
			description: 'Whether the member is asked to connect their calendar while setting up. Not for viewers.',
		},
		{
			displayName: 'Member Names or IDs',
			name: 'userIds',
			type: 'multiOptions',
			typeOptions: { loadOptionsMethod: 'getMembers' },
			default: [],
			description: 'Members whose calendars they see. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		},
		{
			displayName: 'Sees All Calendars',
			name: 'allCalendars',
			type: 'boolean',
			default: true,
			description:
				'Whether the member sees every calendar. Not available in workspaces where members only see their own calendars.',
		},
		{
			displayName: 'Team Names or IDs',
			name: 'teamIds',
			type: 'multiOptions',
			typeOptions: { loadOptionsMethod: 'getTeams' },
			default: [],
			description: 'Teams they see. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		},
	],
});

export const memberFields: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['member'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Find workspace members, by email, status or role',
				action: 'Get many members',
			},
			{
				name: 'Invite',
				value: 'invite',
				description: 'Invite a person to the workspace and email them the invitation',
				action: 'Invite a member',
			},
			{
				name: 'Remove',
				value: 'remove',
				description:
					'Remove a member or cancel a pending invite. This cannot be undone: their imported calendars are removed.',
				action: 'Remove a member',
			},
			{
				name: 'Update',
				value: 'update',
				description: "Change a member's name, role or calendar access",
				action: 'Update a member',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Shown in the invitation email. Cannot contain \'&lt;\' or \'&gt;\'.',
		displayOptions: show('member', ['invite']),
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		displayOptions: show('member', ['invite']),
	},
	{
		displayName: 'Role',
		name: 'role',
		type: 'options',
		required: true,
		default: 'CONTRIBUTOR',
		options: ASSIGNABLE_ROLES,
		displayOptions: show('member', ['invite']),
	},
	accessField('invite', 'Which calendars the member sees. Admins always see all calendars.'),
	memberIdField,
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show('member', ['update']),
		options: [
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{ displayName: 'Role', name: 'role', type: 'options', default: 'CONTRIBUTOR', options: ASSIGNABLE_ROLES },
		],
	},
	accessField('update', "Access you set replaces the member's current access."),
	...returnAllAndLimit('member'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('member', ['getAll']),
		options: [
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description: 'Only the member with this email',
			},
			{
				displayName: 'Role',
				name: 'role',
				type: 'options',
				default: 'CONTRIBUTOR',
				options: ALL_ROLES,
				description: 'Only members with this role',
			},
			{ displayName: 'Status', name: 'status', type: 'options', default: 'all', options: MEMBER_STATUSES },
		],
	},
];

// ─── Team ───

export const teamFields: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['team'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Find teams (calendar groups), by name',
				action: 'Get many teams',
			},
		],
		default: 'getAll',
	},
	...returnAllAndLimit('team'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('team', ['getAll']),
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Only the team with this name. Upper and lower case are treated the same.',
			},
		],
	},
];
