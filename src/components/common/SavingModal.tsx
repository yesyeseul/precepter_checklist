export default function SavingModal() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-8 flex flex-col items-center gap-4">
        <div className="w-9 h-9 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-gray-700">임시저장 중...</p>
      </div>
    </div>
  )
}
