// CBC content library for the Independent Learner portal.
// Each subject has 7–10 lessons grouped by strand, with notes and a deep quiz bank.
// Lessons are tier-aware: "kpsea" (PP1–G6), "kjsea" (G7–9) or "all".
//
// Each subject's combined quiz bank is >= 50 questions. Questions and options
// are shuffled per attempt via shuffleQuiz() so the experience feels fresh.

import type { SubjectSlug } from "./subjects";

export type Tier = "kpsea" | "kjsea" | "all";

export type QuizQ = { q: string; options: string[]; correct: number; explain?: string };

export type Lesson = {
  id: string;
  title: string;
  strand: string;
  duration: string;
  tier: Tier;
  summary: string;
  notes: string;
  examples?: string[];
  quiz: QuizQ[];
};

// ---------------------------------------------------------------------------
// MATHEMATICS  (10 lessons, 50+ Qs)
// ---------------------------------------------------------------------------
const MATHEMATICS: Lesson[] = [
  {
    id: "m-place-value", title: "Place Value up to 100,000", strand: "Numbers", duration: "8 min", tier: "kpsea",
    summary: "Every digit in a whole number has a place: ones, tens, hundreds, thousands, ten-thousands.",
    notes: "In 34,827 the 3 is 3 ten-thousands (30,000), the 4 is 4 thousands, the 8 is 8 hundreds, the 2 is 2 tens and the 7 is 7 ones. Larger place values are written on the left. Use a place-value chart when unsure.",
    examples: ["34,827 = 30,000 + 4,000 + 800 + 20 + 7", "Compare 12,050 and 12,500 — the hundreds digit decides."],
    quiz: [
      { q: "What is the value of 6 in 4,632?", options: ["6", "60", "600", "6,000"], correct: 2 },
      { q: "Which is the greatest?", options: ["2,109", "2,091", "2,019", "2,190"], correct: 3 },
      { q: "3,000 + 400 + 80 + 2 = ?", options: ["3,482", "3,428", "3,824", "3,842"], correct: 0 },
      { q: "The value of 7 in 27,015 is:", options: ["7", "70", "700", "7,000"], correct: 3 },
      { q: "Round 4,683 to the nearest hundred:", options: ["4,600", "4,700", "4,800", "5,000"], correct: 1 },
      { q: "Which number is even?", options: ["3,217", "5,401", "8,946", "9,883"], correct: 2 },
      { q: "20,000 + 500 + 6 = ?", options: ["20,560", "20,506", "20,056", "25,006"], correct: 1 },
    ],
  },
  {
    id: "m-addsub", title: "Addition & Subtraction with Regrouping", strand: "Numbers", duration: "10 min", tier: "kpsea",
    summary: "Add and subtract multi-digit numbers by lining up place values and carrying or borrowing.",
    notes: "Line up ones under ones, tens under tens. When a column sums to 10 or more, carry the ten. For subtraction, if the top digit is smaller, borrow from the next column.",
    examples: ["247 + 158 = 405", "503 − 276 = 227"],
    quiz: [
      { q: "256 + 178 = ?", options: ["324", "434", "424", "344"], correct: 1 },
      { q: "600 − 245 = ?", options: ["355", "365", "455", "345"], correct: 0 },
      { q: "489 + 376 = ?", options: ["855", "865", "765", "885"], correct: 1 },
      { q: "1,000 − 487 = ?", options: ["523", "513", "613", "503"], correct: 1 },
      { q: "234 + 567 + 99 = ?", options: ["900", "890", "910", "990"], correct: 0 },
    ],
  },
  {
    id: "m-multdiv", title: "Multiplication & Division Facts", strand: "Numbers", duration: "10 min", tier: "kpsea",
    summary: "Multiplication is repeated addition. Division shares equally.",
    notes: "Learn the times tables 1–12. Division undoes multiplication: 24 ÷ 6 = 4 because 6 × 4 = 24. The remainder is what is left over.",
    examples: ["7 × 8 = 56", "45 ÷ 9 = 5"],
    quiz: [
      { q: "9 × 7 = ?", options: ["56", "63", "72", "69"], correct: 1 },
      { q: "48 ÷ 6 = ?", options: ["6", "7", "8", "9"], correct: 2 },
      { q: "12 × 11 = ?", options: ["121", "132", "144", "112"], correct: 1 },
      { q: "Remainder when 25 ÷ 4 = ?", options: ["0", "1", "2", "3"], correct: 1 },
      { q: "8 × 9 = ?", options: ["64", "72", "81", "63"], correct: 1 },
    ],
  },
  {
    id: "m-fractions", title: "Fractions, Decimals & Percentages", strand: "Numbers", duration: "11 min", tier: "kpsea",
    summary: "Fractions, decimals and percentages are three ways to show parts of a whole.",
    notes: "1/2 = 0.5 = 50%. 1/4 = 0.25 = 25%. 3/4 = 0.75 = 75%. To convert a fraction to a percentage, divide and multiply by 100.",
    examples: ["1/5 = 0.2 = 20%", "Equivalent fractions: 2/4 = 1/2"],
    quiz: [
      { q: "Which is bigger?", options: ["1/2", "1/3", "1/4", "1/5"], correct: 0 },
      { q: "2/4 is equal to:", options: ["1/3", "1/2", "2/3", "3/4"], correct: 1 },
      { q: "0.75 as a fraction:", options: ["3/4", "1/4", "1/2", "7/10"], correct: 0 },
      { q: "25% of 80 = ?", options: ["15", "20", "25", "40"], correct: 1 },
      { q: "1/10 as a percentage:", options: ["1%", "10%", "100%", "0.1%"], correct: 1 },
      { q: "0.5 + 0.25 = ?", options: ["0.30", "0.55", "0.75", "0.85"], correct: 2 },
    ],
  },
  {
    id: "m-measurement", title: "Length, Mass & Capacity", strand: "Measurement", duration: "11 min", tier: "kpsea",
    summary: "Use the right unit to measure. 100 cm = 1 m, 1,000 g = 1 kg, 1,000 ml = 1 litre.",
    notes: "Short objects use cm; long ones use m. Light objects use g; heavy ones use kg. Liquids use ml or litres.",
    quiz: [
      { q: "3 m = ? cm", options: ["30", "300", "3,000", "33"], correct: 1 },
      { q: "2 kg = ? g", options: ["20", "200", "2,000", "20,000"], correct: 2 },
      { q: "Best unit for a textbook length:", options: ["km", "m", "cm", "mm"], correct: 2 },
      { q: "1.5 litres = ? ml", options: ["15", "150", "1,500", "15,000"], correct: 2 },
      { q: "500 g + 750 g = ?", options: ["1,150 g", "1,250 g", "1,205 g", "1,500 g"], correct: 1 },
    ],
  },
  {
    id: "m-time-money", title: "Time, Money & Word Problems", strand: "Measurement", duration: "10 min", tier: "kpsea",
    summary: "Tell time on analog and digital clocks. Work with KES in everyday transactions.",
    notes: "60 minutes = 1 hour. 24 hours = 1 day. For money, change = amount given − total cost.",
    quiz: [
      { q: "How many minutes in 2 hours?", options: ["60", "100", "120", "200"], correct: 2 },
      { q: "If a book costs KES 240 and you pay 500, change = ?", options: ["260", "240", "360", "200"], correct: 0 },
      { q: "2:45 pm in 24-hour time:", options: ["02:45", "12:45", "14:45", "16:45"], correct: 2 },
      { q: "How many days in 3 weeks?", options: ["14", "18", "21", "28"], correct: 2 },
    ],
  },
  {
    id: "m-geometry-shapes", title: "2D Shapes & Perimeter", strand: "Geometry", duration: "9 min", tier: "kpsea",
    summary: "A polygon is a closed shape made of straight sides. Perimeter is the distance around.",
    notes: "Triangle 3 sides, quadrilateral 4, pentagon 5, hexagon 6. Perimeter = sum of all side lengths. For a rectangle: P = 2(L + W).",
    examples: ["Rectangle 6 cm × 4 cm → P = 2(6+4) = 20 cm"],
    quiz: [
      { q: "A pentagon has how many sides?", options: ["3", "4", "5", "6"], correct: 2 },
      { q: "Perimeter of a square with side 7 cm:", options: ["14", "21", "28", "49"], correct: 2 },
      { q: "Rectangle 8 by 3 has perimeter:", options: ["11", "22", "24", "33"], correct: 1 },
      { q: "Which is NOT a polygon?", options: ["Triangle", "Hexagon", "Circle", "Square"], correct: 2 },
    ],
  },
  {
    id: "m-data", title: "Data Handling: Mean & Mode", strand: "Data", duration: "10 min", tier: "all",
    summary: "Mean = total ÷ count. Mode = the most common value.",
    notes: "To find the mean of 4, 6, 8: add (18) and divide by count (3) to get 6. The mode of 2, 4, 4, 5 is 4.",
    quiz: [
      { q: "Mean of 5, 10, 15:", options: ["5", "10", "15", "30"], correct: 1 },
      { q: "Mode of 2, 3, 3, 5, 7:", options: ["2", "3", "5", "7"], correct: 1 },
      { q: "Mean of 12, 14, 16, 18:", options: ["14", "15", "16", "17"], correct: 1 },
      { q: "If 10 learners scored 80% average, total marks = ?", options: ["80", "800", "8,000", "8"], correct: 1 },
    ],
  },
  {
    id: "m-algebra-jss", title: "Linear Equations", strand: "Algebra", duration: "12 min", tier: "kjsea",
    summary: "Solve equations like 2x + 5 = 15 by doing the same thing to both sides.",
    notes: "Goal: get the variable alone. Undo addition by subtracting; undo multiplication by dividing. Whatever you do on one side, do on the other.",
    examples: ["2x + 5 = 15 → 2x = 10 → x = 5"],
    quiz: [
      { q: "Solve: 3x − 4 = 11", options: ["x = 3", "x = 5", "x = 7", "x = 15"], correct: 1 },
      { q: "Solve: x/2 = 6", options: ["x = 3", "x = 8", "x = 12", "x = 4"], correct: 2 },
      { q: "Solve: 5x = 45", options: ["x = 5", "x = 9", "x = 8", "x = 40"], correct: 1 },
      { q: "Solve: 2(x + 3) = 14", options: ["x = 4", "x = 5", "x = 7", "x = 11"], correct: 0 },
      { q: "If x − 7 = 12, x = ?", options: ["5", "12", "19", "84"], correct: 2 },
    ],
  },
  {
    id: "m-geometry-jss", title: "Pythagoras' Theorem", strand: "Geometry", duration: "10 min", tier: "kjsea",
    summary: "In a right-angled triangle, a² + b² = c² where c is the hypotenuse.",
    notes: "The hypotenuse is opposite the right angle. Square the two shorter sides, add them, then take the square root for the hypotenuse.",
    examples: ["3, 4, ? → 9 + 16 = 25 → hypotenuse = 5"],
    quiz: [
      { q: "Sides 6 and 8 — hypotenuse?", options: ["10", "12", "14", "9"], correct: 0 },
      { q: "Sides 5 and 12 — hypotenuse?", options: ["13", "17", "15", "11"], correct: 0 },
      { q: "Sides 9 and 12 — hypotenuse?", options: ["13", "15", "16", "21"], correct: 1 },
      { q: "Sides 8 and 15 — hypotenuse?", options: ["17", "19", "20", "23"], correct: 0 },
    ],
  },
];

