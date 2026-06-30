import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface ImpersonationSessionAttributes {
  id: string
  actor_internal_user_id: string
  organization_id: string
  impersonated_user_id: string | null
  reason: string
  started_at: Date
  ended_at: Date | null
  expires_at: Date
  status: 'active' | 'ended' | 'expired'
  metadata: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

export class ImpersonationSession extends Model<ImpersonationSessionAttributes> implements ImpersonationSessionAttributes {
  declare id: string
  declare actor_internal_user_id: string
  declare organization_id: string
  declare impersonated_user_id: string | null
  declare reason: string
  declare started_at: Date
  declare ended_at: Date | null
  declare expires_at: Date
  declare status: 'active' | 'ended' | 'expired'
  declare metadata: Record<string, unknown>
  declare created_at: Date
  declare updated_at: Date
}

ImpersonationSession.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    actor_internal_user_id: { type: DataTypes.UUID, allowNull: false },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    impersonated_user_id: { type: DataTypes.UUID, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: false },
    started_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ended_at: { type: DataTypes.DATE, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    status: {
      type: DataTypes.ENUM('active', 'ended', 'expired'),
      allowNull: false,
      defaultValue: 'active',
    },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'impersonation_sessions',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_impersonation_sessions_active_actor',
        unique: true,
        fields: ['actor_internal_user_id'],
        where: { status: 'active' },
      },
    ],
  },
)
