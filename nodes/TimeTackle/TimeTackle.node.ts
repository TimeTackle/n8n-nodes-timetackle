import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

export class TimeTackle implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TimeTackle',
		name: 'timeTackle',
		icon: 'file:timetackle.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with the TimeTackle API — export calendar data and manage properties',
		defaults: {
			name: 'TimeTackle',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
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

			// ────────────────────────────────────────
			// EXPORT operations
			// ────────────────────────────────────────
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
				displayOptions: { show: { resource: ['export'], operation: ['exportSheets'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 100,
				required: true,
				description: 'Number of results per page (max 500)',
				typeOptions: { maxValue: 500, minValue: 1 },
				displayOptions: { show: { resource: ['export'], operation: ['exportSheets'] } },
			},
			{
				displayName: 'Start Date',
				name: 'startDate',
				type: 'dateTime',
				default: '',
				description: 'Filter events starting from this date',
				displayOptions: { show: { resource: ['export'], operation: ['exportSheets'] } },
			},
			{
				displayName: 'End Date',
				name: 'endDate',
				type: 'dateTime',
				default: '',
				description: 'Filter events up to this date',
				displayOptions: { show: { resource: ['export'], operation: ['exportSheets'] } },
			},
			{
				displayName: 'Since',
				name: 'since',
				type: 'dateTime',
				default: '',
				description: 'Return events updated since this timestamp',
				displayOptions: { show: { resource: ['export'], operation: ['exportSheets'] } },
			},
			{
				displayName: 'Merge All',
				name: 'mergeAll',
				type: 'boolean',
				default: true,
				description: 'Whether to merge all calendar results into a single list',
				displayOptions: { show: { resource: ['export'], operation: ['exportSheets'] } },
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'json',
				default: '{}',
				description: 'Additional export body parameters as JSON (tags, fields, formatting, etc.)',
				displayOptions: { show: { resource: ['export'], operation: ['exportSheets'] } },
			},

			// ────────────────────────────────────────
			// PROPERTY operations
			// ────────────────────────────────────────
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
				default: 'BLUE',
				options: [
					{ name: 'Blue', value: 'BLUE' },
					{ name: 'Green', value: 'GREEN' },
					{ name: 'Red', value: 'RED' },
					{ name: 'Yellow', value: 'YELLOW' },
					{ name: 'Purple', value: 'PURPLE' },
					{ name: 'Orange', value: 'ORANGE' },
					{ name: 'Cyan', value: 'CYAN' },
					{ name: 'Pink', value: 'PINK' },
				],
				displayOptions: {
					show: { resource: ['property'], operation: ['update'] },
				},
				description: 'Color for the property',
			},
			{
				displayName: 'Properties JSON',
				name: 'propertiesJson',
				type: 'json',
				default: '{"properties": []}',
				required: true,
				displayOptions: {
					show: { resource: ['property'], operation: ['create'] },
				},
				description: 'JSON body with primary and secondary properties to create',
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
				let responseData: IDataObject | IDataObject[];
				let method: IHttpRequestMethods = 'GET';
				let endpoint = '';
				let body: IDataObject = {};
				let qs: IDataObject = {};

				// ─── Export ───
				if (resource === 'export') {
					method = 'POST';
					endpoint = '/export-sheets';
					qs.page = this.getNodeParameter('page', i) as number;
					qs.limit = this.getNodeParameter('limit', i) as number;

					const startDate = this.getNodeParameter('startDate', i) as string;
					const endDate = this.getNodeParameter('endDate', i) as string;
					const since = this.getNodeParameter('since', i) as string;
					const mergeAll = this.getNodeParameter('mergeAll', i) as boolean;
					const additionalFields = this.getNodeParameter('additionalFields', i) as string;

					if (startDate) body.startDate = startDate;
					if (endDate) body.endDate = endDate;
					if (since) body.since = since;
					body.mergeAll = mergeAll;

					if (additionalFields && additionalFields !== '{}') {
						const parsed = JSON.parse(additionalFields) as IDataObject;
						Object.assign(body, parsed);
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
						body = JSON.parse(this.getNodeParameter('propertiesJson', i) as string) as IDataObject;
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
				const requestOptions: IDataObject = {
					method,
					url: `${baseUrl}${endpoint}`,
					qs,
					body,
					json: true,
				};

				responseData = await this.helpers.requestWithAuthentication.call(
					this,
					'timeTackleApi',
					requestOptions,
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
