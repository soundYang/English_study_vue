/**
 * 构建产物 WebP 兄弟文件生成脚本
 *
 * 用途：`dist/assets` 里的照片素材以 PNG / JPG 存放（单张最大 2MB），首屏要下好几 MB。
 *      线上 nginx 按 `Accept` 头协商（`English_node/deploy/nginx/english-node.conf`）：
 *      同目录存在 `<原名>.webp` 就优先发它，不支持 WebP 的浏览器自动回落原图。
 *
 * 两条不能破的约束（破一条线上就裂图或协商失效）：
 *   1. 输出必须**保留原扩展名**：`hero-desk-abc123.png.webp`，不是 `hero-desk-abc123.webp`。
 *      nginx 的规则是 `try_files $uri$webp_suffix $uri`，`$uri` 带着 `.png`，
 *      文件名一旦改成 `.webp` 结尾就匹配不上，等于没生成。
 *   2. 原图必须保留。WebP 是兄弟文件不是替代品，回落的就靠它。
 *
 * 用法：node scripts/gen-webp.mjs [dist/assets 目录]
 *      已接进 `npm run build`，正常构建不用手动跑；
 *      服务器上另有 `deploy/scripts/gen-webp.sh`（cwebp）作为上传后的兜底。
 * 环境变量：MIN_SIZE 小于该字节数的不处理（默认 102400）、WEBP_QUALITY（默认 82）。
 */
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const IMAGE_EXTS = /\.(png|jpe?g)$/i
const MIN_SIZE = Number(process.env.MIN_SIZE) || 102400
const QUALITY = Number(process.env.WEBP_QUALITY) || 82
// -q 82 -m 6 是服务器上手工跑那批的参数：照片在这个质量下肉眼无差，
// m6 是最慢也最小的档位，一次性构建任务值得多花几百毫秒
const EFFORT = 6

/** 字节数转成 KB，日志里对着看更直观 */
function kb(bytes) {
  return `${Math.round(bytes / 1024)} KB`
}

async function main() {
  const dir = process.argv[2] || 'dist/assets'

  const entries = await readdir(dir, { withFileTypes: true }).catch(() => null)
  if (!entries) {
    console.error(`[webp] 目录不存在：${dir}（先跑 vite build）`)
    process.exitCode = 1
    return
  }

  let before = 0
  let after = 0
  let done = 0
  const failed = []

  for (const entry of entries) {
    if (!entry.isFile() || !IMAGE_EXTS.test(entry.name)) continue

    const src = path.join(dir, entry.name)
    const { size } = await stat(src)
    if (size < MIN_SIZE) continue

    const dest = `${src}.webp`

    try {
      await sharp(src).webp({ quality: QUALITY, effort: EFFORT, smartSubsample: true }).toFile(dest)
      const { size: webpSize } = await stat(dest)
      before += size
      after += webpSize
      done += 1
      console.log(
        `  ${entry.name.padEnd(38)} ${kb(size).padStart(8)} -> ${kb(webpSize).padStart(8)}`,
      )
    } catch (error) {
      // 单张失败不中断整条构建，但最后要以非 0 退出，避免悄悄发出一份没有 .webp 的 dist
      failed.push(entry.name)
      console.error(`  ${entry.name} 生成失败：${error.message}`)
    }
  }

  if (!done) {
    console.log(`[webp] 没有超过 ${kb(MIN_SIZE)} 的图片，跳过（dist 可能还没构建）`)
  } else {
    console.log(`[webp] 生成 ${done} 个兄弟文件：${kb(before)} -> ${kb(after)}`)
  }

  if (failed.length) {
    console.error(
      `[webp] ${failed.length} 张失败，可在服务器上重跑 deploy/scripts/gen-webp.sh 兜底`,
    )
    process.exitCode = 1
  }
}

await main()
