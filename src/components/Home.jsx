import { hiragana } from '../data/hiragana'
import { katakana } from '../data/katakana'
import { kanjiData } from '../data/kanji'
import { allSentences } from '../data/sentences'
import { todayPlan, speak, speakSentences } from '../utils/listenSrs'
import { useState } from 'react'
import { courseStatus, startCourse, COURSE_DAYS } from '../utils/course'
import UpdateBox, { UpdateBanner } from './UpdateBox'

// 30일 회화 코스: 오늘 할 네 단계를 순서대로, 그 아래 보너스(숫자 듣기·AI 회화)
function CourseCard({ navigate }) {
  const [c, setC] = useState(courseStatus)
  if (!c.started) {
    return (
      <div className="card course-card">
        <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>🗓️ 30일 회화 코스</div>
        <p style={{ margin: '0.4rem 0 0.8rem', opacity: 0.9 }}>
          하루 30분: 듣기 → 말하기 → 패턴 → 대화.<br />30일이면 여행 회화 문장 300개를 듣고 말할 수 있어요.
        </p>
        <button className="btn" style={{ width: '100%', background: 'white', color: '#6A1B9A', fontWeight: 800 }}
          onClick={() => { startCourse(); setC(courseStatus()) }}>
          오늘부터 시작하기
        </button>
      </div>
    )
  }
  const firstTodo = c.steps.findIndex((x) => x.todo > 0)
  return (
    <div className="card course-card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>🗓️ {c.over ? '코스 완료 후 복습' : `${c.day}일째`}</div>
        <div style={{ opacity: 0.85 }}>/ {COURSE_DAYS}일 · 문장 {c.learned}/{c.total}</div>
      </div>
      <div className="progress-bar" style={{ margin: '0.5rem 0 0.75rem', background: 'rgba(255,255,255,0.25)' }}>
        <div className="progress-fill" style={{ width: `${(c.learned / c.total) * 100}%`, background: 'white' }} />
      </div>
      {c.steps.map((st, i) => (
        <div key={st.key} className={`course-step${st.todo === 0 ? ' done' : ''}${i === firstTodo ? ' now' : ''}`}
          onClick={() => navigate(st.page, st.type)}>
          <div style={{ fontSize: '1.4rem' }}>{st.todo === 0 ? '✅' : st.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{i + 1}. {st.title}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>{st.todo === 0 ? '오늘 끝' : st.detail}</div>
          </div>
          <div>▶</div>
        </div>
      ))}
      <div className="course-bonus">
        <span style={{ opacity: 0.85 }}>보너스</span>
        {c.bonus.map((b) => (
          <button key={b.key} className={`course-chip${b.todo === 0 ? ' done' : ''}`} onClick={() => navigate(b.page, b.type)}>
            {b.todo === 0 ? '✅' : b.icon} {b.title}
          </button>
        ))}
      </div>
      {c.allDone && <p style={{ margin: '0.6rem 0 0', fontWeight: 700, textAlign: 'center' }}>오늘 코스 끝! 내일 또 만나요 🎉</p>}
    </div>
  )
}

function Home({ navigate, progress }) {
  const hiraganaProgress = progress?.hiragana?.learned?.length || 0
  const katakanaProgress = progress?.katakana?.learned?.length || 0
  const kanjiProgress = progress?.learnedKanji?.length || 0
  const streak = progress?.stats?.streak || 0

  return (
    <div className="content fade-in">
      {/* 로고 */}
      <div className="home-logo">
        <h1>🇯🇵 日本語</h1>
        <p>매일 조금씩 배우는 일본어</p>
      </div>

      <UpdateBanner />

      <CourseCard navigate={navigate} />

      {/* 연습: 코스 밖에서도 바로 들어갈 수 있게 6개만 */}
      <h2 className="home-section">🎯 연습</h2>
      <div className="practice-grid">
        {(() => {
          const lp = todayPlan(allSentences)
          const sp = speak.todayPlan(speakSentences(allSentences))
          const tiles = [
            { page: 'listen-guess', icon: '👂', name: '듣고 맞히기', sub: lp.reviews.length + lp.news.length ? `복습 ${lp.reviews.length} · 새 ${lp.news.length}` : '오늘 끝 🎉', color: '#2962FF' },
            { page: 'speak-guess', icon: '🎤', name: '말해서 맞히기', sub: sp.reviews.length + sp.news.length ? `복습 ${sp.reviews.length} · 새 ${sp.news.length}` : '한국어 보고 말하기', color: '#D81B60' },
            { page: 'patterns', icon: '🧩', name: '패턴 말하기', sub: '틀에 단어 바꿔 넣기', color: '#5E35B1' },
            { page: 'dialogues', icon: '💬', name: '대화 듣기', sub: '흐름으로 듣고 말하기', color: '#00838F' },
            { page: 'numbers', icon: '💴', name: '숫자 듣기', sub: '가격·시간·개수', color: '#EF6C00' },
            { page: 'ai-talk', icon: '🗣️', name: 'AI 회화', sub: '상황극으로 주고받기', color: '#00897B' },
          ]
          return tiles.map((t) => (
            <div key={t.page} className="practice-tile" style={{ background: t.color }} onClick={() => navigate(t.page)}>
              <div style={{ fontSize: '1.6rem' }}>{t.icon}</div>
              <div style={{ fontWeight: 700 }}>{t.name}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{t.sub}</div>
            </div>
          ))
        })()}
      </div>

      {/* 예전 기능(가나·한자·단어·게임·여행·맛집·통계)은 접어 둔다 */}
      <details className="more-box">
        <summary>📦 더 보기 (히라가나·한자·단어·게임·맛집·통계{streak > 0 ? ` · 🔥 ${streak}일 연속` : ''})</summary>

      {/* 기본 학습 섹션 */}
      <div style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--accent)', marginBottom: '1rem' }}>📚 기본 학습</h2>
        
        <div className="menu-grid">
          {/* 히라가나 */}
          <div className="menu-item" onClick={() => navigate('learn', 'hiragana')}>
            <div className="menu-icon">あ</div>
            <div className="menu-info">
              <h3>히라가나</h3>
              <p>기본 46자</p>
              <div className="progress-bar" style={{ width: '120px', marginTop: '0.5rem' }}>
                <div 
                  className="progress-fill" 
                  style={{ width: `${(hiraganaProgress / hiragana.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="menu-progress">
              <div className="value">{hiraganaProgress}/{hiragana.length}</div>
            </div>
          </div>

          {/* 가타카나 */}
          <div className="menu-item" onClick={() => navigate('learn', 'katakana')}>
            <div className="menu-icon">ア</div>
            <div className="menu-info">
              <h3>가타카나</h3>
              <p>기본 46자</p>
              <div className="progress-bar" style={{ width: '120px', marginTop: '0.5rem' }}>
                <div 
                  className="progress-fill" 
                  style={{ width: `${(katakanaProgress / katakana.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="menu-progress">
              <div className="value">{katakanaProgress}/{katakana.length}</div>
            </div>
          </div>

          {/* 기초 단어 */}
          <div className="menu-item" onClick={() => navigate('words')}>
            <div className="menu-icon">📝</div>
            <div className="menu-info">
              <h3>기초 단어</h3>
              <p>인사, 숫자, 가족 등</p>
            </div>
          </div>

          {/* JLPT N5 */}
          <div className="menu-item" onClick={() => navigate('jlpt')}>
            <div className="menu-icon">📖</div>
            <div className="menu-info">
              <h3>JLPT N5</h3>
              <p>필수 단어 100+</p>
            </div>
          </div>

          {/* 한자 학습 */}
          <div className="menu-item" onClick={() => navigate('kanji')}>
            <div className="menu-icon">漢</div>
            <div className="menu-info">
              <h3>한자 (N5)</h3>
              <p>필수 한자 {kanjiData.length}자</p>
              <div className="progress-bar" style={{ width: '120px', marginTop: '0.5rem' }}>
                <div 
                  className="progress-fill" 
                  style={{ width: `${(kanjiProgress / kanjiData.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="menu-progress">
              <div className="value">{kanjiProgress}/{kanjiData.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 문법 & 회화 섹션 */}
      <div style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--accent)', marginBottom: '1rem' }}>💬 문법 & 회화</h2>
        
        <div className="menu-grid">
          <div className="menu-item" onClick={() => navigate('grammar')}>
            <div className="menu-icon">📐</div>
            <div className="menu-info">
              <h3>기초 문법</h3>
              <p>~です, ~ます 등</p>
            </div>
          </div>

          <div className="menu-item" onClick={() => navigate('conversation')}>
            <div className="menu-icon">🗣️</div>
            <div className="menu-info">
              <h3>일상 회화</h3>
              <p>상황별 대화문</p>
            </div>
          </div>
        </div>
      </div>

      {/* 게임 & 퀴즈 섹션 */}
      <div style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--accent)', marginBottom: '1rem' }}>🎮 게임 & 퀴즈</h2>
        
        <div className="menu-grid">
          <div className="menu-item" onClick={() => navigate('quiz', 'hiragana')}>
            <div className="menu-icon">🎯</div>
            <div className="menu-info">
              <h3>퀴즈</h3>
              <p>문자 → 발음 맞추기</p>
            </div>
          </div>

          <div className="menu-item" onClick={() => navigate('listen')}>
            <div className="menu-icon">🎧</div>
            <div className="menu-info">
              <h3>듣기 퀴즈</h3>
              <p>소리 듣고 문자 맞추기</p>
            </div>
          </div>

          <div className="menu-item" onClick={() => navigate('flashcard')}>
            <div className="menu-icon">🎴</div>
            <div className="menu-info">
              <h3>플래시카드</h3>
              <p>스와이프로 외우기</p>
            </div>
          </div>

          <div className="menu-item" onClick={() => navigate('match')}>
            <div className="menu-icon">🧩</div>
            <div className="menu-info">
              <h3>매칭 게임</h3>
              <p>짝 맞추기</p>
            </div>
          </div>

          <div className="menu-item" onClick={() => navigate('timeattack')}>
            <div className="menu-icon">⏱️</div>
            <div className="menu-info">
              <h3>타임어택</h3>
              <p>60초 챌린지</p>
            </div>
          </div>

          <div className="menu-item" onClick={() => navigate('writing')}>
            <div className="menu-icon">✍️</div>
            <div className="menu-info">
              <h3>손글씨 연습</h3>
              <p>직접 써보기</p>
            </div>
          </div>
        </div>
      </div>

      {/* 여행 & 맛집 */}
      <div style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--accent)', marginBottom: '1rem' }}>🗾 여행 & 맛집</h2>
        
        <div className="menu-grid">
          <div className="menu-item" onClick={() => navigate('travel')}>
            <div className="menu-icon">✈️</div>
            <div className="menu-info">
              <h3>여행 일본어</h3>
              <p>상황별 필수 표현</p>
            </div>
          </div>

          <div className="menu-item" onClick={() => navigate('restaurant')}>
            <div className="menu-icon">🍜</div>
            <div className="menu-info">
              <h3>일본 맛집</h3>
              <p>맛집 저장 & 구글맵 길찾기</p>
            </div>
          </div>
        </div>
      </div>

      {/* 목표 & 배지 */}
      <div style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--accent)', marginBottom: '1rem' }}>🏆 성취</h2>
        
        <div className="menu-grid">
          <div className="menu-item" onClick={() => navigate('daily')}>
            <div className="menu-icon">🎖️</div>
            <div className="menu-info">
              <h3>일일 목표 & 배지</h3>
              <p>성취도 확인 및 목표 설정</p>
            </div>
            {streak > 0 && (
              <div className="menu-progress">
                <div className="value">🔥 {streak}</div>
              </div>
            )}
          </div>

          <div className="menu-item" onClick={() => navigate('statistics')}>
            <div className="menu-icon">📊</div>
            <div className="menu-info">
              <h3>학습 통계</h3>
              <p>주간 활동 & 진도 분석</p>
            </div>
          </div>
        </div>
      </div>

      {/* 팁 */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="card-title">💡 오늘의 팁</div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          {streak === 0 
            ? '히라가나는 일본어의 기본! 먼저 모음 5개(あいうえお)부터 시작해보세요! 🚀'
            : streak < 7
              ? `${streak}일째 학습 중! 7일 연속 달성하면 배지를 받을 수 있어요! 💪`
              : '대단해요! 꾸준히 잘 하고 있어요. 오늘도 조금씩 배워봐요! ⭐'
          }
        </p>
      </div>

      </details>

      <UpdateBox />

      {/* 푸터 */}
      <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
        Made with ❤️ for Japanese learners
      </div>
    </div>
  )
}

export default Home
