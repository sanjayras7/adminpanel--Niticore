import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface TenantFrameworkConfigAttributes {
  id: string
  organization_id: string
  framework_id: string
  framework_version_id: string
  is_active: boolean
  assigned_by: string
  assigned_at: Date
  deactivated_at: Date | null
  deactivated_by: string | null
  created_at: Date
  updated_at: Date
}

export class TenantFrameworkConfig extends Model<TenantFrameworkConfigAttributes> implements TenantFrameworkConfigAttributes {
  declare id: string
  declare organization_id: string
  declare framework_id: string
  declare framework_version_id: string
  declare is_active: boolean
  declare assigned_by: string
  declare assigned_at: Date
  declare deactivated_at: Date | null
  declare deactivated_by: string | null
  declare created_at: Date
  declare updated_at: Date
}

TenantFrameworkConfig.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    framework_id: { type: DataTypes.UUID, allowNull: false },
    framework_version_id: { type: DataTypes.UUID, allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    assigned_by: { type: DataTypes.UUID, allowNull: false },
    assigned_at: { type: DataTypes.DATE, allowNull: false },
    deactivated_at: { type: DataTypes.DATE, allowNull: true },
    deactivated_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'tenant_framework_config',
    timestamps: true,
    underscored: true,
    paranoid: false,
  },
)
