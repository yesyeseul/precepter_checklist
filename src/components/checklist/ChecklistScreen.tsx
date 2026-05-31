import { useMemo, useRef, useState } from 'react'
import { useAppContext } from '../../features/checklist/ChecklistContext'
import { useEvaluations } from '../../features/evaluations/useEvaluations'
import { getChecklist } from '../../data/checklistData'
import { ROLE_LABELS } from '../../types/userRole'
import { downloadSession, readSessionFile } from '../../features/storage/jsonIO'
import type { ChecklistSession } from '../../types/evaluation'
import { gasSaveWithExcel, gasSaveSession, gasListSessions, gasLoadSession } from '../../lib/googleDrive/gasClient'
import type { SessionMeta } from '../../lib/googleDrive/gasClient'
import ChecklistCard from './ChecklistCard'
import LowScoreModal from '../common/LowScoreModal'
import SignaturePad from '../signature/SignaturePad'
import ServerLoadModal from '../common/ServerLoadModal'

export default function ChecklistScreen() {
  const { role: roleNullable, weekType: rawWeekType, subject, evaluatorInfo, reset } = useAppContext()
  const weekType = rawWeekType!
  if (!roleNullable || !rawWeekType) return null
  const role = roleNullable

  const allItems = useMemo(() => getChecklist(weekType), [weekType])

  const visibleItems = useMemo(() => {
    if (role === 'educator') return allItems.filter(i => i.evaluatorType === 'educator')
    if (role === 'preceptor') return allItems.filter(i => i.evaluatorType === 'preceptor')
    return allItems
  }, [allItems, role])

  const {
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
  } = useEvaluations(allItems, { weekType, targetName: subject.name })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showLowScore, setShowLowScore] = useState(false)
  const [pendingScore, setPendingScore] = useState(0)
  const [lowScoreReason, setLowScoreReason] = useState('')

  // 'submit' = 최종 제출, 'batch' = 일괄서명만
  const [signMode, setSignMode] = useState<'submit' | 'batch' | null>(null)
  const [signerName, setSignerName] = useState('')

  // 서버 연동 상태
  const [serverStatus, setServerStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showServerLoad, setShowServerLoad] = useState(false)
  const [serverSessions, setServerSessions] = useState<SessionMeta[]>([])
  const [serverLoadError, setServerLoadError] = useState('')

  const roleField = role === 'preceptee' ? 'preceptee'
    : role === 'preceptor' ? 'preceptor'
    : role === 'educator' ? 'educator'
    : 'headNurse'

  const doneCount = useMemo(() => {
    return visibleItems.filter(item => {
      const r = getResult(item.id)
      return r && r[roleField].score !== null
    }).length
  }, [results, visibleItems, roleField, getResult])

  const totalScore = useMemo(() => {
    return visibleItems.reduce((sum, item) => {
      const r = getResult(item.id)
      return sum + (r ? (r[roleField].score ?? 0) : 0)
    }, 0)
  }, [results, visibleItems, roleField, getResult])

  const headNurseAvgScore = useMemo(() => {
    if (role !== 'headNurse') return null
    const scored = results.filter(r => r.headNurse.score !== null)
    if (!scored.length) return null
    const avg = scored.reduce((s, r) => s + (r.headNurse.score ?? 0), 0) / scored.length
    return (avg / 3) * 100
  }, [results, role])

  const isSubmitted = submittedRoles[role] != null

  function buildSession(extra?: Partial<ChecklistSession>): ChecklistSession {
    const baseEvaluatorMeta = evaluatorMeta
    return {
      id: `${subject.employeeId || 'no-id'}_${weekType}_${Date.now()}`,
      targetName: subject.name,
      employeeId: subject.employeeId || undefined,
      preceptorId: evaluatorInfo && role === 'preceptor' ? evaluatorInfo.employeeId : baseEvaluatorMeta.preceptorId,
      preceptorName: evaluatorInfo && role === 'preceptor' ? evaluatorInfo.name : baseEvaluatorMeta.preceptorName,
      educatorId: evaluatorInfo && role === 'educator' ? evaluatorInfo.employeeId : baseEvaluatorMeta.educatorId,
      educatorPersonName: evaluatorInfo && role === 'educator' ? evaluatorInfo.name : baseEvaluatorMeta.educatorPersonName,
      headNurseName: evaluatorInfo && role === 'headNurse' ? evaluatorInfo.name : baseEvaluatorMeta.headNurseName,
      weekType,
      department: surveyMeta.department,
      startDate: surveyMeta.deploymentDate,
      surveyMeta: (surveyMeta.department || surveyMeta.deploymentDate || surveyMeta.educationPeriodStart)
        ? surveyMeta
        : undefined,
      results,
      savedAt: new Date().toISOString(),
      submittedRoles: Object.keys(submittedRoles).length > 0 ? submittedRoles : undefined,
      ...extra,
    }
  }

  function handleDownload(extra?: Partial<ChecklistSession>) {
    downloadSession(buildSession(extra))
  }

  /** 임시저장(서버) — JSON을 임시저장 폴더에 + XLSX를 대상자 폴더에 (현재 진행상황) */
  async function handleServerSave() {
    setServerStatus('saving')
    try {
      const session = buildSession()
      const subjectFolderName = `${subject.employeeId}_${subject.name}_${surveyMeta.department || '미입력'}`
      const weekLabel = weekType === '4week' ? '4주' : '8주'
      const tempFileName = `신규간호사_체크리스트_${weekLabel}_${subject.employeeId || ''}_${subject.name}_임시저장.xlsx`
      try {
        const { buildExcelBuffer } = await import('../../lib/excel/exportExcel')
        const { buffer } = await buildExcelBuffer(session)
        await gasSaveWithExcel(session, buffer, tempFileName, subjectFolderName)
      } catch {
        // Excel 생성 실패 시 JSON만 저장
        await gasSaveSession(session)
      }
      setServerStatus('saved')
      setTimeout(() => setServerStatus('idle'), 2000)
    } catch {
      setServerStatus('error')
      setTimeout(() => setServerStatus('idle'), 3000)
    }
  }

  /** 최종 제출 시 XLSX + JSON을 subject 폴더에 */
  async function handleServerSaveWithExcel() {
    const session = buildSession()
    const subjectFolderName = `${subject.employeeId}_${subject.name}_${surveyMeta.department || '미입력'}`
    try {
      const { buildExcelBuffer } = await import('../../lib/excel/exportExcel')
      const { buffer, fileName } = await buildExcelBuffer(session)
      await gasSaveWithExcel(session, buffer, fileName, subjectFolderName)
    } catch {
      // XLSX 실패 시 JSON만 임시저장
      await gasSaveSession(session)
    }
  }

  async function handleServerLoadOpen() {
    setServerLoadError('')
    setShowServerLoad(true)
    try {
      const list = await gasListSessions()
      setServerSessions(list)
    } catch (err) {
      setServerLoadError(err instanceof Error ? err.message : '서버 오류')
    }
  }

  async function handleServerLoadSelect(fileId: string) {
    try {
      const session = await gasLoadSession(fileId)
      loadFromSession(session)
      // evaluatorMeta 복원
      updateEvaluatorMeta({
        preceptorId: session.preceptorId,
        preceptorName: session.preceptorName,
        educatorId: session.educatorId,
        educatorPersonName: session.educatorPersonName,
        headNurseName: session.headNurseName,
      })
      setShowServerLoad(false)
    } catch (err) {
      setServerLoadError(err instanceof Error ? err.message : '불러오기 실패')
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const session = await readSessionFile(file)
      loadFromSession(session)
      updateEvaluatorMeta({
        preceptorId: session.preceptorId,
        preceptorName: session.preceptorName,
        educatorId: session.educatorId,
        educatorPersonName: session.educatorPersonName,
        headNurseName: session.headNurseName,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : '파일 오류')
    } finally {
      e.target.value = ''
    }
  }

  function handleFinalSubmitStart() {
    if (role === 'headNurse') {
      const score = headNurseAvgScore ?? 0
      if (score < 70) {
        setPendingScore(score)
        setShowLowScore(true)
        return
      }
    }
    setSignerName(evaluatorInfo?.name ?? '')
    setSignMode('submit')
  }

  function handleLowScoreConfirm(reason: string) {
    setLowScoreReason(reason)
    setShowLowScore(false)
    setSignerName(evaluatorInfo?.name ?? '')
    setSignMode('submit')
  }

  async function handleSignSave(dataUrl: string) {
    const now = new Date().toISOString()
    const name = signerName.trim()

    if (signMode === 'submit') {
      // 점수 입력된 항목에 서명 적용
      visibleItems.forEach(item => {
        const r = getResult(item.id)
        if (r && r[roleField].score !== null) {
          updateEvaluation(item.id, role, { signatureImage: dataUrl, signerName: name, signedAt: now })
        }
      })
      // 역할 제출 완료 표시
      submitRole(role)
      setSignMode(null)

      // headNurse: XLSX + 서버 저장
      if (role === 'headNurse') {
        await handleServerSaveWithExcel()
      } else {
        await gasSaveSession(buildSession({ submittedRoles: { ...submittedRoles, [role]: now } }))
      }
      // 로컬 JSON 다운로드
      handleDownload({ lowScoreReason: lowScoreReason || undefined, submittedRoles: { ...submittedRoles, [role]: now } })
    } else if (signMode === 'batch') {
      visibleItems.forEach(item => {
        const r = getResult(item.id)
        if (r && r[roleField].score !== null) {
          updateEvaluation(item.id, role, { signatureImage: dataUrl, signerName: name, signedAt: now })
        }
      })
      setSignMode(null)
    }
  }

  const headerInfo = `${subject.name}${subject.employeeId ? ' · ' + subject.employeeId : ''}`

  const serverBtnLabel =
    serverStatus === 'saving' ? '저장중...' :
    serverStatus === 'saved' ? '저장완료!' :
    serverStatus === 'error' ? '오류' : '임시저장(서버)'

  const serverBtnClass =
    serverStatus === 'saved' ? 'text-xs text-white bg-emerald-500 rounded-lg px-2 py-1' :
    serverStatus === 'error' ? 'text-xs text-white bg-red-500 rounded-lg px-2 py-1' :
    'text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-2 py-1'

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-400 truncate">{weekType === '4week' ? '4주' : '8주'} · {ROLE_LABELS[role]}</p>
                <p className="text-sm font-semibold text-gray-800 truncate">{headerInfo}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  완료 {doneCount}/{visibleItems.length} · 합계 {totalScore}점
                  {isSubmitted && <span className="ml-2 text-green-600 font-medium">제출완료</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <button
                  onClick={() => { setSignerName(evaluatorInfo?.name ?? ''); setSignMode('batch') }}
                  className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50"
                >
                  일괄서명
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50"
                >
                  불러오기
                </button>
                <button
                  onClick={handleServerLoadOpen}
                  className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-2 py-1 hover:bg-indigo-50"
                >
                  임시저장 불러오기
                </button>
                <button
                  onClick={() => handleDownload()}
                  className="text-xs text-white bg-blue-500 hover:bg-blue-600 rounded-lg px-2 py-1"
                >
                  임시저장
                </button>
                <button
                  onClick={handleServerSave}
                  disabled={serverStatus === 'saving'}
                  className={serverBtnClass}
                >
                  {serverBtnLabel}
                </button>
                <button
                  onClick={() =>
                    import('../../lib/excel/exportExcel')
                      .then(m => m.exportToExcel(buildSession()))
                      .catch(e => alert((e as Error).message))
                  }
                  className="text-xs text-white bg-green-600 hover:bg-green-700 rounded-lg px-2 py-1"
                >
                  엑셀출력
                </button>
                <button
                  onClick={reset}
                  className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1"
                >
                  처음으로
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-blue-500 transition-all"
            style={{ width: `${visibleItems.length ? (doneCount / visibleItems.length) * 100 : 0}%` }}
          />
        </div>

        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />

        <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-3 pb-32">
          {/* Survey Meta 카드 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 mb-3">설문 정보</p>
            {role === 'preceptee' && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">부서</label>
                  <input
                    type="text"
                    value={surveyMeta.department}
                    onChange={e => updateSurveyMeta({ department: e.target.value })}
                    placeholder="예) 내과병동"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">배치일</label>
                  <input
                    type="date"
                    value={surveyMeta.deploymentDate}
                    onChange={e => updateSurveyMeta({ deploymentDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            )}
            {role === 'preceptor' && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">교육기간 시작일</label>
                  <input
                    type="date"
                    value={surveyMeta.educationPeriodStart}
                    onChange={e => updateSurveyMeta({ educationPeriodStart: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">교육기간 종료일</label>
                  <input
                    type="date"
                    value={surveyMeta.educationPeriodEnd}
                    onChange={e => updateSurveyMeta({ educationPeriodEnd: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            )}
            {(role === 'educator' || role === 'headNurse') && (
              <div className="text-xs text-gray-400">
                {surveyMeta.department && <p>부서: {surveyMeta.department}</p>}
                {surveyMeta.deploymentDate && <p>배치일: {surveyMeta.deploymentDate}</p>}
                {surveyMeta.educationPeriodStart && (
                  <p>교육기간: {surveyMeta.educationPeriodStart} ~ {surveyMeta.educationPeriodEnd}</p>
                )}
                {!surveyMeta.department && !surveyMeta.deploymentDate && !surveyMeta.educationPeriodStart && (
                  <p>프리셉티/프리셉터가 먼저 입력합니다</p>
                )}
              </div>
            )}
          </div>

          {visibleItems.map(item => {
            const result = getResult(item.id)
            if (!result) return null
            return (
              <ChecklistCard
                key={item.id}
                item={item}
                result={result}
                role={role}
                isLocked={isSubmitted}
                onScoreChange={score => updateEvaluation(item.id, role, { score })}
                onEvaluationPatch={patch => updateEvaluation(item.id, role, patch)}
              />
            )
          })}
        </main>

        {/* 최종 제출 버튼 (하단 고정) */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            {role === 'headNurse' && headNurseAvgScore !== null && (
              <span className={`text-sm font-semibold ${headNurseAvgScore < 70 ? 'text-red-500' : 'text-green-600'}`}>
                평균 {headNurseAvgScore.toFixed(1)}점
              </span>
            )}
            <button
              onClick={handleFinalSubmitStart}
              disabled={isSubmitted}
              className="ml-auto bg-purple-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitted ? '제출완료' : '최종 제출'}
            </button>
          </div>
        </div>
      </div>

      {showLowScore && (
        <LowScoreModal
          score={pendingScore}
          onConfirm={handleLowScoreConfirm}
          onCancel={() => setShowLowScore(false)}
        />
      )}

      {signMode !== null && (
        <SignaturePad
          onSave={handleSignSave}
          onCancel={() => setSignMode(null)}
          signerName={signerName}
          onSignerNameChange={setSignerName}
        />
      )}

      {showServerLoad && (
        <ServerLoadModal
          sessions={serverSessions}
          error={serverLoadError}
          onSelect={handleServerLoadSelect}
          onClose={() => setShowServerLoad(false)}
        />
      )}
    </>
  )
}
