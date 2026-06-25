import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface InternalUserAttributes {
  id: string
  name: string
  surname: string
  email: string
  internal_role_id: string | null
  status: 'active' | 'inactive' | 'locked'
  totp_enabled: boolean
  totp_secret_encrypted: string | null
  totp_enrolled_at: Date | null
  last_login_at: Date | null
  last_totp_verified_at: Date | null
  failed_totp_attempt_count: number
  locked_until: Date | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export class InternalUser extends Model<InternalUserAttributes> implements InternalUserAttributes {
  declare id: string
  declare name: string
  declare surname: string
  declare email: string
  declare internal_role_id: string | null
  declare status: 'active' | 'inactive' | 'locked'
  declare totp_enabled: boolean
  declare totp_secret_encrypted: string | null
  declare totp_enrolled_at: Date | null
  declare last_login_at: Date | null
  declare last_totp_verified_at: Date | null
  declare failed_totp_attempt_count: number
  declare locked_until: Date | null
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

InternalUser.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    surname: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    internal_role_id: { type: DataTypes.UUID, allowNull: true },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'locked'),
      allowNull: false,
      defaultValue: 'active',
    },
    totp_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    totp_secret_encrypted: { type: DataTypes.TEXT, allowNull: true },
    totp_enrolled_at: { type: DataTypes.DATE, allowNull: true },
    last_login_at: { type: DataTypes.DATE, allowNull: true },
    last_totp_verified_at: { type: DataTypes.DATE, allowNull: true },
    failed_totp_attempt_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    locked_until: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'internal_users',
    timestamps: true,
    underscored: true,
    paranoid: true,
  },
)
