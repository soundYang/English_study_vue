/**
 * URL 路径片段编码
 * 把 taskId、阅读 id、单词、dataKey 这类「要拼进路径的一段」统一编码后使用。
 * 不编码时，值里出现 `/`、`?`、`#` 会让请求落到别的路由上——拼路径的调用方
 * 自己并不知道参数是不是干净字符串（md/40 L-1）。
 */

/** 编码单个路径片段；null / undefined 变成空串，与模板字符串的旧行为一致 */
export function pathSegment(value) {
  return encodeURIComponent(String(value ?? ''))
}
