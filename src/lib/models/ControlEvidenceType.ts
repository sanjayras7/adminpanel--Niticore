import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface ControlEvidenceTypeAttributes {
  id: string
  control_version_id: string
  name: string
  description: string | null
  created_at: Date
  updated_at: Date
}

export class ControlEvidenceType extends Model<ControlEvidenceTypeAttributes> implements ControlEvidenceTypeAttributes {
  declare id: string
  declare control_version_id: string
  declare name: string
  declare description: string | null
  declare created_at: Date
  declare updated_at: Date
}

ControlEvidenceType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    control_version_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'control_evidence_types',
    timestamps: true,
    underscored: true,
  },
)