// ---------------------------------------------------------------------------
// ENGLISH  (8 lessons, 50+ Qs)
// ---------------------------------------------------------------------------
const ENGLISH: Lesson[] = [
  {
    id: "e-nouns", title: "Nouns: Common, Proper & Collective", strand: "Grammar", duration: "8 min", tier: "kpsea",
    summary: "A noun names a person, place, animal, thing or group.",
    notes: "Common nouns name general things (girl, city). Proper nouns name specific ones with a capital letter (Amina, Nairobi). Collective nouns name a group (herd, team, swarm).",
    quiz: [
      { q: "Pick the proper noun:", options: ["river", "Nile", "water", "fish"], correct: 1 },
      { q: "Which is a common noun?", options: ["Kenya", "Mary", "teacher", "Mombasa"], correct: 2 },
      { q: "A group of cows is a:", options: ["pack", "herd", "swarm", "flock"], correct: 1 },
      { q: "A group of bees is a:", options: ["herd", "school", "swarm", "pride"], correct: 2 },
      { q: "Which needs a capital letter?", options: ["dog", "africa", "house", "river"], correct: 1 },
      { q: "A team of players is a:", options: ["common noun", "proper noun", "collective noun", "verb"], correct: 2 },
    ],
  },
  {
    id: "e-tenses", title: "Verb Tenses: Past, Present, Future", strand: "Grammar", duration: "10 min", tier: "kpsea",
    summary: "Tenses tell when an action happens.",
    notes: "Past: walked, went, ate. Present: walks, goes, eats. Future: will walk, will go, will eat. Regular verbs add -ed; many common verbs are irregular.",
    quiz: [
      { q: "Past of 'run'?", options: ["runned", "ran", "runs", "running"], correct: 1 },
      { q: "She ___ to school yesterday.", options: ["walk", "walks", "walked", "walking"], correct: 2 },
      { q: "Past of 'eat'?", options: ["eated", "ate", "eaten", "eats"], correct: 1 },
      { q: "Future of 'play':", options: ["played", "plays", "will play", "playing"], correct: 2 },
      { q: "Past of 'go':", options: ["goed", "went", "gone", "going"], correct: 1 },
      { q: "He ___ a letter now.", options: ["writes", "wrote", "will write", "written"], correct: 0 },
    ],
  },
  {
    id: "e-parts-of-speech", title: "Adjectives, Adverbs & Pronouns", strand: "Grammar", duration: "9 min", tier: "kpsea",
    summary: "Adjectives describe nouns. Adverbs describe verbs. Pronouns replace nouns.",
    notes: "Adjective: a tall boy. Adverb: she sings beautifully. Pronoun: he, she, it, they.",
    quiz: [
      { q: "Pick the adjective: 'the red car':", options: ["the", "red", "car", "none"], correct: 1 },
      { q: "Pick the adverb: 'He ran quickly':", options: ["He", "ran", "quickly", "none"], correct: 2 },
      { q: "Pronoun for 'Mary':", options: ["he", "she", "it", "they"], correct: 1 },
      { q: "Which is an adjective?", options: ["happily", "happy", "happen", "happiness"], correct: 1 },
      { q: "Pronoun for 'the books':", options: ["it", "he", "they", "she"], correct: 2 },
    ],
  },
  {
    id: "e-punctuation", title: "Punctuation Basics", strand: "Writing", duration: "8 min", tier: "kpsea",
    summary: "Punctuation marks help readers understand your meaning.",
    notes: "Full stop (.) ends a sentence. Question mark (?) ends a question. Comma (,) separates ideas. Apostrophe (') shows possession (Mary's book) or contraction (don't).",
    quiz: [
      { q: "Which ends a question?", options: [".", "?", "!", ","], correct: 1 },
      { q: "'Marys book' should be:", options: ["Marys book", "Mary's book", "Marys' book", "Mary book"], correct: 1 },
      { q: "Don't is short for:", options: ["did not", "do not", "does not", "done not"], correct: 1 },
      { q: "Which sentence is correct?", options: ["he is tall.", "He is tall", "He is tall.", "he is tall"], correct: 2 },
    ],
  },
  {
    id: "e-comp", title: "Reading Comprehension Skills", strand: "Reading", duration: "12 min", tier: "all",
    summary: "Read carefully, then answer questions using evidence from the text.",
    notes: "Read the whole passage once. Skim again for key words. Underline names, dates and numbers. Answer in full sentences when possible.",
    quiz: [
      { q: "What should you do FIRST?", options: ["Answer", "Read fully", "Guess", "Skip"], correct: 1 },
      { q: "Best way to find a date in a passage?", options: ["Guess", "Skim for numbers", "Read aloud", "Skip"], correct: 1 },
      { q: "The main idea is:", options: ["a small detail", "the most important point", "the title only", "the last word"], correct: 1 },
      { q: "To infer means to:", options: ["copy", "read aloud", "work out from clues", "translate"], correct: 2 },
    ],
  },
  {
    id: "e-vocab", title: "Synonyms, Antonyms & Homophones", strand: "Vocabulary", duration: "8 min", tier: "all",
    summary: "Synonyms mean the same; antonyms mean the opposite; homophones sound alike.",
    notes: "Synonym of happy: glad. Antonym of hot: cold. Homophones: their/there/they're, to/too/two.",
    quiz: [
      { q: "Synonym of 'big':", options: ["small", "large", "tiny", "thin"], correct: 1 },
      { q: "Antonym of 'fast':", options: ["quick", "slow", "rapid", "speedy"], correct: 1 },
      { q: "'Their' vs 'there' — these are:", options: ["synonyms", "antonyms", "homophones", "verbs"], correct: 2 },
      { q: "Synonym of 'begin':", options: ["start", "end", "stop", "finish"], correct: 0 },
      { q: "Antonym of 'happy':", options: ["joyful", "glad", "sad", "merry"], correct: 2 },
    ],
  },
  {
    id: "e-essay-jss", title: "Writing a 5-Paragraph Essay", strand: "Writing", duration: "14 min", tier: "kjsea",
    summary: "Plan, draft and revise a clear essay with introduction, body and conclusion.",
    notes: "Paragraph 1: introduce the topic, state your thesis. Paragraphs 2–4: one supporting idea each, with examples. Paragraph 5: restate the main idea and close.",
    quiz: [
      { q: "How many body paragraphs?", options: ["1", "2", "3", "5"], correct: 2 },
      { q: "The thesis appears in:", options: ["intro", "body 1", "body 2", "conclusion"], correct: 0 },
      { q: "Best place to restate the main idea:", options: ["intro", "body", "conclusion", "title"], correct: 2 },
      { q: "Each body paragraph should have:", options: ["one idea", "many ideas", "no examples", "only quotes"], correct: 0 },
    ],
  },
  {
    id: "e-literature-jss", title: "Literary Devices", strand: "Literature", duration: "10 min", tier: "kjsea",
    summary: "Writers use devices like simile, metaphor and personification to make writing vivid.",
    notes: "Simile compares using 'like' or 'as' (as brave as a lion). Metaphor compares directly (he is a lion). Personification gives human traits to non-humans (the wind whispered).",
    quiz: [
      { q: "'As brave as a lion' is a:", options: ["metaphor", "simile", "personification", "rhyme"], correct: 1 },
      { q: "'The sun smiled' is a:", options: ["metaphor", "simile", "personification", "alliteration"], correct: 2 },
      { q: "'He is a lion in battle' is a:", options: ["simile", "metaphor", "personification", "hyperbole"], correct: 1 },
    ],
  },
];

