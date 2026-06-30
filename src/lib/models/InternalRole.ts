import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface InternalRoleAttributes {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export class InternalRole extends Model<InternalRoleAttributes> implements InternalRoleAttributes {
  declare id: string
  declare name: string
  declare description: string | null
  declare is_active: boolean
  declare created_at: Date
  declare updated_at: Date
}

InternalRole.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'internal_roles',
    timestamps: true,
    underscored: true,
  },
)