import { InternalUser } from './InternalUser'
import { InternalRole } from './InternalRole'
import { MagicLink } from './MagicLink'
import { InternalSession } from './InternalSession'

export { InternalUser, InternalRole, MagicLink, InternalSession }

export function initModels(): void {
  InternalUser;
  InternalRole;
  MagicLink;
  InternalSession;
}
