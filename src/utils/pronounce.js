// 발음 점수: Azure Speech 발음 평가(Pronunciation Assessment, ja-JP)
//   키·지역은 AI 설정(loadAiSettings)의 azureKey·azureRegion에 둔다. 이 휴대폰의 localStorage에만 저장.
//   마이크로 한 번 듣고(말이 끝나면 자동으로 멈춤) 알아들은 글자와 점수를 함께 돌려준다.
//   reference(정답 문장)가 있으면 그 문장과 비교하고(빠진 단어도 잡음), 없으면 말한 그대로 발음만 평가한다.

let current = null // 듣는 중인 recognizer (멈추기용)

export function azureReady(settings) {
  return !!(settings?.azureKey && settings?.azureRegion)
}

// 결과: { text, pron, accuracy, fluency, completeness, words: [{ word, score, error }] }
// 아무 말도 못 알아들으면 null. 권한 거부는 Error('permission'), 키 오류는 Error('azure-auth')
export async function assessOnce(settings, reference = '') {
  const sdk = await import('microsoft-cognitiveservices-speech-sdk')
  const speechConfig = sdk.SpeechConfig.fromSubscription(settings.azureKey, settings.azureRegion)
  speechConfig.speechRecognitionLanguage = 'ja-JP'
  speechConfig.outputFormat = sdk.OutputFormat.Detailed

  let audioConfig
  try {
    audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput()
  } catch {
    throw new Error('permission')
  }
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)
  const pa = new sdk.PronunciationAssessmentConfig(
    reference,
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Word,
    !!reference, // 정답 문장이 있을 때만 빠진 말·덧붙인 말을 잡는다
  )
  pa.applyTo(recognizer)
  current = recognizer

  try {
    const result = await new Promise((resolve, reject) => recognizer.recognizeOnceAsync(resolve, reject))
    if (result.reason === sdk.ResultReason.NoMatch) return null
    if (result.reason === sdk.ResultReason.Canceled) {
      const c = sdk.CancellationDetails.fromResult(result)
      if (c.reason === sdk.CancellationReason.EndOfStream) return null
      if (c.errorCode === sdk.CancellationErrorCode.AuthenticationFailure || /401|403|auth/i.test(c.errorDetails)) {
        throw new Error('azure-auth')
      }
      if (/permission|NotAllowed|microphone/i.test(c.errorDetails)) throw new Error('permission')
      throw new Error(c.errorDetails || 'azure-error')
    }
    const pr = sdk.PronunciationAssessmentResult.fromResult(result)
    const words = (pr.detailResult?.Words ?? []).map((w) => ({
      word: w.Word,
      score: Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0),
      error: w.PronunciationAssessment?.ErrorType ?? 'None',
    }))
    return {
      text: result.text ?? '',
      reference,
      pron: Math.round(pr.pronunciationScore ?? 0),
      accuracy: Math.round(pr.accuracyScore ?? 0),
      fluency: Math.round(pr.fluencyScore ?? 0),
      completeness: reference ? Math.round(pr.completenessScore ?? 0) : null,
      words,
    }
  } catch (e) {
    const msg = String(e?.message ?? e)
    if (/NotAllowedError|Permission|denied/i.test(msg) && msg !== 'azure-auth') throw new Error('permission')
    throw e instanceof Error ? e : new Error(msg)
  } finally {
    current = null
    recognizer.close()
  }
}

export function stopAssess() {
  try {
    current?.close()
  } catch {
    /* 이미 끝남 */
  }
  current = null
}

// 단어 점수 → 색
export function scoreColor(score, error) {
  if (error === 'Omission') return '#9E9E9E'
  if (score >= 80) return '#4CAF50'
  if (score >= 60) return '#FF9800'
  return '#F44336'
}

export function pronErrorText(e) {
  const msg = String(e?.message ?? e)
  if (msg === 'permission') return '마이크 권한이 필요해요. 설정에서 마이크를 허용해 주세요.'
  if (msg === 'azure-auth') return 'Azure 키나 지역이 맞지 않아요. AI 회화 ⚙️ 설정에서 확인해 주세요.'
  if (/network|websocket|1006|Failed to fetch/i.test(msg)) return '인터넷 연결을 확인해 주세요.'
  return `발음 평가 오류: ${msg.slice(0, 150)}`
}
