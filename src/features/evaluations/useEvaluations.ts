import { useState, useCallback, useEffect, useRef } from 'react'
import type { ChecklistItemResult, Evaluation, ChecklistSession, SurveyMeta } from '../../types/evaluation'
import type { ChecklistItem, WeekType } from '../../types/checklist'
import type { Role } from '../../types/userRole'
import { createEmptyEvaluation } from '../../types/evaluation'
import { saveSession, loadSession } from '../storage/localStorage'

function initResults(items: ChecklistItem[], saved: ChecklistSession | null): ChecklistItemResult[] {
  return items.map(item => {
    const existing = saved?.results.find(r => r.itemId === item.id)
    return existing ?? {
      itemId: item.id,
      preceptee: createEmptyEvaluation(),
      preceptor: createEmptyEvaluation(),
      educator: createEmptyEvaluation(),
      headNurse: createEmptyEvaluation(),
    }
  })
}

const ROLE_FIELD: Record<Role, keyof Omit<ChecklistItemResult, 'itemId'>> = {
  preceptee: 'preceptee',
  preceptor: 'preceptor',
  educator: 'educator',
  headNurse: 'headNurse',
}

const EMPTY_SURVEY_META: SurveyMeta = {
  department: '',
  deploymentDate: '',
  educationPeriodStart: '',
  educationPeriodEnd: '',
}

type EvaluatorMeta = {
  preceptorId?: string
  preceptorName?: string
  educatorId?: string
  educatorPersonName?: string
  headNurseName?: string
}

type Options = {
  weekType: WeekType
  targetName?: string
}

export function useEvaluations(items: ChecklistItem[], options: Options) {
  const { weekType, targetName = '' } = options

  const savedRef = useRef<ChecklistSession | null>(null)
  if (savedRef.current === null) {
    savedRef.current = loadSession(weekType)
  }
  const saved = savedRef.current

  const [results, setResults] = useState<ChecklistItemResult[]>(() => initResults(items, saved))

  const [surveyMeta, setSurveyMeta] = useState<SurveyMeta>(() => saved?.surveyMeta ?? EMPTY_SURVEY_META)

  const [submittedRoles, setSubmittedRoles] = useState<Partial<Record<Role, string>>>(
    () => saved?.submittedRoles ?? {}
  )

  const [evaluatorMeta, setEvaluatorMeta] = useState<EvaluatorMeta>(() => ({
    preceptorId: saved?.preceptorId,
    preceptorName: saved?.preceptorName,
    educatorId: saved?.educatorId,
    educatorPersonName: saved?.educatorPersonName,
    headNurseName: saved?.headNurseName,
  }))

  // debounce 자동저장: 마지막 변경 후 800ms 뒤 저장
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const session: ChecklistSession = {
        id: `${weekType}_${Date.now()}`,
        targetName,
        weekType,
        department: surveyMeta.department,
        startDate: surveyMeta.deploymentDate,
        surveyMeta,
        preceptorId: evaluatorMeta.preceptorId,
        preceptorName: evaluatorMeta.preceptorName,
        educatorId: evaluatorMeta.educatorId,
        educatorPersonName: evaluatorMeta.educatorPersonName,
        headNurseName: evaluatorMeta.headNurseName,
        results,
        savedAt: new Date().toISOString(),
        submittedRoles: Object.keys(submittedRoles).length > 0 ? submittedRoles : undefined,
      }
      saveSession(session)
    }, 800)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [results, weekType, targetName, surveyMeta, submittedRoles, evaluatorMeta])

  const updateEvaluation = useCallback(
    (itemId: string, role: Role, patch: Partial<Evaluation>) => {
      setResults(prev =>
        prev.map(r => {
          if (r.itemId !== itemId) return r
          const field = ROLE_FIELD[role]
          return { ...r, [field]: { ...r[field], ...patch } }
        })
      )
    },
    []
  )

  const loadFromSession = useCallback((session: ChecklistSession) => {
    setResults(initResults(items, session))
    if (session.surveyMeta) setSurveyMeta(session.surveyMeta)
    if (session.submittedRoles) setSubmittedRoles(session.submittedRoles)
    setEvaluatorMeta({
      preceptorId: session.preceptorId,
      preceptorName: session.preceptorName,
      educatorId: session.educatorId,
      educatorPersonName: session.educatorPersonName,
      headNurseName: session.headNurseName,
    })
  }, [items])

  const getResult = useCallback(
    (itemId: string) => results.find(r => r.itemId === itemId),
    [results]
  )

  const updateSurveyMeta = useCallback((patch: Partial<SurveyMeta>) => {
    setSurveyMeta(prev => ({ ...prev, ...patch }))
  }, [])

  const submitRole = useCallback((role: Role) => {
    setSubmittedRoles(prev => ({ ...prev, [role]: new Date().toISOString() }))
  }, [])

  const updateEvaluatorMeta = useCallback((patch: Partial<EvaluatorMeta>) => {
    setEvaluatorMeta(prev => ({ ...prev, ...patch }))
  }, [])

  return {
    results,
    updateEvaluation,
    getResult,
    loadFromSession,
    surveyMeta,
    updateSurveyMeta,
    submittedRoles,
    submitRole,
    evaluatorMeta,
    updateEvaluatorMeta,
  }
}
