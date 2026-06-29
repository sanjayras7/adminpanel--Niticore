import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface NotificationAttributes {
  id: string
  recipient_id: string
  organization_id: string | null
  lead_id: string | null
  title: string
  body: string
  channel: 'in_app' | 'email'
  read_at: Date | null
  metadata: Record<string, unknown> | null
  created_at: Date
}

export class Notification extends Model<NotificationAttributes> implements NotificationAttributes {
  declare id: string
  declare recipient_id: string
  declare organization_id: string | null
  declare lead_id: string | null
  declare title: string
  declare body: string
  declare channel: 'in_app' | 'email'
  declare read_at: Date | null
  declare metadata: Record<string, unknown> | null
  declare created_at: Date
}

Notification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    recipient_id: { type: DataTypes.UUID, allowNull: false },
    organization_id: { type: DataTypes.UUID, allowNull: true },
    lead_id: { type: DataTypes.UUID, allowNull: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    channel: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    read_at: { type: DataTypes.DATE, allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'notifications',
    timestamps: false,
    underscored: true,
  },
)
