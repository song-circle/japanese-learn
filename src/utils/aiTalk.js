// AI 회화 상대
//   API 키는 이 휴대폰의 localStorage에만 둔다(APK·저장소에는 없음). 본인만 쓰는 앱이라 서버 없이 직접 호출한다.
//   Claude(Anthropic SDK) 또는 Gemini(REST) 중 설정에서 고른다.

const KEY = 'japanese-learn-ai'

export const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (교정이 가장 꼼꼼)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (가장 싸고 빠름)' },
]
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

export function loadAiSettings() {
  try {
    return { provider: 'claude', apiKey: '', model: CLAUDE_MODELS[0].id, geminiModel: DEFAULT_GEMINI_MODEL, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { provider: 'claude', apiKey: '', model: CLAUDE_MODELS[0].id, geminiModel: DEFAULT_GEMINI_MODEL }
  }
}

export function saveAiSettings(s) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

// ---------- 응답 형식 ----------

const line = {
  type: 'object',
  properties: {
    ja: { type: 'string' },
    pron: { type: 'string' },
    ko: { type: 'string' },
  },
  required: ['ja', 'pron', 'ko'],
  additionalProperties: false,
}

const SCHEMA = {
  type: 'object',
  properties: {
    feedback: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        better_ja: { type: 'string' },
        better_pron: { type: 'string' },
        note_ko: { type: 'string' },
      },
      required: ['ok', 'better_ja', 'better_pron', 'note_ko'],
      additionalProperties: false,
    },
    reply: line,
    suggestions: { type: 'array', items: line },
    done: { type: 'boolean' },
  },
  required: ['feedback', 'reply', 'suggestions', 'done'],
  additionalProperties: false,
}

// 상황에서 AI가 맡을 역할: '나'가 아닌 첫 화자
export function roleOf(situation) {
  return situation.sentences.find((s) => s.who !== '나')?.who ?? '상대'
}

function systemPrompt(situation) {
  const role = roleOf(situation)
  const list = situation.sentences.map((s) => `- [${s.who}] ${s.ja} (${s.ko})`).join('\n')
  return `당신은 일본어를 막 배우기 시작한 한국인과 상황극으로 회화 연습을 하는 상대입니다.

## 학습자
- 히라가나를 읽지 못하고 귀로만 배웁니다. 그래서 일본어마다 한글 발음(pron)을 꼭 붙입니다. 장음은 '-'로 적습니다(예: 아리가토- 고자이마스).
- 학습자의 말은 휴대폰 음성 인식으로 받아 적은 것이라 인식 오류가 섞일 수 있습니다. 뜻이 통하면 너그럽게 봅니다.
- 학습자가 한국어로 말하면, 일본어로 어떻게 말하는지 몰라서 물어본 것입니다.

## 상황
- 장소: ${situation.scene} (${situation.name})
- 당신의 역할: ${role}. 학습자는 손님/여행자인 '나'입니다.
- 학습자가 배운 문장(되도록 이 범위의 말로 대화합니다):
${list}

## 대화 규칙
- reply: 역할에 맞는 다음 대사 한 문장. 아주 쉽고 짧은 일본어로, 위 문장들을 최대한 그대로 씁니다. ko는 자연스러운 한국어 뜻.
- feedback: 학습자의 바로 앞 말에 대한 평가.
  - 뜻이 통하고 자연스러우면 ok=true, better_ja·better_pron·note_ko는 빈 문자열.
  - 틀렸거나 어색하면 ok=false, better_ja에 고친 일본어, better_pron에 한글 발음, note_ko에 무엇이 달랐는지 한국어 한 문장.
  - 학습자가 한국어로 말했으면 ok=false, better_ja에 그 말을 일본어로, note_ko에 "이렇게 말해 보세요" 같은 안내.
  - 대화 시작(학습자의 말이 '(시작)')이면 ok=true, 나머지는 빈 문자열.
- suggestions: 학습자가 다음에 할 수 있는 대답 2개(배운 문장에서 고르거나 아주 쉬운 문장).
- 주고받기 6번쯤이면 상황을 자연스럽게 마무리하는 대사를 하고 done=true. 그 전에는 done=false.

## 출력
다음 JSON 하나만 출력합니다.
{"feedback":{"ok":true,"better_ja":"","better_pron":"","note_ko":""},"reply":{"ja":"...","pron":"...","ko":"..."},"suggestions":[{"ja":"...","pron":"...","ko":"..."}],"done":false}`
}

// history: [{ role: 'user', text }, { role: 'assistant', data }] 순서. 첫 user text는 '(시작)'
export async function talkTurn(settings, situation, history) {
  if (!settings.apiKey) throw new Error('no-key')
  return settings.provider === 'gemini'
    ? geminiTurn(settings, situation, history)
    : claudeTurn(settings, situation, history)
}

async function claudeTurn(settings, situation, history) {
  // 본인 휴대폰에서 본인 키로만 쓰는 앱이라 브라우저(WebView) 직접 호출을 허용한다
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true })
  const response = await client.beta.messages.create({
    model: settings.model,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: systemPrompt(situation),
    messages: history.map((h) => ({
      role: h.role,
      content: h.role === 'user' ? h.text : JSON.stringify(h.data),
    })),
  })
  if (response.stop_reason === 'refusal') throw new Error('refusal')
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  return JSON.parse(text)
}

async function geminiTurn(settings, situation, history) {
  const model = settings.geminiModel || DEFAULT_GEMINI_MODEL
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(situation) }] },
      contents: history.map((h) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.role === 'user' ? h.text : JSON.stringify(h.data) }],
      })),
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
  return JSON.parse(text)
}

// 사용자에게 보여 줄 오류 문구
export function errorText(e) {
  const msg = String(e?.message ?? e)
  if (msg === 'no-key') return 'API 키를 먼저 넣어 주세요.'
  if (msg === 'refusal') return 'AI가 이 요청에 답하지 않았어요. 다시 시도해 주세요.'
  if (e?.status === 401 || /401|API key not valid|invalid x-api-key/i.test(msg)) return 'API 키가 맞지 않아요. 설정에서 확인해 주세요.'
  if (e?.status === 429 || /429/.test(msg)) return '요청이 너무 많거나 한도를 넘었어요. 잠시 뒤에 다시 해 주세요.'
  if (/Failed to fetch|NetworkError|Connection/i.test(msg)) return '인터넷 연결을 확인해 주세요.'
  return `AI 오류: ${msg.slice(0, 200)}`
}
