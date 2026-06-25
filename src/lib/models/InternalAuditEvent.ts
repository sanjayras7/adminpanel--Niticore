import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface InternalAuditEventAttributes {
  id: string
  actor_internal_user_id: string
  actor_role: string | null
  action: string
  target_type: string
  target_id: string
  organization_id: string | null
  lead_id: string | null
  before_values: object | null
  after_values: object | null
  reason: string | null
  metadata: object | null
  ip_address: string | null
  user_agent: string | null
  created_at: Date
}

export class InternalAuditEvent extends Model<InternalAuditEventAttributes> implements InternalAuditEventAttributes {
  declare id: string
  declare actor_internal_user_id: string
  declare actor_role: string | null
  declare action: string
  declare target_type: string
  declare target_id: string
  declare organization_id: string | null
  declare lead_id: string | null
  declare before_values: object | null
  declare after_values: object | null
  declare reason: string | null
  declare metadata: object | null
  declare ip_address: string | null
  declare user_agent: string | null
  declare created_at: Date
}

InternalAuditEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    actor_internal_user_id: { type: DataTypes.UUID, allowNull: false },
    actor_role: { type: DataTypes.STRING(255), allowNull: true },
    action: { type: DataTypes.STRING(255), allowNull: false },
    target_type: { type: DataTypes.STRING(255), allowNull: false },
    target_id: { type: DataTypes.STRING(255), allowNull: false },
    organization_id: { type: DataTypes.UUID, allowNull: true },
    lead_id: { type: DataTypes.UUID, allowNull: true },
    before_values: { type: DataTypes.JSONB, allowNull: true },
    after_values: { type: DataTypes.JSONB, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: true },
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
    user_agent: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'internal_audit_events',
    timestamps: false,
    underscored: true,
  },
)
