import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface FrameworkClauseAttributes {
  id: string
  framework_section_id: string
  clause_code: string
  clause_text: string
  sort_order: number
  created_at: Date
  updated_at: Date
}

export class FrameworkClause extends Model<FrameworkClauseAttributes> implements FrameworkClauseAttributes {
  declare id: string
  declare framework_section_id: string
  declare clause_code: string
  declare clause_text: string
  declare sort_order: number
  declare created_at: Date
  declare updated_at: Date
}

FrameworkClause.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    framework_section_id: { type: DataTypes.UUID, allowNull: false },
    clause_code: { type: DataTypes.STRING(50), allowNull: false },
    clause_text: { type: DataTypes.TEXT, allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'framework_clauses',
    timestamps: true,
    underscored: true,
  },
)
