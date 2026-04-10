const CPU_NAME_POOL = ['かけはし', '寿咲谷', 'くにぽ', 'K・橋本', '水川', '堀', '噂の青木君', '山内'] as const;

function shuffleNames(names: readonly string[]): string[] {
  const pool = [...names];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool;
}

export function pickCpuNames(count: number): string[] {
  if (count <= 0) {
    return [];
  }

  const shuffled = shuffleNames(CPU_NAME_POOL);
  return shuffled.slice(0, count);
}

export function normalizeCpuDisplayName(name: string): string {
  if (name === 'K' || name === '橋本') {
    return 'K・橋本';
  }

  if (name === 'すさきや') {
    return '寿咲谷';
  }

  if (name === '青木') {
    return '噂の青木君';
  }

  return name;
}
