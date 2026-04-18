// ============================================================
//  KICD-aligned Curriculum Designs (CBC)
//  Grade 4–6 core subjects: Math, English, Kiswahili, Science, SST
//  ----------------------------------------------------------------
//  This is the SINGLE SOURCE OF TRUTH for the Curriculum-Driven
//  Engine. Every SLO, activity and inquiry question used in
//  generated Schemes of Work MUST come from this file.
//
//  Structure is normalised so the engine can:
//    • map (grade, subject, term) → CurriculumDesign
//    • walk strands in order
//    • respect each sub-strand's lessonAllocation
//    • pull SLOs / activities verbatim (Lock mode) OR allow
//      teachers to APPEND extra activities only (Flex mode)
// ============================================================

export interface CurriculumSubStrand {
  name: string;
  lessonAllocation: number;          // KICD-defined number of lessons
  slos: string[];                    // Specific Learning Outcomes (verbatim)
  activities: string[];              // Suggested learning experiences
  inquiryQuestions: string[];        // Key Inquiry Questions
  coreCompetencies: string[];
  values: string[];
  pcis: string[];                    // Pertinent & Contemporary Issues
  links: string[];                   // Links to other learning areas
  assessmentMethods?: string[];
  resources?: string[];
}

export interface CurriculumStrand {
  name: string;
  subStrands: CurriculumSubStrand[];
}

export interface CurriculumDesign {
  grade: string;
  subject: string;
  term: string;
  strands: CurriculumStrand[];
}

// ---------- helpers ---------------------------------------------
const COMMON_COMPETENCIES = [
  'Communication and collaboration',
  'Critical thinking and problem solving',
  'Creativity and imagination',
  'Citizenship',
  'Digital literacy',
  'Learning to learn',
  'Self-efficacy',
];
const COMMON_VALUES = ['Respect', 'Responsibility', 'Integrity', 'Unity', 'Patriotism', 'Love', 'Peace'];
const COMMON_PCIS = ['Life skills', 'Citizenship', 'Health education', 'ESD (Education for Sustainable Development)'];

// ============================================================
//                        GRADE 4
// ============================================================

