import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'
import { InternalUser } from './InternalUser'

export interface MagicLinkAttributes {
  id: string
  token: string
  otp: string
  email: string
  internal_user_id: string | null
  purpose: 'login' | 'totp_enrollment'
  consumed_at: Date | null
  expires_at: Date
  created_at: Date
  updated_at: Date
}

export class MagicLink extends Model<MagicLinkAttributes> implements MagicLinkAttributes {
  declare id: string
  declare token: string
  declare otp: string
  declare email: string
  declare internal_user_id: string | null
  declare purpose: 'login' | 'totp_enrollment'
  declare consumed_at: Date | null
  declare expires_at: Date
  declare created_at: Date
  declare updated_at: Date
}

MagicLink.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    token: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    otp: { type: DataTypes.STRING(6), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    internal_user_id: { type: DataTypes.UUID, allowNull: true },
    purpose: {
      type: DataTypes.ENUM('login', 'totp_enrollment'),
      allowNull: false,
    },
    consumed_at: { type: DataTypes.DATE, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'magic_links',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_magic_links_internal_user_purpose',
        fields: ['internal_user_id', 'purpose', 'consumed_at'],
      },
    ],
  },
)

MagicLink.belongsTo(InternalUser, {
  foreignKey: 'internal_user_id',
  as: 'internalUser',
})
