import { useAppContext } from '../../features/checklist/ChecklistContext'
import type { Role } from '../../types/userRole'
import { ROLE_LABELS } from '../../types/userRole'

const ROLES: { role: Role; desc: string; color: string }[] = [
  { role: 'preceptee', desc: '자가평가 점수 입력', color: 'bg-blue-50 border-blue-300 hover:bg-blue-100' },
  { role: 'preceptor', desc: '프리셉티 자가평가 확인 + 평가 입력', color: 'bg-green-50 border-green-300 hover:bg-green-100' },
  { role: 'educator', desc: '교육전담 담당 문항 평가 입력', color: 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100' },
  { role: 'headNurse', desc: '전체 평가 확인 + 최종 평가 입력', color: 'bg-purple-50 border-purple-300 hover:bg-purple-100' },
]

export default function RoleSelectScreen() {
  const { setRole, subject } = useAppContext()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">신규간호사 체크리스트</h1>
        <p className="text-sm text-gray-500 text-center mb-1">
          대상자: <span className="font-medium text-gray-700">{subject.name}</span>
          {subject.employeeId && <span className="text-gray-400"> ({subject.employeeId})</span>}
        </p>
        <p className="text-sm text-gray-500 text-center mb-8">역할을 선택하세요</p>

        <div className="flex flex-col gap-3">
          {ROLES.map(({ role, desc, color }) => (
            <button
              key={role}
              onClick={() => setRole(role)}
              className={`border-2 rounded-xl px-5 py-4 text-left transition-colors ${color}`}
            >
              <p className="font-semibold text-gray-800 text-base">{ROLE_LABELS[role]}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