const G4_MATH_T1: CurriculumStrand[] = [
  {
    name: 'Numbers',
    subStrands: [
      {
        name: 'Whole Numbers',
        lessonAllocation: 14,
        slos: [
          'read and write numbers up to 10,000 in symbols',
          'read and write numbers up to 1,000 in words',
          'identify place value of digits up to thousands',
          'round off numbers to the nearest ten and hundred',
          'order numbers up to 10,000 in ascending and descending order',
        ],
        activities: [
          'Learners read number cards in groups and write them in symbols and words',
          'Learners use place value charts/abacus to identify place value of digits',
          'Learners round off numbers using a number line',
          'Learners arrange number cards in ascending and descending order in pairs',
          'Learners play digital games on number recognition',
        ],
        inquiryQuestions: [
          'How do we use whole numbers in our daily life?',
          'Why is place value important when reading numbers?',
        ],
        coreCompetencies: ['Critical thinking and problem solving', 'Communication and collaboration', 'Digital literacy'],
        values: ['Responsibility', 'Unity'],
        pcis: ['Financial literacy', 'Life skills'],
        links: ['English (number names)', 'Social Studies (population data)'],
        assessmentMethods: ['Oral questions', 'Written exercise', 'Observation'],
        resources: ['Place value charts', 'Number cards', 'Abacus', 'Mathematics learner\'s book Gr. 4'],
      },
      {
        name: 'Addition',
        lessonAllocation: 10,
        slos: [
          'add up to three 4-digit numbers with single regrouping',
          'apply addition in real-life situations',
          'work out missing numbers in addition sentences',
        ],
        activities: [
          'Learners add numbers using place value apparatus in groups',
          'Learners solve real-life word problems involving addition',
          'Learners fill in missing numbers in addition puzzles',
          'Learners use digital devices to practise addition drills',
        ],
        inquiryQuestions: [
          'Where do we use addition at home and in school?',
          'How does regrouping help in addition?',
        ],
        coreCompetencies: ['Critical thinking and problem solving', 'Self-efficacy'],
        values: ['Responsibility', 'Integrity'],
        pcis: ['Financial literacy'],
        links: ['Social Studies (trade)', 'Home Science (budgeting)'],
        assessmentMethods: ['Written exercise', 'Practical activity', 'Portfolio'],
        resources: ['Place value charts', 'Number cards', 'Mathematics learner\'s book Gr. 4'],
      },
      {
        name: 'Subtraction',
        lessonAllocation: 10,
        slos: [
          'subtract numbers up to 4 digits with single regrouping',
          'apply subtraction in real-life situations',
          'work out missing numbers in subtraction sentences',
        ],
        activities: [
          'Learners subtract using place value apparatus in groups',
          'Learners solve word problems involving subtraction',
          'Learners check answers using addition (inverse operation)',
          'Learners play subtraction games in pairs',
        ],
        inquiryQuestions: [
          'Where do we use subtraction in our daily life?',
          'How can we check if a subtraction answer is correct?',
        ],
        coreCompetencies: ['Critical thinking and problem solving', 'Communication and collaboration'],
        values: ['Honesty', 'Responsibility'],
        pcis: ['Financial literacy'],
        links: ['Home Science (change in shopping)', 'Agriculture'],
        assessmentMethods: ['Oral questions', 'Written exercise'],
        resources: ['Number cards', 'Place value charts', 'Mathematics learner\'s book Gr. 4'],
      },
    ],
  },
  {
    name: 'Measurement',
    subStrands: [
      {
        name: 'Length',
        lessonAllocation: 8,
        slos: [
          'identify metres and centimetres as units of length',
          'measure length of objects in metres and centimetres',
          'convert metres to centimetres and vice versa',
          'add and subtract length in metres and centimetres',
        ],
        activities: [
          'Learners measure objects in the classroom using a metre rule',
          'Learners record measurements in a table',
          'Learners convert m to cm in pairs using worked examples',
          'Learners solve word problems involving length',
        ],
        inquiryQuestions: [
          'Why do we need to measure length accurately?',
          'Where in real life do we measure length?',
        ],
        coreCompetencies: ['Critical thinking and problem solving', 'Communication and collaboration'],
        values: ['Accuracy', 'Responsibility'],
        pcis: ['Life skills'],
        links: ['Science (height of plants)', 'Art and Craft'],
        assessmentMethods: ['Practical activity', 'Written exercise', 'Observation'],
        resources: ['Metre rule', 'Tape measure', 'Mathematics learner\'s book Gr. 4'],
      },
    ],
  },
];

