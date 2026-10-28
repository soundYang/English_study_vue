/**
 * Mock 初始数据
 * 唯一初始数据文件：24 个单词、5 篇阅读（1 篇待作答、4 篇已提交）与 3 份生成模板。
 * 后端就绪后删除整个 mock 目录；本文件不导出给视图，只由 adapter 读取。
 */

/*
 * 单词结构见 md/单词词库与自动补全设计方案.md 第 5.2 节：
 * 命中词库的条目带 phonetic 与多条 senses；手填条目 phonetic 为 null、senses 只有一条且无词性。
 * 末尾 4 条刻意保留为 manual，用于验证列表与表单的降级展示。
 */
/*
 * COCA 词频名次，取自后端 data/word-ranks.json（同一份数据，数字必须对得上）。
 * 只列种子词库里出现过的词；手填条目不在词库里，名次为 null。
 */
const COCA_RANKS = {
  apple: 2718,
  happy: 748,
  angry: 1717,
  tired: 1973,
  sunny: 4921,
  park: 1233,
  book: 242,
  read: 338,
  study: 241,
  garden: 1047,
  friend: 266,
  morning: 358,
  quiet: 1442,
  gentle: 3421,
  journey: 2431,
  memory: 894,
  courage: 3355,
  curious: 3139,
  patient: 573,
  simple: 764,
  story: 234,
  language: 723,
  practice: 565,
  wonder: 791,
}

