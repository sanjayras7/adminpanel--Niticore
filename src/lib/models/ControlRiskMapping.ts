import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface ControlRiskMappingAttributes {
  id: string
  control_id: string
  risk_id: string
  created_at: Date
  updated_at: Date
}

export class ControlRiskMapping extends Model<ControlRiskMappingAttributes> implements ControlRiskMappingAttributes {
  declare id: string
  declare control_id: string
  declare risk_id: string
  declare created_at: Date
  declare updated_at: Date
}

ControlRiskMapping.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    control_id: { type: DataTypes.UUID, allowNull: false },
    risk_id: { type: DataTypes.UUID, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'control_risk_mappings',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['control_id', 'risk_id'],
      },
    ],
  },
)
