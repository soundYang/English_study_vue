/**
 * 生成页测试
 * 锁住：交接单驱动建任务、无交接单退回设置页、刷新用 taskId 续上、
 * 取消 / 任务过期退回、成功后先在纸页上收尾再替换到阅读页。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import GeneratingPage from '../index.vue'
import PaperStage from '../component/PaperStage.vue'
import {
  clearGenerationHandoff,
  setGenerationHandoff,
} from '../../../composables/useGenerationHandoff'
import { useReadingStore } from '../../../stores/model/reading'
import { mockApiKey, setMockLatency } from '../../../mock/adapter'
import { localStore, storageKeys } from '../../../unit/storage'

const EmptyStub = { template: '<div />' }

let wrapper = null

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: EmptyStub },
      { path: '/settings', name: 'settings', component: EmptyStub },
      { path: '/generating', name: 'generating', component: EmptyStub },
      { path: '/readings/:id', name: 'reading', component: EmptyStub },
    ],
  })
}

async function mountPage(beforeMount) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createTestRouter()
  await router.push('/generating')
  await router.isReady()

  const store = useReadingStore()
  if (beforeMount) beforeMount(store)

  wrapper = mount(GeneratingPage, {
    global: { plugins: [pinia, router] },
  })

  return { router, store }
}

beforeEach(() => {
  clearGenerationHandoff()
  localStorage.removeItem(storageKeys.generationTask)
  // 生成页只服务登录用户；游客进页会被送回设置页（md/45 §5.8）
  localStore.set(storageKeys.accessToken, 'sess_generating_page')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('GeneratingPage', () => {
  it('should fall back to the settings page when there is no handoff', async () => {
    const { router } = await mountPage()

    await flushPromises()
    await flushPromises()

    // 刷新或直接访问 /generating：拿不到参数，就不该空等
    expect(router.currentRoute.value.name).toBe('settings')
  })

  it('should start the generation carried by the handoff', async () => {
    setGenerationHandoff(
      { level: 'hard', targetWords: 600, questionCount: 5 },
      { availableWords: 120, from: '/settings' },
    )

    const generate = vi.fn().mockResolvedValue(null)
    await mountPage((store) => {
      store.generate = generate
    })
    await flushPromises()

    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate).toHaveBeenCalledWith(
      { level: 'hard', targetWords: 600, questionCount: 5 },
      { availableWords: 120, from: '/settings' },
    )
  })

  // 有自备 Key 时纸页要常驻标识（md/43 §12）；读取与生成并行，不阻塞建任务
  it('should badge the paper when the user has an own api key', async () => {
    setMockLatency(0)
    await mockApiKey.save({ apiKey: `sk-${'a'.repeat(40)}` })
    setGenerationHandoff(
      { level: 'easy', targetWords: 100, questionCount: 3 },
      { availableWords: 20, from: '/settings' },
    )

    await mountPage((reading) => {
      reading.generate = vi.fn().mockResolvedValue(null)
    })
    await flushPromises()

    expect(wrapper.findComponent(PaperStage).props('usingOwnKey')).toBe(true)
    expect(wrapper.get('.paper-key-note').text()).toContain('本篇使用我的 API Key')
  })

  it('should resume from the stored task without replaying the entrance', async () => {
    localStorage.setItem(
      storageKeys.generationTask,
      JSON.stringify({
        taskId: 't1',
        from: '/',
        availableWords: 40,
        level: 'easy',
        targetWords: 100,
        questionCount: 3,
      }),
    )

    const resume = vi.fn(() => ({ taskId: 't1', from: '/' }))
    const { router } = await mountPage((store) => {
      store.resumeGeneration = resume
    })
    await nextTick()

    expect(resume).toHaveBeenCalledTimes(1)
    expect(wrapper.findComponent(PaperStage).props('skipEntrance')).toBe(true)
    // 续上之后就该留在本页等，而不是退回去
    expect(router.currentRoute.value.name).toBe('generating')
  })

  it('should go back to where it came from after cancelling', async () => {
    vi.useFakeTimers()
    setGenerationHandoff({ level: 'easy', targetWords: 100, questionCount: 3 }, { from: '/' })

    const { router, store } = await mountPage((reading) => {
      reading.generate = vi.fn().mockResolvedValue(null)
    })
    await flushPromises()

    store.phase = 'cancelled'
    await nextTick()

    expect(wrapper.get('.paper-title').text()).toBe('已暂停这次阅读准备')

    await vi.advanceTimersByTimeAsync(360)
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('should leave immediately when the task no longer exists', async () => {
    vi.useFakeTimers()
    setGenerationHandoff({ level: 'easy', targetWords: 100, questionCount: 3 }, { from: '/' })

    const { router, store } = await mountPage((reading) => {
      reading.generate = vi.fn().mockResolvedValue(null)
    })
    await flushPromises()

    // 先进入运行态，再模拟任务过期回 idle（直接赋 idle 不会有变化，watch 不触发）
    store.phase = 'generating'
    await nextTick()
    store.phase = 'idle'
    await nextTick()
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('should keep the last real segment count after the task snapshot is cleared', async () => {
    setGenerationHandoff({ level: 'easy', targetWords: 100, questionCount: 3 }, { from: '/' })

    const { store } = await mountPage((reading) => {
      reading.generate = vi.fn().mockResolvedValue(null)
    })
    await flushPromises()

    store.task = { progress: { done: 3, total: 4 }, selectedWords: [] }
    await nextTick()
    await nextTick()

    // 成功后 store 会清掉任务；纸页要用最后一次真实进度把整页写完
    store.task = null
    await nextTick()

    expect(wrapper.findComponent(PaperStage).props('progress')).toEqual({ done: 3, total: 4 })
  })

  it('should show the backend fallback message on the paper', async () => {
    setGenerationHandoff({ level: 'easy', targetWords: 100, questionCount: 3 }, { from: '/' })

    const { store } = await mountPage((reading) => {
      reading.generate = vi.fn().mockResolvedValue(null)
    })
    await flushPromises()

    store.task = {
      stage: 'planning',
      progress: { done: 0, total: 0 },
      selectedWords: [],
      vocabFallback: {
        used: true,
        requestedScope: ['today_new'],
        scopeAvailable: 0,
        allAvailable: 20,
        needed: 15,
        supplemented: 15,
        message: '「今天新学」没有可用词，已从「全部词汇」补充 15 个候选词。',
      },
    }
    await nextTick()

    // 文案是后端给的，纸页原样展示；生成中途补词这件事不能静默
    expect(wrapper.findComponent(PaperStage).props('fallbackMessage')).toContain(
      '已从「全部词汇」补充',
    )
    expect(wrapper.get('.paper-fallback-note').text()).toBe(
      '「今天新学」没有可用词，已从「全部词汇」补充 15 个候选词。',
    )

    store.task = { ...store.task, vocabFallback: { used: false, message: '不该显示' } }
    await nextTick()

    expect(wrapper.find('.paper-fallback-note').exists()).toBe(false)
  })

  it('should let the paper announce success before entering the reading page', async () => {
    vi.useFakeTimers()
    setGenerationHandoff({ level: 'easy', targetWords: 100, questionCount: 3 }, { from: '/' })

    const { router, store } = await mountPage((reading) => {
      reading.generate = vi.fn().mockResolvedValue(null)
    })
    await flushPromises()

    store.reading = { id: 'r9', questions: [] }
    await nextTick()

    expect(wrapper.get('.paper-title').text()).toBe('新的阅读，准备好了')

    await vi.advanceTimersByTimeAsync(600)
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('reading')
    expect(router.currentRoute.value.params.id).toBe('r9')
  })
})
