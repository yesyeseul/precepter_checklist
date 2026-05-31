import { createContext, useContext, useState } from 'react'
import type { Role } from '../../types/userRole'
import type { WeekType } from '../../types/checklist'

export type SubjectInfo = {
  employeeId: string   // 사번
  name: string         // 성명
}

export type EvaluatorInfo = {
  employeeId: string
  name: string
}

const EMPTY_SUBJECT: SubjectInfo = {
  employeeId: '',
  name: '',
}

type AppState = {
  role: Role | null
  weekType: WeekType | null
  sessionId: string | null
  subject: SubjectInfo
  evaluatorInfo: EvaluatorInfo | null
}

type AppContextValue = AppState & {
  setRole: (role: Role) => void
  setWeekType: (weekType: WeekType) => void
  setSessionId: (id: string) => void
  setSubject: (info: SubjectInfo) => void
  setEvaluatorInfo: (info: EvaluatorInfo) => void
  reset: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    role: null,
    weekType: null,
    sessionId: null,
    subject: EMPTY_SUBJECT,
    evaluatorInfo: null,
  })

  const setRole = (role: Role) => setState(s => ({ ...s, role }))
  const setWeekType = (weekType: WeekType) => setState(s => ({ ...s, weekType }))
  const setSessionId = (sessionId: string) => setState(s => ({ ...s, sessionId }))
  const setSubject = (subject: SubjectInfo) => setState(s => ({ ...s, subject }))
  const setEvaluatorInfo = (evaluatorInfo: EvaluatorInfo) => setState(s => ({ ...s, evaluatorInfo }))
  const reset = () => setState({
    role: null,
    weekType: null,
    sessionId: null,
    subject: EMPTY_SUBJECT,
    evaluatorInfo: null,
  })

  return (
    <AppContext.Provider value={{ ...state, setRole, setWeekType, setSessionId, setSubject, setEvaluatorInfo, reset }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
