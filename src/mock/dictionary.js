/**
 * Mock 词库
 *
 * 用途：在真实词典 API 就绪前，为一个可控的小词表提供与后端一致的搜索能力，
 *       让表单联想、锁定态与列表展示可以完整开发与测试。
 * 用法：只经 src/api/dictionary.js 调用，视图不直接依赖本文件。
 *
 * 结构与设计文档 5.1 节一致：{ id, headword, phonetic: { uk, us }, senses, source, fetchedAt }。
 * 词表刻意包含"单义项""多义项""无音标"三种形态，供 UI 验证降级。
 */

const FETCHED_AT = '2026-10-27T00:00:00.000Z'
const MAX_RESULTS = 8
const LATENCY = 120

/**
 * 原始词表：headword, 英式音标, 美式音标, [[词性, 释义], ...]
 * 拆成元组是为了让新增词条保持一行一条，便于人工维护。
 */
const RAW_ENTRIES = [
  [
    'abandon',
    '/əˈbæn.dən/',
    '/əˈbæn.dən/',
    [
      ['v.', '放弃；抛弃'],
      ['v.', '遗弃（某人）'],
      ['n.', '放任；放纵'],
    ],
  ],
  ['ability', '/əˈbɪl.ə.ti/', '/əˈbɪl.ə.t̬i/', [['n.', '能力；才能']]],
  [
    'about',
    '/əˈbaʊt/',
    '/əˈbaʊt/',
    [
      ['prep.', '关于；对于'],
      ['adv.', '大约；到处'],
    ],
  ],
  [
    'accept',
    '/əkˈsept/',
    '/əkˈsept/',
    [
      ['v.', '接受；同意'],
      ['v.', '承认；认可'],
    ],
  ],
  [
    'achieve',
    '/əˈtʃiːv/',
    '/əˈtʃiːv/',
    [
      ['v.', '实现；达到'],
      ['v.', '取得（成功）'],
    ],
  ],
  [
    'across',
    '/əˈkrɒs/',
    '/əˈkrɔːs/',
    [
      ['prep.', '穿过；横过'],
      ['adv.', '在对面'],
    ],
  ],
  ['afraid', '/əˈfreɪd/', '/əˈfreɪd/', [['adj.', '害怕的；担心的']]],
  [
    'again',
    '/əˈɡen/',
    '/əˈɡen/',
    [
      ['adv.', '再一次；又'],
      ['adv.', '此外；而且'],
    ],
  ],
  [
    'agree',
    '/əˈɡriː/',
    '/əˈɡriː/',
    [
      ['v.', '同意；赞成'],
      ['v.', '约定；商定'],
    ],
  ],
  [
    'air',
    '/eə/',
    '/er/',
    [
      ['n.', '空气；大气'],
      ['n.', '神态；感觉'],
    ],
  ],
  [
    'allow',
    '/əˈlaʊ/',
    '/əˈlaʊ/',
    [
      ['v.', '允许；准许'],
      ['v.', '留出（时间、钱）'],
    ],
  ],
  ['almost', '/ˈɔːl.məʊst/', '/ˈɑːl.moʊst/', [['adv.', '几乎；差不多']]],
  [
    'alone',
    '/əˈləʊn/',
    '/əˈloʊn/',
    [
      ['adj.', '独自的；单独的'],
      ['adv.', '单独地；仅仅'],
    ],
  ],
  ['already', '/ɔːlˈred.i/', '/ɑːlˈred.i/', [['adv.', '已经；早已']]],
  ['always', '/ˈɔːl.weɪz/', '/ˈɑːl.weɪz/', [['adv.', '总是；一直']]],
  [
    'angry',
    '/ˈæŋ.ɡri/',
    '/ˈæŋ.ɡri/',
    [
      ['adj.', '生气的；愤怒的'],
      ['adj.', '（天气）狂暴的'],
    ],
  ],
  [
    'animal',
    '/ˈæn.ɪ.məl/',
    '/ˈæn.ɪ.məl/',
    [
      ['n.', '动物；牲畜'],
      ['adj.', '动物的'],
    ],
  ],
  [
    'answer',
    '/ˈɑːn.sər/',
    '/ˈæn.sɚ/',
    [
      ['n.', '回答；答案'],
      ['v.', '回答；答复'],
    ],
  ],
  [
    'apple',
    '/ˈæp.əl/',
    '/ˈæp.əl/',
    [
      ['n.', '苹果'],
      ['n.', '苹果树'],
    ],
  ],
  [
    'appear',
    '/əˈpɪər/',
    '/əˈpɪr/',
    [
      ['v.', '出现；显现'],
      ['v.', '似乎；看来'],
    ],
  ],
  [
    'arrive',
    '/əˈraɪv/',
    '/əˈraɪv/',
    [
      ['v.', '到达；抵达'],
      ['v.', '（时间）来临'],
    ],
  ],
  ['autumn', '/ˈɔː.təm/', '/ˈɑː.t̬əm/', [['n.', '秋天；秋季']]],
  [
    'avoid',
    '/əˈvɔɪd/',
    '/əˈvɔɪd/',
    [
      ['v.', '避免；避开'],
      ['v.', '躲避（某人）'],
    ],
  ],
  [
    'balance',
    '/ˈbæl.əns/',
    '/ˈbæl.əns/',
    [
      ['n.', '平衡；均衡'],
      ['v.', '使平衡；权衡'],
    ],
  ],
  [
    'beautiful',
    '/ˈbjuː.tɪ.fəl/',
    '/ˈbjuː.t̬ə.fəl/',
    [
      ['adj.', '美丽的；漂亮的'],
      ['adj.', '美好的；出色的'],
    ],
  ],
  ['because', '/bɪˈkɒz/', '/bɪˈkɑːz/', [['conj.', '因为；由于']]],
  [
    'become',
    '/bɪˈkʌm/',
    '/bɪˈkʌm/',
    [
      ['v.', '变成；成为'],
      ['v.', '适合；相称'],
    ],
  ],
  [
    'before',
    '/bɪˈfɔːr/',
    '/bɪˈfɔːr/',
    [
      ['prep.', '在……之前'],
      ['adv.', '以前；从前'],
    ],
  ],
  ['begin', '/bɪˈɡɪn/', '/bɪˈɡɪn/', [['v.', '开始；着手']]],
  [
    'believe',
    '/bɪˈliːv/',
    '/bɪˈliːv/',
    [
      ['v.', '相信；认为'],
      ['v.', '信任；信赖'],
    ],
  ],
  [
    'between',
    '/bɪˈtwiːn/',
    '/bɪˈtwiːn/',
    [
      ['prep.', '在……之间'],
      ['adv.', '在中间'],
    ],
  ],
  [
    'book',
    '/bʊk/',
    '/bʊk/',
    [
      ['n.', '书；书籍'],
      ['v.', '预订；预约'],
    ],
  ],
  [
    'brave',
    '/breɪv/',
    '/breɪv/',
    [
      ['adj.', '勇敢的；无畏的'],
      ['v.', '勇敢面对'],
    ],
  ],
  [
    'break',
    '/breɪk/',
    '/breɪk/',
    [
      ['v.', '打破；折断'],
      ['n.', '休息；间歇'],
    ],
  ],
  [
    'bright',
    '/braɪt/',
    '/braɪt/',
    [
      ['adj.', '明亮的；鲜艳的'],
      ['adj.', '聪明的；伶俐的'],
    ],
  ],
  [
    'build',
    '/bɪld/',
    '/bɪld/',
    [
      ['v.', '建造；建立'],
      ['n.', '体格；身材'],
    ],
  ],
  [
    'busy',
    '/ˈbɪz.i/',
    '/ˈbɪz.i/',
    [
      ['adj.', '忙碌的；繁忙的'],
      ['adj.', '（电话）占线的'],
    ],
  ],
  [
    'calm',
    '/kɑːm/',
    '/kɑːm/',
    [
      ['adj.', '平静的；镇静的'],
      ['v.', '使平静；使镇定'],
    ],
  ],
  [
    'careful',
    '/ˈkeə.fəl/',
    '/ˈker.fəl/',
    [
      ['adj.', '小心的；仔细的'],
      ['adj.', '谨慎的'],
    ],
  ],
  [
    'carry',
    '/ˈkær.i/',
    '/ˈker.i/',
    [
      ['v.', '携带；搬运'],
      ['v.', '支撑；承担'],
    ],
  ],
  [
    'change',
    '/tʃeɪndʒ/',
    '/tʃeɪndʒ/',
    [
      ['v.', '改变；更换'],
      ['n.', '变化；零钱'],
    ],
  ],
  ['choose', '/tʃuːz/', '/tʃuːz/', [['v.', '选择；挑选']]],
  [
    'clear',
    '/klɪər/',
    '/klɪr/',
    [
      ['adj.', '清楚的；晴朗的'],
      ['v.', '清除；清理'],
    ],
  ],
  [
    'climb',
    '/klaɪm/',
    '/klaɪm/',
    [
      ['v.', '攀登；爬'],
      ['n.', '攀登'],
    ],
  ],
  ['courage', '/ˈkʌr.ɪdʒ/', '/ˈkɝː.ɪdʒ/', [['n.', '勇气；胆量']]],
  [
    'curious',
    '/ˈkjʊə.ri.əs/',
    '/ˈkjʊr.i.əs/',
    [
      ['adj.', '好奇的；求知欲强的'],
      ['adj.', '奇特的；不寻常的'],
    ],
  ],
  [
    'garden',
    '/ˈɡɑː.dən/',
    '/ˈɡɑːr.dən/',
    [
      ['n.', '花园；菜园'],
      ['v.', '从事园艺'],
    ],
  ],
  [
    'gentle',
    '/ˈdʒen.təl/',
    '/ˈdʒen.təl/',
    [
      ['adj.', '温和的；温柔的'],
      ['adj.', '轻柔的；和缓的'],
    ],
  ],
  [
    'happy',
    '/ˈhæp.i/',
    '/ˈhæp.i/',
    [
      ['adj.', '快乐的；幸福的'],
      ['adj.', '满意的；乐意的'],
    ],
  ],
  [
    'journey',
    '/ˈdʒɜː.ni/',
    '/ˈdʒɝː.ni/',
    [
      ['n.', '旅行；旅程'],
      ['v.', '旅行；行走'],
    ],
  ],
  [
    'language',
    '/ˈlæŋ.ɡwɪdʒ/',
    '/ˈlæŋ.ɡwɪdʒ/',
    [
      ['n.', '语言'],
      ['n.', '措辞；表达方式'],
    ],
  ],
  [
    'memory',
    '/ˈmem.ər.i/',
    '/ˈmem.ər.i/',
    [
      ['n.', '记忆；记忆力'],
      ['n.', '回忆；往事'],
      ['n.', '（计算机）内存'],
    ],
  ],
  [
    'morning',
    '/ˈmɔː.nɪŋ/',
    '/ˈmɔːr.nɪŋ/',
    [
      ['n.', '早晨；上午'],
      ['n.', '黎明；破晓'],
    ],
  ],
  [
    'park',
    '/pɑːk/',
    '/pɑːrk/',
    [
      ['n.', '公园'],
      ['v.', '停放（车辆）'],
    ],
  ],
  [
    'patient',
    '/ˈpeɪ.ʃənt/',
    '/ˈpeɪ.ʃənt/',
    [
      ['adj.', '有耐心的；能忍耐的'],
      ['n.', '病人；患者'],
    ],
  ],
  [
    'practice',
    '/ˈpræk.tɪs/',
    '/ˈpræk.tɪs/',
    [
      ['n.', '练习；实践'],
      ['v.', '练习；实行'],
    ],
  ],
  [
    'quiet',
    '/ˈkwaɪ.ət/',
    '/ˈkwaɪ.ət/',
    [
      ['adj.', '安静的；轻声的'],
      ['adj.', '平静的；不张扬的'],
    ],
  ],
  [
    'read',
    '/riːd/',
    '/riːd/',
    [
      ['v.', '阅读；朗读'],
      ['v.', '读懂；理解'],
    ],
  ],
  [
    'simple',
    '/ˈsɪm.pəl/',
    '/ˈsɪm.pəl/',
    [
      ['adj.', '简单的；容易的'],
      ['adj.', '朴素的；不复杂的'],
    ],
  ],
  [
    'story',
    '/ˈstɔː.ri/',
    '/ˈstɔːr.i/',
    [
      ['n.', '故事；小说'],
      ['n.', '（建筑的）楼层'],
    ],
  ],
  [
    'study',
    '/ˈstʌd.i/',
    '/ˈstʌd.i/',
    [
      ['v.', '学习；研究'],
      ['n.', '书房'],
    ],
  ],
  [
    'sunny',
    '/ˈsʌn.i/',
    '/ˈsʌn.i/',
    [
      ['adj.', '晴朗的；阳光充足的'],
      ['adj.', '快活的；开朗的'],
    ],
  ],
  [
    'tired',
    '/ˈtaɪəd/',
    '/ˈtaɪərd/',
    [
      ['adj.', '疲倦的；累的'],
      ['adj.', '厌倦的；厌烦的'],
    ],
  ],
  [
    'wonder',
    '/ˈwʌn.dər/',
    '/ˈwʌn.dɚ/',
    [
      ['n.', '惊奇；奇迹'],
      ['v.', '想知道；感到诧异'],
    ],
  ],
]

