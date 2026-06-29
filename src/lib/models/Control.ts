import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface ControlAttributes {
  id: string
  control_code: string
  title: string
  description: string | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export class Control extends Model<ControlAttributes> implements ControlAttributes {
  declare id: string
  declare control_code: string
  declare title: string
  declare description: string | null
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

Control.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    control_code: { type: DataTypes.STRING(50), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'controls',
    timestamps: true,
    underscored: true,
    paranoid: true,
  },
)
