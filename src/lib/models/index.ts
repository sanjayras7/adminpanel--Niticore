import { InternalUser } from './InternalUser'
import { InternalRole } from './InternalRole'
import { MagicLink } from './MagicLink'
import { InternalAuditEvent } from './InternalAuditEvent'

export { InternalUser, InternalRole, MagicLink }

export function initModels(): void {
  InternalUser;
  InternalRole;
  MagicLink;
}
