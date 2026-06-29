import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface ModuleAttributes {
  id: string
  name: string
  description: string | null
  key: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export class Module extends Model<ModuleAttributes> implements ModuleAttributes {
  declare id: string
  declare name: string
  declare description: string | null
  declare key: string
  declare is_active: boolean
  declare created_at: Date
  declare updated_at: Date
}

Module.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'modules',
    timestamps: true,
    underscored: true,
  },
)
