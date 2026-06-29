import { v4 as uuidv4 } from 'uuid'
import { ControlVersion, ControlImplementationStep, ControlEvidenceType } from '@/lib/models'

export interface CloneResult {
  newVersion: ControlVersion
  stepIdMap: Map<string, string>
}

export async function cloneVersion(
  version: ControlVersion,
): Promise<CloneResult> {
  const steps = await ControlImplementationStep.findAll({
    where: { control_version_id: version.id },
  })

  const evidenceTypes = await ControlEvidenceType.findAll({
    where: { control_version_id: version.id },
  })

  const newVersion = await ControlVersion.create({
    id: uuidv4(),
    control_id: version.control_id,
    version_label: `${version.version_label}-draft-${Date.now()}`,
    description: version.description,
    effective_date: version.effective_date,
    status: 'draft',
  } as ControlVersion)

  const stepIdMap = new Map<string, string>()

  for (const step of steps) {
    const newStepId = uuidv4()
    stepIdMap.set(step.id, newStepId)

    await ControlImplementationStep.create({
      id: newStepId,
      control_version_id: newVersion.id,
      step_code: step.step_code,
      title: step.title,
      description: step.description,
      category_id: step.category_id,
      sort_order: step.sort_order,
    } as ControlImplementationStep)
  }

  for (const et of evidenceTypes) {
    await ControlEvidenceType.create({
      id: uuidv4(),
      control_version_id: newVersion.id,
      name: et.name,
      description: et.description,
    } as ControlEvidenceType)
  }

  return { newVersion, stepIdMap }
}

export async function ensureDraftVersion(
  version: ControlVersion,
): Promise<{ version: ControlVersion; wasCloned: boolean; stepIdMap?: Map<string, string> }> {
  if (version.status !== 'draft') {
    const { newVersion, stepIdMap } = await cloneVersion(version)
    return { version: newVersion, wasCloned: true, stepIdMap }
  }
  return { version, wasCloned: false }
}
