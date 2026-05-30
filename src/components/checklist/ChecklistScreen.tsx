import { useMemo, useRef, useState } from 'react'
import { useAppContext } from '../../features/checklist/ChecklistContext'
import { useEvaluations } from '../../features/evaluations/useEvaluations'
import { getChecklist } from '../../data/checklistData'
import { ROLE_LABELS } from '../../types/userRole'
import { downloadSession, readSessionFile } from '../../features/storage/jsonIO'
import type { ChecklistSession } from '../../types/evaluation'
import { gasSaveSession, gasListSessions, gasLoadSession } from '../../lib/googleDrive/gasClient'
import type { SessionMeta } from '../../lib/googleDrive/gasClient'
import ChecklistCard from './ChecklistCard'
import LowScoreModal from '../common/LowScoreModal'
import SignaturePad from '../signature/SignaturePad'
import ServerLoadModal from '../common/ServerLoadModal'

export default function ChecklistScreen() {
  const { role, weekType: rawWeekType, subject, reset } = useAppContext()
  const weekType = rawWeekType!
  if (!role || !rawWeekType) return null

  const allItems = useMemo(() => getChecklist(weekType), [weekType])

  const visibleItems = useMemo(() => {
    if (role === 'educator') return allItems.filter(i => i.evaluatorType === 'educator')
    if (role === 'preceptor') return allItems.filter(i => i.evaluatorType === 'preceptor')
    return allItems
  }, [allItems, role])

  const { results, updateEvaluation, getResult, loadFromSession } = useEvaluations(
    allItems,
    { weekType, targetName: subject.name, department: subject.department, startDate: subject.startDate }
  )

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showLowScore, setShowLowScore] = useState(false)
  const [pendingScore, setPendingScore] = useState(0)
  const [lowScoreReason, setLowScoreReason] = useState('')

  const [signMode, setSignMode] = useState<'final' | 'batch' | null>(null)
  const [signerName, setSignerName] = useState('')

  // 서버 연동 상태
  const [serverStatus, setServerStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showServerLoad, setShowServerLoad] = useState(false)
  const [serverSessions, setServerSessions] = useState<SessionMeta[]>([])
  const [serverLoadError, setServerLoadError] = useState('')

  const doneCount = useMemo(() => {
    const field = role === 'preceptee' ? 'preceptee'
      : role === 'preceptor' ? 'preceptor'
      : role === 'educator' ? 'educator'
      : 'headNurse'
    return visibleItems.filter(item => {
      const r = getResult(item.id)
      return r && r[field].score !== null
    }).length
  }, [results, visibleItems, role, getResult])

  const headNurseAvgScore = useMemo(() => {
    if (role !== 'headNurse') return null
    const scored = results.filter(r => r.headNurse.score !== null)
    if (!scored.length) return null
    const avg = scored.reduce((s, r) => s + (r.headNurse.score ?? 0), 0) / scored.length
    return (avg / 3) * 100
  }, [results, role])

  function buildSession(extra?: Partial<ChecklistSession>): ChecklistSession {
    return {
      id: `${subject.employeeId || 'no-id'}_${weekType}_${Date.now()}`,
      targetName: subject.name,
      weekType,
      department: subject.department,
      startDate: subject.startDate,
      results,
      savedAt: new Date().toISOString(),
      ...extra,
    }
  }

  function handleDownload(extra?: Partial<ChecklistSession>) {
    downloadSession(buildSession(extra))
  }

  async function handleServerSave() {
    setServerStatus('saving')
    try {
      await gasSaveSession(buildSession())
      setServerStatus('saved')
      setTimeout(() => setServerStatus('idle'), 2000)
    } catch {
      setServerStatus('error')
      setTimeout(() => setServerStatus('idle'), 3000)
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
    } catch (err) {
      alert(err instanceof Error ? err.message : '파일 오류')
    } finally {
      e.target.value = ''
    }
  }

  function handleFinalSignStart() {
    const score = headNurseAvgScore ?? 0
    if (score < 70) {
      setPendingScore(score)
      setShowLowScore(true)
    } else {
      setSignMode('final')
    }
  }

  function handleLowScoreConfirm(reason: string) {
    setLowScoreReason(reason)
    setShowLowScore(false)
    setSignMode('final')
  }

  function handleSignSave(dataUrl: string) {
    const now = new Date().toISOString()
    const name = signerName.trim()

    if (signMode === 'final') {
      results.forEach(r => {
        updateEvaluation(r.itemId, 'headNurse', { signatureImage: dataUrl, signerName: name, signedAt: now })
      })
      setSignMode(null)
      handleDownload({ lowScoreReason: lowScoreReason || undefined })
    } else if (signMode === 'batch') {
      const field = role === 'preceptee' ? 'preceptee'
        : role === 'preceptor' ? 'preceptor'
        : role === 'educator' ? 'educator'
        : 'headNurse'
      visibleItems.forEach(item => {
        const r = getResult(item.id)
        if (r && r[field].score !== null && role) {
          updateEvaluation(item.id, role, { signatureImage: dataUrl, signerName: name, signedAt: now })
        }
      })
      setSignMode(null)
    }
  }

  const headerInfo = `${subject.name} · ${subject.employeeId ? subject.employeeId + ' · ' : ''}${subject.department}`

  const serverBtnLabel =
    serverStatus === 'saving' ? '저장중...' :
    serverStatus === 'saved' ? '저장완료!' :
    serverStatus === 'error' ? '오류' : '서버저장'

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
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <span className="text-xs text-gray-500">{doneCount}/{visibleItems.length}</span>
                <button
                  onClick={() => { setSignerName(''); setSignMode('batch') }}
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
                  서버불러오기
                </button>
                <button
                  onClick={() => handleDownload()}
                  className="text-xs text-white bg-blue-500 hover:bg-blue-600 rounded-lg px-2 py-1"
                >
                  저장
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
                      .then(m => m.exportToExcel(results, weekType, subject.name))
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
          {visibleItems.map(item => {
            const result = getResult(item.id)
            if (!result) return null
            return (
              <ChecklistCard
                key={item.id}
                item={item}
                result={result}
                role={role}
                onScoreChange={score => updateEvaluation(item.id, role, { score })}
                onMemoChange={memo => updateEvaluation(item.id, role, { memo })}
                onEvaluationPatch={patch => updateEvaluation(item.id, role, patch)}
              />
            )
          })}
        </main>

        {role === 'headNurse' && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
              {headNurseAvgScore !== null && (
                <span className={`text-sm font-semibold ${headNurseAvgScore < 70 ? 'text-red-500' : 'text-green-600'}`}>
                  평균 {headNurseAvgScore.toFixed(1)}점
                </span>
              )}
              <button
                onClick={handleFinalSignStart}
                className="ml-auto bg-purple-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-purple-700"
              >
                최종 서명 및 저장
              </button>
            </div>
          </div>
        )}
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
