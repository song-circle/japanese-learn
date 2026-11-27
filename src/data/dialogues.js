// 대화 듣기: 듣고 맞히기 문장(원어민 음성이 이미 있음)을 이어 붙인 상황별 짧은 대화
//   turns: 문장 id 순서. '나'의 대사는 '내 차례 말하기'에서 직접 말한다.
//   다른 상황의 문장도 자연스러우면 섞는다(예: 어디서든 쓰는 ありがとうございます).

import { allSentences } from './sentences.js'

const D = (id, situation, title, turns) => ({ id, situation, title, turns })

export const dialogues = [
  D('konbini', 'konbini', '편의점에서 도시락 계산', ['konbini-01', 'konbini-02', 'konbini-08', 'konbini-03', 'basic-05', 'konbini-06', 'restaurant-08', 'talk-08', 'basic-03']),
  D('konbini2', 'konbini', '젓가락과 포인트 카드', ['konbini-01', 'konbini-04', 'konbini-08', 'konbini-05', 'reply-02', 'konbini-07', 'restaurant-08', 'talk-08', 'basic-03']),
  D('restaurant', 'restaurant', '식당에 들어가서 주문', ['restaurant-01', 'restaurant-02', 'restaurant-03', 'restaurant-05', 'gift-07', 'restaurant-04', 'cafe-07']),
  D('restaurant2', 'restaurant', '식당에서 계산', ['restaurant-07', 'konbini-06', 'restaurant-08', 'talk-08', 'basic-03']),
  D('directions', 'directions', '역 가는 길 묻기', ['basic-04', 'directions-01', 'directions-03', 'directions-06', 'directions-07', 'basic-03']),
  D('directions2', 'directions', '근처 편의점 찾기', ['basic-04', 'directions-08', 'directions-03', 'directions-04', 'basic-03']),
  D('shop', 'shop', '옷 가게에서', ['shop-02', 'shop-03', 'shop-04', 'talk-08', 'shop-07', 'shop-06', 'shop-08', 'konbini-08']),
  D('hotel', 'hotel', '호텔 체크인', ['hotel-01', 'hotel-02', 'hotel-03', 'self-03', 'hotel-04', 'hotel-07', 'hotel-08', 'hotel-06', 'basic-03']),
  D('train', 'train', '신주쿠 가는 전철', ['train-02', 'train-05', 'train-06', 'train-07', 'basic-03', 'train-08']),
  D('train2', 'train', '이 전철 맞나요?', ['basic-04', 'train-03', 'train-04', 'basic-03']),
  D('talk', 'talk', '여행지에서 말 걸기', ['talk-01', 'talk-02', 'talk-05', 'talk-06', 'talk-03', 'talk-04', 'talk-07', 'talk-08', 'basic-03']),
  D('cafe', 'cafe', '카페에서 주문', ['cafe-01', 'cafe-03', 'cafe-04', 'cafe-05', 'cafe-06', 'cafe-07', 'cafe-09', 'basic-03']),
  D('taxi', 'taxi', '호텔까지 택시', ['taxi-01', 'taxi-02', 'taxi-05', 'taxi-06', 'talk-08', 'basic-03']),
  D('taxi2', 'taxi', '공항까지 택시 요금', ['taxi-01', 'taxi-07', 'taxi-08', 'konbini-08', 'taxi-05', 'taxi-09', 'talk-08']),
  D('trouble', 'trouble', '지갑을 잃어버렸을 때', ['trouble-07', 'trouble-03', 'trouble-04', 'directions-03', 'basic-03']),
  D('sight', 'sight', '관광지 매표소', ['sight-01', 'sight-02', 'sight-03', 'sight-04', 'sight-05', 'sight-06', 'reply-10']),
  D('airport', 'airport', '입국 심사', ['airport-01', 'airport-02', 'airport-03', 'airport-04', 'airport-05', 'basic-03']),
  D('airport2', 'airport', '탑승 수속 좌석 고르기', ['airport-01', 'airport-09', 'airport-10', 'basic-03']),
  D('pharmacy', 'pharmacy', '약국에서 증상 말하기', ['pharmacy-01', 'pharmacy-02', 'pharmacy-05', 'pharmacy-06', 'pharmacy-07', 'pharmacy-08', 'pharmacy-09', 'basic-03']),
  D('izakaya', 'izakaya', '이자카야에서', ['izakaya-01', 'izakaya-03', 'izakaya-05', 'izakaya-06', 'izakaya-08', 'izakaya-09', 'izakaya-10', 'talk-08']),
  D('chat', 'chat', '날씨 이야기', ['chat-01', 'chat-02', 'chat-07', 'chat-08', 'chat-09', 'chat-10', 'reply-05']),
  D('self', 'self', '자기소개', ['self-01', 'self-02', 'self-03', 'self-04', 'self-05', 'self-06', 'self-08', 'self-09', 'reply-05']),
  D('room', 'room', '호텔 방 에어컨 고장', ['room-02', 'room-05', 'room-06', 'room-09', 'room-10', 'basic-03']),
  D('reserve', 'reserve', '식당 자리 기다리기', ['reserve-01', 'reserve-02', 'reserve-03', 'reserve-04', 'reserve-05', 'reserve-06', 'reserve-07', 'reserve-08', 'reserve-09']),
  D('gift', 'gift', '기념품 가게 계산', ['gift-07', 'gift-06', 'gift-01', 'gift-02', 'gift-03', 'gift-09', 'gift-10']),
  D('bus', 'bus', '교토역 가는 버스', ['bus-01', 'bus-02', 'bus-04', 'bus-05', 'bus-07', 'bus-09']),
]

const byId = Object.fromEntries(allSentences.map((s) => [s.id, s]))
export const sentenceOf = (id) => byId[id]
