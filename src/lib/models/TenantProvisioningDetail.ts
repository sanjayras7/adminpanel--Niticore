import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface TenantProvisioningDetailAttributes {
  id: string
  provisioning_log_id: string
  schema_name: string
  table_name: string
  status: 'created' | 'skipped' | 'failed'
  error_message: string | null
  rows_created: number
  started_at: Date
  completed_at: Date | null
}

export class TenantProvisioningDetail extends Model<TenantProvisioningDetailAttributes> implements TenantProvisioningDetailAttributes {
  declare id: string
  declare provisioning_log_id: string
  declare schema_name: string
  declare table_name: string
  declare status: 'created' | 'skipped' | 'failed'
  declare error_message: string | null
  declare rows_created: number
  declare started_at: Date
  declare completed_at: Date | null
}

TenantProvisioningDetail.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true },
    provisioning_log_id: { type: DataTypes.UUID, allowNull: false },
    schema_name: { type: DataTypes.STRING(255), allowNull: false },
    table_name: { type: DataTypes.STRING(255), allowNull: false },
    status: { type: DataTypes.STRING(50), allowNull: false },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    rows_created: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    started_at: { type: DataTypes.DATE, allowNull: false },
    completed_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'tenant_provisioning_details',
    timestamps: false,
    underscored: true,
  },
)
