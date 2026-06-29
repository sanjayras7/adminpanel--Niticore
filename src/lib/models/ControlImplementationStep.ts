import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface ControlImplementationStepAttributes {
  id: string
  control_version_id: string
  step_code: string
  title: string
  description: string | null
  category_id: string | null
  sort_order: number
  created_at: Date
  updated_at: Date
}

export class ControlImplementationStep extends Model<ControlImplementationStepAttributes> implements ControlImplementationStepAttributes {
  declare id: string
  declare control_version_id: string
  declare step_code: string
  declare title: string
  declare description: string | null
  declare category_id: string | null
  declare sort_order: number
  declare created_at: Date
  declare updated_at: Date
}

ControlImplementationStep.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    control_version_id: { type: DataTypes.UUID, allowNull: false },
    step_code: { type: DataTypes.STRING(50), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    category_id: { type: DataTypes.UUID, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'control_implementation_steps',
    timestamps: true,
    underscored: true,
  },
)
