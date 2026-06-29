import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface GateOverrideAttributes {
  id: string
  gate_type: 'nda' | 'contract'
  lead_id: string | null
  organization_id: string | null
  overridden_by: string
  reason: string
  metadata: Record<string, unknown> | null
  created_at: Date
}

export class GateOverride extends Model<GateOverrideAttributes> implements GateOverrideAttributes {
  declare id: string
  declare gate_type: 'nda' | 'contract'
  declare lead_id: string | null
  declare organization_id: string | null
  declare overridden_by: string
  declare reason: string
  declare metadata: Record<string, unknown> | null
  declare created_at: Date
}

GateOverride.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    gate_type: {
      type: DataTypes.ENUM('nda', 'contract'),
      allowNull: false,
    },
    lead_id: { type: DataTypes.UUID, allowNull: true },
    organization_id: { type: DataTypes.UUID, allowNull: true },
    overridden_by: { type: DataTypes.UUID, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    metadata: { type: DataTypes.JSONB, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'gate_overrides',
    timestamps: false,
    underscored: true,
  },
)