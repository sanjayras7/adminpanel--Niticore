import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface WizardStateAttributes {
  id: string
  lead_id: string
  organization_id: string | null
  step_data: Record<string, unknown>
  current_step: string
  completed_steps: string[]
  created_by: string | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export class WizardState extends Model<WizardStateAttributes> implements WizardStateAttributes {
  declare id: string
  declare lead_id: string
  declare organization_id: string | null
  declare step_data: Record<string, unknown>
  declare current_step: string
  declare completed_steps: string[]
  declare created_by: string | null
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

WizardState.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    lead_id: { type: DataTypes.UUID, allowNull: false },
    organization_id: { type: DataTypes.UUID, allowNull: true },
    step_data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    current_step: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'organization' },
    completed_steps: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    created_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'wizard_state',
    timestamps: true,
    underscored: true,
    paranoid: true,
  },
)
