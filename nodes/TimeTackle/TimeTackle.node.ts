import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

const EXPORT_SHOW = { resource: ['export'], operation: ['exportSheets'] };
const PROPERTY_COLORS = [
	{ name: 'Tomato', value: 'Tomato' },
	{ name: 'Flamingo', value: 'Flamingo' },
	{ name: 'Tangerine', value: 'Tangerine' },
	{ name: 'Banana', value: 'Banana' },
	{ name: 'Sage', value: 'Sage' },
	{ name: 'Basil', value: 'Basil' },
	{ name: 'Peacock', value: 'Peacock' },
	{ name: 'Blueberry', value: 'Blueberry' },
	{ name: 'Lavender', value: 'Lavender' },
	{ name: 'Grape', value: 'Grape' },
	{ name: 'Graphite', value: 'Graphite' },
];
const SECONDARY_VARIETIES = [
	{ name: 'Checkbox', value: 'CHECKBOX' },
	{ name: 'Multi Select', value: 'MULTI_SELECT' },
	{ name: 'Number', value: 'NUMBER' },
	{ name: 'Rating', value: 'RATING' },
	{ name: 'Single Select', value: 'SINGLE_SELECT' },
	{ name: 'Text', value: 'TEXT' },
];

export class TimeTackle implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TimeTackle',
		name: 'timeTackle',
		icon: 'file:timetackle.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with the TimeTackle API — export calendar data and manage properties. See https://timetackle.gitbook.io/tackle for API docs.',
		defaults: {
			name: 'TimeTackle',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'timeTackleApi',
				required: true,
			},
		],
		properties: [
			// ─── Resource ───
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Export', value: 'export' },
					{ name: 'Property', value: 'property' },
				],
				default: 'export',
			},

			// ════════════════════════════════════════
			// EXPORT
			// ════════════════════════════════════════
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['export'] } },
				options: [
					{
						name: 'Export Calendar Data',
						value: 'exportSheets',
						description: 'Export calendar event data with filters and pagination',
						action: 'Export calendar data',
					},
				],
				default: 'exportSheets',
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				default: 1,
				required: true,
				description: 'Page number of results to retrieve',
				displayOptions: { show: EXPORT_SHOW },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 100,
				required: true,
				description: 'Number of results per page (max 500)',
				typeOptions: { maxValue: 500, minValue: 1 },
				displayOptions: { show: EXPORT_SHOW },
			},
			{
				displayName: 'Start Date',
				name: 'startDate',
				type: 'dateTime',
				default: '',
				description: 'Filter events starting from this date',
				displayOptions: { show: EXPORT_SHOW },
			},
			{
				displayName: 'End Date',
				name: 'endDate',
				type: 'dateTime',
				default: '',
				description: 'Filter events up to this date',
				displayOptions: { show: EXPORT_SHOW },
			},
			{
				displayName: 'Merge All',
				name: 'mergeAll',
				type: 'boolean',
				default: true,
				description: 'Whether to merge all calendar results into a single list',
				displayOptions: { show: EXPORT_SHOW },
			},
			{
				displayName: 'Additional Options',
				name: 'exportOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: EXPORT_SHOW },
				options: [
					{
						displayName: 'Since',
						name: 'since',
						type: 'dateTime',
						default: '',
						description: 'Return events updated since this date',
					},
					{
						displayName: 'Group ID',
						name: 'groupId',
						type: 'number',
						default: 0,
						description: 'Filter by calendar group ID',
					},
					{
						displayName: 'Calendar IDs',
						name: 'calendarIds',
						type: 'string',
						default: '',
						description: 'Comma-separated list of calendar IDs to export',
					},
					{
						displayName: 'Timezone',
						name: 'timezone',
						type: 'string',
						default: '',
						placeholder: 'America/New_York',
						description: 'Timezone for date/time values in the response',
					},
				],
			},

			// ─── Export Filters ───
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: { show: EXPORT_SHOW },
				options: [
					{
						displayName: 'Tags',
						name: 'tag',
						type: 'string',
						default: '',
						description: 'Comma-separated tags to filter by (format: "key:value" or "key")',
					},
					{
						displayName: 'RSVP',
						name: 'rsvp',
						type: 'boolean',
						default: false,
						description: 'Whether to filter by RSVP status',
					},
					{
						displayName: 'All Day Events',
						name: 'allDay',
						type: 'options',
						default: 'INCLUDE',
						options: [
							{ name: 'Include', value: 'INCLUDE' },
							{ name: 'Exclude', value: 'EXCLUDE' },
						],
						description: 'Whether to include or exclude all-day events',
					},
					{
						displayName: 'Search',
						name: 'search',
						type: 'string',
						default: '',
						description: 'Comma-separated search terms to filter events',
					},
					{
						displayName: 'Has CRM Account',
						name: 'hasCrmAccount',
						type: 'boolean',
						default: false,
						description: 'Whether to filter events linked to a CRM account',
					},
					{
						displayName: 'Has CRM Opportunity',
						name: 'hasCrmOpportunity',
						type: 'boolean',
						default: false,
						description: 'Whether to filter events linked to a CRM opportunity',
					},
					{
						displayName: 'Has CRM Opportunity Owner',
						name: 'hasCrmOpportunityOwner',
						type: 'boolean',
						default: false,
						description: 'Whether to filter events with a CRM opportunity owner',
					},
					{
						displayName: 'Has CRM Stage',
						name: 'hasCrmStage',
						type: 'boolean',
						default: false,
						description: 'Whether to filter events with a CRM stage',
					},
					{
						displayName: 'CRM Account Tags',
						name: 'crmAccountTags',
						type: 'string',
						default: '',
						description: 'Comma-separated CRM account tags to filter by',
					},
					{
						displayName: 'CRM Opportunity Tags',
						name: 'crmOpportunityTags',
						type: 'string',
						default: '',
						description: 'Comma-separated CRM opportunity tags to filter by',
					},
					{
						displayName: 'CRM Opportunity Owner Tags',
						name: 'crmOpportunityOwnerTags',
						type: 'string',
						default: '',
						description: 'Comma-separated CRM opportunity owner tags to filter by',
					},
					{
						displayName: 'CRM Stage Tags',
						name: 'crmStageTags',
						type: 'string',
						default: '',
						description: 'Comma-separated CRM stage tags to filter by',
					},
				],
			},

			// ─── Export Formatting ───
			{
				displayName: 'Formatting',
				name: 'formatting',
				type: 'collection',
				placeholder: 'Add Formatting Option',
				default: {},
				displayOptions: { show: EXPORT_SHOW },
				description: 'Configure output formatting for dates, times, and durations',
				options: [
					{
						displayName: 'Date Format',
						name: 'date',
						type: 'options',
						default: 'MM_DD_YYYY',
						description: 'Format for date values in the response',
						options: [
							{ name: 'MM/DD/YYYY', value: 'MM_DD_YYYY' },
							{ name: 'DD/MM/YYYY', value: 'DD_MM_YYYY' },
							{ name: 'YYYY/MM/DD', value: 'YYYY_MM_DD' },
						],
					},
					{
						displayName: 'Time Format',
						name: 'time',
						type: 'options',
						default: 'HOUR_MIN_AMPM',
						description: 'Format for time values in the response',
						options: [
							{ name: '12-Hour (AM/PM)', value: 'HOUR_MIN_AMPM' },
							{ name: '24-Hour', value: 'HOUR_MIN_24' },
						],
					},
					{
						displayName: 'Duration Format',
						name: 'duration',
						type: 'options',
						default: 'HOURS_IN_DECIMAL',
						description: 'Format for duration values in the response',
						options: [
							{ name: 'Decimal Hours (e.g. 1.5)', value: 'HOURS_IN_DECIMAL' },
							{ name: 'Hours:Minutes (e.g. 1:30)', value: 'HOUR_MIN' },
						],
					},
					{
						displayName: 'Exclude Resource',
						name: 'excludeResource',
						type: 'boolean',
						default: false,
						description: 'Whether to exclude resource calendars from results',
					},
					{
						displayName: 'Exclude Organizer',
						name: 'excludeOrganizer',
						type: 'boolean',
						default: false,
						description: 'Whether to exclude organizer data from results',
					},
					{
						displayName: 'Single Column Tag',
						name: 'singleColumnTag',
						type: 'boolean',
						default: true,
						description: 'Whether to combine tags into a single column',
					},
				],
			},

			// ─── Export Fields ───
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: EXPORT_SHOW },
				options: [
					{ displayName: 'Subject', name: 'subject', type: 'boolean', default: true, description: 'Whether to include the event subject' },
					{ displayName: 'Start Date', name: 'startDate', type: 'boolean', default: true, description: 'Whether to include the event start date' },
					{ displayName: 'Start Time', name: 'startTime', type: 'boolean', default: true, description: 'Whether to include the event start time' },
					{ displayName: 'End Date', name: 'endDate', type: 'boolean', default: true, description: 'Whether to include the event end date' },
					{ displayName: 'End Time', name: 'endTime', type: 'boolean', default: true, description: 'Whether to include the event end time' },
					{ displayName: 'Duration', name: 'duration', type: 'boolean', default: true, description: 'Whether to include the event duration' },
					{ displayName: 'Tags', name: 'tags', type: 'boolean', default: true, description: 'Whether to include event tags' },
					{ displayName: 'Created Date', name: 'createdDate', type: 'boolean', default: true, description: 'Whether to include the created date' },
					{ displayName: 'Created Time', name: 'createdTime', type: 'boolean', default: true, description: 'Whether to include the created time' },
					{ displayName: 'Description', name: 'description', type: 'boolean', default: false, description: 'Whether to include the event description' },
					{ displayName: 'Location', name: 'location', type: 'boolean', default: false, description: 'Whether to include the event location' },
					{ displayName: 'Event Notes', name: 'eventNotes', type: 'boolean', default: false, description: 'Whether to include event notes' },
					{ displayName: 'Day of Week', name: 'dayOfWeek', type: 'boolean', default: false, description: 'Whether to include the day of the week' },
					{ displayName: 'Day Total', name: 'dayTotal', type: 'boolean', default: false, description: 'Whether to include the day total duration' },
					{ displayName: 'Sum All', name: 'sumAll', type: 'boolean', default: false, description: 'Whether to include the sum of all durations' },
					{ displayName: 'Conference Links', name: 'conferenceLinks', type: 'boolean', default: false, description: 'Whether to include conference/meeting links' },
					{ displayName: 'Created By Name', name: 'createdByName', type: 'boolean', default: false, description: 'Whether to include the creator name' },
					{ displayName: 'Created By Email', name: 'createdByEmail', type: 'boolean', default: false, description: 'Whether to include the creator email' },
					{ displayName: 'Organized By Name', name: 'organizedByName', type: 'boolean', default: false, description: 'Whether to include the organizer name' },
					{ displayName: 'Organized By Email', name: 'organizedByEmail', type: 'boolean', default: false, description: 'Whether to include the organizer email' },
					{ displayName: 'All Attendees By Name', name: 'allAttendeesByName', type: 'boolean', default: false, description: 'Whether to include all attendees by name' },
					{ displayName: 'All Attendees By Email', name: 'allAttendeesByEmail', type: 'boolean', default: false, description: 'Whether to include all attendees by email' },
					{ displayName: 'Accepted Attendees By Name', name: 'acceptedAttendeesByName', type: 'boolean', default: false, description: 'Whether to include accepted attendees by name' },
					{ displayName: 'Accepted Attendees By Email', name: 'acceptedAttendeesByEmail', type: 'boolean', default: false, description: 'Whether to include accepted attendees by email' },
					{ displayName: 'Declined Attendees By Name', name: 'declinedAttendeesByName', type: 'boolean', default: false, description: 'Whether to include declined attendees by name' },
					{ displayName: 'Declined Attendees By Email', name: 'declinedAttendeesByEmail', type: 'boolean', default: false, description: 'Whether to include declined attendees by email' },
					{ displayName: 'Tentative Attendees By Name', name: 'tentativeAttendeesByName', type: 'boolean', default: false, description: 'Whether to include tentative attendees by name' },
					{ displayName: 'Tentative Attendees By Email', name: 'tentativeAttendeesByEmail', type: 'boolean', default: false, description: 'Whether to include tentative attendees by email' },
					{ displayName: 'Not Responded Attendees By Name', name: 'notRespondedAttendeesByName', type: 'boolean', default: false, description: 'Whether to include non-responded attendees by name' },
					{ displayName: 'Not Responded Attendees By Email', name: 'notRespondedAttendeesByEmail', type: 'boolean', default: false, description: 'Whether to include non-responded attendees by email' },
					{ displayName: 'CRM Account ID', name: 'crmAccountId', type: 'boolean', default: false, description: 'Whether to include the CRM account ID' },
					{ displayName: 'CRM Account Name', name: 'crmAccountName', type: 'boolean', default: false, description: 'Whether to include the CRM account name' },
					{ displayName: 'CRM Opportunity ID', name: 'crmOpportunityId', type: 'boolean', default: false, description: 'Whether to include the CRM opportunity ID' },
					{ displayName: 'CRM Opportunity Name', name: 'crmOpportunityName', type: 'boolean', default: false, description: 'Whether to include the CRM opportunity name' },
					{ displayName: 'CRM Opportunity Owner ID', name: 'crmOpportunityOwnerId', type: 'boolean', default: false, description: 'Whether to include the CRM opportunity owner ID' },
					{ displayName: 'CRM Opportunity Owner Name', name: 'crmOpportunityOwnerName', type: 'boolean', default: false, description: 'Whether to include the CRM opportunity owner name' },
				],
			},

			// ════════════════════════════════════════
			// PROPERTY
			// ════════════════════════════════════════
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['property'] } },
				options: [
					{ name: 'Create', value: 'create', description: 'Create new properties', action: 'Create properties' },
					{ name: 'Delete', value: 'delete', description: 'Delete a property', action: 'Delete a property' },
					{ name: 'Get All', value: 'getAll', description: 'Get all properties', action: 'Get all properties' },
					{ name: 'Update', value: 'update', description: 'Update a property', action: 'Update a property' },
				],
				default: 'getAll',
			},
			{
				displayName: 'Property ID',
				name: 'propertyId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['property'], operation: ['update', 'delete'] },
				},
				description: 'The ID of the property',
			},
			{
				displayName: 'Property Name',
				name: 'propertyName',
				type: 'string',
				default: '',
				displayOptions: {
					show: { resource: ['property'], operation: ['update'] },
				},
				description: 'New name for the property',
			},
			{
				displayName: 'Color',
				name: 'color',
				type: 'options',
				default: 'Blueberry',
				options: PROPERTY_COLORS,
				displayOptions: {
					show: { resource: ['property'], operation: ['update'] },
				},
				description: 'Color for the property',
			},

			// ─── Property Create: Primary ───
			{
				displayName: 'Primary Properties',
				name: 'primaryProperties',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: {
					show: { resource: ['property'], operation: ['create'] },
				},
				description: 'Primary properties to create. Docs: https://timetackle.gitbook.io/tackle',
				options: [
					{
						displayName: 'Property',
						name: 'items',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								required: true,
								default: '',
								description: 'Property name (must be unique, cannot contain ":" or ",")',
							},
							{
								displayName: 'Color',
								name: 'color',
								type: 'options',
								default: 'Blueberry',
								options: PROPERTY_COLORS,
								description: 'Color for the property',
							},
							{
								displayName: 'Children (JSON)',
								name: 'children',
								type: 'json',
								default: '[]',
								description: 'Child properties as JSON array. Example: [{"name": "SubTask", "color": "Flamingo"}]. Max 1-level nesting.',
							},
						],
					},
				],
			},

			// ─── Property Create: Secondary ───
			{
				displayName: 'Secondary Properties',
				name: 'secondaryProperties',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: {
					show: { resource: ['property'], operation: ['create'] },
				},
				description: 'Secondary properties to create. Docs: https://timetackle.gitbook.io/tackle',
				options: [
					{
						displayName: 'Property',
						name: 'items',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								required: true,
								default: '',
								description: 'Property name (must be unique, cannot contain ":" or ",")',
							},
							{
								displayName: 'Color',
								name: 'color',
								type: 'options',
								default: 'Blueberry',
								options: PROPERTY_COLORS,
								description: 'Color for the property',
							},
							{
								displayName: 'Variety',
								name: 'variety',
								type: 'options',
								default: 'SINGLE_SELECT',
								options: SECONDARY_VARIETIES,
								description: 'The type of secondary property',
							},
							{
								displayName: 'Children (JSON)',
								name: 'children',
								type: 'json',
								default: '[]',
								description: 'Child properties as JSON array. Example: [{"name": "Option A", "color": "Sage"}]. Max 1-level nesting.',
							},
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const baseUrl = 'https://api.timetackle.com/external-api/v1';

		for (let i = 0; i < items.length; i++) {
			try {
				let method: IHttpRequestMethods = 'GET';
				let endpoint = '';
				let body: IDataObject = {};
				const qs: IDataObject = {};

				// ─── Export ───
				if (resource === 'export') {
					method = 'POST';
					endpoint = '/export-sheets';
					qs.page = this.getNodeParameter('page', i) as number;
					qs.limit = this.getNodeParameter('limit', i) as number;

					const startDate = this.getNodeParameter('startDate', i) as string;
					const endDate = this.getNodeParameter('endDate', i) as string;
					const mergeAll = this.getNodeParameter('mergeAll', i) as boolean;

					if (startDate) body.startDate = startDate.substring(0, 10);
					if (endDate) body.endDate = endDate.substring(0, 10);
					body.mergeAll = mergeAll;

					// Additional options
					const exportOptions = this.getNodeParameter('exportOptions', i, {}) as IDataObject;
					if (exportOptions.since) body.since = (exportOptions.since as string).substring(0, 10);
					if (exportOptions.groupId) body.groupId = exportOptions.groupId;
					if (exportOptions.calendarIds) {
						body.calendarIds = (exportOptions.calendarIds as string).split(',').map((s) => s.trim());
					}
					if (exportOptions.timezone) body.timezone = exportOptions.timezone;

					// Filters
					const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
					if (Object.keys(filters).length > 0) {
						const filterBody: IDataObject = {};
						if (filters.tag) filterBody.tag = (filters.tag as string).split(',').map((s) => s.trim());
						if (filters.rsvp !== undefined) filterBody.rsvp = filters.rsvp;
						if (filters.allDay) filterBody.allDay = filters.allDay;
						if (filters.search) filterBody.search = (filters.search as string).split(',').map((s) => s.trim());
						if (filters.hasCrmAccount !== undefined) filterBody.hasCrmAccount = filters.hasCrmAccount;
						if (filters.hasCrmOpportunity !== undefined) filterBody.hasCrmOpportunity = filters.hasCrmOpportunity;
						if (filters.hasCrmOpportunityOwner !== undefined) filterBody.hasCrmOpportunityOwner = filters.hasCrmOpportunityOwner;
						if (filters.hasCrmStage !== undefined) filterBody.hasCrmStage = filters.hasCrmStage;
						if (filters.crmAccountTags) filterBody.crmAccountTags = (filters.crmAccountTags as string).split(',').map((s) => s.trim());
						if (filters.crmOpportunityTags) filterBody.crmOpportunityTags = (filters.crmOpportunityTags as string).split(',').map((s) => s.trim());
						if (filters.crmOpportunityOwnerTags) filterBody.crmOpportunityOwnerTags = (filters.crmOpportunityOwnerTags as string).split(',').map((s) => s.trim());
						if (filters.crmStageTags) filterBody.crmStageTags = (filters.crmStageTags as string).split(',').map((s) => s.trim());
						body.filters = filterBody;
					}

					// Formatting
					const formatting = this.getNodeParameter('formatting', i, {}) as IDataObject;
					if (Object.keys(formatting).length > 0) {
						body.formatting = formatting;
					}

					// Fields
					const fields = this.getNodeParameter('fields', i, {}) as IDataObject;
					if (Object.keys(fields).length > 0) {
						body.fields = fields;
					}
				}

				// ─── Property ───
				else if (resource === 'property') {
					if (operation === 'getAll') {
						method = 'GET';
						endpoint = '/properties';
					} else if (operation === 'create') {
						method = 'POST';
						endpoint = '/properties/create';

						const primary: IDataObject[] = [];
						const secondary: IDataObject[] = [];

						const primaryData = this.getNodeParameter('primaryProperties', i, {}) as IDataObject;
						if (primaryData.items) {
							for (const item of primaryData.items as IDataObject[]) {
								const prop: IDataObject = {
									name: item.name as string,
									color: item.color as string,
								};
								if (item.children && item.children !== '[]') {
									prop.children = JSON.parse(item.children as string);
								}
								primary.push(prop);
							}
						}

						const secondaryData = this.getNodeParameter('secondaryProperties', i, {}) as IDataObject;
						if (secondaryData.items) {
							for (const item of secondaryData.items as IDataObject[]) {
								const prop: IDataObject = {
									name: item.name as string,
									color: item.color as string,
									variety: item.variety as string,
								};
								if (item.children && item.children !== '[]') {
									prop.children = JSON.parse(item.children as string);
								}
								secondary.push(prop);
							}
						}

						body = { primary, secondary };
					} else if (operation === 'update') {
						method = 'POST';
						const id = this.getNodeParameter('propertyId', i) as string;
						endpoint = `/property/${id}/update`;
						const name = this.getNodeParameter('propertyName', i) as string;
						const color = this.getNodeParameter('color', i) as string;
						if (name) body.name = name;
						if (color) body.color = color;
					} else if (operation === 'delete') {
						method = 'POST';
						const id = this.getNodeParameter('propertyId', i) as string;
						endpoint = `/property/${id}/delete`;
					}
				}

				// ─── Execute request ───
				const responseData = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'timeTackleApi',
					{
						method,
						url: `${baseUrl}${endpoint}`,
						qs,
						body,
						json: true,
					},
				) as IDataObject;

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);

			} catch (error) {
				if (this.continueOnFail()) {
					const executionErrorData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: (error as Error).message }),
						{ itemData: { item: i } },
					);
					returnData.push(...executionErrorData);
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