const G4_ENGLISH_T1: CurriculumStrand[] = [
  {
    name: 'Listening and Speaking',
    subStrands: [
      {
        name: 'Pronunciation and Vocabulary',
        lessonAllocation: 6,
        slos: [
          'pronounce words with the sounds /θ/ and /ð/ correctly',
          'use new vocabulary in oral sentences',
          'identify silent letters in given words',
        ],
        activities: [
          'Learners listen to a recording and repeat target sounds in groups',
          'Learners role-play short conversations using new vocabulary',
          'Learners pick word cards and pronounce them in pairs',
          'Learners watch a video clip and identify silent letters',
        ],
        inquiryQuestions: [
          'Why is correct pronunciation important?',
          'How does new vocabulary help us communicate?',
        ],
        coreCompetencies: ['Communication and collaboration', 'Digital literacy'],
        values: ['Respect', 'Unity'],
        pcis: ['Life skills'],
        links: ['Kiswahili', 'CRE'],
        assessmentMethods: ['Oral questions', 'Observation', 'Checklist'],
        resources: ['Audio clips', 'Flash cards', 'English learner\'s book Gr. 4'],
      },
    ],
  },
  {
    name: 'Reading',
    subStrands: [
      {
        name: 'Intensive Reading',
        lessonAllocation: 8,
        slos: [
          'read a grade-appropriate text fluently',
          'answer comprehension questions from a passage',
          'identify main ideas and supporting details',
        ],
        activities: [
          'Learners read a passage individually then aloud in groups',
          'Learners answer set comprehension questions in writing',
          'Learners discuss the main idea of a passage in pairs',
          'Learners use a dictionary to find meanings of new words',
        ],
        inquiryQuestions: [
          'How does reading help us learn new things?',
          'Why is it important to understand what we read?',
        ],
        coreCompetencies: ['Critical thinking and problem solving', 'Learning to learn'],
        values: ['Responsibility', 'Patriotism'],
        pcis: ['Life skills', 'Citizenship'],
        links: ['Social Studies', 'CRE'],
        assessmentMethods: ['Oral questions', 'Written exercise', 'Portfolio'],
        resources: ['Story books', 'Dictionaries', 'English learner\'s book Gr. 4'],
      },
      {
        name: 'Extensive Reading',
        lessonAllocation: 6,
        slos: [
          'read a variety of supplementary texts for pleasure',
          'summarise a story in own words',
          'develop a positive reading habit',
        ],
        activities: [
          'Learners select books from the class library and read silently',
          'Learners narrate stories they have read to peers',
          'Learners keep a reading log/journal',
        ],
        inquiryQuestions: [
          'Why do we read story books?',
          'How does reading for pleasure help us?',
        ],
        coreCompetencies: ['Self-efficacy', 'Communication and collaboration'],
        values: ['Responsibility', 'Love'],
        pcis: ['Life skills'],
        links: ['CRE', 'Social Studies'],
        assessmentMethods: ['Portfolio', 'Observation'],
        resources: ['Class library', 'Story books'],
      },
    ],
  },
  {
    name: 'Writing',
    subStrands: [
      {
        name: 'Handwriting and Spelling',
        lessonAllocation: 6,
        slos: [
          'write legibly using cursive script',
          'spell common words correctly',
          'apply spelling rules learnt in writing',
        ],
        activities: [
          'Learners practise writing cursive letters and words',
          'Learners do dictation exercises in pairs',
          'Learners proofread each other\'s work',
        ],
        inquiryQuestions: [
          'Why is correct spelling important?',
          'How does neat handwriting help the reader?',
        ],
        coreCompetencies: ['Self-efficacy', 'Communication and collaboration'],
        values: ['Responsibility', 'Integrity'],
        pcis: ['Life skills'],
        links: ['All learning areas'],
        assessmentMethods: ['Written exercise', 'Portfolio', 'Peer assessment'],
        resources: ['Writing books', 'Charts', 'Pens'],
      },
    ],
  },
];

const G4_KISWAHILI_T1: CurriculumStrand[] = [
  {
    name: 'Kusikiliza na Kuzungumza',
    subStrands: [
      {
        name: 'Salamu',
        lessonAllocation: 6,
        slos: [
          'kutoa salamu kulingana na muktadha',
          'kuitikia salamu ipasavyo',
          'kutumia maneno ya heshima katika mawasiliano',
        ],
        activities: [
          'Wanafunzi wanaigiza mazungumzo ya salamu wakiwa wawili wawili',
          'Wanafunzi wanaimba wimbo wa salamu kwa pamoja',
          'Wanafunzi wanasikiliza rekodi ya salamu na kurudia',
        ],
        inquiryQuestions: [
          'Kwa nini ni muhimu kutoa salamu?',
          'Tunatumia salamu gani kwa wakati gani?',
        ],
        coreCompetencies: ['Mawasiliano na ushirikiano', 'Uraia'],
        values: ['Heshima', 'Upendo', 'Umoja'],
        pcis: ['Stadi za maisha', 'Uraia'],
        links: ['English', 'CRE'],
        assessmentMethods: ['Maswali ya mdomo', 'Uchunguzi'],
        resources: ['Kadi za maneno', 'Kitabu cha mwanafunzi Gredi 4'],
      },
    ],
  },
  {
    name: 'Kusoma',
    subStrands: [
      {
        name: 'Kusoma kwa Ufahamu',
        lessonAllocation: 8,
        slos: [
          'kusoma kifungu kwa ufasaha',
          'kujibu maswali ya ufahamu kutoka katika kifungu',
          'kueleza wazo kuu la kifungu',
        ],
        activities: [
          'Wanafunzi wanasoma kifungu kimoja mmoja kisha kwa vikundi',
          'Wanafunzi wanajibu maswali ya ufahamu kwa maandishi',
          'Wanafunzi wanajadili wazo kuu wakiwa wawili wawili',
        ],
        inquiryQuestions: [
          'Kwa nini tunasoma vifungu mbalimbali?',
          'Kusoma kunatusaidiaje katika maisha?',
        ],
        coreCompetencies: ['Kufikiria kwa kina', 'Kujifunza kujifunza'],
        values: ['Uwajibikaji', 'Upendo wa lugha'],
        pcis: ['Stadi za maisha'],
        links: ['English', 'Masomo ya Jamii'],
        assessmentMethods: ['Maswali ya mdomo', 'Mtihani wa maandishi'],
        resources: ['Kitabu cha mwanafunzi', 'Kamusi'],
      },
    ],
  },
];

