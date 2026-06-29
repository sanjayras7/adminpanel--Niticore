import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'
import { Module } from './Module'

export interface OrganizationModuleConfigAttributes {
  id: string
  organization_id: string
  module_id: string
  enabled: boolean
  config_json: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export class OrganizationModuleConfig
  extends Model<OrganizationModuleConfigAttributes>
  implements OrganizationModuleConfigAttributes
{
  declare id: string
  declare organization_id: string
  declare module_id: string
  declare enabled: boolean
  declare config_json: Record<string, unknown> | null
  declare created_at: Date
  declare updated_at: Date
}

OrganizationModuleConfig.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    module_id: { type: DataTypes.UUID, allowNull: false },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    config_json: { type: DataTypes.JSONB, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'organization_module_config',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_org_module_config_org_module',
        unique: true,
        fields: ['organization_id', 'module_id'],
      },
    ],
  },
)

OrganizationModuleConfig.belongsTo(Module, {
  foreignKey: 'module_id',
  as: 'module',
})
