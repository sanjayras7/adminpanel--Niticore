import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface OrganizationIntegrationIntentAttributes {
  id: string
  organization_id: string
  domain: string | null
  sso_required: boolean
  sso_provider: string | null
  notes: string | null
  created_by: string | null
  created_at: Date
  updated_at: Date
}

export class OrganizationIntegrationIntent extends Model<OrganizationIntegrationIntentAttributes> implements OrganizationIntegrationIntentAttributes {
  declare id: string
  declare organization_id: string
  declare domain: string | null
  declare sso_required: boolean
  declare sso_provider: string | null
  declare notes: string | null
  declare created_by: string | null
  declare created_at: Date
  declare updated_at: Date
}

OrganizationIntegrationIntent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organization_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    domain: { type: DataTypes.STRING(255), allowNull: true },
    sso_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sso_provider: { type: DataTypes.STRING(100), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'organization_integration_intents',
    timestamps: true,
    underscored: true,
  },
)