const G4_SCIENCE_T1: CurriculumStrand[] = [
  {
    name: 'Living Things',
    subStrands: [
      {
        name: 'Plants',
        lessonAllocation: 8,
        slos: [
          'identify parts of a flowering plant',
          'state the functions of each part of a plant',
          'classify plants as flowering and non-flowering',
        ],
        activities: [
          'Learners observe real plants in the school compound and name parts',
          'Learners draw and label a flowering plant in their books',
          'Learners discuss functions of each plant part in groups',
          'Learners watch a video on plant classification',
        ],
        inquiryQuestions: [
          'Why are plants important to human beings?',
          'How do different parts of a plant work together?',
        ],
        coreCompetencies: ['Critical thinking and problem solving', 'Digital literacy'],
        values: ['Responsibility', 'Love for environment'],
        pcis: ['ESD', 'Health education'],
        links: ['Agriculture', 'Art and Craft'],
        assessmentMethods: ['Practical activity', 'Observation', 'Written exercise'],
        resources: ['Real plants', 'Charts', 'Science learner\'s book Gr. 4'],
      },
      {
        name: 'Animals',
        lessonAllocation: 8,
        slos: [
          'classify animals as vertebrates and invertebrates',
          'identify characteristics of mammals, birds, fish and reptiles',
          'appreciate the role of animals in the environment',
        ],
        activities: [
          'Learners observe pictures of various animals and classify them',
          'Learners discuss characteristics of each animal group in groups',
          'Learners visit a nearby zoo/farm (where possible) and record findings',
          'Learners make a chart showing classification of animals',
        ],
        inquiryQuestions: [
          'How do animals depend on each other?',
          'Why should we care for animals around us?',
        ],
        coreCompetencies: ['Critical thinking and problem solving', 'Citizenship'],
        values: ['Responsibility', 'Love'],
        pcis: ['ESD', 'Animal welfare'],
        links: ['Agriculture', 'Social Studies'],
        assessmentMethods: ['Observation', 'Written exercise', 'Portfolio'],
        resources: ['Pictures/charts of animals', 'Science learner\'s book Gr. 4'],
      },
    ],
  },
  {
    name: 'Environment',
    subStrands: [
      {
        name: 'Weather',
        lessonAllocation: 6,
        slos: [
          'identify different weather conditions',
          'observe and record daily weather',
          'describe how weather affects human activities',
        ],
        activities: [
          'Learners observe and record daily weather using a weather chart',
          'Learners discuss effects of weather on farming and travel',
          'Learners draw symbols representing different weather conditions',
        ],
        inquiryQuestions: [
          'How does weather influence our daily activities?',
          'Why is it important to predict the weather?',
        ],
        coreCompetencies: ['Critical thinking and problem solving', 'Communication and collaboration'],
        values: ['Responsibility'],
        pcis: ['ESD', 'Climate change'],
        links: ['Agriculture', 'Social Studies'],
        assessmentMethods: ['Observation', 'Written exercise'],
        resources: ['Weather chart', 'Thermometer', 'Science learner\'s book Gr. 4'],
      },
    ],
  },
];