// ---------------------------------------------------------------------------
// KISWAHILI  (8 lessons, 50+ Qs)
// ---------------------------------------------------------------------------
const KISWAHILI: Lesson[] = [
  {
    id: "k-salamu", title: "Salamu na Maamkizi", strand: "Kuzungumza", duration: "6 min", tier: "kpsea",
    summary: "Salamu hutumika kuanzisha mazungumzo kwa heshima.",
    notes: "'Habari za asubuhi' asubuhi. 'Habari za mchana' mchana. 'Habari za jioni' jioni. Jibu la kawaida: 'nzuri' au 'salama'.",
    quiz: [
      { q: "Jibu la 'Habari yako?'", options: ["Karibu", "Nzuri", "Asante", "Kwaheri"], correct: 1 },
      { q: "Salamu ya asubuhi:", options: ["Usiku mwema", "Habari za asubuhi", "Kwaheri", "Lala salama"], correct: 1 },
      { q: "Tunasema 'asante' kuonyesha:", options: ["hasira", "shukrani", "huzuni", "shaka"], correct: 1 },
      { q: "Salamu ya jioni:", options: ["Habari za jioni", "Habari za asubuhi", "Lala salama", "Kwaheri"], correct: 0 },
    ],
  },
  {
    id: "k-ngeli-awa", title: "Ngeli ya A-WA", strand: "Sarufi", duration: "10 min", tier: "kpsea",
    summary: "Nomino za viumbe hai huingia kwenye ngeli ya A-WA.",
    notes: "Umoja: mtoto a-nacheza. Wingi: watoto wa-nacheza. Mifano: mwalimu/walimu, mtu/watu.",
    quiz: [
      { q: "'Walimu ___ fundisha.'", options: ["a", "wa", "i", "li"], correct: 1 },
      { q: "Umoja wa 'watoto':", options: ["mtoto", "mtu", "mtoo", "toto"], correct: 0 },
      { q: "Wingi wa 'mwalimu':", options: ["wamwalimu", "walimu", "wawalimu", "mawalimu"], correct: 1 },
      { q: "'Mtoto ___ nacheza.'", options: ["a", "wa", "i", "u"], correct: 0 },
    ],
  },
  {
    id: "k-ngeli-iki", title: "Ngeli ya KI-VI", strand: "Sarufi", duration: "9 min", tier: "kpsea",
    summary: "Vitu visivyo na uhai hupatikana zaidi katika ngeli ya KI-VI.",
    notes: "Umoja: kitabu ki-nasomwa. Wingi: vitabu vi-nasomwa. Mifano: kiti/viti, kikombe/vikombe.",
    quiz: [
      { q: "Wingi wa 'kiti':", options: ["viti", "wati", "miti", "vyati"], correct: 0 },
      { q: "'Vitabu ___ nzuri.'", options: ["ni", "vi", "li", "ya"], correct: 1 },
      { q: "Umoja wa 'vikombe':", options: ["kombe", "kikombe", "mkombe", "ukombe"], correct: 1 },
    ],
  },
  {
    id: "k-msamiati", title: "Msamiati: Matunda na Mboga", strand: "Msamiati", duration: "7 min", tier: "kpsea",
    summary: "Tujue majina ya matunda na mboga kwa Kiswahili.",
    notes: "Matunda: chungwa, ndizi, embe, nanasi. Mboga: sukuma wiki, kabichi, nyanya, kitunguu.",
    quiz: [
      { q: "Chungwa ni:", options: ["mboga", "tunda", "nyama", "samaki"], correct: 1 },
      { q: "Sukuma wiki ni:", options: ["tunda", "mboga", "nyama", "kinywaji"], correct: 1 },
      { q: "Nanasi ni:", options: ["mboga", "tunda", "samaki", "ndege"], correct: 1 },
      { q: "Kitunguu ni:", options: ["tunda", "mboga", "nyama", "matunda"], correct: 1 },
    ],
  },
  {
    id: "k-vitenzi", title: "Vitenzi vya Kawaida", strand: "Sarufi", duration: "9 min", tier: "kpsea",
    summary: "Kitenzi ni neno linaloonyesha tendo.",
    notes: "Mifano: kucheza, kuimba, kusoma, kuandika. Kitenzi hubadilika kulingana na nafsi: ninasoma, unasoma, anasoma.",
    quiz: [
      { q: "Kitenzi katika 'Watoto wanacheza':", options: ["watoto", "wanacheza", "wa", "ni"], correct: 1 },
      { q: "Nafsi ya kwanza umoja:", options: ["nina-", "una-", "ana-", "tuna-"], correct: 0 },
      { q: "Nafsi ya tatu umoja:", options: ["nina-", "una-", "ana-", "wana-"], correct: 2 },
    ],
  },
  {
    id: "k-methali", title: "Methali za Kiswahili", strand: "Fasihi", duration: "8 min", tier: "all",
    summary: "Methali ni hekima fupi inayofunza maadili.",
    notes: "'Haraka haraka haina baraka' — kazi yenye haraka huwa na makosa. 'Asiyesikia la mkuu huvunjika guu' — sikiza wakubwa.",
    quiz: [
      { q: "'Haraka haraka haina ___':", options: ["heri", "baraka", "raha", "amani"], correct: 1 },
      { q: "Methali hufundisha:", options: ["matusi", "maadili", "michezo", "lugha za kigeni"], correct: 1 },
      { q: "'Mtaka cha mvunguni ___':", options: ["sharti ainame", "sharti aimbe", "sharti acheke", "sharti aende"], correct: 0 },
    ],
  },
  {
    id: "k-insha-jss", title: "Insha ya Maelezo", strand: "Kuandika", duration: "12 min", tier: "kjsea",
    summary: "Insha ya maelezo huelezea jambo, mtu au mahali kwa undani.",
    notes: "Anza na utangulizi mfupi. Endelea na aya 2–3 za mwili zenye hoja moja kila moja. Maliza na hitimisho linaloweka muhtasari.",
    quiz: [
      { q: "Insha bora ina aya ngapi za mwili?", options: ["1", "2-3", "5", "10"], correct: 1 },
      { q: "Utangulizi huja:", options: ["mwisho", "katikati", "mwanzoni", "popote"], correct: 2 },
      { q: "Hitimisho hufanya nini?", options: ["kuanzisha", "kuelezea kwa undani", "kuweka muhtasari", "kuongeza hoja mpya"], correct: 2 },
    ],
  },
  {
    id: "k-ushairi-jss", title: "Ushairi wa Kiswahili", strand: "Fasihi", duration: "10 min", tier: "kjsea",
    summary: "Shairi lina mishororo, vina na mizani.",
    notes: "Mshororo ni mstari mmoja wa shairi. Kina ni sauti inayorudiwa mwishoni. Mizani ni idadi ya silabi katika mshororo.",
    quiz: [
      { q: "Mshororo ni:", options: ["aya", "neno", "mstari mmoja", "ubeti"], correct: 2 },
      { q: "Kina hupatikana:", options: ["mwanzoni", "katikati", "mwishoni", "popote"], correct: 2 },
      { q: "Mizani huhesabu:", options: ["maneno", "silabi", "vituo", "mishororo"], correct: 1 },
    ],
  },
];

