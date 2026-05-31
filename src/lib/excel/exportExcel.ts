import ExcelJS from 'exceljs'
import type { ChecklistSession } from '../../types/evaluation'

const SHEET_NAME: Record<string, string> = {
  '4week': '체크리스트(4주)0~3점평가)',
  '8week': '체크리스트(8주)(0~3점평가) (2)',
}

// 원본 엑셀의 열 인덱스 (1-based for ExcelJS)
const COL = {
  NUM: 1,            // A: 연번
  CONTENT: 6,        // F: 교육 내용
  SIGN_DATE: 8,      // H: 교육 실행일
  SIGNER: 9,         // I: 교육자 서명
  SELF_SCORE: 10,    // J: 자가평가
  EVAL_SCORE: 11,    // K: 교육자 평가
}

async function loadWorkbook(weekType: string): Promise<{ workbook: ExcelJS.Workbook; sheet: ExcelJS.Worksheet }> {
  const templateUrl = import.meta.env.BASE_URL + 'templates/checklist-template.xlsx'
  const response = await fetch(templateUrl)
  if (!response.ok) throw new Error('템플릿 파일을 불러올 수 없습니다.')
  const arrayBuffer = await response.arrayBuffer()

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)

  const sheet = workbook.getWorksheet(SHEET_NAME[weekType])
  if (!sheet) throw new Error('시트를 찾을 수 없습니다.')

  return { workbook, sheet }
}

function fillSheet(sheet: ExcelJS.Worksheet, session: ChecklistSession) {
  const { results, weekType } = session

  // 결과 Map
  const resultMap = new Map(results.map(r => {
    const numStr = r.itemId.replace(`${weekType}_`, '')
    return [parseInt(numStr, 10), r]
  }))

  // 데이터 행 순회 (17행부터)
  sheet.eachRow((row, rowNum) => {
    if (rowNum < 17) return
    const rawNum = row.getCell(COL.NUM).value
    if (rawNum === null || rawNum === undefined) return
    const num = parseInt(String(rawNum).replace('*', ''), 10)
    if (isNaN(num)) return

    const result = resultMap.get(num)
    if (!result) return

    // 자가평가 점수
    if (result.preceptee.score !== null) {
      row.getCell(COL.SELF_SCORE).value = result.preceptee.score
    }

    // 프리셉터 또는 교육전담 평가 점수 (어느 쪽이든 preceptor column에 씀)
    const evalResult = result.preceptor.score !== null ? result.preceptor : result.educator
    if (evalResult.score !== null) {
      row.getCell(COL.EVAL_SCORE).value = evalResult.score
      // 서명자명: session의 preceptorName 사용
      row.getCell(COL.SIGNER).value = session.preceptorName || evalResult.signerName || ''
      // 교육 실행일: per-item educationDate (preceptor 우선, educator fallback)
      const educationDate = result.preceptor.educationDate || result.educator.educationDate
      if (educationDate) {
        row.getCell(COL.SIGN_DATE).value = educationDate
      } else if (evalResult.signedAt) {
        row.getCell(COL.SIGN_DATE).value = evalResult.signedAt.slice(0, 10)
      }
    }
  })
}

function addSignatureImage(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, session: ChecklistSession) {
  // 프리셉터 서명 이미지 (프리셉터 문항 우선, 없으면 교육전담)
  const repSignImage = session.results.find(r => r.preceptor.signatureImage)?.preceptor.signatureImage
    ?? session.results.find(r => r.educator.signatureImage)?.educator.signatureImage
  if (repSignImage) {
    const base64 = repSignImage.split(',')[1]
    const imageId = workbook.addImage({ base64, extension: 'png' })
    sheet.addImage(imageId, {
      tl: { col: COL.SIGNER - 1, row: 7 },
      ext: { width: 80, height: 30 },
    })
  }
  // 수간호사 서명은 엑셀에 미포함 (수기로 처리)
}

/** 파일명 생성 */
export function buildExcelFileName(session: ChecklistSession): string {
  const weekLabel = session.weekType === '4week' ? '4주' : '8주'
  const dateStr = new Date().toISOString().slice(0, 10)
  return `신규간호사_체크리스트_${weekLabel}_${session.targetName || ''}_${dateStr}.xlsx`
}

/** 브라우저에서 바로 다운로드 */
export async function exportToExcel(session: ChecklistSession): Promise<void> {
  const { workbook, sheet } = await loadWorkbook(session.weekType)

  fillSheet(sheet, session)
  addSignatureImage(workbook, sheet, session)

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = buildExcelFileName(session)
  a.click()
  URL.revokeObjectURL(url)
}

/** 브라우저 다운로드 없이 ArrayBuffer + 파일명만 반환 (서버 업로드용) */
export async function buildExcelBuffer(session: ChecklistSession): Promise<{ buffer: ArrayBuffer; fileName: string }> {
  const { workbook, sheet } = await loadWorkbook(session.weekType)

  fillSheet(sheet, session)
  addSignatureImage(workbook, sheet, session)

  const buffer = await workbook.xlsx.writeBuffer()
  return { buffer, fileName: buildExcelFileName(session) }
}
