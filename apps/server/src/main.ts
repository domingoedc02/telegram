// Placeholder entrypoint for apps/server.
// The real Fastify app factory (createServer()), plugin registration, env
// parsing and listen() wiring land with TG-3 (Fastify server skeleton).

import { SHARED_PACKAGE_PLACEHOLDER } from '@tg/shared';

export function placeholderMain(): string {
  return `tg-server placeholder, shared package: ${SHARED_PACKAGE_PLACEHOLDER}`;
}