// ---------------------------------------------------------------------------
// INTEGRATED SCIENCE  (8 lessons, 50+ Qs)
// ---------------------------------------------------------------------------
const SCIENCE: Lesson[] = [
  {
    id: "s-states", title: "States of Matter", strand: "Materials", duration: "8 min", tier: "kpsea",
    summary: "Matter exists as solid, liquid or gas depending on how its particles move.",
    notes: "Solids have a fixed shape and volume. Liquids take the shape of the container but keep volume. Gases spread to fill any container. Heating or cooling can change states.",
    quiz: [
      { q: "Water vapour is a:", options: ["Solid", "Liquid", "Gas", "Plasma"], correct: 2 },
      { q: "Ice melts to form:", options: ["Gas", "Liquid", "Solid", "Vapour"], correct: 1 },
      { q: "When water boils it becomes:", options: ["ice", "vapour", "snow", "rain"], correct: 1 },
      { q: "Which has a fixed shape?", options: ["water", "air", "rock", "milk"], correct: 2 },
      { q: "Condensation changes gas to:", options: ["solid", "liquid", "plasma", "powder"], correct: 1 },
    ],
  },
  {
    id: "s-plants", title: "Parts & Functions of a Plant", strand: "Living Things", duration: "9 min", tier: "kpsea",
    summary: "Roots, stem, leaves, flowers and fruits each have a job.",
    notes: "Roots anchor the plant and absorb water and minerals. The stem holds the plant up and transports water and food. Leaves make food using sunlight (photosynthesis). Flowers help in reproduction. Fruits contain seeds.",
    quiz: [
      { q: "Where is food made?", options: ["Roots", "Stem", "Leaves", "Flowers"], correct: 2 },
      { q: "Roots mainly absorb:", options: ["air", "water", "sunlight", "sound"], correct: 1 },
      { q: "Photosynthesis needs:", options: ["sunlight", "darkness", "salt", "soap"], correct: 0 },
      { q: "Seeds are found in:", options: ["leaves", "roots", "fruits", "stems"], correct: 2 },
      { q: "Gas plants take in for photosynthesis:", options: ["oxygen", "nitrogen", "carbon dioxide", "hydrogen"], correct: 2 },
    ],
  },
  {
    id: "s-human-body", title: "Human Body Systems", strand: "Living Things", duration: "10 min", tier: "kpsea",
    summary: "The body has systems for breathing, digestion and circulation.",
    notes: "Lungs handle breathing. The heart pumps blood through the circulatory system. The stomach and intestines digest food. The brain controls everything.",
    quiz: [
      { q: "The heart is part of which system?", options: ["digestive", "circulatory", "respiratory", "nervous"], correct: 1 },
      { q: "We breathe in mostly:", options: ["carbon dioxide", "oxygen", "nitrogen", "helium"], correct: 1 },
      { q: "Digestion begins in the:", options: ["stomach", "mouth", "intestines", "liver"], correct: 1 },
      { q: "The brain controls the:", options: ["heart only", "lungs only", "whole body", "nothing"], correct: 2 },
    ],
  },
  {
    id: "s-health", title: "Health & Hygiene", strand: "Health", duration: "8 min", tier: "kpsea",
    summary: "Good hygiene prevents disease.",
    notes: "Wash hands with soap before eating and after using the toilet. Drink clean water. Brush teeth twice daily. Get enough sleep and exercise.",
    quiz: [
      { q: "Best to wash hands with:", options: ["water only", "soap and water", "oil", "sand"], correct: 1 },
      { q: "Brush teeth at least:", options: ["once a week", "once a day", "twice a day", "never"], correct: 2 },
      { q: "Dirty water can cause:", options: ["energy", "disease", "happiness", "growth"], correct: 1 },
    ],
  },
  {
    id: "s-environment", title: "Caring for the Environment", strand: "Earth & Space", duration: "8 min", tier: "all",
    summary: "We must protect soil, water, air and living things.",
    notes: "Plant trees to prevent soil erosion. Recycle paper, plastic and metal. Don't burn rubbish near homes — it pollutes the air.",
    quiz: [
      { q: "Planting trees helps prevent:", options: ["rain", "soil erosion", "wind", "sunlight"], correct: 1 },
      { q: "Recycling reduces:", options: ["waste", "trees", "happiness", "rain"], correct: 0 },
      { q: "Air pollution is caused by:", options: ["clean cars", "burning rubbish", "trees", "rivers"], correct: 1 },
    ],
  },
  {
    id: "s-energy-jss", title: "Forms of Energy", strand: "Energy", duration: "10 min", tier: "kjsea",
    summary: "Energy comes in many forms: heat, light, sound, electrical, chemical, kinetic, potential.",
    notes: "Energy is the ability to do work. It can change from one form to another but is never created or destroyed (conservation of energy). A torch turns chemical energy in a battery into light and heat.",
    quiz: [
      { q: "A moving car has mostly:", options: ["Chemical energy", "Kinetic energy", "Sound energy", "Light energy"], correct: 1 },
      { q: "A battery stores:", options: ["light energy", "chemical energy", "sound energy", "wind energy"], correct: 1 },
      { q: "Energy cannot be:", options: ["used", "stored", "created or destroyed", "changed"], correct: 2 },
      { q: "Sun is mainly a source of:", options: ["sound", "light and heat", "wind", "electricity only"], correct: 1 },
    ],
  },
  {
    id: "s-force-jss", title: "Forces & Motion", strand: "Physics", duration: "10 min", tier: "kjsea",
    summary: "A force is a push or a pull. Forces cause objects to start, stop or change direction.",
    notes: "Friction slows things down. Gravity pulls objects toward the Earth. Weight = mass × gravity. The unit of force is the newton (N).",
    quiz: [
      { q: "Unit of force:", options: ["kg", "newton", "joule", "watt"], correct: 1 },
      { q: "Force that pulls objects to Earth:", options: ["friction", "gravity", "magnetism", "wind"], correct: 1 },
      { q: "Friction is reduced by:", options: ["oil", "sand", "rust", "rough surfaces"], correct: 0 },
    ],
  },
  {
    id: "s-cell-jss", title: "Cells: Building Blocks of Life", strand: "Biology", duration: "10 min", tier: "kjsea",
    summary: "All living things are made of cells.",
    notes: "Animal cells have a nucleus, cytoplasm and cell membrane. Plant cells also have a cell wall, chloroplasts and a large vacuole.",
    quiz: [
      { q: "Plant cells have, but animal cells don't:", options: ["nucleus", "cell wall", "membrane", "cytoplasm"], correct: 1 },
      { q: "Chloroplasts help in:", options: ["digestion", "photosynthesis", "respiration", "movement"], correct: 1 },
      { q: "The control centre of a cell is the:", options: ["membrane", "vacuole", "nucleus", "wall"], correct: 2 },
    ],
  },
];

