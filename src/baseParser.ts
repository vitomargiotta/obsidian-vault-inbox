import { parseYaml } from 'obsidian';

export type FilterNode =
	| { kind: 'and' | 'or'; children: FilterNode[] }
	| { kind: 'eq' | 'neq'; lhs: Lhs; rhs: PrimitiveValue }
	| { kind: 'always' }
	| { kind: 'unsupported'; raw: string };

export type Lhs =
	| { kind: 'fileFolder' }
	| { kind: 'fileName' }
	| { kind: 'filePath' }
	| { kind: 'property'; name: string };

export type PrimitiveValue = string | number | boolean | null;

export interface ParsedBase {
	scopeFolders: string[];
	filter: FilterNode;
	warnings: string[];
}

export function parseBase(content: string): ParsedBase {
	const warnings: string[] = [];
	let raw: unknown;
	try {
		raw = parseYaml(content);
	} catch (e) {
		warnings.push(`Could not parse base YAML: ${(e as Error).message}`);
		return { scopeFolders: [], filter: { kind: 'always' }, warnings };
	}

	const root = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
	const collected: FilterNode[] = [];

	if (root.filters !== undefined) {
		collected.push(parseFilterValue(root.filters, warnings));
	}

	const views = Array.isArray(root.views) ? root.views : [];
	if (views.length > 1) {
		warnings.push(`Base has ${views.length} views; only the first one's filters are used.`);
	}
	const firstView = views[0];
	if (firstView && typeof firstView === 'object' && (firstView as Record<string, unknown>).filters !== undefined) {
		collected.push(parseFilterValue((firstView as Record<string, unknown>).filters, warnings));
	}

	const filter: FilterNode = collected.length === 0
		? { kind: 'always' }
		: collected.length === 1
			? collected[0]!
			: { kind: 'and', children: collected };

	const scopeFolders = extractFolderScopes(filter);

	return { scopeFolders, filter, warnings };
}

function parseFilterValue(value: unknown, warnings: string[]): FilterNode {
	if (typeof value === 'string') return parseAtom(value, warnings);
	if (Array.isArray(value)) {
		return { kind: 'and', children: value.map(v => parseFilterValue(v, warnings)) };
	}
	if (value && typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		if ('and' in obj) {
			const arr = Array.isArray(obj.and) ? obj.and : [];
			return { kind: 'and', children: arr.map(v => parseFilterValue(v, warnings)) };
		}
		if ('or' in obj) {
			const arr = Array.isArray(obj.or) ? obj.or : [];
			return { kind: 'or', children: arr.map(v => parseFilterValue(v, warnings)) };
		}
		warnings.push(`Unrecognized filter object: ${JSON.stringify(obj)}`);
		return { kind: 'unsupported', raw: JSON.stringify(obj) };
	}
	warnings.push(`Unrecognized filter value: ${String(value)}`);
	return { kind: 'unsupported', raw: String(value) };
}

const ATOM_RE = /^\s*(\S+?)\s*(==|!=)\s*(.+?)\s*$/;

function parseAtom(expr: string, warnings: string[]): FilterNode {
	const m = expr.match(ATOM_RE);
	if (!m) {
		warnings.push(`Unsupported filter expression: ${expr}`);
		return { kind: 'unsupported', raw: expr };
	}
	const lhsStr = m[1]!;
	const op = m[2]!;
	const rhsStr = m[3]!;
	const lhs = parseLhs(lhsStr);
	if (!lhs) {
		warnings.push(`Unsupported filter LHS: ${lhsStr}`);
		return { kind: 'unsupported', raw: expr };
	}
	const rhs = parsePrimitive(rhsStr);
	if (rhs === undefined) {
		warnings.push(`Unsupported filter RHS: ${rhsStr}`);
		return { kind: 'unsupported', raw: expr };
	}
	return { kind: op === '==' ? 'eq' : 'neq', lhs, rhs };
}

function parseLhs(s: string): Lhs | undefined {
	if (s === 'file.folder') return { kind: 'fileFolder' };
	if (s === 'file.name') return { kind: 'fileName' };
	if (s === 'file.path') return { kind: 'filePath' };
	if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(s)) return { kind: 'property', name: s };
	return undefined;
}

function parsePrimitive(s: string): PrimitiveValue | undefined {
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return s.slice(1, -1);
	}
	if (s === 'true') return true;
	if (s === 'false') return false;
	if (s === 'null') return null;
	const n = Number(s);
	if (!Number.isNaN(n) && s.trim() !== '') return n;
	return undefined;
}

function extractFolderScopes(node: FilterNode): string[] {
	// Collect file.folder == "X" constraints reachable via top-level AND chains.
	const folders = new Set<string>();
	const visit = (n: FilterNode, inAnd: boolean): void => {
		if (n.kind === 'and') {
			for (const c of n.children) visit(c, true);
		} else if (n.kind === 'eq' && n.lhs.kind === 'fileFolder' && typeof n.rhs === 'string' && inAnd) {
			folders.add(n.rhs);
		}
		// `or` branches don't yield a single scope; skip.
	};
	visit(node, true);
	return [...folders];
}
