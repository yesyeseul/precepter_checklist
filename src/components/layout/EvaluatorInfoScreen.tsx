import { useState } from 'react'
import { useAppContext } from '../../features/checklist/ChecklistContext'
import { ROLE_LABELS } from '../../types/userRole'

export default function EvaluatorInfoScreen() {
  const { role, subject, setEvaluatorInfo, reset } = useAppContext()

  const [employeeId, setEmployeeId] = useState('')
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<{ employeeId?: string; name?: string }>({})

  if (!role || role === 'preceptee') return null

  const needsEmployeeId = role === 'preceptor' || role === 'educator'

  function validate() {
    const e: typeof errors = {}
    if (!name.trim()) e.name = '성명을 입력하세요'
    if (needsEmployeeId && !employeeId.trim()) e.employeeId = '사번을 입력하세요'
    return e
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setEvaluatorInfo({ employeeId: employeeId.trim(), name: name.trim() })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1">
          ← 처음으로
        </button>

        <p className="text-sm text-gray-500 mb-1">
          대상자: <span className="font-medium text-gray-700">{subject.name}</span>
          {subject.employeeId && <span className="text-gray-400"> ({subject.employeeId})</span>}
        </p>
        <h1 className="text-xl font-bold text-gray-800 mb-1">교육자 정보 입력</h1>
        <p className="text-sm text-gray-500 mb-6">
          역할: <span className="font-medium text-gray-700">{ROLE_LABELS[role]}</span>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          {needsEmployeeId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사번<span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={e => { setEmployeeId(e.target.value); setErrors(er => ({ ...er, employeeId: undefined })) }}
                placeholder="예) 12345"
                className={[
                  'w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400',
                  errors.employeeId ? 'border-red-400' : 'border-gray-200',
                ].join(' ')}
              />
              {errors.employeeId && <p className="text-xs text-red-500 mt-1">{errors.employeeId}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              성명<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setErrors(er => ({ ...er, name: undefined })) }}
              placeholder="홍길동"
              className={[
                'w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400',
                errors.name ? 'border-red-400' : 'border-gray-200',
              ].join(' ')}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-700 mt-2"
          >
            체크리스트 시작
          </button>
        </form>
      </div>
    </div>
  )
}