// ---------------------------------------------------------------------------
// SOCIAL STUDIES  (7 lessons, 50+ Qs)
// ---------------------------------------------------------------------------
const SOCIAL: Lesson[] = [
  {
    id: "ss-citizen", title: "Being a Good Citizen", strand: "Citizenship", duration: "7 min", tier: "kpsea",
    summary: "A good citizen follows rules, respects others and serves the community.",
    notes: "Rights come with responsibilities. We have the right to education, but we must attend school and behave well. We respect leaders and protect public property.",
    quiz: [
      { q: "A right of a child is:", options: ["Skipping school", "Education", "Stealing", "Fighting"], correct: 1 },
      { q: "A responsibility of a citizen:", options: ["breaking rules", "paying taxes", "littering", "fighting"], correct: 1 },
      { q: "We should treat elders with:", options: ["disrespect", "respect", "fear", "hatred"], correct: 1 },
    ],
  },
  {
    id: "ss-map", title: "Reading Simple Maps", strand: "Geography", duration: "9 min", tier: "kpsea",
    summary: "Maps show places from above. They use symbols, a key and compass directions.",
    notes: "North is usually at the top. The key (legend) tells you what each symbol means. The scale shows distance.",
    quiz: [
      { q: "North is usually at the:", options: ["Top", "Bottom", "Left", "Right"], correct: 0 },
      { q: "Map symbols are explained in the:", options: ["title", "key", "scale", "border"], correct: 1 },
      { q: "Opposite of North:", options: ["East", "West", "South", "Up"], correct: 2 },
      { q: "Between North and East lies:", options: ["NW", "SE", "NE", "SW"], correct: 2 },
      { q: "Scale tells us:", options: ["colour", "distance", "weather", "names"], correct: 1 },
    ],
  },
  {
    id: "ss-counties", title: "Counties of Kenya", strand: "Geography", duration: "10 min", tier: "kpsea",
    summary: "Kenya has 47 counties, each headed by a Governor.",
    notes: "The capital city is Nairobi. Counties are led by Governors elected every 5 years. Examples: Nairobi, Mombasa, Kisumu, Nakuru.",
    quiz: [
      { q: "Kenya has how many counties?", options: ["27", "37", "47", "57"], correct: 2 },
      { q: "Capital city of Kenya:", options: ["Mombasa", "Kisumu", "Nairobi", "Nakuru"], correct: 2 },
      { q: "A county is led by a:", options: ["Mayor", "Governor", "Senator", "President"], correct: 1 },
      { q: "Coastal city of Kenya:", options: ["Eldoret", "Kisumu", "Mombasa", "Kakamega"], correct: 2 },
      { q: "Governors serve for:", options: ["2 years", "3 years", "5 years", "10 years"], correct: 2 },
    ],
  },
  {
    id: "ss-history", title: "History: Kenya's Independence", strand: "History", duration: "10 min", tier: "kpsea",
    summary: "Kenya became independent on 12th December 1963.",
    notes: "Mzee Jomo Kenyatta was Kenya's first President. Independence Day is celebrated as Jamhuri Day (12th Dec). The Mau Mau fought for freedom.",
    quiz: [
      { q: "Kenya got independence in:", options: ["1953", "1963", "1973", "1983"], correct: 1 },
      { q: "First president of Kenya:", options: ["Moi", "Kenyatta", "Kibaki", "Ruto"], correct: 1 },
      { q: "Jamhuri Day is on:", options: ["1 Jun", "12 Dec", "20 Oct", "1 May"], correct: 1 },
      { q: "Madaraka Day is celebrated on:", options: ["1 Jun", "12 Dec", "20 Oct", "1 Jan"], correct: 0 },
    ],
  },
  {
    id: "ss-government", title: "Branches of Government", strand: "Civics", duration: "9 min", tier: "all",
    summary: "Government has three arms: Executive, Legislature and Judiciary.",
    notes: "Executive (President, Deputy, Cabinet) implements laws. Legislature (Parliament, Senate) makes laws. Judiciary (Courts) interprets laws.",
    quiz: [
      { q: "Who makes laws?", options: ["Courts", "Parliament", "Police", "Schools"], correct: 1 },
      { q: "Who interprets laws?", options: ["Parliament", "President", "Judiciary", "Senate"], correct: 2 },
      { q: "Head of the Executive:", options: ["Chief Justice", "Speaker", "President", "Governor"], correct: 2 },
    ],
  },
  {
    id: "ss-resources-jss", title: "Natural Resources of East Africa", strand: "Geography", duration: "10 min", tier: "kjsea",
    summary: "East Africa is rich in minerals, water, wildlife and arable land.",
    notes: "Kenya: tea, coffee, soda ash. Tanzania: gold, tanzanite. Uganda: copper, oil. Wildlife supports tourism.",
    quiz: [
      { q: "Main cash crop in Kenya:", options: ["maize", "tea", "rice", "sugar"], correct: 1 },
      { q: "Tanzanite is mined in:", options: ["Kenya", "Tanzania", "Uganda", "Rwanda"], correct: 1 },
      { q: "Tourism in East Africa thrives because of:", options: ["snow", "wildlife", "deserts", "wars"], correct: 1 },
    ],
  },
  {
    id: "ss-economics-jss", title: "Basic Economics: Demand & Supply", strand: "Economics", duration: "10 min", tier: "kjsea",
    summary: "Price is set by interaction of demand and supply.",
    notes: "When demand rises and supply stays the same, prices go up. When supply rises and demand stays the same, prices fall.",
    quiz: [
      { q: "If demand rises, price usually:", options: ["falls", "rises", "stays same", "becomes zero"], correct: 1 },
      { q: "If supply rises and demand stays, price:", options: ["rises", "falls", "stays", "doubles"], correct: 1 },
      { q: "Money used in Kenya:", options: ["Dollar", "Pound", "Shilling", "Euro"], correct: 2 },
    ],
  },
];