const RAW_WORDS = [
  {
    id: 'w1',
    word: 'apple',
    status: 'mastered',
    createdAt: '2026-09-01T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_apple',
    phonetic: { uk: '/ˈæp.əl/', us: '/ˈæp.əl/' },
    senses: [
      { pos: 'n.', meaning: '苹果' },
      { pos: 'n.', meaning: '苹果树' },
    ],
  },
  {
    id: 'w2',
    word: 'happy',
    status: 'mastered',
    createdAt: '2026-09-02T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_happy',
    phonetic: { uk: '/ˈhæp.i/', us: '/ˈhæp.i/' },
    senses: [
      { pos: 'adj.', meaning: '快乐的；幸福的' },
      { pos: 'adj.', meaning: '满意的；乐意的' },
    ],
  },
  {
    id: 'w3',
    word: 'angry',
    status: 'mastered',
    createdAt: '2026-09-03T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_angry',
    phonetic: { uk: '/ˈæŋ.ɡri/', us: '/ˈæŋ.ɡri/' },
    senses: [
      { pos: 'adj.', meaning: '生气的；愤怒的' },
      { pos: 'adj.', meaning: '（天气）狂暴的' },
    ],
  },
  {
    id: 'w4',
    word: 'tired',
    status: 'learning',
    createdAt: '2026-09-04T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_tired',
    phonetic: { uk: '/ˈtaɪəd/', us: '/ˈtaɪərd/' },
    senses: [
      { pos: 'adj.', meaning: '疲倦的；累的' },
      { pos: 'adj.', meaning: '厌倦的；厌烦的' },
    ],
  },
  {
    id: 'w5',
    word: 'sunny',
    status: 'mastered',
    createdAt: '2026-09-05T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_sunny',
    phonetic: { uk: '/ˈsʌn.i/', us: '/ˈsʌn.i/' },
    senses: [
      { pos: 'adj.', meaning: '晴朗的；阳光充足的' },
      { pos: 'adj.', meaning: '快活的；开朗的' },
    ],
  },
  {
    id: 'w6',
    word: 'park',
    status: 'mastered',
    createdAt: '2026-09-06T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_park',
    phonetic: { uk: '/pɑːk/', us: '/pɑːrk/' },
    senses: [
      { pos: 'n.', meaning: '公园' },
      { pos: 'v.', meaning: '停放（车辆）' },
    ],
  },
  {
    id: 'w7',
    word: 'book',
    status: 'mastered',
    createdAt: '2026-09-07T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_book',
    phonetic: { uk: '/bʊk/', us: '/bʊk/' },
    senses: [
      { pos: 'n.', meaning: '书；书籍' },
      { pos: 'v.', meaning: '预订；预约' },
    ],
  },
  {
    id: 'w8',
    word: 'read',
    status: 'mastered',
    createdAt: '2026-09-08T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_read',
    phonetic: { uk: '/riːd/', us: '/riːd/' },
    senses: [
      { pos: 'v.', meaning: '阅读；朗读' },
      { pos: 'v.', meaning: '读懂；理解' },
    ],
  },
  {
    id: 'w9',
    word: 'study',
    status: 'learning',
    createdAt: '2026-09-09T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_study',
    phonetic: { uk: '/ˈstʌd.i/', us: '/ˈstʌd.i/' },
    senses: [
      { pos: 'v.', meaning: '学习；研究' },
      { pos: 'n.', meaning: '书房' },
    ],
  },
  {
    id: 'w10',
    word: 'garden',
    status: 'learning',
    createdAt: '2026-09-10T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_garden',
    phonetic: { uk: '/ˈɡɑː.dən/', us: '/ˈɡɑːr.dən/' },
    senses: [
      { pos: 'n.', meaning: '花园；菜园' },
      { pos: 'v.', meaning: '从事园艺' },
    ],
  },
  {
    id: 'w11',
    word: 'friend',
    status: 'mastered',
    createdAt: '2026-09-11T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_friend',
    phonetic: { uk: '/frend/', us: '/frend/' },
    senses: [{ pos: 'n.', meaning: '朋友；友人' }],
  },
  {
    id: 'w12',
    word: 'morning',
    status: 'mastered',
    createdAt: '2026-09-12T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_morning',
    phonetic: { uk: '/ˈmɔː.nɪŋ/', us: '/ˈmɔːr.nɪŋ/' },
    senses: [
      { pos: 'n.', meaning: '早晨；上午' },
      { pos: 'n.', meaning: '黎明；破晓' },
    ],
  },
  {
    id: 'w13',
    word: 'quiet',
    status: 'learning',
    createdAt: '2026-09-13T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_quiet',
    phonetic: { uk: '/ˈkwaɪ.ət/', us: '/ˈkwaɪ.ət/' },
    senses: [
      { pos: 'adj.', meaning: '安静的；轻声的' },
      { pos: 'adj.', meaning: '平静的；不张扬的' },
    ],
  },
  {
    id: 'w14',
    word: 'gentle',
    status: 'learning',
    createdAt: '2026-09-14T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_gentle',
    phonetic: { uk: '/ˈdʒen.təl/', us: '/ˈdʒen.təl/' },
    senses: [
      { pos: 'adj.', meaning: '温和的；温柔的' },
      { pos: 'adj.', meaning: '轻柔的；和缓的' },
    ],
  },
  {
    id: 'w15',
    word: 'journey',
    status: 'learning',
    createdAt: '2026-09-15T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_journey',
    phonetic: { uk: '/ˈdʒɜː.ni/', us: '/ˈdʒɝː.ni/' },
    senses: [
      { pos: 'n.', meaning: '旅行；旅程' },
      { pos: 'v.', meaning: '旅行；行走' },
    ],
  },
  {
    id: 'w16',
    word: 'memory',
    status: 'learning',
    createdAt: '2026-09-16T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_memory',
    phonetic: { uk: '/ˈmem.ər.i/', us: '/ˈmem.ər.i/' },
    senses: [
      { pos: 'n.', meaning: '记忆；记忆力' },
      { pos: 'n.', meaning: '回忆；往事' },
      { pos: 'n.', meaning: '（计算机）内存' },
    ],
  },
  {
    id: 'w17',
    word: 'courage',
    status: 'new',
    createdAt: '2026-09-17T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_courage',
    phonetic: { uk: '/ˈkʌr.ɪdʒ/', us: '/ˈkɝː.ɪdʒ/' },
    senses: [{ pos: 'n.', meaning: '勇气；胆量' }],
  },
  {
    id: 'w18',
    word: 'curious',
    status: 'new',
    createdAt: '2026-09-18T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_curious',
    phonetic: { uk: '/ˈkjʊə.ri.əs/', us: '/ˈkjʊr.i.əs/' },
    senses: [
      { pos: 'adj.', meaning: '好奇的；求知欲强的' },
      { pos: 'adj.', meaning: '奇特的；不寻常的' },
    ],
  },
  {
    id: 'w19',
    word: 'patient',
    status: 'learning',
    createdAt: '2026-09-19T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_patient',
    phonetic: { uk: '/ˈpeɪ.ʃənt/', us: '/ˈpeɪ.ʃənt/' },
    senses: [
      { pos: 'adj.', meaning: '有耐心的；能忍耐的' },
      { pos: 'n.', meaning: '病人；患者' },
    ],
  },
  {
    id: 'w20',
    word: 'simple',
    status: 'mastered',
    createdAt: '2026-09-20T08:00:00.000Z',
    source: 'dictionary',
    dictionaryId: 'dict_simple',
    phonetic: { uk: '/ˈsɪm.pəl/', us: '/ˈsɪm.pəl/' },
    senses: [
      { pos: 'adj.', meaning: '简单的；容易的' },
      { pos: 'adj.', meaning: '朴素的；不复杂的' },
    ],
  },
  {
    id: 'w21',
    word: 'story',
    status: 'mastered',
    createdAt: '2026-09-21T08:00:00.000Z',
    source: 'manual',
    dictionaryId: null,
    phonetic: null,
    senses: [{ pos: '', meaning: '故事' }],
  },
  {
    id: 'w22',
    word: 'language',
    status: 'new',
    createdAt: '2026-09-22T08:00:00.000Z',
    source: 'manual',
    dictionaryId: null,
    phonetic: null,
    senses: [{ pos: '', meaning: '语言' }],
  },
  {
    id: 'w23',
    word: 'practice',
    status: 'learning',
    createdAt: '2026-09-23T08:00:00.000Z',
    source: 'manual',
    dictionaryId: null,
    phonetic: null,
    senses: [{ pos: '', meaning: '练习' }],
  },
  {
    id: 'w24',
    word: 'wonder',
    status: 'new',
    createdAt: '2026-09-24T08:00:00.000Z',
    source: 'manual',
    dictionaryId: null,
    phonetic: null,
    senses: [{ pos: '', meaning: '惊奇' }],
  },
]

// 名次按词形一次性补上：手填条目即使词在表里也不给（它们没有词库快照）
const WORDS = RAW_WORDS.map((item) => ({
  ...item,
  cocaRank: item.source === 'dictionary' ? (COCA_RANKS[item.word] ?? null) : null,
}))

