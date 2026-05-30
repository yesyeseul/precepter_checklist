import type { SessionMeta } from '../../lib/googleDrive/gasClient'

type Props = {
  sessions: SessionMeta[]
  error: string
  onSelect: (fileId: string) => void
  onClose: () => void
}

export default function ServerLoadModal({ sessions, error, onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">서버에서 불러오기</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {error && (
          <p className="text-sm text-red-500 mb-3">{error}</p>
        )}

        {!error && sessions.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">불러오는 중...</p>
        )}

        {sessions.length > 0 && (
          <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto">
            {sessions.map(s => (
              <li key={s.fileId}>
                <button
                  onClick={() => onSelect(s.fileId)}
                  className="w-full text-left border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(s.updatedAt).toLocaleString('ko-KR')}</p>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50"
        >
          취소
        </button>
      </div>
    </div>
  )
}
