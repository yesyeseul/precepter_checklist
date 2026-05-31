import type { ChecklistSession } from '../../types/evaluation'

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzQJCAp1L36NkqFKDj0P79vbVrp3xvxb0SCuTOv484G39gKVPl_UfDlux3ugLOuOhZOnQ/exec'

export type SessionMeta = {
  fileId: string
  name: string
  updatedAt: string
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * JSON + XLSX 둘 다 Drive의 대상자 폴더에 저장.
 * text/plain body → GAS e.postData.contents 로 수신.
 */
export async function gasSaveWithExcel(
  session: ChecklistSession,
  xlsxBuffer: ArrayBuffer,
  xlsxFileName: string,
  subjectFolderName: string,
): Promise<void> {
  const xlsxBase64 = arrayBufferToBase64(xlsxBuffer)
  await fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ session, xlsxBase64, xlsxFileName, subjectFolderName }),
  })
}

/** JSON만 임시저장 폴더에 저장 */
export async function gasSaveSession(session: ChecklistSession): Promise<void> {
  await fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ session, folderType: 'temp' }),
  })
}

export async function gasListSessions(): Promise<SessionMeta[]> {
  const res = await fetch(`${GAS_URL}?action=list`, { mode: 'cors' })
  if (!res.ok) throw new Error(`서버 오류: ${res.status}`)
  const json = await res.json() as { sessions?: SessionMeta[]; error?: string }
  if (json.error) throw new Error(json.error)
  return json.sessions ?? []
}

export async function gasLoadSession(fileId: string): Promise<ChecklistSession> {
  const res = await fetch(`${GAS_URL}?action=load&fileId=${encodeURIComponent(fileId)}`, { mode: 'cors' })
  if (!res.ok) throw new Error(`서버 오류: ${res.status}`)
  const json = await res.json() as ChecklistSession & { error?: string }
  if ('error' in json && json.error) throw new Error(json.error)
  return json
}
