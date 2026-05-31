import { AppProvider, useAppContext } from './features/checklist/ChecklistContext'
import SubjectInfoScreen from './components/layout/SubjectInfoScreen'
import RoleSelectScreen from './components/layout/RoleSelectScreen'
import WeekSelectScreen from './components/layout/WeekSelectScreen'
import EvaluatorInfoScreen from './components/layout/EvaluatorInfoScreen'
import ChecklistScreen from './components/checklist/ChecklistScreen'

function AppInner() {
  const { subject, role, weekType, evaluatorInfo } = useAppContext()

  if (!subject.name || !subject.employeeId) return <SubjectInfoScreen />
  if (!role) return <RoleSelectScreen />
  if (!weekType) return <WeekSelectScreen />
  if (role !== 'preceptee' && !evaluatorInfo) return <EvaluatorInfoScreen />
  return <ChecklistScreen />
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
