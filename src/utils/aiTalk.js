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

// azureKey·azureRegion: 발음 점수(Azure Speech)용. 비어 있으면 발음 점수 없이 기기 음성 인식만 쓴다
// level: 'easy'(배운 문장 그대로) | 'normal'(조금 더 자연스럽게)
const DEFAULTS = {
  provider: 'claude', apiKey: '', model: CLAUDE_MODELS[0].id, geminiModel: DEFAULT_GEMINI_MODEL,
  azureKey: '', azureRegion: 'koreacentral', level: 'easy',
}

export function loadAiSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
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

// 대화마다 하나를 골라 같은 상황이라도 전개가 달라지게 한다
const TWISTS = [
  '평범하게, 이 장소에서 가장 흔한 순서대로 진행합니다.',
  '중간에 이 장소에서 흔히 묻는 질문을 하나 더 합니다(예: 봉투·사이즈·인원수·결제 방법·포장 여부 등 장소에 맞는 것).',
  '중간에 작은 문제가 하나 생깁니다(예: 품절, 자리 없음, 시간이 걸림, 다른 것을 권함 등 장소에 맞는 것). 학습자가 대처하게 합니다.',
  '상대가 친근하게 짧은 잡담을 한 번 건넵니다(예: 어디서 왔는지, 날씨, 여행 중인지).',
  '상대가 먼저 말을 건 뒤, 학습자가 무언가를 부탁하거나 물어보도록 이끕니다(예: "무엇을 찾으세요?").',
]

export function newPlan(settings) {
  return {
    level: settings.level === 'normal' ? 'normal' : 'easy',
    twist: TWISTS[Math.floor(Math.random() * TWISTS.length)],
  }
}

const LEVEL_RULE = {
  easy: '아주 쉽고 짧은 일본어로, 위 문장들을 최대한 그대로 씁니다.',
  normal: '실제 점원·상대처럼 자연스러운 일본어로 말하되 한 문장은 짧게 합니다. 배운 문장을 바탕으로, 이 장소에서 흔히 듣는 표현을 조금 섞어도 됩니다.',
}

function systemPrompt(situation, plan = { level: 'easy', twist: TWISTS[0] }) {
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
- 이번 대화의 전개: ${plan.twist}

## 대화 규칙
- reply: 역할에 맞는 다음 대사 한 문장. ${LEVEL_RULE[plan.level] ?? LEVEL_RULE.easy} ko는 자연스러운 한국어 뜻.
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
export async function talkTurn(settings, situation, history, plan) {
  const messages = history.map((h) => ({
    role: h.role,
    text: h.role === 'user' ? h.text : JSON.stringify(h.data),
  }))
  return callJson(settings, systemPrompt(situation, plan), messages, SCHEMA)
}

// ---------- 발음 설명 ----------
// Azure 점수를 받아, 점수가 낮은 단어를 한국인이 흔히 틀리는 점에 비추어 한국어로 설명한다.
// AI는 소리를 직접 듣지 않으므로 '이럴 가능성이 높다'로 설명하게 한다.

const EXPLAIN_SCHEMA = {
  type: 'object',
  properties: {
    summary_ko: { type: 'string' },
    tips: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          pron: { type: 'string' },
          tip_ko: { type: 'string' },
        },
        required: ['word', 'pron', 'tip_ko'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary_ko', 'tips'],
  additionalProperties: false,
}

const EXPLAIN_SYSTEM = `당신은 한국인에게 일본어 발음을 가르치는 선생님입니다. 학습자는 히라가나를 읽지 못하고 귀로만 배우므로, 일본어에는 꼭 한글 발음을 붙이고 장음은 '-'로 적습니다(예: 아리가토-).

발음 평가 기계(Azure)가 낸 단어별 점수(0~100)와 오류 종류를 받습니다. 당신은 소리를 직접 듣지 못합니다. 점수가 낮은 단어에서 한국인이 흔히 틀리는 점을 짚어 "~했을 가능성이 높아요"처럼 설명합니다.
한국인이 자주 틀리는 점: 장음 길이(おう·ええ·ー를 짧게), 촉음 っ(한 박자 쉬기), ん(한 박자), つ(츠/쓰가 아님), ざ·ず·ぜ·ぞ(ㅈ이 아니라 z 소리), 단어 첫 か·た행과 が·だ행 구분, ふ(후보다 입술을 덜 모음), 요음(きゃ 등), 억양을 한국어처럼 끝을 올리거나 내림.
오류 종류: Mispronunciation(발음이 다름), Omission(빠뜨림), Insertion(정답에 없는 말을 덧붙임).

출력 규칙:
- summary_ko: 전체 한 줄 평가(한국어, 칭찬할 점이 있으면 먼저).
- tips: 점수가 낮거나 오류가 있는 단어 최대 3개. word는 일본어 단어, pron은 한글 발음, tip_ko는 어떻게 고치면 되는지 한국어 한두 문장. 고칠 곳이 없으면 빈 배열.
다음 JSON 하나만 출력합니다.
{"summary_ko":"...","tips":[{"word":"...","pron":"...","tip_ko":"..."}]}`

export async function explainPronunciation(settings, r) {
  const lines = r.words.map((w) => `- ${w.word}: ${w.score}점${w.error !== 'None' ? ` (${w.error})` : ''}`).join('\n')
  const user = `${r.reference ? `정답 문장: ${r.reference}\n` : ''}기계가 알아들은 말: ${r.text || '(없음)'}
점수: 발음 ${r.pron}, 정확도 ${r.accuracy}, 유창성 ${r.fluency}${r.completeness != null ? `, 완성도 ${r.completeness}` : ''}
단어별:
${lines}`
  return callJson(settings, EXPLAIN_SYSTEM, [{ role: 'user', text: user }], EXPLAIN_SCHEMA)
}

// ---------- 호출 ----------
// messages: [{ role: 'user' | 'assistant', text }]
async function callJson(settings, system, messages, schema) {
  if (!settings.apiKey) throw new Error('no-key')
  return settings.provider === 'gemini'
    ? geminiJson(settings, system, messages)
    : claudeJson(settings, system, messages, schema)
}

async function claudeJson(settings, system, messages, schema) {
  // 본인 휴대폰에서 본인 키로만 쓰는 앱이라 브라우저(WebView) 직접 호출을 허용한다
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true })
  const response = await client.beta.messages.create({
    model: settings.model,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.text })),
  })
  if (response.stop_reason === 'refusal') throw new Error('refusal')
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  return JSON.parse(text)
}

async function geminiJson(settings, system, messages) {
  const model = settings.geminiModel || DEFAULT_GEMINI_MODEL
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
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
