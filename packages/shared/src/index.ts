// Barrel for @tg/shared — framework-agnostic types/schemas/constants imported
// by both apps/web and apps/server (spec/file-structure's module-boundary
// rule: no I/O, no drizzle, no fetch, no ws in this package).

export * from './csrf.js';
export * from './domain/index.js';
export * from './dto/index.js';
export * from './ws-envelope/index.js';

// TODO(TG-3): apps/server/src/main.ts's placeholder still imports this ahead
// of the Fastify-skeleton issue landing. Kept for now so that in-progress
// branch doesn't break on rebase; remove once TG-3 merges and drops the import.
export const SHARED_PACKAGE_PLACEHOLDER = 'tg-shared';
