import ScoreInput from './ScoreInput'
import type { ChecklistItem } from '../../types/checklist'
import type { ChecklistItemResult, Evaluation } from '../../types/evaluation'
import type { Role } from '../../types/userRole'

type Props = {
  item: ChecklistItem
  result: ChecklistItemResult
  role: Role
  isLocked: boolean
  onScoreChange: (score: number) => void
  onEvaluationPatch: (patch: Partial<Evaluation>) => void
}

const ROLE_LABEL: Record<Role, string> = {
  preceptee: '자가평가',
  preceptor: '프리셉터 평가',
  educator: '교육전담 평가',
  headNurse: '수간호사 최종평가',
}

const DIFFICULTY_COLOR: Record<string, string> = {
  하: 'bg-green-100 text-green-700',
  중: 'bg-yellow-100 text-yellow-700',
  상: 'bg-red-100 text-red-700',
}

export default function ChecklistCard({ item, result, role, isLocked, onScoreChange, onEvaluationPatch }: Props) {
  const myEval = result[role === 'preceptee' ? 'preceptee'
    : role === 'preceptor' ? 'preceptor'
    : role === 'educator' ? 'educator'
    : 'headNurse']

  const precepteeEval = result.preceptee
  const preceptorEval = result.preceptor
  const educatorEval = result.educator

  return (
    <div className={[
      'bg-white rounded-xl border p-4 shadow-sm',
      item.evaluatorType === 'educator' ? 'border-l-4 border-l-yellow-400' : 'border-gray-200',
    ].join(' ')}>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs text-gray-400">#{item.id}</span>
            <span className="text-xs text-gray-500">{item.category}</span>
            {item.subCategory && <span className="text-xs text-gray-400">· {item.subCategory}</span>}
            {item.difficulty && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${DIFFICULTY_COLOR[item.difficulty] ?? 'bg-gray-100 text-gray-500'}`}>
                {item.difficulty}
              </span>
            )}
            {item.evaluatorType === 'educator' && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">교육전담</span>
            )}
          </div>
          <p className="text-sm text-gray-800 leading-snug">{item.content}</p>
        </div>
        {isLocked && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded shrink-0">평가완료</span>}
      </div>

      {/* 자가평가 열람 (프리셉터·교육전담·수간호사) */}
      {role !== 'preceptee' && (
        <div className="bg-gray-50 rounded-lg p-3 mb-3 text-xs">
          <p className="text-gray-400 mb-1">자가평가</p>
          <div className="flex items-center gap-3">
            <span className={`font-semibold ${precepteeEval.score !== null ? 'text-gray-800' : 'text-gray-300'}`}>
              {precepteeEval.score !== null ? `${precepteeEval.score}점` : '미입력'}
            </span>
          </div>
        </div>
      )}

      {/* 프리셉터 평가 열람 (수간호사) */}
      {role === 'headNurse' && item.evaluatorType === 'preceptor' && (
        <div className="bg-green-50 rounded-lg p-3 mb-3 text-xs">
          <p className="text-green-600 mb-1">프리셉터 평가{preceptorEval.signerName && ` — ${preceptorEval.signerName}`}</p>
          <div className="flex items-center gap-3">
            <span className={`font-semibold ${preceptorEval.score !== null ? 'text-gray-800' : 'text-gray-300'}`}>
              {preceptorEval.score !== null ? `${preceptorEval.score}점` : '미입력'}
            </span>
            {preceptorEval.educationDate && <span className="text-gray-500">교육일: {preceptorEval.educationDate}</span>}
          </div>
        </div>
      )}

      {/* 교육전담 평가 열람 (수간호사) */}
      {role === 'headNurse' && item.evaluatorType === 'educator' && (
        <div className="bg-yellow-50 rounded-lg p-3 mb-3 text-xs">
          <p className="text-yellow-600 mb-1">교육전담 평가{educatorEval.signerName && ` — ${educatorEval.signerName}`}</p>
          <div className="flex items-center gap-3">
            <span className={`font-semibold ${educatorEval.score !== null ? 'text-gray-800' : 'text-gray-300'}`}>
              {educatorEval.score !== null ? `${educatorEval.score}점` : '미입력'}
            </span>
          </div>
        </div>
      )}

      {/* 내 평가 입력 */}
      <div>
        <p className="text-xs text-gray-400 mb-2">{ROLE_LABEL[role]}</p>
        <ScoreInput value={myEval.score} onChange={onScoreChange} disabled={isLocked} />

        {/* 교육 실행일 (프리셉터 역할만) */}
        {role === 'preceptor' && (
          <div className="mt-2">
            <label className="block text-xs text-gray-400 mb-1">교육 실행일</label>
            <input
              type="date"
              value={myEval.educationDate}
              disabled={isLocked}
              onChange={e => onEvaluationPatch({ educationDate: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-40"
            />
          </div>
        )}
      </div>
    </div>
  )
}
