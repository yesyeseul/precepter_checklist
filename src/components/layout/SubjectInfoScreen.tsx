import { useState } from 'react'
import { useAppContext } from '../../features/checklist/ChecklistContext'
import type { SubjectInfo } from '../../features/checklist/ChecklistContext'

export default function SubjectInfoScreen() {
  const { setSubject } = useAppContext()

  const [form, setForm] = useState<SubjectInfo>({
    employeeId: '',
    name: '',
  })

  const [errors, setErrors] = useState<Partial<Record<keyof SubjectInfo, string>>>({})

  function validate() {
    const e: typeof errors = {}
    if (!form.name.trim()) e.name = '성명을 입력하세요'
    if (!form.employeeId.trim()) e.employeeId = '사번을 입력하세요'
    return e
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSubject(form)
  }

  const field = (
    key: keyof SubjectInfo,
    label: string,
    placeholder: string,
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}<span className="text-red-500 ml-0.5">*</span>
      </label>
      <input
        type="text"
        value={form[key]}
        onChange={e => {
          setForm(f => ({ ...f, [key]: e.target.value }))
          setErrors(er => ({ ...er, [key]: undefined }))
        }}
        placeholder={placeholder}
        className={[
          'w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400',
          errors[key] ? 'border-red-400' : 'border-gray-200',
        ].join(' ')}
      />
      {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-bold text-gray-800 mb-1">신입간호사 정보 입력</h1>
        <p className="text-sm text-gray-500 mb-6">신규 간호사의 사번과 성명을 입력하세요</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          {field('employeeId', '사번', '예) 12345')}
          {field('name', '성명 (신입간호사)', '홍길동')}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-700 mt-2"
          >
            다음
          </button>
        </form>
      </div>
    </div>
  )
}