const READINGS = [
  {
    id: 'r1',
    title: 'A Quiet Morning',
    level: 'easy',
    targetWords: 100,
    questionCount: 3,
    status: 'submitted',
    createdAt: '2026-10-05T09:20:00.000Z',
    submittedAt: '2026-10-05T09:34:00.000Z',
    newWords: [
      {
        word: 'gentle',
        phonetic: { uk: '/ˈdʒen.tl/', us: '/ˈdʒen.tl/' },
        senses: [{ pos: 'adj.', meaning: '温和的' }],
        source: 'dictionary',
      },
      {
        word: 'fence',
        phonetic: { uk: '/fens/', us: '/fens/' },
        senses: [{ pos: 'n.', meaning: '篱笆' }],
        source: 'dictionary',
      },
    ],
    tokenUsage: { promptTokens: 640, completionTokens: 214, totalTokens: 854 },
    vocabulary: [
      'quiet',
      'morning',
      'garden',
      'apple',
      'book',
      'happy',
      'patient',
      'simple',
      'story',
    ],
    article:
      'It is a quiet morning in the garden. The sun is gentle and the air is cool. Anna sits on a simple wooden chair with a book in her hands. She reads for a while, then looks up at the apple tree. A small bird lands on the fence and sings. Anna smiles. She feels happy and patient. This is her favorite part of the day, before the streets become busy and the world becomes loud. She turns the page and reads one more story. For now, nothing else matters.',
    translation:
      '花园里是一个安静的早晨。阳光温和，空气清凉。安娜坐在一把简单的木椅上，手里捧着一本书。她读了一会儿，然后抬头望向苹果树。一只小鸟落在篱笆上，唱起歌来。安娜笑了。她感到快乐而耐心。这是她一天中最喜欢的时光——在街道变得忙碌、世界变得喧闹之前。她翻过一页，又读了一个故事。此刻，别的都不重要。',
    questions: [
      {
        id: 1,
        question: 'Where is Anna?',
        options: ['In the garden', 'At school', 'In a shop', 'On a bus'],
        correctAnswer: 0,
        explanation: '文章第一句写明 “It is a quiet morning in the garden.”，安娜在花园里。',
      },
      {
        id: 2,
        question: 'What is Anna doing?',
        options: ['Cooking', 'Reading a book', 'Sleeping', 'Painting'],
        correctAnswer: 1,
        explanation: '“She reads for a while” 说明她正在读书。',
      },
      {
        id: 3,
        question: 'How does Anna feel?',
        options: ['Angry', 'Tired', 'Happy', 'Worried'],
        correctAnswer: 2,
        explanation: '“She feels happy and patient.” 直接给出她的感受。',
      },
    ],
    userAnswers: { 1: 0, 2: 1, 3: 2 },
  },
  {
    id: 'r2',
    title: 'The Garden Gate',
    level: 'easy',
    targetWords: 100,
    questionCount: 5,
    status: 'submitted',
    createdAt: '2026-10-09T15:10:00.000Z',
    submittedAt: '2026-10-09T15:26:00.000Z',
    newWords: [
      {
        word: 'path',
        phonetic: { uk: '/pɑːθ/', us: '/pæθ/' },
        senses: [{ pos: 'n.', meaning: '小路' }],
        source: 'dictionary',
      },
      {
        word: 'goodbye',
        phonetic: { uk: '/ˌɡʊdˈbaɪ/', us: '/ˌɡʊdˈbaɪ/' },
        senses: [{ pos: 'n.', meaning: '告别' }],
        source: 'dictionary',
      },
    ],
    tokenUsage: { promptTokens: 668, completionTokens: 236, totalTokens: 904 },
    vocabulary: ['afternoon', 'garden', 'wood', 'park', 'book', 'friend', 'sun', 'quiet', 'simple'],
    article:
      'Every afternoon, Tom walks to the old garden gate. The gate is made of wood and it is always open. Behind it, there is a small park with tall trees and a quiet path. Tom brings his book and sits under the tallest tree. He reads about a boy who travels to far places. Sometimes a friend joins him, and they talk about the story. When the sun goes down, the air becomes cool. Tom closes his book, says goodbye to the trees, and walks home. It is a simple day, but it is a good day.',
    translation:
      '每天下午，汤姆都会走到那座旧花园的门前。门是木头做的，总是敞开着。门后有一座小公园，长着高大的树，还有一条安静的小路。汤姆带着他的书，坐在最高的那棵树下。他读到一个小男孩远行的故事。有时一个朋友会来找他，他们一起聊这个故事。太阳落山时，空气变凉了。汤姆合上书，向树木道别，然后走回家。这是简单的一天，却是美好的一天。',
    questions: [
      {
        id: 1,
        question: 'When does Tom walk to the garden gate?',
        options: ['In the morning', 'In the afternoon', 'In the evening', 'At night'],
        correctAnswer: 1,
        explanation: '“Every afternoon, Tom walks to the old garden gate.”',
      },
      {
        id: 2,
        question: 'What is the gate made of?',
        options: ['Stone', 'Wood', 'Glass', 'Iron'],
        correctAnswer: 1,
        explanation: '“The gate is made of wood” 说明门是木头做的。',
      },
      {
        id: 3,
        question: 'Where does Tom sit?',
        options: ['On a bench', 'Under the tallest tree', 'By the river', 'At the gate'],
        correctAnswer: 1,
        explanation: '“sits under the tallest tree” 说明他坐在最高的树下。',
      },
      {
        id: 4,
        question: 'Who sometimes joins him?',
        options: ['His brother', 'A friend', 'A teacher', 'A neighbor'],
        correctAnswer: 1,
        explanation: '“Sometimes a friend joins him” 说明有时朋友会来。',
      },
      {
        id: 5,
        question: 'What does Tom do when the sun goes down?',
        options: [
          'He stays in the park',
          'He closes his book and walks home',
          'He visits a friend',
          'He reads another story',
        ],
        correctAnswer: 1,
        explanation: '太阳落山时，汤姆合上书、向树木道别并走回家。',
      },
    ],
    userAnswers: { 1: 1, 2: 1, 3: 1, 4: 3, 5: 1 },
  },
  {
    id: 'r3',
    title: 'The Old Bookshop',
    level: 'medium',
    targetWords: 150,
    questionCount: 5,
    status: 'submitted',
    createdAt: '2026-10-14T11:05:00.000Z',
    submittedAt: '2026-10-14T11:27:00.000Z',
    newWords: [
      {
        word: 'narrow',
        phonetic: { uk: '/ˈnær.əʊ/', us: '/ˈnær.oʊ/' },
        senses: [{ pos: 'adj.', meaning: '狭窄的' }],
        source: 'dictionary',
      },
      {
        word: 'rainy',
        phonetic: { uk: '/ˈreɪ.ni/', us: '/ˈreɪ.ni/' },
        senses: [{ pos: 'adj.', meaning: '下雨的' }],
        source: 'dictionary',
      },
    ],
    tokenUsage: { promptTokens: 712, completionTokens: 288, totalTokens: 1000 },
    vocabulary: [
      'street',
      'river',
      'bookshop',
      'story',
      'rain',
      'study',
      'journey',
      'friend',
      'memory',
    ],
    article:
      'On a narrow street near the river, there is an old bookshop with a green door. The owner, Mr. Lee, has kept it open for thirty years. The shelves are full of stories, and the air smells of paper and rain. Lily visits the shop every Friday after study. She likes to walk slowly between the shelves and read the first page of a book before she buys it. Mr. Lee says that every book finds its reader in the end. One rainy afternoon, Lily found a small book about a journey across the sea. She took it home and read it twice. The next week, she brought a friend to the shop, because some stories are better when they are shared.',
    translation:
      '在河边一条狭窄的街上，有一家绿色门面的旧书店。店主李先生已经经营了三十年。书架上摆满了故事，空气里是纸张和雨水的味道。莉莉每周五放学后都会来这家店。她喜欢在书架间慢慢走动，买书之前先读一读第一页。李先生说，每一本书最终都会找到它的读者。一个下雨的午后，莉莉发现了一本关于跨海旅程的小书。她把它带回家，读了两遍。第二周，她带了一位朋友来店里，因为有些故事分享之后会更好。',
    questions: [
      {
        id: 1,
        question: 'Where is the bookshop?',
        options: ['Near the river', 'Next to a school', 'In a market', 'By the sea'],
        correctAnswer: 0,
        explanation: '第一句说明书店在河边的一条窄街上。',
      },
      {
        id: 2,
        question: 'How long has Mr. Lee kept the shop open?',
        options: ['Ten years', 'Twenty years', 'Thirty years', 'Fifty years'],
        correctAnswer: 2,
        explanation: '“has kept it open for thirty years” 说明已经经营三十年。',
      },
      {
        id: 3,
        question: 'When does Lily visit the shop?',
        options: ['Every Monday', 'Every Friday', 'Every weekend', 'Every morning'],
        correctAnswer: 1,
        explanation: '“Lily visits the shop every Friday after study.”',
      },
      {
        id: 4,
        question: 'What does Lily do before she buys a book?',
        options: [
          'She reads the last page',
          'She reads the first page',
          'She asks Mr. Lee',
          'She looks at the price',
        ],
        correctAnswer: 1,
        explanation: '“read the first page of a book before she buys it” 说明买前先读第一页。',
      },
      {
        id: 5,
        question: 'Why did Lily bring a friend the next week?',
        options: [
          'To buy a gift',
          'Because some stories are better when shared',
          'To meet Mr. Lee',
          'To find a new book',
        ],
        correctAnswer: 1,
        explanation: '最后一句给出原因：some stories are better when they are shared。',
      },
    ],
    userAnswers: { 1: 0, 2: 2, 3: 0, 4: 0, 5: 1 },
  },
  {
    id: 'r4',
    title: 'A Letter from the Coast',
    level: 'medium',
    targetWords: 150,
    questionCount: 8,
    status: 'submitted',
    createdAt: '2026-10-19T10:40:00.000Z',
    // 隔天提交：让历史页的「提交时间优先」在本地就能看出来（其余记录当天提交）
    submittedAt: '2026-10-20T09:15:00.000Z',
    newWords: [
      {
        word: 'fisherman',
        phonetic: { uk: '/ˈfɪʃ.ə.mən/', us: '/ˈfɪʃ.ɚ.mən/' },
        senses: [{ pos: 'n.', meaning: '渔夫' }],
        source: 'dictionary',
      },
      {
        word: 'notebook',
        phonetic: { uk: '/ˈnəʊt.bʊk/', us: '/ˈnoʊt.bʊk/' },
        senses: [{ pos: 'n.', meaning: '笔记本' }],
        source: 'dictionary',
      },
    ],
    tokenUsage: { promptTokens: 905, completionTokens: 352, totalTokens: 1257 },
    vocabulary: [
      'summer',
      'sea',
      'coast',
      'quiet',
      'gentle',
      'language',
      'memory',
      'tired',
      'wonder',
    ],
    article:
      "Last summer, Nora spent two weeks in a small town by the sea. Her aunt lived there in a white house with a red roof. Every morning, Nora walked along the coast and listened to the water. The town was quiet, and the people were gentle. She met an old fisherman named Ben, who taught her how to read the sky. If the clouds are high and thin, the weather will stay kind, he said. Nora wrote his words in her notebook. In the afternoon, she sat on the rocks and studied the language of the waves. When it was time to leave, Ben gave her a simple shell. Keep it, he said. It will help you remember. Now the shell sits on Nora's desk. Whenever she feels tired, she holds it and thinks of the coast.",
    translation:
      '去年夏天，诺拉在一个海边小镇住了两周。她的姑妈住在那里一栋白墙红顶的房子里。每天清晨，诺拉沿着海岸散步，听海水的声音。小镇很安静，人们也很温和。她遇见了一位名叫本的老渔夫，他教她如何读懂天空。如果云又高又薄，天气就会一直很好，他说。诺拉把他的话写在笔记本里。下午，她坐在岩石上，研究海浪的语言。到了离开的时候，本送给她一枚朴素的贝壳。留着吧，他说，它会帮你记住这里。现在，那枚贝壳放在诺拉的桌上。每当她感到疲惫，就把它握在手里，想起那片海岸。',
    questions: [
      {
        id: 1,
        question: 'Where did Nora spend two weeks?',
        options: ['In the mountains', 'By the sea', 'In a big city', 'On a farm'],
        correctAnswer: 1,
        explanation: '第一句 “Nora spent two weeks in a small town by the sea.”',
      },
      {
        id: 2,
        question: 'Who did she stay with?',
        options: ['Her parents', 'Her aunt', 'Her friend', 'Her teacher'],
        correctAnswer: 1,
        explanation: '“Her aunt lived there…” 说明她住在姑妈家。',
      },
      {
        id: 3,
        question: 'What color was the roof of the house?',
        options: ['Blue', 'Green', 'Red', 'White'],
        correctAnswer: 2,
        explanation: '“a white house with a red roof” 说明屋顶是红色的。',
      },
      {
        id: 4,
        question: 'Who taught her to read the sky?',
        options: ['A teacher', 'An old fisherman', 'Her aunt', 'A sailor'],
        correctAnswer: 1,
        explanation: '“an old fisherman named Ben, who taught her how to read the sky.”',
      },
      {
        id: 5,
        question: 'What did Ben say high thin clouds mean?',
        options: [
          'A storm is coming',
          'The weather will stay kind',
          'The sea will be rough',
          'Winter is near',
        ],
        correctAnswer: 1,
        explanation: '“If the clouds are high and thin, the weather will stay kind.”',
      },
      {
        id: 6,
        question: "Where did Nora write Ben's words?",
        options: ['In a letter', 'In her notebook', 'On a shell', 'In a book'],
        correctAnswer: 1,
        explanation: '“Nora wrote his words in her notebook.”',
      },
      {
        id: 7,
        question: 'What did Ben give her?',
        options: ['A notebook', 'A small shell', 'A fishing net', 'A photo'],
        correctAnswer: 1,
        explanation: '“Ben gave her a simple shell.”',
      },
      {
        id: 8,
        question: 'Where is the shell now?',
        options: ['On the beach', 'In a box', "On Nora's desk", 'In her bag'],
        correctAnswer: 2,
        explanation: "“Now the shell sits on Nora's desk.”",
      },
    ],
    userAnswers: { 1: 1, 2: 1, 3: 2, 4: 1, 5: 1, 6: 1, 7: 1, 8: 0 },
  },
  {
    id: 'r5',
    title: 'The Courage to Begin',
    level: 'hard',
    targetWords: 200,
    questionCount: 5,
    status: 'generated',
    createdAt: '2026-10-26T08:30:00.000Z',
    submittedAt: null,
    newWords: [
      {
        word: 'dramatic',
        phonetic: { uk: '/drəˈmæt.ɪk/', us: '/drəˈmæt̬.ɪk/' },
        senses: [{ pos: 'adj.', meaning: '戏剧性的' }],
        source: 'dictionary',
      },
      {
        word: 'uncertain',
        phonetic: { uk: '/ʌnˈsɜː.tən/', us: '/ʌnˈsɝː.tən/' },
        senses: [{ pos: 'adj.', meaning: '不确定的' }],
        source: 'dictionary',
      },
    ],
    tokenUsage: { promptTokens: 1080, completionTokens: 470, totalTokens: 1550 },
    vocabulary: ['courage', 'quiet', 'study', 'language', 'story', 'practice', 'patient', 'fear'],
    article:
      'Everyone talks about courage as if it were a loud thing—a brave jump, a bold speech, a bright victory. But most courage is quiet. It is the student who opens a book after failing a test. It is the friend who says sorry first. It is the woman who begins again after a long, difficult year. Marla learned this in a small classroom at the edge of town. She had always wanted to learn another language, but she was afraid of sounding foolish. For months she waited for the right moment. Then one evening, she opened a simple story and read the first line out loud. Her voice was slow and uncertain. The words did not come easily. But she read the next line, and then the next. Nothing dramatic happened. No one clapped. Yet something in her changed. She understood that courage is not the absence of fear. It is the decision to practice anyway, one patient page at a time.',
    translation:
      '人们谈起勇气，总把它说成一件响亮的事——勇敢的一跃、大胆的演讲、耀眼的胜利。但大多数勇气是安静的。它是考试失利后仍然翻开书本的学生，是先说对不起的朋友，是在漫长艰难的一年后重新开始的女人。玛拉在城镇边缘的一间小教室里明白了这一点。她一直想学另一门语言，却害怕自己听起来很傻。她等了几个月，等待合适的时机。后来有一天晚上，她打开一个简单的故事，大声读出了第一行。她的声音缓慢而不确定，词语并不轻松地流出来。但她读了下一行，又读了下一行。没有戏剧性的事情发生，也没有人鼓掌。可她内心的某些东西变了。她明白了，勇气不是没有恐惧，而是尽管害怕，仍然决定一页一页耐心地练习下去。',
    questions: [
      {
        id: 1,
        question: 'What does the writer say most courage is like?',
        options: ['Loud', 'Quiet', 'Bright', 'Sudden'],
        correctAnswer: 1,
        explanation: '第二句 “But most courage is quiet.” 是作者的核心观点。',
      },
      {
        id: 2,
        question: 'What had Marla always wanted to do?',
        options: ['Travel abroad', 'Write a book', 'Learn another language', 'Teach a class'],
        correctAnswer: 2,
        explanation: '“She had always wanted to learn another language.”',
      },
      {
        id: 3,
        question: 'Why did Marla wait for months?',
        options: [
          'She had no time',
          'She could not find a book',
          'She had no teacher',
          'She was afraid of sounding foolish',
        ],
        correctAnswer: 3,
        explanation: '“she was afraid of sounding foolish” 是她迟迟不开始的原因。',
      },
      {
        id: 4,
        question: 'What happened after Marla read the first line out loud?',
        options: [
          'People clapped',
          'Nothing dramatic happened',
          'She gave up',
          'She called a friend',
        ],
        correctAnswer: 1,
        explanation: '“Nothing dramatic happened. No one clapped.”',
      },
      {
        id: 5,
        question: 'What does the writer say courage is?',
        options: [
          'The absence of fear',
          'A loud victory',
          'The decision to practice anyway',
          'A brave jump',
        ],
        correctAnswer: 2,
        explanation: '最后一句 “It is the decision to practice anyway…”。',
      },
    ],
    userAnswers: null,
  },
]

