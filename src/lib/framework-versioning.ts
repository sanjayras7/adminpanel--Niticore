import { v4 as uuidv4 } from 'uuid'
import { FrameworkVersion, FrameworkSection, FrameworkClause } from '@/lib/models'

export interface CloneResult {
  newVersion: FrameworkVersion
  sectionIdMap: Map<string, string>
}

export async function cloneVersion(
  version: FrameworkVersion,
): Promise<CloneResult> {
  const sections = await FrameworkSection.findAll({
    where: { framework_version_id: version.id },
    include: [{ model: FrameworkClause, as: 'clauses' }],
  })

  const newVersion = await FrameworkVersion.create({
    id: uuidv4(),
    framework_id: version.framework_id,
    version_label: `${version.version_label}-draft-${Date.now()}`,
    description: version.description,
    effective_date: version.effective_date,
    status: 'draft',
  } as FrameworkVersion)

  const sectionIdMap = new Map<string, string>()

  const rootSections = sections.filter((s) => !s.parent_section_id)
  for (const section of rootSections) {
    const newSectionId = uuidv4()
    sectionIdMap.set(section.id, newSectionId)

    await FrameworkSection.create({
      id: newSectionId,
      framework_version_id: newVersion.id,
      parent_section_id: null,
      section_code: section.section_code,
      title: section.title,
      description: section.description,
      sort_order: section.sort_order,
    } as FrameworkSection)

    const clauses = section.get('clauses') as FrameworkClause[] | undefined
    if (clauses) {
      for (const clause of clauses) {
        await FrameworkClause.create({
          id: uuidv4(),
          framework_section_id: newSectionId,
          clause_code: clause.clause_code,
          clause_text: clause.clause_text,
          sort_order: clause.sort_order,
        } as FrameworkClause)
      }
    }
  }

  const childSections = sections.filter((s) => s.parent_section_id)
  for (const section of childSections) {
    const newParentId = sectionIdMap.get(section.parent_section_id!)
    if (!newParentId) continue

    const newSectionId = uuidv4()
    sectionIdMap.set(section.id, newSectionId)

    await FrameworkSection.create({
      id: newSectionId,
      framework_version_id: newVersion.id,
      parent_section_id: newParentId,
      section_code: section.section_code,
      title: section.title,
      description: section.description,
      sort_order: section.sort_order,
    } as FrameworkSection)

    const clauses = section.get('clauses') as FrameworkClause[] | undefined
    if (clauses) {
      for (const clause of clauses) {
        await FrameworkClause.create({
          id: uuidv4(),
          framework_section_id: newSectionId,
          clause_code: clause.clause_code,
          clause_text: clause.clause_text,
          sort_order: clause.sort_order,
        } as FrameworkClause)
      }
    }
  }

  return { newVersion, sectionIdMap }
}

export async function ensureDraftVersion(
  version: FrameworkVersion,
): Promise<{ version: FrameworkVersion; wasCloned: boolean; sectionIdMap?: Map<string, string> }> {
  if (version.status !== 'draft') {
    const { newVersion, sectionIdMap } = await cloneVersion(version)
    return { version: newVersion, wasCloned: true, sectionIdMap }
  }
  return { version, wasCloned: false }
}
