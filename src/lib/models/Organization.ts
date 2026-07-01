import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export type TenantStatus = 'Draft' | 'Pending Setup' | 'Active' | 'Suspended' | 'Churned' | 'Archived'
export const TENANT_STATUSES: TenantStatus[] = ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived']

export interface OrganizationAttributes {
  id: string
  name: string
  domain: string | null
  tenant_hash: string
  status: TenantStatus
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export class Organization extends Model<OrganizationAttributes> implements OrganizationAttributes {
  declare id: string
  declare name: string
  declare domain: string | null
  declare tenant_hash: string
  declare status: TenantStatus
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

Organization.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    domain: { type: DataTypes.STRING(255), allowNull: true },
    tenant_hash: { type: DataTypes.STRING(255), allowNull: false },
    status: {
      type: DataTypes.ENUM('Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'),
      allowNull: false,
      defaultValue: 'Draft',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'organizations',
    timestamps: true,
    underscored: true,
    paranoid: true,
  },
)
