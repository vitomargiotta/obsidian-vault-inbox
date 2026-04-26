import { FilterNode, Lhs, PrimitiveValue } from './baseParser';

export interface EvalContext {
	filePath: string;
	fileFolder: string;
	fileName: string;
	frontmatter: Record<string, unknown> | undefined;
}

export type EvalResult = 'match' | 'no-match' | 'pending';

// 'pending' means a property filter referenced frontmatter that isn't loaded
// yet. The caller should wait for metadataCache to populate and re-evaluate.
export function evalFilter(node: FilterNode, ctx: EvalContext): EvalResult {
	switch (node.kind) {
		case 'always':
			return 'match';
		case 'unsupported':
			// Treat unsupported branches as "match" so we don't drop notifications
			// silently — the user has been warned in settings.
			return 'match';
		case 'and': {
			let pending = false;
			for (const c of node.children) {
				const r = evalFilter(c, ctx);
				if (r === 'no-match') return 'no-match';
				if (r === 'pending') pending = true;
			}
			return pending ? 'pending' : 'match';
		}
		case 'or': {
			let pending = false;
			for (const c of node.children) {
				const r = evalFilter(c, ctx);
				if (r === 'match') return 'match';
				if (r === 'pending') pending = true;
			}
			return pending ? 'pending' : 'no-match';
		}
		case 'eq':
		case 'neq': {
			const lhs = lhsValue(node.lhs, ctx);
			if (lhs.kind === 'pending') return 'pending';
			const eq = primitiveEq(lhs.value, node.rhs);
			return ((node.kind === 'eq') === eq) ? 'match' : 'no-match';
		}
	}
}

type LhsResolved =
	| { kind: 'value'; value: PrimitiveValue | undefined }
	| { kind: 'pending' };

function lhsValue(lhs: Lhs, ctx: EvalContext): LhsResolved {
	switch (lhs.kind) {
		case 'fileFolder': return { kind: 'value', value: ctx.fileFolder };
		case 'fileName': return { kind: 'value', value: ctx.fileName };
		case 'filePath': return { kind: 'value', value: ctx.filePath };
		case 'property': {
			if (ctx.frontmatter === undefined) return { kind: 'pending' };
			const v = ctx.frontmatter[lhs.name];
			return { kind: 'value', value: coerce(v) };
		}
	}
}

function coerce(v: unknown): PrimitiveValue | undefined {
	if (v === null) return null;
	if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
	return undefined;
}

function primitiveEq(a: PrimitiveValue | undefined, b: PrimitiveValue): boolean {
	if (a === undefined) return false;
	return a === b;
}
