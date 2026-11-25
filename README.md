# n8n-nodes-timetackle

n8n community nodes for [TimeTackle](https://timetackle.com), the workforce analytics and calendar platform. They call
the [TimeTackle API](https://timetackle.gitbook.io/tackle) (`https://api.timetackle.com/external-api/v1`) with the
workspace API key, and offer the same triggers, actions and searches as the TimeTackle Zapier app.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community
nodes documentation and install `@timetackle/n8n-nodes-timetackle`.

## Credentials

1. In TimeTackle, an owner or admin opens **Settings > Developer** and copies the workspace API key. API access is
   included in every paid plan.
2. In n8n, open **Credentials > Add credential**, search for **TimeTackle API** and paste the key into **API Key**.
3. Click **Save**. n8n tests the key by reading the workspace owner; a wrong key fails the test.

The key is sent in the `X-Tackle-Api-Key` header of every request, never in the URL.

## What it does

### TimeTackle Trigger

Checks TimeTackle on the schedule set in **Poll Times** and starts the workflow once for each new record.

| Trigger On | Fires when | Filters |
| --- | --- | --- |
| New Event | A calendar event is added to TimeTackle, including manual time entries | Calendars, team, time zone |
| New Tagged Event | An event gets a chosen tag or property value | Tag (required), calendars, team, time zone |
| New Tag or Property | A tag or property is created | Type, include sub-tags and options |
| New Member | Someone is invited to or joins the workspace | Status, role |
| New Team | A team (calendar group) is created | |

Event triggers read every event that changed in the last 2 days, from 30 days back to 90 days ahead.
The node remembers the records it has sent, so each fires once. Records that the first check returns do not fire.
An older event that is edited later is new to the node, so New Event fires for it once; the TimeTackle Zapier app
does the same. A test run returns one record.

### TimeTackle

| Resource | Operation | What it does |
| --- | --- | --- |
| Event | Get Many | Finds calendar events in a date range, by calendar, team, tag or text |
| Export | Export Calendar Data | Exports one page of calendar events with every export filter, format and field option |
| Member | Get Many | Finds members by email, status or role |
| Member | Invite | Invites a person and emails them the invitation |
| Member | Update | Changes a member's name, role or calendar access |
| Member | Remove | Removes a member or cancels a pending invite |
| Property | Create | Creates a tag or property; one with the same name is updated instead of duplicated |
| Property | Get Many | Finds tags, properties, sub-tags and options by name or type |
| Property | Update | Renames or recolors a tag, property, sub-tag or option |
| Property | Delete | Deletes a tag, property, sub-tag or option |
| Team | Get Many | Finds teams (calendar groups) by name |

Calendars, teams, members, tags and properties are picked from lists loaded from the workspace.

### Workflows saved with version 0.2.x

The TimeTackle node is now at node version 2. Workflows saved with 0.2.x stay on node version 1 and run as before:
Property > Create still takes primary and secondary properties, Property > Get Many still returns the
`{primary, secondary}` list, and Export still reads 100 rows per page unless Limit was changed.

## Usage examples

### Add a row for every tagged meeting (trigger)

Add **TimeTackle Trigger** as the first node and set:

| Parameter | Value |
| --- | --- |
| Credential | your TimeTackle API credential |
| Poll Times | Every X, 15 minutes |
| Trigger On | New Tagged Event |
| Tag Name or ID | `Client:Acme` (picked from the list of your tags and their values) |
| Calendar Names or IDs | leave empty for every calendar, or pick the calendars to watch |
| Team Name or ID | All Teams, or pick a team to watch only its calendars |
| Time Zone | `Europe/Berlin` |

Click **Fetch Test Event** to load one matching event from the last 30 days to the next 90. Each item looks like
this:

```json
{
  "id": "jane@acme.com:0d842cd5-cbc1-4ab2-9943-f1307f214b14",
  "calendar": "Jane Doe",
  "calendarId": "jane@acme.com",
  "eventId": "0d842cd5-cbc1-4ab2-9943-f1307f214b14",
  "subject": "Weekly sync with Acme",
  "description": "Agenda in the doc",
  "location": "Zoom",
  "startDate": "11/02/2026",
  "startTime": "10:00 AM",
  "endDate": "11/02/2026",
  "endTime": "10:30 AM",
  "duration": "0.5",
  "createdDate": "10/28/2026",
  "createdTime": "09:12 AM",
  "organizedByEmail": "jane@acme.com",
  "allAttendeesByEmail": "jane@acme.com,sam@client.com",
  "source": "Google Calendar",
  "tags": "Client:Acme,Billable",
  "crmAccountName": "Acme",
  "crmOpportunityName": "Acme renewal"
}
```

Connect **Google Sheets > Append Row** and map `{{ $json.subject }}`, `{{ $json.startDate }}`, `{{ $json.duration }}`
and `{{ $json.tags }}`. Activate the workflow: from then on each event tagged `Client:Acme` adds one row.

### Invite a new hire (action)

After a trigger that carries the person's name and email (a form, an HR tool), add **TimeTackle** and set:

| Parameter | Value |
| --- | --- |
| Resource | Member |
| Operation | Invite |
| Name | `{{ $json.name }}` |
| Email | `{{ $json.email }}` |
| Role | Contributor |
| Calendar Access > Connects Their Own Calendar | on |
| Calendar Access > Team Names or IDs | Sales |

TimeTackle emails the invitation and the node returns the member:

```json
{
  "id": 345,
  "name": "Jane Doe",
  "email": "jane@acme.com",
  "role": "CONTRIBUTOR",
  "status": "PENDING",
  "access": { "allCalendars": false, "connectOwnCalendar": true, "teamIds": [12], "calendarIds": [], "userIds": [] }
}
```

Admins always see all calendars, so an Admin invite needs no Calendar Access. Every other role needs at least one
Calendar Access field.

### Find last week's meetings for a client (search)

| Parameter | Value |
| --- | --- |
| Resource | Event |
| Operation | Get Many |
| From | `{{ $today.minus({ days: 7 }) }}` |
| To | `{{ $today }}` |
| Return All | on |
| Filters > Tag Name or ID | `Client:Acme` |
| Filters > Text | `renewal` (optional: only events whose title contains it) |

The node returns one item per event per calendar, in the shape shown above. Add **Summarize** to total `duration`.

### Keep tags in step with another tool

| Parameter | Value |
| --- | --- |
| Resource | Property |
| Operation | Create |
| Name | `{{ $json.projectName }}` |
| Type | Tag |
| Additional Fields > Sub-Tags or Options | `Design`, `Build` |

A tag with the same name is updated instead of duplicated, so the workflow can run for every project without a
lookup first. The node returns the tag with its id and the ids of its sub-tags.

### Errors

A failed request stops the node with TimeTackle's own message, for example "OWNER members cannot be removed"; a
wrong or inactive key says "Your TimeTackle API key is invalid or inactive." In the node's **Settings**, set
**On Error** to continue to get `{ "error": "..." }` as the item instead. TimeTackle handles one request per endpoint
at a time for a workspace: an action that hits a busy endpoint fails and says to try again in a minute (turn on
**Retry On Fail**), and a trigger skips that poll and catches up on the next one.

## Develop

Needs Node.js 22 or later.

```bash
npm install
npm test
npm run lint
npm run build
```

`npm test` runs every trigger, operation and dropdown against mocked HTTP. `npm run lint` is `n8n-node lint`, the
rules n8n applies to verified community nodes. Before a release, also run n8n's package scan on the build:

```bash
npx @n8n/scan-community-package .
```

To try the nodes in a local n8n at http://localhost:5678 (it asks for a local owner account the first time):

```bash
npm run dev
```

## Release

Set the new version in `package.json` and add its notes to `CHANGELOG.md` in the pull request. After it is merged:

```bash
git tag v0.3.0
git push origin v0.3.0
```

Pushing the `v*` tag runs `.github/workflows/publish.yml`, which lints, tests, builds and publishes to npm with a
provenance statement (n8n requires this for verified nodes). It needs the `NPM_AUTH_TOKEN` repository secret.

To list the nodes in n8n's node panel, submit the package for verification in the
[n8n Creator Portal](https://creators.n8n.io/nodes).

## Resources

- [TimeTackle API documentation](https://timetackle.gitbook.io/tackle)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
