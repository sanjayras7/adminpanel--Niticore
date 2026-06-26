import { InternalUser } from './InternalUser'
import { InternalRole } from './InternalRole'
import { MagicLink } from './MagicLink'
import { InternalAuditEvent } from './InternalAuditEvent'
import { InternalSession } from './InternalSession'

export { InternalUser, InternalRole, MagicLink, InternalAuditEvent, InternalSession }

export function initModels(): void {
  InternalUser;
  InternalRole;
  MagicLink;
  InternalAuditEvent;
  InternalSession;
}
