import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface FrameworkSectionAttributes {
  id: string
  framework_version_id: string
  parent_section_id: string | null
  section_code: string
  title: string
  description: string | null
  sort_order: number
  created_at: Date
  updated_at: Date
}

export class FrameworkSection extends Model<FrameworkSectionAttributes> implements FrameworkSectionAttributes {
  declare id: string
  declare framework_version_id: string
  declare parent_section_id: string | null
  declare section_code: string
  declare title: string
  declare description: string | null
  declare sort_order: number
  declare created_at: Date
  declare updated_at: Date
}

FrameworkSection.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    framework_version_id: { type: DataTypes.UUID, allowNull: false },
    parent_section_id: { type: DataTypes.UUID, allowNull: true },
    section_code: { type: DataTypes.STRING(50), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'framework_sections',
    timestamps: true,
    underscored: true,
  },
)