const G4_SST_T1: CurriculumStrand[] = [
  {
    name: 'Natural and Built Environments',
    subStrands: [
      {
        name: 'Position and Size of Kenya',
        lessonAllocation: 6,
        slos: [
          'locate Kenya on the map of Africa',
          'identify Kenya\'s neighbouring countries',
          'state the size of Kenya in square kilometres',
        ],
        activities: [
          'Learners locate Kenya on a map of Africa in groups',
          'Learners name and write Kenya\'s neighbours on an outline map',
          'Learners watch a short video about Kenya\'s geography',
        ],
        inquiryQuestions: [
          'Why is it important to know the location of our country?',
          'How does Kenya\'s position affect its relationship with neighbours?',
        ],
        coreCompetencies: ['Citizenship', 'Digital literacy'],
        values: ['Patriotism', 'Unity'],
        pcis: ['Citizenship', 'Peace education'],
        links: ['English', 'CRE'],
        assessmentMethods: ['Oral questions', 'Map work', 'Written exercise'],
        resources: ['Map of Africa', 'Map of Kenya', 'SST learner\'s book Gr. 4'],
      },
      {
        name: 'Physical Features in Kenya',
        lessonAllocation: 6,
        slos: [
          'identify major physical features in Kenya',
          'locate physical features on the map of Kenya',
          'appreciate the importance of physical features',
        ],
        activities: [
          'Learners identify mountains, lakes, rivers on a map in groups',
          'Learners draw an outline map of Kenya and locate physical features',
          'Learners discuss importance of each physical feature',
        ],
        inquiryQuestions: [
          'How do physical features benefit our country?',
          'Why should we protect our physical features?',
        ],
        coreCompetencies: ['Critical thinking and problem solving', 'Citizenship'],
        values: ['Patriotism', 'Responsibility'],
        pcis: ['ESD', 'Citizenship'],
        links: ['Science', 'Agriculture'],
        assessmentMethods: ['Map work', 'Written exercise', 'Portfolio'],
        resources: ['Map of Kenya', 'Pictures of features', 'SST learner\'s book Gr. 4'],
      },
    ],
  },
];

// ============================================================
//                        GRADE 5  (lighter seed)
// ============================================================

const G5_MATH_T1: CurriculumStrand[] = [
  {
    name: 'Numbers',
    subStrands: [
      {
        name: 'Whole Numbers',
        lessonAllocation: 12,
        slos: [
          'read and write numbers up to 1,000,000 in symbols and words',
          'identify place value up to hundreds of thousands',
          'round off numbers to the nearest 1,000 and 10,000',
        ],
        activities: [
          'Learners use place value charts to read large numbers',
          'Learners write numbers up to 1,000,000 in symbols and words',
          'Learners round off numbers using a number line',
        ],
        inquiryQuestions: ['How do we read and write large numbers?', 'Why is rounding off useful?'],
        coreCompetencies: ['Critical thinking and problem solving', 'Communication and collaboration'],
        values: ['Responsibility', 'Accuracy'],
        pcis: ['Financial literacy'],
        links: ['Social Studies (population)', 'English (number names)'],
        assessmentMethods: ['Written exercise', 'Oral questions'],
        resources: ['Place value charts', 'Number cards'],
      },
      {
        name: 'Multiplication',
        lessonAllocation: 10,
        slos: [
          'multiply up to a 3-digit number by a 2-digit number',
          'apply multiplication in real-life situations',
        ],
        activities: [
          'Learners practise multiplication using long method',
          'Learners solve word problems involving multiplication',
          'Learners use digital devices to verify answers',
        ],
        inquiryQuestions: ['Where do we use multiplication in real life?'],
        coreCompetencies: ['Critical thinking and problem solving', 'Digital literacy'],
        values: ['Responsibility'],
        pcis: ['Financial literacy'],
        links: ['Home Science (recipes)'],
        assessmentMethods: ['Written exercise', 'Practical activity'],
        resources: ['Number cards', 'Calculators'],
      },
    ],
  },
];

const G5_ENGLISH_T1: CurriculumStrand[] = [
  {
    name: 'Listening and Speaking',
    subStrands: [
      {
        name: 'Conversations',
        lessonAllocation: 6,
        slos: [
          'engage in a conversation on a familiar topic',
          'use polite language during conversations',
          'maintain a topic in a conversation',
        ],
        activities: [
          'Learners role-play conversations in pairs',
          'Learners listen to a recorded conversation and respond',
          'Learners discuss given topics in groups',
        ],
        inquiryQuestions: ['Why is polite language important in conversations?'],
        coreCompetencies: ['Communication and collaboration'],
        values: ['Respect', 'Unity'],
        pcis: ['Life skills'],
        links: ['Kiswahili'],
        assessmentMethods: ['Oral questions', 'Observation'],
        resources: ['Audio recordings', 'English learner\'s book Gr. 5'],
      },
    ],
  },
  {
    name: 'Reading',
    subStrands: [
      {
        name: 'Comprehension',
        lessonAllocation: 8,
        slos: [
          'read a grade-appropriate text fluently',
          'answer literal and inferential questions',
          'predict outcomes from a passage',
        ],
        activities: [
          'Learners read passages individually and in groups',
          'Learners answer comprehension questions in writing',
          'Learners predict what happens next in a story',
        ],
        inquiryQuestions: ['How does reading help us understand the world?'],
        coreCompetencies: ['Critical thinking and problem solving'],
        values: ['Responsibility'],
        pcis: ['Life skills'],
        links: ['Social Studies'],
        assessmentMethods: ['Written exercise', 'Oral questions'],
        resources: ['Story books', 'English learner\'s book Gr. 5'],
      },
    ],
  },
];

