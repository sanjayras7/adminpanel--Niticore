import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface ControlFrameworkMappingAttributes {
  id: string
  control_id: string
  framework_clause_id: string
  created_at: Date
  updated_at: Date
}

export class ControlFrameworkMapping extends Model<ControlFrameworkMappingAttributes> implements ControlFrameworkMappingAttributes {
  declare id: string
  declare control_id: string
  declare framework_clause_id: string
  declare created_at: Date
  declare updated_at: Date
}

ControlFrameworkMapping.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    control_id: { type: DataTypes.UUID, allowNull: false },
    framework_clause_id: { type: DataTypes.UUID, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'control_framework_mappings',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['control_id', 'framework_clause_id'],
      },
    ],
  },
)