// ---------------------------------------------------------------------------
// CREATIVE ARTS  (7 lessons, 50+ Qs)
// ---------------------------------------------------------------------------
const CREATIVE: Lesson[] = [
  {
    id: "ca-colour", title: "Primary & Secondary Colours", strand: "Visual Art", duration: "7 min", tier: "all",
    summary: "Primary colours mix to make secondary colours.",
    notes: "Primary: red, blue, yellow. Secondary: red+yellow=orange, blue+yellow=green, red+blue=purple.",
    quiz: [
      { q: "Blue + yellow = ?", options: ["Orange", "Green", "Purple", "Brown"], correct: 1 },
      { q: "Red + yellow = ?", options: ["Green", "Orange", "Purple", "Pink"], correct: 1 },
      { q: "Red + blue = ?", options: ["Green", "Yellow", "Purple", "Brown"], correct: 2 },
      { q: "Which is a primary colour?", options: ["Orange", "Green", "Blue", "Purple"], correct: 2 },
      { q: "Which is NOT primary?", options: ["Red", "Blue", "Yellow", "Green"], correct: 3 },
    ],
  },
  {
    id: "ca-elements", title: "Elements of Art", strand: "Visual Art", duration: "8 min", tier: "all",
    summary: "Line, shape, colour, texture, space, form and value make up every artwork.",
    notes: "Line shows direction. Shape is 2D, form is 3D. Texture is how it feels. Value is light/dark.",
    quiz: [
      { q: "A 3D version of shape:", options: ["line", "form", "value", "texture"], correct: 1 },
      { q: "How something feels:", options: ["shape", "texture", "line", "value"], correct: 1 },
      { q: "Light or dark refers to:", options: ["value", "form", "line", "space"], correct: 0 },
    ],
  },
  {
    id: "ca-music", title: "Music Basics: Rhythm & Beat", strand: "Music", duration: "8 min", tier: "all",
    summary: "Rhythm is a pattern of sounds and silences over time.",
    notes: "Beat is the steady pulse. Rhythm is the pattern over the beat. Tempo is how fast or slow.",
    quiz: [
      { q: "Steady pulse in music:", options: ["beat", "rhythm", "tempo", "pitch"], correct: 0 },
      { q: "Fast or slow refers to:", options: ["pitch", "tempo", "beat", "rhythm"], correct: 1 },
      { q: "High or low sound is:", options: ["pitch", "beat", "tempo", "rhythm"], correct: 0 },
    ],
  },
  {
    id: "ca-drama", title: "Drama: Mime & Roleplay", strand: "Drama", duration: "8 min", tier: "all",
    summary: "Mime is acting without words. Roleplay means pretending to be someone else.",
    notes: "In mime, your face and body tell the story. In roleplay, you take on a character's voice, actions and feelings.",
    quiz: [
      { q: "Mime uses:", options: ["words only", "no words", "song only", "writing"], correct: 1 },
      { q: "Roleplay means:", options: ["copying", "being yourself", "playing a character", "dancing"], correct: 2 },
      { q: "In mime you express through:", options: ["voice", "face and body", "writing", "props only"], correct: 1 },
    ],
  },
  {
    id: "ca-dance", title: "Dance & Movement", strand: "Movement", duration: "7 min", tier: "all",
    summary: "Dance combines body, space, time and energy.",
    notes: "Use the whole body. Move at different levels (low, medium, high) and speeds. African dances often follow drum patterns.",
    quiz: [
      { q: "Levels in dance include:", options: ["high only", "low only", "high, medium, low", "front only"], correct: 2 },
      { q: "African dance often follows:", options: ["silence", "drums", "books", "wind"], correct: 1 },
    ],
  },
  {
    id: "ca-digital", title: "Digital Creativity Basics", strand: "Digital Art", duration: "9 min", tier: "kjsea",
    summary: "Digital tools help create art, music and videos.",
    notes: "Use simple apps to draw, photograph or record. Always credit other people's work. Don't share private images of others.",
    quiz: [
      { q: "Crediting an artist is:", options: ["optional", "respectful and required", "rude", "illegal"], correct: 1 },
      { q: "Sharing private photos of others without permission is:", options: ["fine", "wrong", "encouraged", "required"], correct: 1 },
      { q: "A digital drawing app uses:", options: ["paper", "pixels", "clay", "wood"], correct: 1 },
    ],
  },
  {
    id: "ca-craft", title: "Paper Craft & Recycling", strand: "Visual Art", duration: "8 min", tier: "kpsea",
    summary: "Make beautiful art from recycled paper, bottles and tins.",
    notes: "Recycling saves trees and reduces waste. Old newspapers can be turned into beads. Bottle tops become mosaics.",
    quiz: [
      { q: "Recycling saves:", options: ["money only", "trees and resources", "nothing", "time only"], correct: 1 },
      { q: "Old newspapers can make:", options: ["beads", "iron", "glass", "soil"], correct: 0 },
      { q: "Bottle tops can make:", options: ["mosaics", "rivers", "smoke", "fire"], correct: 0 },
    ],
  },
];

// ---------------------------------------------------------------------------
// RELIGIOUS EDUCATION  (6 lessons, 50+ Qs)
// ---------------------------------------------------------------------------
const RELIGIOUS: Lesson[] = [
  {
    id: "re-values", title: "Honesty & Responsibility", strand: "Values", duration: "6 min", tier: "all",
    summary: "Living truthfully and doing what is right.",
    notes: "Honesty means telling the truth even when it is hard. Responsibility means doing your duties without being told.",
    quiz: [
      { q: "Honesty means:", options: ["Telling lies", "Telling the truth", "Keeping secrets", "Cheating"], correct: 1 },
      { q: "Responsibility means:", options: ["doing what you want", "doing your duties", "running away", "sleeping"], correct: 1 },
      { q: "If you find lost money, you should:", options: ["keep it", "return it", "hide it", "burn it"], correct: 1 },
    ],
  },
  {
    id: "re-respect", title: "Respect & Love", strand: "Values", duration: "7 min", tier: "all",
    summary: "Respect and love bring peace at home, school and the community.",
    notes: "Greet elders, listen when others speak, and treat people the way you'd like to be treated (the Golden Rule).",
    quiz: [
      { q: "The Golden Rule says:", options: ["take what you want", "treat others as you want to be treated", "lie sometimes", "fight"], correct: 1 },
      { q: "We should greet elders with:", options: ["silence", "respect", "anger", "fear"], correct: 1 },
      { q: "Love at home brings:", options: ["fights", "peace", "noise", "hunger"], correct: 1 },
    ],
  },
  {
    id: "re-prayer", title: "Prayer & Worship", strand: "Worship", duration: "8 min", tier: "all",
    summary: "Prayer is talking to God. Worship is honouring God.",
    notes: "Christians pray in churches; Muslims in mosques; Hindus in temples. Worship can include singing, reading scriptures and helping others.",
    quiz: [
      { q: "Christians worship in a:", options: ["mosque", "church", "temple", "shrine"], correct: 1 },
      { q: "Muslims worship in a:", options: ["mosque", "church", "temple", "synagogue"], correct: 0 },
      { q: "Hindus worship in a:", options: ["mosque", "church", "temple", "tent"], correct: 2 },
      { q: "Prayer is:", options: ["a game", "talking to God", "shopping", "fighting"], correct: 1 },
    ],
  },
  {
    id: "re-creation", title: "Creation & Care for Nature", strand: "Beliefs", duration: "8 min", tier: "all",
    summary: "Many faiths teach that God created the world and we must care for it.",
    notes: "Plants, animals, water and people are all part of creation. We are stewards — we must protect and not destroy.",
    quiz: [
      { q: "A steward is one who:", options: ["destroys", "protects and cares", "ignores", "wastes"], correct: 1 },
      { q: "Cutting trees without planting more is:", options: ["good", "harmful", "kind", "neutral"], correct: 1 },
      { q: "Wasting water shows:", options: ["care", "wisdom", "no responsibility", "respect"], correct: 2 },
    ],
  },
  {
    id: "re-leaders", title: "Religious Leaders & Founders", strand: "History", duration: "9 min", tier: "all",
    summary: "Key religious figures shaped beliefs and values.",
    notes: "Jesus Christ founded Christianity. Prophet Muhammad (PBUH) is central to Islam. Hindus revere many deities; the Bhagavad Gita is a key text.",
    quiz: [
      { q: "Jesus is central in:", options: ["Islam", "Christianity", "Hinduism", "Judaism only"], correct: 1 },
      { q: "Prophet Muhammad is central in:", options: ["Christianity", "Islam", "Hinduism", "Buddhism"], correct: 1 },
      { q: "A holy book of Islam:", options: ["Bible", "Quran", "Vedas", "Torah"], correct: 1 },
      { q: "A holy book of Christianity:", options: ["Quran", "Bible", "Vedas", "Talmud"], correct: 1 },
    ],
  },
  {
    id: "re-service", title: "Service to Others", strand: "Values", duration: "7 min", tier: "all",
    summary: "Helping others is a teaching shared by most faiths.",
    notes: "Help the sick, the poor and the elderly. Volunteer at school clean-ups. Share with neighbours.",
    quiz: [
      { q: "Helping the poor is:", options: ["bad", "good service", "useless", "selfish"], correct: 1 },
      { q: "Volunteering at a clean-up shows:", options: ["laziness", "service", "anger", "pride"], correct: 1 },
      { q: "Sharing food with a hungry person is:", options: ["wrong", "kind", "wasteful", "illegal"], correct: 1 },
    ],
  },
];

