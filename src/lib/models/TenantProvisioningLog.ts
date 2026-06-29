import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface TenantProvisioningLogAttributes {
  id: string
  organization_id: string
  tenant_hash: string
  template_version_id: string
  status: 'success' | 'failed' | 'in_progress'
  failed_table: string | null
  error_message: string | null
  started_at: Date
  completed_at: Date | null
  created_at: Date
}

export class TenantProvisioningLog extends Model<TenantProvisioningLogAttributes> implements TenantProvisioningLogAttributes {
  declare id: string
  declare organization_id: string
  declare tenant_hash: string
  declare template_version_id: string
  declare status: 'success' | 'failed' | 'in_progress'
  declare failed_table: string | null
  declare error_message: string | null
  declare started_at: Date
  declare completed_at: Date | null
  declare created_at: Date
}

TenantProvisioningLog.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    tenant_hash: { type: DataTypes.STRING(255), allowNull: false },
    template_version_id: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING(50), allowNull: false },
    failed_table: { type: DataTypes.STRING(255), allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: false },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'tenant_provisioning_log',
    timestamps: false,
    underscored: true,
  },
)
