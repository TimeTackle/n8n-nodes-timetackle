// Remembers which records a trigger has already sent, in the workflow's static data, so each fires once.

import type { IDataObject } from 'n8n-workflow';

const dayNumber = (now: number): number => Math.floor(now / 86_400_000);

export interface SeenOptions {
	// What the trigger is watching (event and filters). The memory starts over when it changes.
	signature: string;
	// Forget an id this many days after it last appeared in a poll. Leave out for lists that are read in full.
	forgetAfterDays?: number;
	now?: number;
}

// Returns the records not seen before and remembers them. The first poll only remembers: records that already
// exist when the workflow is activated do not fire.
export function takeNew(state: IDataObject, records: IDataObject[], options: SeenOptions): IDataObject[] {
	const today = dayNumber(options.now ?? Date.now());
	const firstPoll = state.signature !== options.signature;
	const seen: Record<string, number> = firstPoll ? {} : { ...((state.seen as Record<string, number>) || {}) };

	const fresh: IDataObject[] = [];
	for (const record of records) {
		const id = String(record.id);
		if (!(id in seen)) fresh.push(record);
		seen[id] = today;
	}

	if (options.forgetAfterDays !== undefined) {
		for (const id of Object.keys(seen)) {
			if (today - seen[id] > options.forgetAfterDays) delete seen[id];
		}
	}

	state.signature = options.signature;
	state.seen = seen;
	return firstPoll ? [] : fresh;
}
