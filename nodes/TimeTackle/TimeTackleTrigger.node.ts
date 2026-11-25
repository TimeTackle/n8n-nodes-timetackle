import type {
	IDataObject,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { byIdDesc, isBusyError } from './shared/api';
import { fetchEvents, pollingBody, POLL_WINDOW_DAYS } from './shared/events';
import { ALL_ROLES, loadOptions, MEMBER_STATUSES, VARIETIES } from './shared/options';
import { flattenProperties, getMembers, getProperties, getTeams } from './shared/resources';
import { takeNew } from './shared/seen';

const EVENT_TRIGGERS = ['newEvent', 'newTaggedEvent'];

const properties: INodeProperties[] = [
	{
		displayName: 'Trigger On',
		name: 'event',
		type: 'options',
		noDataExpression: true,
		default: 'newEvent',
		options: [
			{
				name: 'New Event',
				value: 'newEvent',
				description: 'A calendar event is added to TimeTackle, including manual time entries',
			},
			{
				name: 'New Member',
				value: 'newMember',
				description: 'Someone is invited to or joins the workspace',
			},
			{
				name: 'New Tag or Property',
				value: 'newProperty',
				description: 'A tag or property is created in the workspace',
			},
			{
				name: 'New Tagged Event',
				value: 'newTaggedEvent',
				description: 'An event gets a chosen tag or property value',
			},
			{
				name: 'New Team',
				value: 'newTeam',
				description: 'A team (calendar group) is created',
			},
		],
	},

	// Event triggers
	{
		displayName: 'Tag Name or ID',
		name: 'tag',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getTags' },
		required: true,
		default: '',
		description:
			'A tag or property, or one of its values, e.g. Client or Client:Acme. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show: { event: ['newTaggedEvent'] } },
	},
	{
		displayName: 'Calendar Names or IDs',
		name: 'calendarIds',
		type: 'multiOptions',
		typeOptions: { loadOptionsMethod: 'getCalendars' },
		default: [],
		description:
			'Only events from these calendars. Leave empty for every calendar. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show: { event: EVENT_TRIGGERS } },
	},
	{
		displayName: 'Team Name or ID',
		name: 'teamId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getTeams' },
		default: '',
		description:
			'Only events from calendars in this team. Overrides Calendars. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show: { event: EVENT_TRIGGERS } },
	},
	{
		displayName: 'Time Zone',
		name: 'timezone',
		type: 'string',
		default: 'UTC',
		placeholder: 'America/New_York',
		description: 'IANA time zone for event dates and times',
		displayOptions: { show: { event: EVENT_TRIGGERS } },
	},

	// New Tag or Property
	{
		displayName: 'Type',
		name: 'variety',
		type: 'options',
		default: '',
		options: [{ name: 'All Types', value: '' }, ...VARIETIES],
		description: 'Only tags or properties of this type',
		displayOptions: { show: { event: ['newProperty'] } },
	},
	{
		displayName: 'Include Sub-Tags and Options',
		name: 'includeOptions',
		type: 'boolean',
		default: false,
		description: 'Whether to also trigger when a sub-tag or select option is added',
		displayOptions: { show: { event: ['newProperty'] } },
	},

	// New Member
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: 'all',
		options: MEMBER_STATUSES,
		displayOptions: { show: { event: ['newMember'] } },
	},
	{
		displayName: 'Role',
		name: 'role',
		type: 'options',
		default: '',
		options: [{ name: 'Any Role', value: '' }, ...ALL_ROLES],
		description: 'Only members with this role',
		displayOptions: { show: { event: ['newMember'] } },
	},
];

export class TimeTackleTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TimeTackle Trigger',
		name: 'timeTackleTrigger',
		icon: { light: 'file:timetackle.svg', dark: 'file:timetackle.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when events, tags, members or teams are added in TimeTackle',
		defaults: {
			name: 'TimeTackle Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'timeTackleApi',
				required: true,
			},
		],
		properties,
	};

	methods = { loadOptions };

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as string;
		const filters: IDataObject = {};
		let records: IDataObject[];
		let forgetAfterDays: number | undefined;

		try {
			if (EVENT_TRIGGERS.includes(event)) {
				filters.calendarIds = this.getNodeParameter('calendarIds', []) as string[];
				filters.teamId = this.getNodeParameter('teamId', '') as string | number;
				filters.timezone = this.getNodeParameter('timezone', 'UTC') as string;
				if (event === 'newTaggedEvent') {
					filters.tag = this.getNodeParameter('tag') as string;
					if (!filters.tag) throw new NodeOperationError(this.getNode(), 'Choose the tag to watch.');
				}
				records = await fetchEvents.call(this, pollingBody(filters));
				// An event can come back for as long as it is inside the polling window.
				forgetAfterDays = POLL_WINDOW_DAYS + 1;
			} else if (event === 'newProperty') {
				filters.variety = this.getNodeParameter('variety', '') as string;
				filters.includeOptions = this.getNodeParameter('includeOptions', false) as boolean;
				records = flattenProperties(await getProperties.call(this))
					.filter((item) => !filters.variety || item.variety === filters.variety)
					.filter((item) => filters.includeOptions === true || !item.isOption)
					.sort(byIdDesc);
			} else if (event === 'newMember') {
				filters.status = this.getNodeParameter('status', 'all') as string;
				filters.role = this.getNodeParameter('role', '') as string;
				records = (await getMembers.call(this, { type: filters.status || 'all', role: filters.role })).sort(
					byIdDesc,
				);
			} else {
				records = (await getTeams.call(this)).sort(byIdDesc);
			}
		} catch (error) {
			// Another request to the same endpoint is still running for this workspace: skip this poll, the next
			// one picks up whatever this one would have found.
			if (isBusyError(error) && this.getMode() !== 'manual') return null;
			if (error instanceof NodeOperationError) throw new NodeOperationError(this.getNode(), error);
			throw new NodeApiError(this.getNode(), error as JsonObject);
		}

		// A test run shows the latest record without marking anything as sent.
		if (this.getMode() === 'manual') {
			if (!records.length) {
				throw new NodeOperationError(this.getNode(), 'No data with the current filter could be found', {
					description: 'Add a matching record in TimeTackle, or change the filters, and test again.',
				});
			}
			return [this.helpers.returnJsonArray(records.slice(0, 1))];
		}

		const state = this.getWorkflowStaticData('node');
		const fresh = takeNew(state, records, { signature: JSON.stringify({ event, ...filters }), forgetAfterDays });
		return fresh.length ? [this.helpers.returnJsonArray(fresh)] : null;
	}
}
