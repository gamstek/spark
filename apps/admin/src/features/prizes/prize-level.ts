const prizeLevels = ['一等奖', '二等奖', '三等奖'] as const;
const chineseDigits = [
  '零',
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
] as const;
const chineseUnits = ['', '十', '百', '千'] as const;

function toChineseNumeral(value: number): string {
  if (value > 9999) {
    return String(value)
      .split('')
      .map((digit) => chineseDigits[Number(digit)])
      .join('');
  }

  const digits = String(value).split('').map(Number);
  let result = '';
  let pendingZero = false;

  digits.forEach((digit, index) => {
    const unitIndex = digits.length - index - 1;

    if (digit === 0) {
      pendingZero = result.length > 0;
      return;
    }

    if (pendingZero) {
      result += chineseDigits[0];
      pendingZero = false;
    }

    result += `${chineseDigits[digit]}${chineseUnits[unitIndex]}`;
  });

  return result.startsWith('一十') ? result.slice(1) : result;
}

export function getPrizeLevel(index: number): string {
  return prizeLevels[index] ?? `${toChineseNumeral(index + 1)}等奖`;
}