const G5_KISWAHILI_T1: CurriculumStrand[] = [
  {
    name: 'Kusikiliza na Kuzungumza',
    subStrands: [
      {
        name: 'Mazungumzo',
        lessonAllocation: 6,
        slos: [
          'kushiriki katika mazungumzo kuhusu mada mbalimbali',
          'kutumia lugha ya heshima katika mazungumzo',
        ],
        activities: [
          'Wanafunzi wanaigiza mazungumzo wakiwa wawili wawili',
          'Wanafunzi wanasikiliza rekodi na kujibu maswali',
        ],
        inquiryQuestions: ['Kwa nini lugha ya heshima ni muhimu?'],
        coreCompetencies: ['Mawasiliano na ushirikiano'],
        values: ['Heshima', 'Upendo'],
        pcis: ['Stadi za maisha'],
        links: ['English'],
        assessmentMethods: ['Maswali ya mdomo'],
        resources: ['Kitabu cha mwanafunzi Gredi 5'],
      },
    ],
  },
];

const G5_SCIENCE_T1: CurriculumStrand[] = [
  {
    name: 'Living Things',
    subStrands: [
      {
        name: 'Human Body Systems',
        lessonAllocation: 10,
        slos: [
          'identify parts of the digestive system',
          'state functions of each part of the digestive system',
          'describe how to take care of the digestive system',
        ],
        activities: [
          'Learners use a model/chart to identify digestive system parts',
          'Learners discuss healthy eating habits in groups',
          'Learners watch a video on the digestive process',
        ],
        inquiryQuestions: ['How does food move through our body?', 'Why should we eat healthy food?'],
        coreCompetencies: ['Critical thinking and problem solving', 'Digital literacy'],
        values: ['Responsibility', 'Self-care'],
        pcis: ['Health education', 'Nutrition'],
        links: ['Home Science', 'Agriculture'],
        assessmentMethods: ['Practical activity', 'Written exercise', 'Observation'],
        resources: ['Charts/models', 'Science learner\'s book Gr. 5'],
      },
    ],
  },
];

const G5_SST_T1: CurriculumStrand[] = [
  {
    name: 'Natural and Built Environments',
    subStrands: [
      {
        name: 'Climate of Kenya',
        lessonAllocation: 6,
        slos: [
          'identify climatic regions of Kenya',
          'describe characteristics of each climatic region',
          'explain how climate affects human activities',
        ],
        activities: [
          'Learners identify climatic regions on a map of Kenya',
          'Learners discuss characteristics of each region in groups',
          'Learners relate climate to crops grown in different regions',
        ],
        inquiryQuestions: ['How does climate affect what people do?'],
        coreCompetencies: ['Critical thinking and problem solving', 'Citizenship'],
        values: ['Responsibility', 'Patriotism'],
        pcis: ['ESD', 'Climate change'],
        links: ['Science', 'Agriculture'],
        assessmentMethods: ['Map work', 'Written exercise'],
        resources: ['Map of Kenya', 'Climate charts'],
      },
    ],
  },
];

// ============================================================
//                        GRADE 6  (lighter seed)
// ============================================================

