import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface ModuleAttributes {
  id: string
  name: string
  key: string
  description: string | null
  created_at: Date
  updated_at: Date
}

export class Module extends Model<ModuleAttributes> implements ModuleAttributes {
  declare id: string
  declare name: string
  declare key: string
  declare description: string | null
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
    key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
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
