import type { Role } from './userRole'

export type Evaluation = {
  score: number | null
  educationDate: string
  signerName: string
  signatureImage: string | null  // base64
  signedAt: string | null
}

export type ChecklistItemResult = {
  itemId: string
  preceptee: Evaluation
  preceptor: Evaluation
  educator: Evaluation
  headNurse: Evaluation
}

export type SurveyMeta = {
  department: string
  deploymentDate: string
  educationPeriodStart: string
  educationPeriodEnd: string
}

export type ChecklistSession = {
  id: string
  targetName: string
  employeeId?: string
  preceptorId?: string
  preceptorName?: string
  educatorId?: string
  educatorPersonName?: string  // 교육전담 성명
  headNurseName?: string
  weekType: import('./checklist').WeekType
  department: string    // kept for backward compat
  startDate: string     // kept for backward compat
  surveyMeta?: SurveyMeta
  results: ChecklistItemResult[]
  savedAt: string
  lowScoreReason?: string
  submittedRoles?: Partial<Record<Role, string>>  // role → ISO timestamp
}

export const createEmptyEvaluation = (): Evaluation => ({
  score: null,
  educationDate: '',
  signerName: '',
  signatureImage: null,
  signedAt: null,
})
