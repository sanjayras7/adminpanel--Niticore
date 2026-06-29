import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface ControlStepCategoryAttributes {
  id: string
  name: string
  description: string | null
  created_at: Date
  updated_at: Date
}

export class ControlStepCategory extends Model<ControlStepCategoryAttributes> implements ControlStepCategoryAttributes {
  declare id: string
  declare name: string
  declare description: string | null
  declare created_at: Date
  declare updated_at: Date
}

ControlStepCategory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'control_step_categories',
    timestamps: true,
    underscored: true,
  },
)
