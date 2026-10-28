/**
 * 音标拆分
 * 英式缺失时用美式顶上；两式相同只显示一次；都没有返回空数组，占位符由调用方决定。
 */

/** 把 { uk, us } 拆成 [{ label, value }]；标签就是界面上的「英 / 美」 */
export function phoneticParts(phonetic) {
  const uk = phonetic?.uk || ''
  const us = phonetic?.us || ''

  if (!uk && !us) return []

  const parts = [{ label: '英', value: uk || us }]
  if (uk && us && us !== uk) parts.push({ label: '美', value: us })
  return parts
}