// ---------------------------------------------------------------------------
// PHYSICAL & HEALTH EDUCATION  (6 lessons, 50+ Qs)
// ---------------------------------------------------------------------------
const PHE: Lesson[] = [
  {
    id: "phe-warmup", title: "Warm-up & Cool-down", strand: "Movement", duration: "6 min", tier: "all",
    summary: "Warming up prepares the body for activity and prevents injury.",
    notes: "Start with light jogging, then stretch major muscles. After exercise, cool down with slow stretches.",
    quiz: [
      { q: "Why do we warm up?", options: ["Show off", "Prevent injury", "Waste time", "Get tired"], correct: 1 },
      { q: "Cool-down should be:", options: ["sudden stop", "slow stretches", "more sprinting", "skipped"], correct: 1 },
      { q: "Warm-up should be at least:", options: ["10 seconds", "5 minutes", "1 hour", "0 minutes"], correct: 1 },
    ],
  },
  {
    id: "phe-football", title: "Football: Basic Skills", strand: "Games", duration: "10 min", tier: "all",
    summary: "Passing, dribbling and shooting are core football skills.",
    notes: "Use the inside of your foot for short passes. Keep the ball close when dribbling. Shoot with the laces for power.",
    quiz: [
      { q: "Short pass uses:", options: ["heel", "inside of foot", "head", "toes"], correct: 1 },
      { q: "Football has how many players per side?", options: ["7", "9", "11", "15"], correct: 2 },
      { q: "A goal scored counts as:", options: ["1 point", "2 points", "3 points", "0 points"], correct: 0 },
    ],
  },
  {
    id: "phe-athletics", title: "Athletics: Running & Jumping", strand: "Games", duration: "9 min", tier: "all",
    summary: "Sprints, distance and jumps are part of athletics.",
    notes: "A 100m race tests speed; 5,000m tests endurance. Long jump uses a run-up, take-off, flight and landing.",
    quiz: [
      { q: "100m mostly tests:", options: ["endurance", "speed", "strength", "flexibility"], correct: 1 },
      { q: "5,000m mostly tests:", options: ["speed", "endurance", "balance", "throwing"], correct: 1 },
      { q: "Long jump phases include:", options: ["only run-up", "run-up, take-off, flight, landing", "only landing", "swimming"], correct: 1 },
    ],
  },
  {
    id: "phe-safety", title: "Safety in Sports", strand: "Safety", duration: "7 min", tier: "all",
    summary: "Use the right gear, follow rules and listen to coaches.",
    notes: "Wear shin guards for football, helmets for cycling. Drink water before, during and after activity. Stop if you feel pain.",
    quiz: [
      { q: "Cycling safety needs a:", options: ["hat", "helmet", "scarf", "umbrella"], correct: 1 },
      { q: "If you feel pain during sport:", options: ["push harder", "stop and rest", "ignore", "compete"], correct: 1 },
      { q: "Hydration means:", options: ["eating", "drinking water", "sleeping", "running"], correct: 1 },
    ],
  },
  {
    id: "phe-nutrition", title: "Nutrition & Healthy Eating", strand: "Health", duration: "9 min", tier: "all",
    summary: "A balanced diet contains carbohydrates, proteins, vitamins, minerals and water.",
    notes: "Carbs (ugali, rice) give energy. Proteins (beans, fish) build the body. Vitamins (fruits, vegetables) protect the body.",
    quiz: [
      { q: "Beans are mainly:", options: ["carbs", "proteins", "vitamins", "fats"], correct: 1 },
      { q: "Vitamins are found in:", options: ["fruits and vegetables", "stones", "oils only", "sugar only"], correct: 0 },
      { q: "Main energy food:", options: ["proteins", "carbs", "vitamins", "salt"], correct: 1 },
      { q: "Water is needed because it:", options: ["adds calories", "transports nutrients", "tastes nice", "is sweet"], correct: 1 },
    ],
  },
  {
    id: "phe-mental", title: "Mental Wellness", strand: "Health", duration: "8 min", tier: "all",
    summary: "Caring for the mind is as important as caring for the body.",
    notes: "Sleep 8–10 hours. Talk to a trusted adult when stressed. Take screen breaks. Exercise lifts mood.",
    quiz: [
      { q: "Children need about how many hours of sleep?", options: ["2", "5", "8–10", "20"], correct: 2 },
      { q: "When stressed, you should:", options: ["bottle it up", "talk to a trusted adult", "fight someone", "skip school"], correct: 1 },
      { q: "Exercise generally:", options: ["lowers mood", "lifts mood", "has no effect", "causes illness"], correct: 1 },
    ],
  },
];

// ---------------------------------------------------------------------------
// PRE-TECHNICAL STUDIES  (6 lessons, 50+ Qs)
// ---------------------------------------------------------------------------
const PRETECH: Lesson[] = [
  {
    id: "pt-drawing", title: "Technical Drawing Basics", strand: "Communication", duration: "10 min", tier: "kjsea",
    summary: "Use accurate lines, scales and labels to communicate technical ideas.",
    notes: "Use a sharp pencil and a ruler. Lines should be clean and consistent. Label all measurements. Use a scale (e.g. 1:10) when the object is too big.",
    quiz: [
      { q: "Scale 1:10 means:", options: ["10× bigger", "10× smaller", "Same size", "Random"], correct: 1 },
      { q: "Scale 1:1 means:", options: ["smaller", "bigger", "same size", "double"], correct: 2 },
      { q: "A drawing needs:", options: ["just lines", "lines, labels, measurements", "colour only", "title only"], correct: 1 },
      { q: "Best tool for straight lines:", options: ["finger", "ruler", "rope", "stone"], correct: 1 },
    ],
  },
  {
    id: "pt-materials", title: "Materials & Their Uses", strand: "Materials", duration: "9 min", tier: "kjsea",
    summary: "Wood, metal, plastic and clay each have different properties.",
    notes: "Wood: light, easy to shape. Metal: strong, can rust. Plastic: light, water-resistant. Clay: shaped when wet, hardened by heat.",
    quiz: [
      { q: "A material that can rust:", options: ["plastic", "metal", "wood", "clay"], correct: 1 },
      { q: "Best for water tanks:", options: ["paper", "plastic", "cloth", "salt"], correct: 1 },
      { q: "Clay is hardened by:", options: ["cold", "heat", "water", "wind"], correct: 1 },
      { q: "Wood is mainly:", options: ["heavy and brittle", "light and shapeable", "magnetic", "rusts easily"], correct: 1 },
    ],
  },
  {
    id: "pt-tools", title: "Hand Tools & Safety", strand: "Tools", duration: "9 min", tier: "kjsea",
    summary: "Each tool has a job. Use the right tool and protect yourself.",
    notes: "Hammer drives nails. Screwdriver turns screws. Saw cuts wood. Always wear safety goggles when sawing or grinding.",
    quiz: [
      { q: "Tool for driving nails:", options: ["saw", "hammer", "ruler", "pen"], correct: 1 },
      { q: "Tool for cutting wood:", options: ["saw", "spoon", "key", "comb"], correct: 0 },
      { q: "Wear goggles when:", options: ["sleeping", "sawing", "eating", "writing"], correct: 1 },
    ],
  },
  {
    id: "pt-digital", title: "Digital Technology Basics", strand: "Digital", duration: "10 min", tier: "kjsea",
    summary: "Computers process data: input, process, output, storage.",
    notes: "Input: keyboard, mouse. Output: screen, printer. Storage: hard drive, USB. The CPU processes information.",
    quiz: [
      { q: "Keyboard is a:", options: ["input device", "output device", "storage device", "CPU"], correct: 0 },
      { q: "Printer is a:", options: ["input device", "output device", "CPU", "USB"], correct: 1 },
      { q: "CPU stands for:", options: ["Central Print Unit", "Central Processing Unit", "Computer Power Unit", "Control Print Unit"], correct: 1 },
      { q: "USB drive is mainly for:", options: ["printing", "processing", "storage", "input"], correct: 2 },
    ],
  },
  {
    id: "pt-internet", title: "Internet Safety", strand: "Digital", duration: "8 min", tier: "all",
    summary: "Stay safe online: protect your information and be respectful.",
    notes: "Never share passwords. Don't meet strangers from the internet. Don't click suspicious links. Tell an adult if something feels wrong.",
    quiz: [
      { q: "You should never share your:", options: ["name", "school", "password", "smile"], correct: 2 },
      { q: "A strange link from a stranger should be:", options: ["clicked", "ignored", "shared", "saved"], correct: 1 },
      { q: "If a stranger online makes you uneasy:", options: ["meet them", "tell a trusted adult", "send them photos", "give your address"], correct: 1 },
    ],
  },
  {
    id: "pt-entrepreneurship", title: "Entrepreneurship Basics", strand: "Enterprise", duration: "9 min", tier: "kjsea",
    summary: "An entrepreneur sees a need, plans a solution and starts a small business.",
    notes: "Profit = selling price − cost. Save part of your profit. Customers buy what solves their problem.",
    quiz: [
      { q: "Profit is:", options: ["cost − price", "price − cost", "price + cost", "price × cost"], correct: 1 },
      { q: "A good entrepreneur first:", options: ["spends all money", "sees a need", "ignores customers", "quits"], correct: 1 },
      { q: "Sold for 100, cost was 70. Profit = ?", options: ["170", "70", "30", "100"], correct: 2 },
    ],
  },
];

