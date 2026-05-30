import type { ChecklistSession } from '../../types/evaluation'

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzQJCAp1L36NkqFKDj0P79vbVrp3xvxb0SCuTOv484G39gKVPl_UfDlux3ugLOuOhZOnQ/exec'

export type SessionMeta = {
  fileId: string
  name: string
  updatedAt: string
}

/** Fire-and-forget POST — GAS does not support CORS preflight */
export async function gasSaveSession(session: ChecklistSession): Promise<void> {
  const body = new URLSearchParams({ data: JSON.stringify(session) })
  await fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  // no-cors → opaque response, cannot check status
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
