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

    expect(extractFile).toHaveBeenCalledWith(expect.any(File))
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
