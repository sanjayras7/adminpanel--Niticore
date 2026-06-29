import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export type TenantStatus = 'Draft' | 'Pending Setup' | 'Active' | 'Suspended' | 'Churned' | 'Archived'

export const TENANT_STATUSES: TenantStatus[] = ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived']

export interface OrganizationAttributes {
  id: string
  name: string
  tenant_hash: string | null
  status: TenantStatus
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export class Organization extends Model<OrganizationAttributes> implements OrganizationAttributes {
  declare id: string
  declare name: string
  declare tenant_hash: string | null
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
    tenant_hash: { type: DataTypes.STRING(64), allowNull: true },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'Draft',
      validate: {
        isIn: [TENANT_STATUSES],
      },
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