const G6_MATH_T1: CurriculumStrand[] = [
  {
    name: 'Numbers',
    subStrands: [
      {
        name: 'Whole Numbers',
        lessonAllocation: 10,
        slos: [
          'read and write numbers up to 1,000,000,000',
          'identify place value up to hundreds of millions',
          'round off numbers to the nearest 100,000 and 1,000,000',
        ],
        activities: [
          'Learners read large numbers from charts',
          'Learners write numbers in symbols and words',
          'Learners round off numbers using a number line',
        ],
        inquiryQuestions: ['Where do we encounter very large numbers?'],
        coreCompetencies: ['Critical thinking and problem solving'],
        values: ['Responsibility', 'Accuracy'],
        pcis: ['Financial literacy'],
        links: ['Social Studies (national budget)'],
        assessmentMethods: ['Written exercise'],
        resources: ['Place value charts', 'Number cards'],
      },
      {
        name: 'Fractions',
        lessonAllocation: 10,
        slos: [
          'add and subtract fractions with different denominators',
          'multiply fractions by whole numbers and fractions',
          'apply fractions in real-life situations',
        ],
        activities: [
          'Learners use fraction boards to add and subtract fractions',
          'Learners solve word problems involving fractions',
          'Learners use digital tools to practise fractions',
        ],
        inquiryQuestions: ['Where do we use fractions in daily life?'],
        coreCompetencies: ['Critical thinking and problem solving', 'Digital literacy'],
        values: ['Responsibility'],
        pcis: ['Financial literacy'],
        links: ['Home Science (cooking)'],
        assessmentMethods: ['Written exercise', 'Practical activity'],
        resources: ['Fraction boards', 'Mathematics learner\'s book Gr. 6'],
      },
    ],
  },
];

const G6_ENGLISH_T1: CurriculumStrand[] = [
  {
    name: 'Listening and Speaking',
    subStrands: [
      {
        name: 'Discussion',
        lessonAllocation: 6,
        slos: [
          'participate in group discussions on familiar topics',
          'present own views clearly',
          'respect others\' opinions during discussions',
        ],
        activities: [
          'Learners hold group discussions on selected topics',
          'Learners present discussion outcomes to class',
          'Learners give feedback to other groups',
        ],
        inquiryQuestions: ['Why should we listen to others during discussions?'],
        coreCompetencies: ['Communication and collaboration', 'Citizenship'],
        values: ['Respect', 'Tolerance'],
        pcis: ['Life skills', 'Citizenship'],
        links: ['Kiswahili', 'Social Studies'],
        assessmentMethods: ['Observation', 'Oral questions', 'Peer assessment'],
        resources: ['English learner\'s book Gr. 6'],
      },
    ],
  },
];

const G6_KISWAHILI_T1: CurriculumStrand[] = [
  {
    name: 'Kusoma',
    subStrands: [
      {
        name: 'Kusoma kwa Ufahamu',
        lessonAllocation: 8,
        slos: [
          'kusoma vifungu mbalimbali kwa ufasaha',
          'kujibu maswali ya ufahamu kwa usahihi',
          'kueleza wazo kuu na hoja muhimu',
        ],
        activities: [
          'Wanafunzi wanasoma vifungu kimoja mmoja na kwa vikundi',
          'Wanafunzi wanajibu maswali ya ufahamu kwa maandishi',
        ],
        inquiryQuestions: ['Kusoma kunatusaidiaje katika maisha?'],
        coreCompetencies: ['Kufikiria kwa kina'],
        values: ['Uwajibikaji'],
        pcis: ['Stadi za maisha'],
        links: ['English'],
        assessmentMethods: ['Maswali ya mdomo', 'Mtihani wa maandishi'],
        resources: ['Kitabu cha mwanafunzi Gredi 6'],
      },
    ],
  },
];

const G6_SCIENCE_T1: CurriculumStrand[] = [
  {
    name: 'Living Things',
    subStrands: [
      {
        name: 'Reproduction in Plants',
        lessonAllocation: 8,
        slos: [
          'identify parts of a flower',
          'describe the process of pollination',
          'explain the importance of pollination',
        ],
        activities: [
          'Learners observe and dissect a flower in groups',
          'Learners draw and label parts of a flower',
          'Learners discuss types of pollination',
        ],
        inquiryQuestions: ['Why is pollination important to plants and humans?'],
        coreCompetencies: ['Critical thinking and problem solving'],
        values: ['Responsibility', 'Love for nature'],
        pcis: ['ESD'],
        links: ['Agriculture'],
        assessmentMethods: ['Practical activity', 'Written exercise'],
        resources: ['Real flowers', 'Charts', 'Science learner\'s book Gr. 6'],
      },
    ],
  },
];