/** 供 UI 验证"无音标"降级：词条存在，但两种音标都为空 */
const ENTRIES_WITHOUT_PHONETIC = new Set(['about'])

const ENTRIES = RAW_ENTRIES.map(([headword, uk, us, senses]) => ({
  id: `dict_${headword}`,
  headword,
  phonetic: ENTRIES_WITHOUT_PHONETIC.has(headword) ? { uk: '', us: '' } : { uk, us },
  senses: senses.map(([pos, meaning]) => ({ pos, meaning })),
  source: 'mock',
  fetchedAt: FETCHED_AT,
}))

function createAbortError() {
  if (typeof DOMException !== 'undefined') return new DOMException('生成已取消', 'AbortError')
  const error = new Error('搜索已取消')
  error.name = 'AbortError'
  return error
}

function wait(ms, signal) {
  if (signal?.aborted) return Promise.reject(createAbortError())
  if (!ms) return Promise.resolve()

  return new Promise((resolve, reject) => {
    function handleAbort() {
      clearTimeout(timer)
      reject(createAbortError())
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, ms)

    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

/**
 * 按词头搜索
 * 排序规则：完全匹配 → 前缀匹配 → 包含匹配；同组内按字母序，保证结果稳定可测。
 * @param {string} q 查询词
 * @param {{ signal?: AbortSignal }} options 可中断
 * @returns {Promise<Array>} 最多 8 条完整词条
 */
export async function search(q, { signal } = {}) {
  await wait(LATENCY, signal)

  const keyword = String(q ?? '')
    .trim()
    .toLowerCase()
  if (keyword.length < 2) return []

  const ranked = ENTRIES.filter((entry) => entry.headword.includes(keyword)).sort((a, b) => {
    const rank = (entry) => {
      if (entry.headword === keyword) return 0
      if (entry.headword.startsWith(keyword)) return 1
      return 2
    }
    return rank(a) - rank(b) || a.headword.localeCompare(b.headword)
  })

  return ranked.slice(0, MAX_RESULTS).map((entry) => ({
    ...entry,
    phonetic: { ...entry.phonetic },
    senses: entry.senses.map((sense) => ({ ...sense })),
  }))
}

/**
 * 按词头精确取词条
 *
 * 预检与批量导入需要「是否收录 / 释义摘要」，不能靠 search 的前缀结果反推：
 * search('app') 里可能有 apple，但 search('apple') 为空不代表没收录（大小写、空格已归一）。
 * 返回副本，避免调用方改到词表常量。
 */
export function findEntry(word) {
  const keyword = String(word ?? '')
    .trim()
    .toLowerCase()
  const entry = ENTRIES.find((item) => item.headword === keyword)
  if (!entry) return null

  return {
    ...entry,
    phonetic: { ...entry.phonetic },
    senses: entry.senses.map((sense) => ({ ...sense })),
  }
}

export const mockDictionary = { search, findEntry }
