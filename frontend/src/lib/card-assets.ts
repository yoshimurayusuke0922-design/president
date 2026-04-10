import type { Card } from '../types/game';

const rankNames: Record<Exclude<Card['rank'], 'JOKER'>, string> = {
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'jack',
  Q: 'queen',
  K: 'king',
  A: 'ace'
};

const suitNames: Record<Exclude<Card['suit'], 'JOKER'>, string> = {
  C: 'clubs',
  D: 'diamonds',
  H: 'hearts',
  S: 'spades'
};

const preloadPaths = [
  '/cards/black_joker.svg',
  ...(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king', 'ace'] as const).flatMap((rank) =>
    (['clubs', 'diamonds', 'hearts', 'spades'] as const).map((suit) => `/cards/${rank}_of_${suit}.svg`)
  )
];

let preloaded = false;

const suitLabels: Record<Card['suit'], string> = {
  C: 'クラブ',
  D: 'ダイヤ',
  H: 'ハート',
  S: 'スペード',
  JOKER: 'ジョーカー'
};

export function getCardAssetPath(card: Card) {
  if (card.suit === 'JOKER' || card.rank === 'JOKER') {
    return '/cards/black_joker.svg';
  }

  return `/cards/${rankNames[card.rank]}_of_${suitNames[card.suit]}.svg`;
}

export function preloadCardAssets(): void {
  if (preloaded || typeof window === 'undefined') {
    return;
  }

  preloaded = true;

  for (const path of preloadPaths) {
    const image = new Image();
    image.decoding = 'async';
    image.src = path;
  }
}

export function getCardLabel(card: Card) {
  if (card.suit === 'JOKER' || card.rank === 'JOKER') {
    return 'ジョーカー';
  }

  return `${suitLabels[card.suit]}の${card.rank}`;
}