const G6_SST_T1: CurriculumStrand[] = [
  {
    name: 'Political Systems',
    subStrands: [
      {
        name: 'Government of Kenya',
        lessonAllocation: 6,
        slos: [
          'identify the three arms of government',
          'state the functions of each arm of government',
          'appreciate the role of government in Kenya',
        ],
        activities: [
          'Learners discuss arms of government in groups',
          'Learners draw a chart showing arms of government',
          'Learners role-play parliament/court proceedings',
        ],
        inquiryQuestions: ['Why does our country need a government?'],
        coreCompetencies: ['Citizenship', 'Communication and collaboration'],
        values: ['Patriotism', 'Integrity', 'Responsibility'],
        pcis: ['Citizenship', 'Governance'],
        links: ['CRE', 'English'],
        assessmentMethods: ['Oral questions', 'Written exercise', 'Portfolio'],
        resources: ['Chart of arms of government', 'SST learner\'s book Gr. 6'],
      },
    ],
  },
];

// ============================================================
//                       MASTER REGISTRY
// ============================================================

export const CURRICULUM_DESIGNS: CurriculumDesign[] = [
  // ---- Grade 4 ----
  { grade: 'Grade 4', subject: 'Mathematics',     term: 'Term 1', strands: G4_MATH_T1 },
  { grade: 'Grade 4', subject: 'English',         term: 'Term 1', strands: G4_ENGLISH_T1 },
  { grade: 'Grade 4', subject: 'Kiswahili',       term: 'Term 1', strands: G4_KISWAHILI_T1 },
  { grade: 'Grade 4', subject: 'Science and Technology', term: 'Term 1', strands: G4_SCIENCE_T1 },
  { grade: 'Grade 4', subject: 'Social Studies',  term: 'Term 1', strands: G4_SST_T1 },
  // ---- Grade 5 ----
  { grade: 'Grade 5', subject: 'Mathematics',     term: 'Term 1', strands: G5_MATH_T1 },
  { grade: 'Grade 5', subject: 'English',         term: 'Term 1', strands: G5_ENGLISH_T1 },
  { grade: 'Grade 5', subject: 'Kiswahili',       term: 'Term 1', strands: G5_KISWAHILI_T1 },
  { grade: 'Grade 5', subject: 'Science and Technology', term: 'Term 1', strands: G5_SCIENCE_T1 },
  { grade: 'Grade 5', subject: 'Social Studies',  term: 'Term 1', strands: G5_SST_T1 },
  // ---- Grade 6 ----
  { grade: 'Grade 6', subject: 'Mathematics',     term: 'Term 1', strands: G6_MATH_T1 },
  { grade: 'Grade 6', subject: 'English',         term: 'Term 1', strands: G6_ENGLISH_T1 },
  { grade: 'Grade 6', subject: 'Kiswahili',       term: 'Term 1', strands: G6_KISWAHILI_T1 },
  { grade: 'Grade 6', subject: 'Science and Technology', term: 'Term 1', strands: G6_SCIENCE_T1 },
  { grade: 'Grade 6', subject: 'Social Studies',  term: 'Term 1', strands: G6_SST_T1 },
];

// ============================================================
//                     MAPPING ENGINE
// ============================================================

/** Tolerant matcher: handles "Math" vs "Mathematics", "Sci" vs "Science and Technology", etc. */
function matchSubject(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const A = norm(a); const B = norm(b);
  if (A === B) return true;
  // common aliases
  if ((A.includes('math') && B.includes('math'))) return true;
  if ((A.includes('english') && B.includes('english'))) return true;
  if ((A.includes('kiswahili') && B.includes('kiswahili'))) return true;
  if ((A.includes('science') && B.includes('science'))) return true;
  if ((A.includes('social') && B.includes('social'))) return true;
  return false;
}

export function findCurriculumDesign(
  grade: string,
  subject: string,
  term: string,
): CurriculumDesign | null {
  return (
    CURRICULUM_DESIGNS.find(
      d => d.grade === grade && d.term === term && matchSubject(d.subject, subject),
    ) || null
  );
}

export function hasCurriculumDesign(grade: string, subject: string, term: string): boolean {
  return findCurriculumDesign(grade, subject, term) !== null;
}

export function listAvailableDesigns(): { grade: string; subject: string; term: string }[] {
  return CURRICULUM_DESIGNS.map(d => ({ grade: d.grade, subject: d.subject, term: d.term }));
}

export const CURRICULUM_COMMON = { COMMON_COMPETENCIES, COMMON_VALUES, COMMON_PCIS };