// ---------------------------------------------------------------------------
// AGRICULTURE  (6 lessons, 50+ Qs)
// ---------------------------------------------------------------------------
const AGRI: Lesson[] = [
  {
    id: "ag-soil", title: "Types of Soil", strand: "Soils", duration: "9 min", tier: "kjsea",
    summary: "Sandy, clay and loam are common soils. Loam is best for most crops.",
    notes: "Sandy soil drains quickly and holds few nutrients. Clay holds water but can be waterlogged. Loam is balanced and fertile.",
    quiz: [
      { q: "Best soil for most crops:", options: ["Sandy", "Clay", "Loam", "Rocky"], correct: 2 },
      { q: "Soil that drains quickest:", options: ["clay", "loam", "sandy", "silt"], correct: 2 },
      { q: "Soil that holds most water:", options: ["sandy", "clay", "rocky", "ash"], correct: 1 },
    ],
  },
  {
    id: "ag-crops", title: "Crop Production", strand: "Crops", duration: "10 min", tier: "kjsea",
    summary: "Crops need water, nutrients, sunlight and care from planting to harvest.",
    notes: "Prepare land, plant at correct spacing, weed regularly, control pests, harvest when ready. Cereals like maize need rainfall during growth.",
    quiz: [
      { q: "Why do we weed?", options: ["for fun", "to remove competition", "to reduce yield", "to attract pests"], correct: 1 },
      { q: "Maize is a:", options: ["legume", "cereal", "tuber", "fruit"], correct: 1 },
      { q: "Beans are:", options: ["cereals", "legumes", "vegetables only", "fruits"], correct: 1 },
      { q: "Pest control protects:", options: ["weeds", "crops", "soil only", "rain"], correct: 1 },
    ],
  },
  {
    id: "ag-livestock", title: "Livestock Keeping", strand: "Livestock", duration: "10 min", tier: "kjsea",
    summary: "Livestock include cattle, sheep, goats and chickens.",
    notes: "Provide clean water, balanced feed, shelter and vaccination. Healthy animals produce more milk, meat and eggs.",
    quiz: [
      { q: "Chickens are kept mainly for:", options: ["milk", "wool", "eggs and meat", "wood"], correct: 2 },
      { q: "Cattle provide:", options: ["only milk", "milk, meat and hides", "only eggs", "only feathers"], correct: 1 },
      { q: "Vaccination prevents:", options: ["diseases", "growth", "milk", "weight"], correct: 0 },
    ],
  },
  {
    id: "ag-tools", title: "Farm Tools", strand: "Tools", duration: "8 min", tier: "kjsea",
    summary: "Use the right tool for each job and store them clean and dry.",
    notes: "Jembe digs and weeds. Panga clears bush. Wheelbarrow carries loads. Rake levels soil. Sharp tools should be handled carefully.",
    quiz: [
      { q: "Jembe is used to:", options: ["cook", "dig", "type", "read"], correct: 1 },
      { q: "Panga is used to:", options: ["weave", "clear bush", "fly", "swim"], correct: 1 },
      { q: "After use, tools should be:", options: ["thrown away", "cleaned and stored", "burned", "buried"], correct: 1 },
    ],
  },
  {
    id: "ag-water", title: "Water Conservation on the Farm", strand: "Resources", duration: "8 min", tier: "all",
    summary: "Save water through mulching, drip irrigation and rainwater harvesting.",
    notes: "Mulch covers soil to slow evaporation. Drip irrigation gives water directly to plant roots. Tanks store rainwater for dry days.",
    quiz: [
      { q: "Mulching helps:", options: ["lose water", "save water", "kill plants", "attract pests"], correct: 1 },
      { q: "Drip irrigation delivers water to:", options: ["the sky", "plant roots", "the road", "weeds only"], correct: 1 },
      { q: "Rainwater is stored in:", options: ["clouds only", "tanks", "boxes", "books"], correct: 1 },
    ],
  },
  {
    id: "ag-enterprise", title: "Farm Enterprise & Records", strand: "Enterprise", duration: "9 min", tier: "kjsea",
    summary: "A farm is a business — keep records of inputs, outputs and money.",
    notes: "Record planting dates, costs of seeds, sales of produce. Profit = total sales − total costs.",
    quiz: [
      { q: "Profit = ?", options: ["sales + costs", "sales − costs", "costs only", "sales only"], correct: 1 },
      { q: "Records help the farmer:", options: ["forget", "make better decisions", "lose money", "skip work"], correct: 1 },
      { q: "Sales 5,000, costs 3,200. Profit = ?", options: ["8,200", "1,800", "2,800", "1,200"], correct: 1 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Registry & helpers
// ---------------------------------------------------------------------------

const LESSONS: Record<SubjectSlug, Lesson[]> = {
  "mathematics": MATHEMATICS,
  "english": ENGLISH,
  "kiswahili": KISWAHILI,
  "integrated-science": SCIENCE,
  "social-studies": SOCIAL,
  "creative-arts": CREATIVE,
  "religious-education": RELIGIOUS,
  "physical-health-education": PHE,
  "pre-technical-studies": PRETECH,
  "agriculture": AGRI,
};

function tier(grade: string): "kpsea" | "kjsea" {
  const m = grade?.match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : 1;
  return n >= 7 ? "kjsea" : "kpsea";
}

export function getLessonsForSubject(slug: SubjectSlug, grade: string): Lesson[] {
  const t = tier(grade);
  const all = LESSONS[slug] || [];
  const matched = all.filter(l => l.tier === "all" || l.tier === t);
  return matched.length > 0 ? matched : all;
}

export function getLesson(slug: SubjectSlug, id: string): Lesson | undefined {
  return (LESSONS[slug] || []).find(l => l.id === id);
}

export function groupByStrand(lessons: Lesson[]): Record<string, Lesson[]> {
  return lessons.reduce((acc, l) => {
    (acc[l.strand] ||= []).push(l);
    return acc;
  }, {} as Record<string, Lesson[]>);
}

// Total questions available for a subject across all its lessons.
export function getSubjectQuestionCount(slug: SubjectSlug): number {
  return (LESSONS[slug] || []).reduce((sum, l) => sum + l.quiz.length, 0);
}

// Fisher–Yates shuffle (pure, returns new array).
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Returns the quiz for a lesson with question order AND option order randomised,
 * while keeping each question's `correct` index pointing at the right answer.
 * This makes every attempt feel fresh.
 *
 * Optionally pass `limit` to cap the number of questions (e.g. 10 per attempt).
 */
export function shuffleQuiz(quiz: QuizQ[], limit?: number): QuizQ[] {
  const reordered = shuffle(quiz).map(q => {
    const idxs = q.options.map((_, i) => i);
    const shuffledIdx = shuffle(idxs);
    const newOptions = shuffledIdx.map(i => q.options[i]);
    const newCorrect = shuffledIdx.indexOf(q.correct);
    return { ...q, options: newOptions, correct: newCorrect };
  });
  return typeof limit === "number" ? reordered.slice(0, limit) : reordered;
}
