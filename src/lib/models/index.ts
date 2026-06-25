import { InternalUser } from './InternalUser'
import { MagicLink } from './MagicLink'
import { InternalAuditEvent } from './InternalAuditEvent'

export { InternalUser, MagicLink, InternalAuditEvent }

export function initModels(): void {
  InternalUser;
  MagicLink;
  InternalAuditEvent;
}