/**
 * 生成模板：每个难度一份，均含 8 道题，适配 3 / 5 / 8 三种题目数量
 */
const READING_TEMPLATES = {
  easy: [
    {
      title: 'A Walk by the River',
      article:
        'Lina likes to walk by the river after study. The path is quiet, and the water moves slowly under the bridge. On sunny days, she brings an apple and a small book. She reads a few pages, then watches the birds near the water. An old man often sits on the same bench. He says hello, and Lina says hello back. They do not talk much, but the morning feels gentle and simple. One day, Lina sees a young boy reading by the river. He looks happy and curious. She remembers her first story, and she smiles. A small walk can hold a whole memory.',
      translation:
        '莉娜喜欢在课后沿着河边散步。小路很安静，河水在桥下缓缓流动。晴天时，她会带一个苹果和一本小书。她读上几页，然后看水边的鸟。一位老人常常坐在同一张长椅上。他打招呼，莉娜也回应。他们不怎么交谈，但早晨显得温和而简单。有一天，莉娜看见一个年轻男孩在河边读书。他看起来快乐又好奇。她想起自己的第一个故事，笑了。一次短短的散步也能装下一整段回忆。',
      newWords: [
        {
          word: 'gentle',
          phonetic: { uk: '/ˈdʒen.tl/', us: '/ˈdʒen.tl/' },
          senses: [{ pos: 'adj.', meaning: '温和的' }],
          source: 'dictionary',
        },
        {
          word: 'curious',
          phonetic: { uk: '/ˈkjʊə.ri.əs/', us: '/ˈkjʊr.i.əs/' },
          senses: [{ pos: 'adj.', meaning: '好奇的' }],
          source: 'dictionary',
        },
      ],
      tokenUsage: { promptTokens: 812, completionTokens: 356, totalTokens: 1168 },
      questions: [
        {
          id: 1,
          question: 'When does Lina like to walk by the river?',
          options: ['Before breakfast', 'After study', 'At night', 'On rainy days'],
          correctAnswer: 1,
          explanation: '第一句 “Lina likes to walk by the river after study.”',
        },
        {
          id: 2,
          question: 'How does the water move?',
          options: ['Quickly', 'Slowly', 'It does not move', 'Loudly'],
          correctAnswer: 1,
          explanation: '“the water moves slowly under the bridge”',
        },
        {
          id: 3,
          question: 'What does Lina bring on sunny days?',
          options: ['An apple and a small book', 'A notebook and a pen', 'A kite', 'A camera'],
          correctAnswer: 0,
          explanation: '“she brings an apple and a small book.”',
        },
        {
          id: 4,
          question: 'Who often sits on the same bench?',
          options: ['A young boy', 'An old man', 'A teacher', 'A friend'],
          correctAnswer: 1,
          explanation: '“An old man often sits on the same bench.”',
        },
        {
          id: 5,
          question: 'How much do Lina and the old man talk?',
          options: ['A lot', 'Not much', 'They never speak', 'They argue'],
          correctAnswer: 1,
          explanation: '“They do not talk much.”',
        },
        {
          id: 6,
          question: 'Who does Lina see reading by the river?',
          options: ['An old man', 'A young boy', 'A teacher', 'A girl'],
          correctAnswer: 1,
          explanation: '“Lina sees a young boy reading by the river.”',
        },
        {
          id: 7,
          question: 'How does the boy look?',
          options: ['Tired and angry', 'Happy and curious', 'Sad and quiet', 'Busy and loud'],
          correctAnswer: 1,
          explanation: '“He looks happy and curious.”',
        },
        {
          id: 8,
          question: 'What does Lina remember?',
          options: ['Her first story', 'Her old school', 'Her friend', 'Her garden'],
          correctAnswer: 0,
          explanation: '“She remembers her first story.”',
        },
      ],
    },
  ],
  medium: [
    {
      title: 'The Kite Maker',
      article:
        'In the small town of Bell, there is a workshop where kites are made by hand. The owner, Mr. Park, is a patient man with gentle hands. He uses paper, wood, and string, and he says that a good kite must be light but strong. Children come to his shop after school. They watch him work and ask curious questions. Mr. Park answers each one, even when the question is simple. He tells them that a kite is like a story: it needs a clear shape and a little wind. Every spring, the town holds a kite day. People bring their kites to the park near the river. When the wind rises, the sky fills with color. Mr. Park stands at the edge of the field and smiles. He does not fly a kite himself. He likes to watch the others, and that is enough.',
      translation:
        '在贝尔小镇上，有一间手工制作风筝的作坊。店主帕克先生是个有耐心的人，双手温和。他用纸、木条和细线做风筝，他说一只好风筝必须轻而结实。孩子们放学后会来他的店里。他们看他干活，问出各种好奇的问题。帕克先生每一个都回答，哪怕问题很简单。他告诉他们，风筝就像故事：需要清晰的形状，还需要一点风。每年春天，小镇都会举办风筝节。人们带着风筝来到河边的公园。风起时，天空就充满了颜色。帕克先生站在场地边缘微笑。他自己不放风筝。他喜欢看着别人放，这就足够了。',
      newWords: [
        {
          word: 'workshop',
          phonetic: { uk: '/ˈwɜːk.ʃɒp/', us: '/ˈwɝːk.ʃɑːp/' },
          senses: [{ pos: 'n.', meaning: '作坊；工作间' }],
          source: 'dictionary',
        },
        {
          word: 'string',
          phonetic: { uk: '/strɪŋ/', us: '/strɪŋ/' },
          senses: [{ pos: 'n.', meaning: '细线' }],
          source: 'dictionary',
        },
      ],
      tokenUsage: { promptTokens: 1240, completionTokens: 512, totalTokens: 1752 },
      questions: [
        {
          id: 1,
          question: 'Where is the workshop?',
          options: ['In a big city', 'In the small town of Bell', 'By the sea', 'Near a school'],
          correctAnswer: 1,
          explanation: '第一句 “In the small town of Bell…”',
        },
        {
          id: 2,
          question: 'What does Mr. Park make?',
          options: ['Books', 'Kites', 'Chairs', 'Shoes'],
          correctAnswer: 1,
          explanation: '“a workshop where kites are made by hand.”',
        },
        {
          id: 3,
          question: 'What does he use to make kites?',
          options: [
            'Paper, wood, and string',
            'Glass and metal',
            'Cloth and water',
            'Plastic and paint',
          ],
          correctAnswer: 0,
          explanation: '“He uses paper, wood, and string.”',
        },
        {
          id: 4,
          question: 'What must a good kite be?',
          options: ['Heavy but strong', 'Light but strong', 'Big and loud', 'Simple and slow'],
          correctAnswer: 1,
          explanation: '“a good kite must be light but strong.”',
        },
        {
          id: 5,
          question: 'When do children come to his shop?',
          options: ['Before school', 'After school', 'At night', 'On Sundays'],
          correctAnswer: 1,
          explanation: '“Children come to his shop after school.”',
        },
        {
          id: 6,
          question: 'What does Mr. Park compare a kite to?',
          options: ['A bird', 'A story', 'A river', 'A memory'],
          correctAnswer: 1,
          explanation: '“he tells them that a kite is like a story.”',
        },
        {
          id: 7,
          question: 'What happens every spring?',
          options: ['A kite day', 'A boat race', 'A long holiday', 'A school test'],
          correctAnswer: 0,
          explanation: '“Every spring, the town holds a kite day.”',
        },
        {
          id: 8,
          question: 'What does Mr. Park do during kite day?',
          options: ['He flies a kite', 'He watches the others', 'He sells kites', 'He stays home'],
          correctAnswer: 1,
          explanation: '“He likes to watch the others, and that is enough.”',
        },
      ],
    },
  ],
  hard: [
    {
      title: 'The Lighthouse',
      article:
        'For as long as she could remember, Elsa had lived in the lighthouse on the northern rock. Her father kept the light burning, and her mother kept the small kitchen warm. The work was not dramatic. Every evening, her father climbed the stairs, cleaned the glass, and checked the oil. In winter, the wind pushed against the windows and the sea turned dark and loud. Elsa was afraid of the sound, but her father told her that fear was only a signal, not a command. When Elsa was sixteen, her father became ill. For three weeks, she climbed the stairs herself. She was tired and uncertain, but the light never went out. Ships passed safely in the night, and no one knew her name. Years later, Elsa left the island to study. In the city, people asked her what it was like to grow up in a lighthouse. She always said the same thing: the most important work is often the work nobody sees. A light does not need to be famous to guide someone home.',
      translation:
        '在厄尔莎的记忆里，她一直住在北方礁石上的灯塔里。父亲负责让灯一直亮着，母亲负责让小厨房保持温暖。这份工作并不戏剧化。每天傍晚，父亲都会爬上楼梯，擦净玻璃，检查灯油。冬天，风推着窗户，海变得又黑又响。厄尔莎害怕那种声音，但父亲告诉她，恐惧只是一个信号，而不是命令。厄尔莎十六岁那年，父亲病倒了。有三个星期，是她自己爬上楼梯。她疲惫又不确定，但灯从未熄灭。船只在夜里安全驶过，没有人知道她的名字。多年以后，厄尔莎离开小岛去求学。在城市里，人们问她，在灯塔长大是什么感觉。她总是回答同一句话：最重要的工作，往往是没人看见的工作。一盏灯不必出名，也能指引一个人回家。',
      newWords: [
        {
          word: 'lighthouse',
          phonetic: { uk: '/ˈlaɪt.haʊs/', us: '/ˈlaɪt.haʊs/' },
          senses: [{ pos: 'n.', meaning: '灯塔' }],
          source: 'dictionary',
        },
        {
          word: 'signal',
          phonetic: { uk: '/ˈsɪɡ.nəl/', us: '/ˈsɪɡ.nəl/' },
          senses: [{ pos: 'n.', meaning: '信号' }],
          source: 'dictionary',
        },
      ],
      tokenUsage: { promptTokens: 1680, completionTokens: 705, totalTokens: 2385 },
      questions: [
        {
          id: 1,
          question: 'Where did Elsa live?',
          options: ['On a farm', 'In a lighthouse', 'In a city', 'By a river'],
          correctAnswer: 1,
          explanation: '第一句说明她住在北方礁石上的灯塔里。',
        },
        {
          id: 2,
          question: 'Who kept the light burning?',
          options: ['Her mother', 'Her father', 'Elsa', 'A neighbor'],
          correctAnswer: 1,
          explanation: '“Her father kept the light burning.”',
        },
        {
          id: 3,
          question: 'What did her father do every evening?',
          options: [
            'He cooked dinner',
            'He climbed the stairs and checked the oil',
            'He read a book',
            'He wrote letters',
          ],
          correctAnswer: 1,
          explanation: '“her father climbed the stairs, cleaned the glass, and checked the oil.”',
        },
        {
          id: 4,
          question: 'How did Elsa feel about the winter wind?',
          options: ['She loved it', 'She was afraid of it', 'She ignored it', 'She laughed at it'],
          correctAnswer: 1,
          explanation: '“Elsa was afraid of the sound.”',
        },
        {
          id: 5,
          question: 'What did her father say fear was?',
          options: ['A command', 'A signal', 'A story', 'A light'],
          correctAnswer: 1,
          explanation: '“fear was only a signal, not a command.”',
        },
        {
          id: 6,
          question: 'How old was Elsa when her father became ill?',
          options: ['Twelve', 'Fourteen', 'Sixteen', 'Eighteen'],
          correctAnswer: 2,
          explanation: '“When Elsa was sixteen, her father became ill.”',
        },
        {
          id: 7,
          question: 'How long did Elsa keep the light on herself?',
          options: ['Three days', 'Three weeks', 'Three months', 'Three years'],
          correctAnswer: 1,
          explanation: '“For three weeks, she climbed the stairs herself.”',
        },
        {
          id: 8,
          question: 'What does Elsa always say about important work?',
          options: [
            'It is always seen',
            'It is often the work nobody sees',
            'It must be famous',
            'It is easy to do',
          ],
          correctAnswer: 1,
          explanation: '“the most important work is often the work nobody sees.”',
        },
      ],
    },
  ],
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * 生成一份可写入存储的初始数据库
 * 每次调用都返回深拷贝，避免 mock 运行期修改污染模块级常量
 */
export function createSeedDatabase() {
  return {
    // 与 adapter.js 的 DB_VERSION 保持一致；v2 起单词带 source / phonetic / senses，
    // v3 起练习带 newWords / tokenUsage，v4 起单词带 cocaRank
    version: 4,
    words: clone(WORDS),
    readings: clone(READINGS),
    wordSeq: 25,
    readingSeq: 6,
  }
}

export { WORDS, READINGS, READING_TEMPLATES }
