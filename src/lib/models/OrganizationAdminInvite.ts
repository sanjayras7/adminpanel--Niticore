import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'
import { InternalUser } from './InternalUser'

export interface OrganizationAdminInviteAttributes {
  id: string
  organization_id: string
  internal_user_id: string
  status: 'pending' | 'sent' | 'accepted' | 'expired'
  invited_by: string | null
  expires_at: Date
  created_at: Date
  updated_at: Date
}

export class OrganizationAdminInvite
  extends Model<OrganizationAdminInviteAttributes>
  implements OrganizationAdminInviteAttributes
{
  declare id: string
  declare organization_id: string
  declare internal_user_id: string
  declare status: 'pending' | 'sent' | 'accepted' | 'expired'
  declare invited_by: string | null
  declare expires_at: Date
  declare created_at: Date
  declare updated_at: Date
}

OrganizationAdminInvite.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    internal_user_id: { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'accepted', 'expired'),
      allowNull: false,
      defaultValue: 'pending',
    },
    invited_by: { type: DataTypes.UUID, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'organization_admin_invites',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_org_admin_invites_org_user',
        fields: ['organization_id', 'internal_user_id'],
      },
    ],
  },
)

OrganizationAdminInvite.belongsTo(InternalUser, {
  foreignKey: 'internal_user_id',
  as: 'internalUser',
})

OrganizationAdminInvite.belongsTo(InternalUser, {
  foreignKey: 'invited_by',
  as: 'invitedByUser',
})
