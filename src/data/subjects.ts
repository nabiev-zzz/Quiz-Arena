import type { Subject, Topic } from '../types';

// Har bir fan uchun 100 ta barqaror IDga ega mavzu.
const facets = [
  "Asosiy tushunchalar",
  "Qoidalar va formulalar",
  "Misollar va yechimlar",
  "Amaliy mashqlar",
  "Murakkab topshiriqlar"
] as const;
const definitions = [
  {
    "id": "algebra",
    "name": "Algebra",
    "description": "Sonlar, tenglamalar va matematik munosabatlar",
    "icon": "∑",
    "color": "#8B7CFF",
    "legacy": [
      [
        "equations",
        "Tenglamalar",
        "Chiziqli va kvadrat tenglamalar",
        "medium"
      ],
      [
        "functions",
        "Funksiyalar",
        "Funksiyalar va grafiklar",
        "medium"
      ],
      [
        "percentages",
        "Foizlar",
        "Foizga oid masalalar",
        "easy"
      ],
      [
        "expressions",
        "Algebraik ifodalar",
        "Ifodalarni soddalashtirish",
        "medium"
      ],
      [
        "inequalities",
        "Tengsizliklar",
        "Tengsizliklarni yechish",
        "hard"
      ],
      [
        "polynomials",
        "Ko‘phadlar",
        "Ko‘phadlar ustida amallar",
        "hard"
      ]
    ],
    "modules": [
      "Natural sonlar va amallar",
      "Butun sonlar",
      "Oddiy kasrlar",
      "O‘nli kasrlar",
      "Nisbat va proporsiya",
      "Foizli hisob-kitoblar",
      "Darajalar va ildizlar",
      "Algebraik ifodalar",
      "Bir noma’lumli tenglamalar",
      "Tenglamalar sistemasi",
      "Chiziqli tengsizliklar",
      "Kvadrat tenglamalar",
      "Ko‘phadlar va amallar",
      "Ko‘paytuvchilarga ajratish",
      "Ratsional ifodalar",
      "Funksiya tushunchasi",
      "Chiziqli funksiyalar",
      "Kvadrat funksiyalar",
      "Ketma-ketliklar",
      "Kombinatorika va ehtimollik"
    ]
  },
  {
    "id": "geometry",
    "name": "Geometriya",
    "description": "Shakllar, o‘lchamlar va fazoviy tasavvur",
    "icon": "△",
    "color": "#38BDF8",
    "legacy": [
      [
        "triangles",
        "Uchburchaklar",
        "Uchburchak xossalari",
        "medium"
      ],
      [
        "quadrilaterals",
        "To‘rtburchaklar",
        "Kvadrat, romb va trapetsiya",
        "medium"
      ],
      [
        "circles",
        "Aylana va doira",
        "Aylana elementlari va xossalari",
        "medium"
      ],
      [
        "perimeter-area",
        "Yuza va perimetr",
        "Geometrik o‘lchovlar",
        "easy"
      ],
      [
        "solid-geometry",
        "Fazoviy jismlar",
        "Kub, prizma va piramida",
        "hard"
      ]
    ],
    "modules": [
      "Geometriyaning asosiy tushunchalari",
      "Nuqta, to‘g‘ri chiziq va tekislik",
      "Kesma va burchaklar",
      "Parallel va perpendikulyar chiziqlar",
      "Uchburchaklar tasnifi",
      "Uchburchak tengligi",
      "Uchburchak o‘xshashligi",
      "Pifagor teoremasi",
      "To‘rtburchaklar xossalari",
      "Parallelogram va romb",
      "Trapetsiya va uning elementlari",
      "Ko‘pburchaklar",
      "Aylana va doira elementlari",
      "Aylana uzunligi va sektor",
      "Perimetr va yuzalar",
      "Koordinatalar geometriyasi",
      "Vektorlar",
      "Fazoviy jismlar",
      "Hajm va sirt yuzi",
      "Geometrik yasashlar"
    ]
  },
  {
    "id": "physics",
    "name": "Fizika",
    "description": "Tabiat qonunlarini o‘rganing",
    "icon": "⚛",
    "color": "#38BDF8",
    "legacy": [
      [
        "mechanics",
        "Mexanika",
        "Jismlarning harakati",
        "medium"
      ],
      [
        "kinematics",
        "Kinematika",
        "Harakat va tezlik",
        "medium"
      ],
      [
        "dynamics",
        "Dinamika",
        "Kuch va harakat",
        "hard"
      ],
      [
        "electricity",
        "Elektr",
        "Elektr toki va zanjirlar",
        "medium"
      ],
      [
        "optics",
        "Optika",
        "Yorug‘lik hodisalari",
        "easy"
      ]
    ],
    "modules": [
      "Fizik kattaliklar va o‘lchovlar",
      "Mexanik harakat",
      "Tezlik va o‘rtacha tezlik",
      "Tezlanish",
      "Erkin tushish",
      "Nyuton qonunlari",
      "Kuchlar va ularning turlari",
      "Ish, quvvat va energiya",
      "Impuls va saqlanish qonunlari",
      "Bosim va suyuqliklar",
      "Gazlar fizikasi",
      "Issiqlik hodisalari",
      "Termodinamika asoslari",
      "Elektr zaryadi va maydon",
      "Elektr toki va zanjirlar",
      "Magnit maydon",
      "Elektromagnit induksiya",
      "Mexanik tebranishlar va to‘lqinlar",
      "Tovush hodisalari",
      "Yorug‘lik va optika"
    ]
  },
  {
    "id": "chemistry",
    "name": "Kimyo",
    "description": "Moddalar va kimyoviy reaksiyalar",
    "icon": "⚗",
    "color": "#34D399",
    "legacy": [
      [
        "atoms",
        "Atom tuzilishi",
        "Atom va uning tarkibi",
        "easy"
      ],
      [
        "periodic-table",
        "Davriy jadval",
        "Kimyoviy elementlar",
        "medium"
      ],
      [
        "chemical-bonds",
        "Kimyoviy bog‘lanishlar",
        "Bog‘lanish turlari",
        "hard"
      ],
      [
        "reactions",
        "Kimyoviy reaksiyalar",
        "Reaksiya tenglamalari",
        "medium"
      ]
    ],
    "modules": [
      "Kimyoning asosiy tushunchalari",
      "Atom tuzilishi",
      "Kimyoviy elementlar",
      "Davriy qonun va jadval",
      "Izotoplar va izobarlar",
      "Kimyoviy bog‘lanishlar",
      "Modda miqdori va mol",
      "Kimyoviy formulalar",
      "Reaksiya tenglamalari",
      "Reaksiya turlari",
      "Oksidlanish-qaytarilish",
      "Oksidlar va asoslar",
      "Kislotalar va tuzlar",
      "Eritmalar va konsentratsiya",
      "Elektrolitik dissotsiatsiya",
      "Metallar va ularning xossalari",
      "Metallmaslar",
      "Organik kimyoga kirish",
      "Uglevodorodlar",
      "Kundalik hayot kimyosi"
    ]
  },
  {
    "id": "biology",
    "name": "Biologiya",
    "description": "Tirik organizmlar va tabiat",
    "icon": "✿",
    "color": "#A3E635",
    "legacy": [
      [
        "cell",
        "Hujayra",
        "Hujayra tuzilishi",
        "easy"
      ],
      [
        "genetics",
        "Genetika",
        "Irsiyat va o‘zgaruvchanlik",
        "hard"
      ],
      [
        "anatomy",
        "Odam anatomiyasi",
        "Inson organizmi",
        "medium"
      ],
      [
        "ecology",
        "Ekologiya",
        "Tabiat va muhit",
        "easy"
      ]
    ],
    "modules": [
      "Biologiya faniga kirish",
      "Hujayra tuzilishi",
      "Hujayra organoidlari",
      "Moddalar almashinuvi",
      "Fotosintez va nafas olish",
      "Hujayra bo‘linishi",
      "Genetika asoslari",
      "Irsiyat qonunlari",
      "O‘zgaruvchanlik",
      "Evolyutsiya nazariyasi",
      "Tabiiy tanlanish",
      "O‘simliklar dunyosi",
      "O‘simliklar fiziologiyasi",
      "Hayvonlar xilma-xilligi",
      "Hayvonlar anatomiyasi",
      "Odam anatomiyasi",
      "Odam fiziologiyasi",
      "Immunitet va salomatlik",
      "Ekologiya va ekotizimlar",
      "Biosfera va tabiatni muhofaza qilish"
    ]
  },
  {
    "id": "history",
    "name": "Tarix",
    "description": "O‘tmish voqealarini kashf eting",
    "icon": "⌛",
    "color": "#FBBF24",
    "legacy": [
      [
        "uzbek-history",
        "O‘zbekiston tarixi",
        "Yurtimiz tarixi",
        "medium"
      ],
      [
        "world-history",
        "Jahon tarixi",
        "Jahon sivilizatsiyalari",
        "medium"
      ],
      [
        "ancient-world",
        "Qadimgi dunyo",
        "Qadimgi davlatlar",
        "easy"
      ]
    ],
    "modules": [
      "Ibtidoiy jamiyat",
      "Qadimgi Sharq sivilizatsiyalari",
      "Qadimgi Misr",
      "Qadimgi Mesopotamiya",
      "Qadimgi Hindiston va Xitoy",
      "Qadimgi Yunoniston",
      "Qadimgi Rim",
      "Markaziy Osiyoning qadimgi tarixi",
      "Kushon davlati",
      "Turk xoqonligi",
      "Arab xalifaligi va Movarounnahr",
      "Somoniylar davlati",
      "Qoraxoniylar va Xorazmshohlar",
      "Amir Temur va Temuriylar",
      "O‘rta asrlar jahon tarixi",
      "Buyuk geografik kashfiyotlar",
      "Yangi davr inqiloblari",
      "XIX asr va mustamlakachilik",
      "XX asr jahon tarixi",
      "Mustaqil O‘zbekiston tarixi"
    ]
  },
  {
    "id": "geography",
    "name": "Geografiya",
    "description": "Dunyo va tabiatni o‘rganing",
    "icon": "◎",
    "color": "#2DD4BF",
    "legacy": [
      [
        "continents",
        "Materiklar va okeanlar",
        "Yer yuzining tuzilishi",
        "easy"
      ],
      [
        "countries",
        "Davlatlar va poytaxtlar",
        "Dunyo mamlakatlari",
        "medium"
      ],
      [
        "climate",
        "Iqlim",
        "Iqlim mintaqalari",
        "hard"
      ]
    ],
    "modules": [
      "Geografiya va xaritalar",
      "Yerning shakli va harakati",
      "Materiklar va okeanlar",
      "Litosfera va relyef",
      "Atmosfera qatlamlari",
      "Ob-havo va iqlim",
      "Gidrosfera va suv resurslari",
      "Daryolar va ko‘llar",
      "Tabiiy geografik zonalar",
      "Tuproq va biosfera",
      "Aholi geografiyasi",
      "Aholi joylashuvi va migratsiya",
      "Dunyo siyosiy xaritasi",
      "Davlatlar va poytaxtlar",
      "Jahon xo‘jaligi",
      "Sanoat geografiyasi",
      "Qishloq xo‘jaligi geografiyasi",
      "Transport va aloqa",
      "O‘zbekiston tabiiy geografiyasi",
      "O‘zbekiston iqtisodiy geografiyasi"
    ]
  },
  {
    "id": "informatics",
    "name": "Informatika",
    "description": "Raqamli texnologiyalar olami",
    "icon": "⌘",
    "color": "#818CF8",
    "legacy": [
      [
        "algorithms",
        "Algoritmlar",
        "Algoritm va mantiq",
        "medium"
      ],
      [
        "programming",
        "Dasturlash",
        "Dasturlash asoslari",
        "hard"
      ],
      [
        "computer",
        "Kompyuter savodxonligi",
        "Kompyuter qurilmalari",
        "easy"
      ]
    ],
    "modules": [
      "Axborot va uning xususiyatlari",
      "Kompyuter arxitekturasi",
      "Operatsion tizimlar",
      "Fayl va papkalar bilan ishlash",
      "Ikkilik sanoq tizimi",
      "Mantiqiy amallar",
      "Algoritmlar va blok-sxemalar",
      "Dasturlashga kirish",
      "O‘zgaruvchilar va ma’lumot turlari",
      "Shart operatorlari",
      "Takrorlash operatorlari",
      "Funksiyalar va protseduralar",
      "Massivlar va kolleksiyalar",
      "Ma’lumotlar tuzilmalari",
      "Ma’lumotlar bazasi asoslari",
      "SQL va so‘rovlar",
      "Kompyuter tarmoqlari",
      "Internet va veb texnologiyalar",
      "Kiberxavfsizlik asoslari",
      "Sun’iy intellekt va raqamli madaniyat"
    ]
  },
  {
    "id": "uzbek-language",
    "name": "O‘zbek tili",
    "description": "Ona tilimiz bilimlarini oshiring",
    "icon": "文",
    "color": "#FB923C",
    "legacy": [
      [
        "grammar",
        "Grammatika",
        "Til qoidalari",
        "medium"
      ],
      [
        "phonetics",
        "Fonetika",
        "Nutq tovushlari",
        "easy"
      ],
      [
        "morphology",
        "Morfologiya",
        "So‘z turkumlari",
        "hard"
      ]
    ],
    "modules": [
      "O‘zbek adabiy tili me’yorlari",
      "Fonetika va tovushlar",
      "Unli va undosh tovushlar",
      "Bo‘g‘in va urg‘u",
      "Orfoepiya qoidalari",
      "Imlo va orfografiya",
      "Leksikologiya",
      "So‘z ma’nosi va ko‘chma ma’no",
      "Frazeologizmlar",
      "So‘z yasalishi",
      "Morfemika",
      "Mustaqil so‘z turkumlari",
      "Ot va uning grammatik kategoriyalari",
      "Sifat va son",
      "Olmosh va ravish",
      "Fe’l va uning shakllari",
      "Yordamchi so‘zlar",
      "Sintaksis va so‘z birikmasi",
      "Sodda va qo‘shma gaplar",
      "Punktuatsiya va uslubiyat"
    ]
  },
  {
    "id": "literature",
    "name": "Adabiyot",
    "description": "Adabiy meros bilan tanishing",
    "icon": "▤",
    "color": "#E879F9",
    "legacy": [
      [
        "classics",
        "Mumtoz adabiyot",
        "Klassik asarlar",
        "medium"
      ],
      [
        "poets",
        "Shoir va yozuvchilar",
        "Adiblar hayoti va ijodi",
        "easy"
      ],
      [
        "works",
        "Badiiy asarlar",
        "Asarlar tahlili",
        "hard"
      ]
    ],
    "modules": [
      "Xalq og‘zaki ijodi",
      "Qadimgi turkiy adabiyot",
      "Alisher Navoiy hayoti va ijodi",
      "Zahiriddin Muhammad Bobur",
      "Lutfiy va Sakkokiy ijodi",
      "Mumtoz she’riyat janrlari",
      "Tasavvuf adabiyoti",
      "Jadid adabiyoti",
      "Abdulla Qodiriy ijodi",
      "Cho‘lpon va Fitrat",
      "Oybek asarlari",
      "G‘afur G‘ulom ijodi",
      "Abdulla Qahhor hikoyalari",
      "Hamid Olimjon va Zulfiya",
      "XX asr she’riyati",
      "Zamonaviy o‘zbek nasri",
      "Jahon adabiyoti namoyandalari",
      "Adabiy janr va uslublar",
      "Badiiy tasvir vositalari",
      "Badiiy asar tahlili"
    ]
  },
  {
    "id": "english",
    "name": "Ingliz tili",
    "description": "Ingliz tilini bosqichma-bosqich o‘rganing",
    "icon": "A",
    "color": "#60A5FA",
    "legacy": [
      [
        "vocabulary",
        "Vocabulary",
        "Yangi so‘zlar",
        "easy"
      ],
      [
        "grammar-en",
        "Grammar",
        "Grammatika qoidalari",
        "medium"
      ],
      [
        "tenses",
        "English Tenses",
        "Zamonlar",
        "hard"
      ]
    ],
    "modules": [
      "English alphabet and pronunciation",
      "Basic greetings and introductions",
      "Everyday vocabulary",
      "Numbers, dates and time",
      "Nouns and articles",
      "Pronouns and possessives",
      "Adjectives and adverbs",
      "Present Simple and Continuous",
      "Past Simple and Continuous",
      "Future forms",
      "Present Perfect",
      "Modal verbs",
      "Questions and negatives",
      "Prepositions and conjunctions",
      "Comparatives and superlatives",
      "Countable and uncountable nouns",
      "Conditionals",
      "Passive voice",
      "Reported speech",
      "Reading, writing and communication"
    ]
  }
] as const;

export const subjects: Subject[] = definitions.map((subject) => {
  const topics: Topic[] = subject.legacy.map(([id, name, description, difficulty]) => ({ id, name, description, questionCount: 20, difficulty }));
  const used = new Set(topics.map((topic) => topic.name.toLocaleLowerCase()));
  for (let moduleIndex = 0; moduleIndex < subject.modules.length && topics.length < 100; moduleIndex += 1) {
    for (let facetIndex = 0; facetIndex < facets.length && topics.length < 100; facetIndex += 1) {
      const moduleName = subject.modules[moduleIndex];
      const name = `${moduleName} — ${facets[facetIndex]}`;
      if (used.has(name.toLocaleLowerCase())) continue;
      used.add(name.toLocaleLowerCase());
      const id = `${moduleName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 46)}-${facetIndex + 1}`;
      topics.push({ id, name, description: `${moduleName} mavzusining ${facets[facetIndex].toLowerCase()} bo‘yicha testlari`, questionCount: 20, difficulty: facetIndex === 4 ? 'hard' : facetIndex === 0 ? 'easy' : 'medium' });
    }
  }
  return { id: subject.id, name: subject.name, description: subject.description, icon: subject.icon, color: subject.color, topics };
});
