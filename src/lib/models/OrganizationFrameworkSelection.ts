import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface OrganizationFrameworkSelectionAttributes {
  id: string
  organization_id: string
  framework_id: string | null
  framework_version_id: string | null
  framework_name: string | null
  framework_version_name: string | null
  selected_control_ids: string[] | null
  risk_threshold: string
  is_stub_data: boolean
  created_by: string | null
  created_at: Date
  updated_at: Date
}

export class OrganizationFrameworkSelection extends Model<OrganizationFrameworkSelectionAttributes> implements OrganizationFrameworkSelectionAttributes {
  declare id: string
  declare organization_id: string
  declare framework_id: string | null
  declare framework_version_id: string | null
  declare framework_name: string | null
  declare framework_version_name: string | null
  declare selected_control_ids: string[] | null
  declare risk_threshold: string
  declare is_stub_data: boolean
  declare created_by: string | null
  declare created_at: Date
  declare updated_at: Date
}

OrganizationFrameworkSelection.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    framework_id: { type: DataTypes.UUID, allowNull: true },
    framework_version_id: { type: DataTypes.UUID, allowNull: true },
    framework_name: { type: DataTypes.STRING(255), allowNull: true },
    framework_version_name: { type: DataTypes.STRING(100), allowNull: true },
    selected_control_ids: { type: DataTypes.JSONB, allowNull: true },
    risk_threshold: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'medium' },
    is_stub_data: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'organization_framework_selections',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_org_framework_selections_org',
        fields: ['organization_id'],
      },
    ],
  },
)
