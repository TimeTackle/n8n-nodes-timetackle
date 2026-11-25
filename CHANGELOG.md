# Changelog

## 0.3.0

- New node: **TimeTackle Trigger** with New Event, New Tagged Event, New Tag or Property, New Member and New Team.
- New resources in the TimeTackle node: **Event** (Get Many), **Member** (Get Many, Invite, Update, Remove) and
  **Team** (Get Many).
- **Property** (node version 2): Create takes one tag or property with its type, color and options; Get Many filters
  by name or type and returns one item per tag, property, sub-tag or option; Update and Delete pick the tag or
  property from a list.
- Calendars, teams, members, tags and properties are picked from lists loaded from the workspace.
- Errors show TimeTackle's message; an invalid API key and a busy endpoint are reported as such.
- The credential test reads the workspace owner instead of the full property list.
- Workflows saved with 0.2.x keep running unchanged on node version 1.
- Built, linted and released with `n8n-node` (`@n8n/node-cli`).

## 0.2.1

- Export filters, formatting and fields; dynamic property forms; icon.
