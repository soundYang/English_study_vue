/**
 * 批量导入弹窗的文件模式
 * 锁住 tab 切换、上传解析结果、图片 / 截断 / 警告提示、行编辑删除与提交入参；
 * 不依赖页面，直接给组件注入 extractFile / submitBatch。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WordBatchImport from '../component/WordBatchImport.vue'

let wrapper = null

function mountImport(extractFile, submitBatch = vi.fn()) {
  wrapper = mount(WordBatchImport, {
    props: {
      open: true,
      previewBatch: vi.fn(),
      submitBatch,
      extractFile,
    },
    global: { stubs: { teleport: true } },
  })
  return wrapper
}

async function switchToFile(target) {
  const tab = target.findAll('button').find((button) => button.text() === '上传文件')
  await tab.trigger('click')
  await flushPromises()
}

async function chooseFile(target, file) {
  const input = target.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

async function openFileMode(extractFile, submitBatch) {
  const target = mountImport(extractFile, submitBatch)
  await switchToFile(target)
  return target
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('WordBatchImport file mode', () => {
  it('should show image, truncation and warning notices from the extract response', async () => {
    const extractFile = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        source: 'image',
        fileName: 'shot.png',
        size: 1200,
        rows: [{ index: 0, word: 'apple', meaning: '', valid: true }],
        stats: { total: 2, valid: 1, invalid: 1 },
        truncated: true,
        warnings: [{ code: 'OCR_LOW_CONFIDENCE', message: '图片识别置信度较低，请核对拼写。' }],
      },
    })
    const target = await openFileMode(extractFile)

    await chooseFile(target, new File(['x'], 'shot.png', { type: 'image/png' }))

    expect(extractFile).toHaveBeenCalledWith(expect.any(File), { mode: 'local' })
    expect(target.text()).toContain('图片是快速识别模式')
    expect(target.text()).toContain('图片识别置信度较低')
    expect(target.text()).toContain('还有 1 条未读取')
    expect(target.text()).toContain('OCR_LOW_CONFIDENCE')
    expect(target.text()).toContain('已读取 1 条')
    expect(target.findAll('.file-row')).toHaveLength(1)
  })

  it('should edit and delete rows, then submit through the existing batch payload', async () => {
    const extractFile = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        source: 'txt',
        fileName: 'words.txt',
        size: 20,
        rows: [
          { index: 0, word: 'apple', meaning: '', valid: true },
          { index: 1, word: 'bad word', meaning: '', valid: false, reason: '格式不正确' },
        ],
        stats: { total: 2, valid: 1, invalid: 1 },
        truncated: false,
        warnings: [],
      },
    })
    const submitBatch = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        created: 1,
        updated: 0,
        skipped: 0,
        failed: 0,
        total: 1,
        items: [],
        skippedItems: [],
        errors: [],
        chunkErrors: [],
      },
    })
    const target = await openFileMode(extractFile, submitBatch)

    await chooseFile(target, new File(['apple\nbad word'], 'words.txt', { type: 'text/plain' }))

    expect(target.findAll('.file-row')).toHaveLength(2)
    expect(target.text()).toContain('格式不正确')

    await target.get('.file-meaning-input').setValue('苹果')
    await target.findAll('.file-row-remove')[1].trigger('click')
    await flushPromises()

    expect(target.findAll('.file-row')).toHaveLength(1)

    const importButton = target.findAll('button').find((button) => button.text() === '确认导入')
    await importButton.trigger('click')
    await flushPromises()

    expect(submitBatch).toHaveBeenCalledWith({
      rows: [{ index: 0, word: 'apple', meaning: '苹果' }],
      status: 'learning',
      onProgress: expect.any(Function),
    })
    expect(target.text()).toContain('新增 1 个')
  })

  it('should show the backend parse error without rendering a fake result', async () => {
    const extractFile = vi.fn().mockResolvedValue({
      ok: false,
      message: '暂不支持旧版 Word 格式，请另存为 .docx 后重试。',
    })
    const target = await openFileMode(extractFile)

    await chooseFile(target, new File(['x'], 'legacy.doc', { type: 'application/msword' }))

    expect(target.get('.form-error').text()).toContain('另存为 .docx')
    expect(target.findAll('.file-row')).toHaveLength(0)
  })

  it('should reject files over 5MB before calling the extract API', async () => {
    const extractFile = vi.fn()
    const target = await openFileMode(extractFile)

    await chooseFile(target, {
      name: 'big.txt',
      type: 'text/plain',
      size: 5 * 1024 * 1024 + 1,
    })

    expect(extractFile).not.toHaveBeenCalled()
    expect(target.get('.form-error').text()).toContain('文件不能超过 5MB')
  })
})

describe('WordBatchImport AI mode', () => {
  async function enableAi(target) {
    const toggle = target.get('[role="switch"]')
    await toggle.trigger('click')
    await flushPromises()
    return toggle
  }

  it('should send mode=ai and show the AI summary, badge and alerts', async () => {
    const extractFile = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        source: 'txt',
        fileName: 'words.txt',
        size: 20,
        engine: 'ai',
        ai: {
          model: 'deepseek-chat',
          keySource: 'user',
          calls: 2,
          inputTokens: 900,
          outputTokens: 500,
        },
        rows: [
          { index: 0, word: 'apple', meaning: '苹果', valid: true, meaningSource: 'ai' },
          { index: 1, word: 'banana', meaning: '', valid: true, meaningSource: 'missing' },
        ],
        stats: { total: 2, valid: 2, invalid: 0 },
        truncated: true,
        warnings: [
          { code: 'AI_RECOGNIZED', message: 'AI 识别结果仅供参考，请逐条核对。' },
          { code: 'AI_TRUNCATED', message: '结果可能不完整，建议拆分文件。' },
        ],
      },
    })
    const target = await openFileMode(extractFile)

    // 默认关，勾选后才带 AI 模式
    expect(target.get('[role="switch"]').attributes('aria-checked')).toBe('false')
    await enableAi(target)

    await chooseFile(target, new File(['apple\nbanana'], 'words.txt', { type: 'text/plain' }))

    expect(extractFile).toHaveBeenCalledWith(expect.any(File), { mode: 'ai' })
    expect(target.text()).toContain('内容会发送到你接入的 AI 服务用于识别')
    expect(target.text()).toContain('AI 整理 · 2 次调用 · 约 1.4k tokens')
    expect(target.text()).toContain('结果可能不完整')
    expect(target.findAll('.file-row.is-ai')).toHaveLength(1)
    expect(target.findAll('.ai-badge')).toHaveLength(1)
    // 普通警告列表里只留 AI_RECOGNIZED，截断提示单独展示
    expect(target.findAll('.warning-item')).toHaveLength(1)
  })

  it('should mark an AI meaning as user-edited once the user changes it', async () => {
    const extractFile = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        source: 'txt',
        fileName: 'words.txt',
        size: 20,
        engine: 'ai',
        ai: { calls: 1, inputTokens: 20, outputTokens: 10 },
        rows: [{ index: 0, word: 'apple', meaning: '苹果', valid: true, meaningSource: 'ai' }],
        stats: { total: 1, valid: 1, invalid: 0 },
        truncated: false,
        warnings: [],
      },
    })
    const target = await openFileMode(extractFile)

    await enableAi(target)
    await chooseFile(target, new File(['apple'], 'words.txt', { type: 'text/plain' }))

    expect(target.findAll('.ai-badge')).toHaveLength(1)

    await target.get('.file-meaning-input').setValue('苹果（水果）')
    await flushPromises()

    expect(target.findAll('.ai-badge')).toHaveLength(0)
  })

  it('should ask the parent to open profile when the account has no API Key', async () => {
    const extractFile = vi.fn().mockResolvedValue({
      ok: false,
      code: 'USER_API_KEY_REQUIRED',
      message: '需要先在个人中心接入你自己的 API Key，才能使用 AI 整理。',
    })
    const target = await openFileMode(extractFile)

    await enableAi(target)
    await chooseFile(target, new File(['apple'], 'words.txt', { type: 'text/plain' }))

    expect(target.text()).toContain('需要先在个人中心接入你自己的 API Key')

    const goProfile = target.findAll('button').find((button) => button.text() === '去个人中心')
    await goProfile.trigger('click')

    expect(target.emitted('api-key-needed')).toHaveLength(1)
  })

  it('should offer retry and a local fallback for AI provider failures', async () => {
    const extractFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        code: 'AI_PROVIDER_ERROR',
        message: 'AI 服务暂时不可用，请稍后重试。',
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          source: 'txt',
          fileName: 'words.txt',
          size: 10,
          rows: [{ index: 0, word: 'apple', meaning: '', valid: true }],
          stats: { total: 1, valid: 1, invalid: 0 },
          truncated: false,
          warnings: [],
        },
      })
    const target = await openFileMode(extractFile)

    await enableAi(target)
    await chooseFile(target, new File(['apple'], 'words.txt', { type: 'text/plain' }))

    expect(target.text()).toContain('AI 服务暂时不可用')
    expect(target.text()).toContain('重试')

    const localButton = target.findAll('button').find((button) => button.text() === '改用本地识别')
    await localButton.trigger('click')
    await flushPromises()

    expect(extractFile).toHaveBeenLastCalledWith(expect.any(File), { mode: 'local' })
    expect(target.findAll('.file-row')).toHaveLength(1)
  })

  it('should hide the AI switch when the server turns the feature off', async () => {
    const extractFile = vi.fn().mockResolvedValue({
      ok: false,
      code: 'IMPORT_AI_DISABLED',
      message: 'AI 整理暂未开放。',
    })
    const target = await openFileMode(extractFile)

    await enableAi(target)
    await chooseFile(target, new File(['apple'], 'words.txt', { type: 'text/plain' }))

    expect(target.find('[role="switch"]').exists()).toBe(false)
    expect(target.text()).toContain('AI 整理暂未开放')
  })
})
