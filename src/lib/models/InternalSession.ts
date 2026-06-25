import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'
import { InternalUser } from './InternalUser'

export interface InternalSessionAttributes {
  id: string
  internal_user_id: string
  token_hash: string
  expires_at: Date
  idle_expires_at: Date
  created_at: Date
  last_activity_at: Date
  ip_address: string
  user_agent: string
}

export class InternalSession extends Model<InternalSessionAttributes> implements InternalSessionAttributes {
  declare id: string
  declare internal_user_id: string
  declare token_hash: string
  declare expires_at: Date
  declare idle_expires_at: Date
  declare created_at: Date
  declare last_activity_at: Date
  declare ip_address: string
  declare user_agent: string
}

InternalSession.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    internal_user_id: { type: DataTypes.UUID, allowNull: false },
    token_hash: { type: DataTypes.CHAR(64), allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    idle_expires_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    last_activity_at: { type: DataTypes.DATE, allowNull: false },
    ip_address: { type: DataTypes.STRING(45), allowNull: false },
    user_agent: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    sequelize,
    tableName: 'internal_sessions',
    timestamps: true,
    underscored: true,
  },
)

InternalSession.belongsTo(InternalUser, {
  foreignKey: 'internal_user_id',
  as: 'internalUser',
})
