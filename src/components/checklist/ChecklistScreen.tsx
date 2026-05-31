import { useMemo, useState, useRef } from 'react'
import { useAppContext } from '../../features/checklist/ChecklistContext'
import { useEvaluations } from '../../features/evaluations/useEvaluations'
import { getChecklist } from '../../data/checklistData'
import { ROLE_LABELS } from '../../types/userRole'
import type { ChecklistSession } from '../../types/evaluation'
import { gasSaveWithExcel, gasSaveSession, gasListSessions, gasLoadSession, gasDeleteTempFiles, gasSaveSignatureImage } from '../../lib/googleDrive/gasClient'
import type { SessionMeta } from '../../lib/googleDrive/gasClient'
import ChecklistCard from './ChecklistCard'
import LowScoreModal from '../common/LowScoreModal'
import SignaturePad from '../signature/SignaturePad'
import ServerLoadModal from '../common/ServerLoadModal'
import SaveCompleteModal from '../common/SaveCompleteModal'
import SavingModal from '../common/SavingModal'
import FinalSubmitModal from '../common/FinalSubmitModal'
import UnansweredModal from '../common/UnansweredModal'
import { buildUnifiedFileName } from '../../lib/excel/fileNames'

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
  } = useEvaluations(allItems, { weekType, targetName: subject.name, subjectEmployeeId: subject.employeeId })

  const [bulkDate, setBulkDate] = useState('')
  const bulkScoreApplied = useRef(false)

  const [showLowScore, setShowLowScore] = useState(false)
  const [pendingScore, setPendingScore] = useState(0)
  const [lowScoreReason, setLowScoreReason] = useState('')

  const [signMode, setSignMode] = useState<'submit' | 'batch' | null>(null)
  const [signerName, setSignerName] = useState('')

  const [serverStatus, setServerStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showSaving, setShowSaving] = useState(false)
  const [showSaveComplete, setShowSaveComplete] = useState(false)
  const [showServerLoad, setShowServerLoad] = useState(false)
  const [serverSessions, setServerSessions] = useState<SessionMeta[]>([])
  const [serverLoadError, setServerLoadError] = useState('')

  const [showFinalSubmit, setShowFinalSubmit] = useState(false)
  const [showUnanswered, setShowUnanswered] = useState(false)
  const [unansweredNums, setUnansweredNums] = useState<number[]>([])

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

  // 교육자 평가 총점 백분율 (최종제출 확인용)
  const evalScorePct = useMemo(() => {
    if (role === 'preceptee') return null
    const maxScore = visibleItems.length * 3
    if (maxScore === 0) return null
    return Math.round((totalScore / maxScore) * 100 * 10) / 10
  }, [totalScore, visibleItems, role])

  const hasSigned = useMemo(() => {
    return visibleItems.some(item => {
      const r = getResult(item.id)
      return r && r[roleField].signatureImage !== null
    })
  }, [results, visibleItems, roleField, getResult])

  // 기존 서명 이미지 (재사용용)
  const existingSignature = useMemo(() => {
    for (const r of results) {
      const ev = r[roleField as keyof typeof r] as { signatureImage?: string | null }
      if (ev.signatureImage) return ev.signatureImage as string
    }
    return null
  }, [results, roleField])

  const isSubmitted = submittedRoles[role] != null

  const currentEvaluatorId = role === 'preceptee' ? (subject.employeeId || '')
    : role === 'preceptor' ? (evaluatorInfo?.employeeId || '')
    : role === 'educator' ? (evaluatorInfo?.employeeId || '')
    : (evaluatorInfo?.employeeId || '')

  const currentEvaluatorName = role === 'preceptee' ? (subject.name || '')
    : (evaluatorInfo?.name || '')

  function buildFileNames() {
    const base = {
      subjectEmployeeId: subject.employeeId || '',
      subjectName: subject.name || '',
      role,
      evaluatorName: currentEvaluatorName,
      evaluatorId: currentEvaluatorId,
    }
    return {
      tempJson: buildUnifiedFileName({ ...base, status: '임시저장', ext: 'json' }),
      tempXlsx: buildUnifiedFileName({ ...base, status: '임시저장', ext: 'xlsx' }),
      finalXlsx: buildUnifiedFileName({ ...base, status: '최종제출', ext: 'xlsx' }),
      finalJson: buildUnifiedFileName({ ...base, status: '최종제출', ext: 'json' }),
    }
  }

  function buildSubjectFolderName(): string {
    return `${subject.employeeId}_${subject.name}_${surveyMeta.department || '미입력'}`
  }

  function buildSession(extra?: Partial<ChecklistSession>): ChecklistSession {
    return {
      id: `${subject.employeeId || 'no-id'}_${weekType}_${Date.now()}`,
      targetName: subject.name,
      employeeId: subject.employeeId || undefined,
      preceptorId: evaluatorInfo && role === 'preceptor' ? evaluatorInfo.employeeId : evaluatorMeta.preceptorId,
      preceptorName: evaluatorInfo && role === 'preceptor' ? evaluatorInfo.name : evaluatorMeta.preceptorName,
      educatorId: evaluatorInfo && role === 'educator' ? evaluatorInfo.employeeId : evaluatorMeta.educatorId,
      educatorPersonName: evaluatorInfo && role === 'educator' ? evaluatorInfo.name : evaluatorMeta.educatorPersonName,
      headNurseName: evaluatorInfo && role === 'headNurse' ? evaluatorInfo.name : evaluatorMeta.headNurseName,
      weekType,
      department: surveyMeta.department,
      startDate: surveyMeta.deploymentDate,
      surveyMeta: (surveyMeta.department || surveyMeta.deploymentDate || surveyMeta.educationPeriodStart)
        ? surveyMeta : undefined,
      results,
      savedAt: new Date().toISOString(),
      submittedRoles: Object.keys(submittedRoles).length > 0 ? submittedRoles : undefined,
      ...extra,
    }
  }

  function handleBulkDateChange(date: string) {
    setBulkDate(date)
    if (!date) return
    allItems.forEach(item => {
      updateEvaluation(item.id, 'preceptee', { educationDate: date })
    })
  }

  // B안: 첫 점수 입력 시 미채점 전 문항 일괄 적용
  function handleScoreChange(itemId: string, score: number) {
    const hasAnyScore = visibleItems.some(item => {
      const r = getResult(item.id)
      return r && r[roleField].score !== null
    })
    if (!hasAnyScore && !bulkScoreApplied.current) {
      bulkScoreApplied.current = true
      visibleItems.forEach(item => {
        updateEvaluation(item.id, role, { score })
      })
    } else {
      updateEvaluation(itemId, role, { score })
    }
  }

  /** 임시저장(서버) */
  async function handleServerSave() {
    if (doneCount > 0 && !hasSigned) {
      alert('전자서명을 먼저 완료해주세요.')
      return
    }
    setServerStatus('saving')
    setShowSaving(true)
    try {
      const session = buildSession()
      const { tempJson, tempXlsx } = buildFileNames()
      const subjectFolderName = buildSubjectFolderName()
      try {
        const { buildExcelBuffer } = await import('../../lib/excel/exportExcel')
        const { buffer } = await buildExcelBuffer(session, false)
        await gasSaveWithExcel(session, buffer, tempXlsx, subjectFolderName, tempJson)
      } catch {
        await gasSaveSession(session, tempJson)
      }
      setShowSaving(false)
      setServerStatus('saved')
      setShowSaveComplete(true)
    } catch {
      setShowSaving(false)
      setServerStatus('error')
      setTimeout(() => setServerStatus('idle'), 3000)
    }
  }

  /** 최종제출 XLSX + JSON → subject 폴더, 임시 파일 파기 */
  async function handleServerSaveWithExcel(sessionWithFinal: ChecklistSession) {
    const subjectFolderName = buildSubjectFolderName()
    const { tempJson, tempXlsx, finalXlsx } = buildFileNames()
    try {
      const { buildExcelBuffer } = await import('../../lib/excel/exportExcel')
      const { buffer } = await buildExcelBuffer(sessionWithFinal, true)
      await gasSaveWithExcel(sessionWithFinal, buffer, finalXlsx, subjectFolderName, tempJson)
      await gasDeleteTempFiles(tempJson, subjectFolderName, tempXlsx)
    } catch {
      await gasSaveSession(sessionWithFinal, tempJson)
    }
  }

  async function handleServerLoadOpen() {
    setServerLoadError('')
    setShowServerLoad(true)
    try {
      const list = await gasListSessions(subject.employeeId || '', weekType)
      setServerSessions(list)
    } catch (err) {
      setServerLoadError(err instanceof Error ? err.message : '서버 오류')
    }
  }

  async function handleServerLoadSelect(fileId: string) {
    try {
      const session = await gasLoadSession(fileId)
      loadFromSession(session)
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

  function handleFinalSubmitStart() {
    if (doneCount > 0 && !hasSigned) {
      alert('전자서명을 먼저 완료해주세요.')
      return
    }

    // 미답변 문항 체크 (블록)
    const unanswered = visibleItems
      .filter(item => {
        const r = getResult(item.id)
        return !r || r[roleField].score === null
      })
      .map(item => {
        const numStr = item.id.replace(`${weekType}_`, '')
        return parseInt(numStr, 10)
      })
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b)

    if (unanswered.length > 0) {
      setUnansweredNums(unanswered)
      setShowUnanswered(true)
      return
    }

    // 수간호사 70점 미만 체크
    if (role === 'headNurse') {
      const score = headNurseAvgScore ?? 0
      if (score < 70) {
        setPendingScore(score)
        setShowLowScore(true)
        return
      }
    }

    setShowFinalSubmit(true)
  }

  function handleLowScoreConfirm(reason: string) {
    setLowScoreReason(reason)
    setShowLowScore(false)
    setShowFinalSubmit(true)
  }

  async function doFinalSubmit() {
    setShowFinalSubmit(false)
    const now = new Date().toISOString()
    const name = signerName.trim() || currentEvaluatorName

    // 기존 서명 재사용 or 새 서명 필요
    if (existingSignature) {
      await applySignatureAndSubmit(existingSignature, now, name)
    } else {
      setSignMode('submit')
    }
  }

  async function applySignatureAndSubmit(dataUrl: string, now: string, name: string) {
    visibleItems.forEach(item => {
      const r = getResult(item.id)
      if (r && r[roleField].score !== null) {
        updateEvaluation(item.id, role, { signatureImage: dataUrl, signerName: name, signedAt: now })
      }
    })
    submitRole(role)

    const finalSession = buildSession({
      submittedRoles: { ...submittedRoles, [role]: now },
      lowScoreReason: lowScoreReason || undefined,
    })
    await handleServerSaveWithExcel(finalSession)
    reset()
  }

  async function handleSignSave(dataUrl: string) {
    const now = new Date().toISOString()
    const name = signerName.trim() || currentEvaluatorName

    // 서명 이미지 Drive 저장 (fire-and-forget)
    const sigBase64 = dataUrl.split(',')[1]
    gasSaveSignatureImage(sigBase64, name, currentEvaluatorId).catch(() => {})

    if (signMode === 'submit') {
      await applySignatureAndSubmit(dataUrl, now, name)
      setSignMode(null)
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

  function handleSignatureButtonClick() {
    setSignerName(evaluatorInfo?.name ?? currentEvaluatorName)
    if (existingSignature && hasSigned) {
      // 기존 서명 재사용: 즉시 배치 서명
      const now = new Date().toISOString()
      const name = evaluatorInfo?.name ?? currentEvaluatorName
      visibleItems.forEach(item => {
        const r = getResult(item.id)
        if (r && r[roleField].score !== null) {
          updateEvaluation(item.id, role, { signatureImage: existingSignature, signerName: name, signedAt: now })
        }
      })
      alert('기존 서명이 적용되었습니다.')
    } else {
      setSignMode('batch')
    }
  }

  const headerInfo = `${subject.name}${subject.employeeId ? ' · ' + subject.employeeId : ''}`

  const serverBtnLabel =
    serverStatus === 'saving' ? '저장중...' :
    serverStatus === 'error' ? '오류' : '임시저장'

  const serverBtnClass =
    serverStatus === 'error' ? 'text-xs text-white bg-red-500 rounded-lg px-2 py-1' :
    'text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-2 py-1 disabled:opacity-60'

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-3 py-2">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-400 truncate">{weekType === '4week' ? '4주' : '8주'} · {ROLE_LABELS[role]}</p>
                <p className="text-sm font-semibold text-gray-800 truncate">{headerInfo}</p>
                <p className="text-xs text-gray-500">
                  완료 {doneCount}/{visibleItems.length} · 합계 {totalScore}점
                  {isSubmitted && <span className="ml-2 text-green-600 font-medium">제출완료</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                <button
                  onClick={handleSignatureButtonClick}
                  className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50"
                >
                  전자서명{hasSigned ? ' ✓' : ''}
                </button>
                <button
                  onClick={handleServerLoadOpen}
                  className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-2 py-1 hover:bg-indigo-50"
                >
                  불러오기
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
                      .then(m => m.exportToExcel(buildSession(), isSubmitted))
                      .catch(e => alert((e as Error).message))
                  }
                  className="text-xs text-white bg-green-600 hover:bg-green-700 rounded-lg px-2 py-1"
                >
                  엑셀
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

        <main className="max-w-3xl mx-auto px-2 py-2 flex flex-col gap-1.5 pb-28">
          {/* 설문 정보 */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 mb-2">설문 정보</p>
            {role === 'preceptee' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">부서</label>
                  <input type="text" value={surveyMeta.department}
                    onChange={e => updateSurveyMeta({ department: e.target.value })}
                    placeholder="예) 내과병동"
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">배치일</label>
                  <input type="date" value={surveyMeta.deploymentDate}
                    onChange={e => updateSurveyMeta({ deploymentDate: e.target.value })}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">교육기간 시작일</label>
                  <input type="date" value={surveyMeta.educationPeriodStart}
                    onChange={e => updateSurveyMeta({ educationPeriodStart: e.target.value })}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">교육기간 종료일</label>
                  <input type="date" value={surveyMeta.educationPeriodEnd}
                    onChange={e => updateSurveyMeta({ educationPeriodEnd: e.target.value })}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-0.5">교육 실행일 (전체 일괄 적용)</label>
                  <input type="date" value={bulkDate}
                    onChange={e => handleBulkDateChange(e.target.value)}
                    className="w-full border border-blue-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
                  <p className="text-xs text-gray-400 mt-0.5">선택 시 전 문항 일괄 적용 · 각 문항에서 개별 수정 가능</p>
                </div>
              </div>
            )}
            {role === 'preceptor' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">부서</label>
                  <input type="text" value={surveyMeta.department}
                    onChange={e => updateSurveyMeta({ department: e.target.value })}
                    placeholder="예) 내과병동"
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">교육기간 시작일</label>
                  <input type="date" value={surveyMeta.educationPeriodStart}
                    onChange={e => updateSurveyMeta({ educationPeriodStart: e.target.value })}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">교육기간 종료일</label>
                  <input type="date" value={surveyMeta.educationPeriodEnd}
                    onChange={e => updateSurveyMeta({ educationPeriodEnd: e.target.value })}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
                </div>
              </div>
            )}
            {(role === 'educator' || role === 'headNurse') && (
              <div className="text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-0.5">
                {surveyMeta.department && <span>부서: {surveyMeta.department}</span>}
                {surveyMeta.deploymentDate && <span>배치일: {surveyMeta.deploymentDate}</span>}
                {surveyMeta.educationPeriodStart && (
                  <span>교육기간: {surveyMeta.educationPeriodStart} ~ {surveyMeta.educationPeriodEnd}</span>
                )}
                {!surveyMeta.department && !surveyMeta.deploymentDate && !surveyMeta.educationPeriodStart && (
                  <span>프리셉티/프리셉터가 먼저 입력합니다</span>
                )}
              </div>
            )}
          </div>

          {/* 첫 점수 자동 적용 안내 */}
          {doneCount === 0 && !bulkScoreApplied.current && visibleItems.length > 1 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
              첫 번째 점수 입력 시 전체 문항에 자동 적용됩니다. 이후 개별 수정하세요.
            </div>
          )}

          {/* 체크리스트 카드 */}
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
                onScoreChange={score => handleScoreChange(item.id, score)}
                onEvaluationPatch={patch => updateEvaluation(item.id, role, patch)}
              />
            )
          })}
        </main>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-3 py-2">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
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

      {showFinalSubmit && (
        <FinalSubmitModal
          role={role}
          evaluatorName={currentEvaluatorName}
          evaluatorId={currentEvaluatorId}
          evalScorePct={evalScorePct}
          onConfirm={doFinalSubmit}
          onCancel={async () => {
            setShowFinalSubmit(false)
            await handleServerSave()
          }}
        />
      )}

      {showUnanswered && (
        <UnansweredModal
          itemNums={unansweredNums}
          onClose={() => setShowUnanswered(false)}
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

      {showSaving && <SavingModal />}

      {showSaveComplete && (
        <SaveCompleteModal
          onGoHome={() => { setShowSaveComplete(false); setServerStatus('idle'); reset() }}
          onContinue={() => { setShowSaveComplete(false); setServerStatus('idle') }}
        />
      )}
    </>
  )
}
