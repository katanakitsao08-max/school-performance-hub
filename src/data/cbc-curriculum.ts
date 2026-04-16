// CBC Curriculum Dataset - PP1 to Grade 9
// This is a starter dataset structured for expansion

export interface SLOEntry {
  name: string;
  slos: string[];
}

export interface StrandEntry {
  name: string;
  sub_strands: SLOEntry[];
}

export interface TermEntry {
  term: string;
  strands: StrandEntry[];
}

export interface SubjectEntry {
  name: string;
  terms: TermEntry[];
}

export interface GradeEntry {
  grade: string;
  subjects: SubjectEntry[];
}

export const cbcCurriculum: GradeEntry[] = [
  {
    grade: "PP1",
    subjects: [
      {
        name: "Language Activities",
        terms: [
          {
            term: "Term 1",
            strands: [
              {
                name: "Listening and Speaking",
                sub_strands: [
                  { name: "Greetings", slos: ["Respond to greetings appropriately", "Use polite words in daily communication"] },
                  { name: "Naming Objects", slos: ["Name common objects in the classroom", "Describe objects using simple words"] },
                  { name: "Following Instructions", slos: ["Follow simple oral instructions", "Respond to one-step directions"] }
                ]
              },
              {
                name: "Reading Readiness",
                sub_strands: [
                  { name: "Picture Reading", slos: ["Interpret simple pictures", "Describe what is happening in pictures"] },
                  { name: "Letter Recognition", slos: ["Identify letters of the alphabet", "Match letters to their sounds"] }
                ]
              }
            ]
          },
          {
            term: "Term 2",
            strands: [
              {
                name: "Listening and Speaking",
                sub_strands: [
                  { name: "Storytelling", slos: ["Listen to short stories attentively", "Retell simple stories in own words"] },
                  { name: "Rhymes and Songs", slos: ["Recite simple rhymes", "Sing along to familiar songs"] }
                ]
              },
              {
                name: "Writing Readiness",
                sub_strands: [
                  { name: "Pre-writing Patterns", slos: ["Trace pre-writing patterns correctly", "Draw patterns from left to right"] }
                ]
              }
            ]
          },
          {
            term: "Term 3",
            strands: [
              {
                name: "Listening and Speaking",
                sub_strands: [
                  { name: "Conversations", slos: ["Participate in simple conversations", "Take turns when speaking"] }
                ]
              },
              {
                name: "Reading Readiness",
                sub_strands: [
                  { name: "Word Recognition", slos: ["Read simple three-letter words", "Match words to pictures"] }
                ]
              }
            ]
          }
        ]
      },
      {
        name: "Mathematical Activities",
        terms: [
          {
            term: "Term 1",
            strands: [
              {
                name: "Numbers",
                sub_strands: [
                  { name: "Counting 1-10", slos: ["Count objects up to 10", "Write numbers 1 to 10"] },
                  { name: "Number Recognition", slos: ["Identify numbers 1-10", "Match numbers to quantities"] }
                ]
              },
              {
                name: "Geometry",
                sub_strands: [
                  { name: "Shapes", slos: ["Identify basic shapes (circle, square, triangle)", "Sort objects by shape"] }
                ]
              }
            ]
          },
          {
            term: "Term 2",
            strands: [
              {
                name: "Numbers",
                sub_strands: [
                  { name: "Counting 11-20", slos: ["Count objects up to 20", "Write numbers 11 to 20"] },
                  { name: "Addition", slos: ["Add numbers whose sum does not exceed 10", "Use objects to demonstrate addition"] }
                ]
              }
            ]
          },
          {
            term: "Term 3",
            strands: [
              {
                name: "Numbers",
                sub_strands: [
                  { name: "Subtraction", slos: ["Subtract numbers up to 10", "Use objects to demonstrate subtraction"] }
                ]
              },
              {
                name: "Measurement",
                sub_strands: [
                  { name: "Length", slos: ["Compare lengths of objects", "Use non-standard units to measure length"] }
                ]
              }
            ]
          }
        ]
      },
      {
        name: "Environmental Activities",
        terms: [
          {
            term: "Term 1",
            strands: [
              {
                name: "Our Environment",
                sub_strands: [
                  { name: "Living Things", slos: ["Identify living things in the environment", "Name common animals and plants"] }
                ]
              }
            ]
          },
          { term: "Term 2", strands: [{ name: "Weather", sub_strands: [{ name: "Weather Changes", slos: ["Observe different weather conditions", "Describe sunny and rainy weather"] }] }] },
          { term: "Term 3", strands: [{ name: "Safety", sub_strands: [{ name: "Safety at Home", slos: ["Identify safe and unsafe situations", "Practice safety rules at home"] }] }] }
        ]
      }
    ]
  },
  {
    grade: "PP2",
    subjects: [
      {
        name: "Language Activities",
        terms: [
          {
            term: "Term 1",
            strands: [
              {
                name: "Listening and Speaking",
                sub_strands: [
                  { name: "Self Introduction", slos: ["Introduce self using full name", "State personal details confidently"] },
                  { name: "Asking Questions", slos: ["Ask simple questions correctly", "Use question words (who, what, where)"] }
                ]
              },
              {
                name: "Reading",
                sub_strands: [
                  { name: "Word Building", slos: ["Build three-letter words using letter sounds", "Read simple CVC words"] }
                ]
              }
            ]
          },
          { term: "Term 2", strands: [{ name: "Writing", sub_strands: [{ name: "Letter Writing", slos: ["Write upper case letters correctly", "Write lower case letters correctly"] }] }] },
          { term: "Term 3", strands: [{ name: "Reading", sub_strands: [{ name: "Sentence Reading", slos: ["Read simple sentences", "Understand simple sentence structures"] }] }] }
        ]
      },
      {
        name: "Mathematical Activities",
        terms: [
          {
            term: "Term 1",
            strands: [{ name: "Numbers", sub_strands: [{ name: "Counting 1-50", slos: ["Count objects up to 50", "Read and write numbers up to 50"] }] }]
          },
          { term: "Term 2", strands: [{ name: "Numbers", sub_strands: [{ name: "Addition up to 20", slos: ["Add numbers whose sum does not exceed 20", "Solve simple addition word problems"] }] }] },
          { term: "Term 3", strands: [{ name: "Numbers", sub_strands: [{ name: "Subtraction up to 20", slos: ["Subtract numbers within 20", "Solve simple subtraction word problems"] }] }] }
        ]
      }
    ]
  },
  {
    grade: "Grade 1",
    subjects: [
      {
        name: "English",
        terms: [
          {
            term: "Term 1",
            strands: [
              { name: "Listening and Speaking", sub_strands: [{ name: "Oral Communication", slos: ["Listen to and respond to oral texts", "Participate in guided conversations"] }] },
              { name: "Reading", sub_strands: [{ name: "Phonics", slos: ["Blend letter sounds to read words", "Read CVC words fluently"] }] }
            ]
          },
          { term: "Term 2", strands: [{ name: "Writing", sub_strands: [{ name: "Sentence Construction", slos: ["Write simple sentences using capital letters", "Use full stops in sentences"] }] }] },
          { term: "Term 3", strands: [{ name: "Reading", sub_strands: [{ name: "Reading Comprehension", slos: ["Read short passages", "Answer simple questions from a passage"] }] }] }
        ]
      },
      {
        name: "Kiswahili",
        terms: [
          { term: "Term 1", strands: [{ name: "Kusikiliza na Kuzungumza", sub_strands: [{ name: "Salamu", slos: ["Kutumia salamu kwa usahihi", "Kujibu maswali rahisi kwa Kiswahili"] }] }] },
          { term: "Term 2", strands: [{ name: "Kusoma", sub_strands: [{ name: "Silabi", slos: ["Kusoma silabi za Kiswahili", "Kuunda maneno kwa silabi"] }] }] },
          { term: "Term 3", strands: [{ name: "Kuandika", sub_strands: [{ name: "Herufi", slos: ["Kuandika herufi ndogo na kubwa", "Kuandika maneno rahisi"] }] }] }
        ]
      },
      {
        name: "Mathematics",
        terms: [
          { term: "Term 1", strands: [{ name: "Numbers", sub_strands: [{ name: "Whole Numbers up to 99", slos: ["Count, read and write numbers up to 99", "Compare and order numbers up to 99"] }] }] },
          { term: "Term 2", strands: [{ name: "Numbers", sub_strands: [{ name: "Addition", slos: ["Add numbers whose sum does not exceed 99", "Solve word problems involving addition"] }] }] },
          { term: "Term 3", strands: [{ name: "Measurement", sub_strands: [{ name: "Length", slos: ["Estimate and measure length using standard units", "Compare lengths of different objects"] }] }] }
        ]
      }
    ]
  },
  {
    grade: "Grade 2",
    subjects: [
      {
        name: "English",
        terms: [
          { term: "Term 1", strands: [{ name: "Reading", sub_strands: [{ name: "Fluency", slos: ["Read grade-level text with fluency", "Use expression when reading aloud"] }] }] },
          { term: "Term 2", strands: [{ name: "Writing", sub_strands: [{ name: "Creative Writing", slos: ["Write short compositions", "Use descriptive words in writing"] }] }] },
          { term: "Term 3", strands: [{ name: "Grammar", sub_strands: [{ name: "Parts of Speech", slos: ["Identify nouns in sentences", "Use verbs correctly in sentences"] }] }] }
        ]
      },
      {
        name: "Mathematics",
        terms: [
          { term: "Term 1", strands: [{ name: "Numbers", sub_strands: [{ name: "Place Value up to 999", slos: ["Identify place value of digits up to 999", "Read and write numbers up to 999"] }] }] },
          { term: "Term 2", strands: [{ name: "Numbers", sub_strands: [{ name: "Multiplication", slos: ["Multiply numbers up to 2-digit by 1-digit", "Create multiplication tables"] }] }] },
          { term: "Term 3", strands: [{ name: "Geometry", sub_strands: [{ name: "2D Shapes", slos: ["Identify properties of 2D shapes", "Draw and name common 2D shapes"] }] }] }
        ]
      }
    ]
  },
  {
    grade: "Grade 3",
    subjects: [
      {
        name: "English",
        terms: [
          { term: "Term 1", strands: [{ name: "Reading", sub_strands: [{ name: "Comprehension", slos: ["Read and understand grade-level passages", "Identify main idea and supporting details"] }] }] },
          { term: "Term 2", strands: [{ name: "Writing", sub_strands: [{ name: "Paragraphs", slos: ["Write well-organized paragraphs", "Use topic sentences effectively"] }] }] },
          { term: "Term 3", strands: [{ name: "Grammar", sub_strands: [{ name: "Tenses", slos: ["Use present tense correctly", "Use past tense correctly"] }] }] }
        ]
      },
      {
        name: "Mathematics",
        terms: [
          { term: "Term 1", strands: [{ name: "Numbers", sub_strands: [{ name: "Place Value up to 9999", slos: ["Identify place value up to thousands", "Read and write 4-digit numbers"] }] }] },
          { term: "Term 2", strands: [{ name: "Numbers", sub_strands: [{ name: "Division", slos: ["Divide up to 2-digit by 1-digit numbers", "Solve division word problems"] }] }] },
          { term: "Term 3", strands: [{ name: "Measurement", sub_strands: [{ name: "Time", slos: ["Read time on analogue and digital clocks", "Calculate duration of events"] }] }] }
        ]
      },
      {
        name: "Kiswahili",
        terms: [
          { term: "Term 1", strands: [{ name: "Kusoma", sub_strands: [{ name: "Ufahamu", slos: ["Kusoma vifungu vya habari", "Kujibu maswali ya ufahamu"] }] }] },
          { term: "Term 2", strands: [{ name: "Kuandika", sub_strands: [{ name: "Insha", slos: ["Kuandika insha fupi", "Kutumia alama za uakifishaji"] }] }] },
          { term: "Term 3", strands: [{ name: "Sarufi", sub_strands: [{ name: "Aina za Maneno", slos: ["Kutambua nomino katika sentensi", "Kutumia vitenzi kwa usahihi"] }] }] }
        ]
      }
    ]
  },
  {
    grade: "Grade 4",
    subjects: [
      {
        name: "Mathematics",
        terms: [
          {
            term: "Term 1",
            strands: [
              {
                name: "Numbers",
                sub_strands: [
                  { name: "Place Value", slos: ["Identify place value up to millions", "Write numbers in expanded form"] },
                  { name: "Operations", slos: ["Add and subtract numbers up to 6 digits", "Solve multi-step word problems"] }
                ]
              },
              { name: "Fractions", sub_strands: [{ name: "Proper Fractions", slos: ["Identify proper fractions", "Compare and order fractions"] }] }
            ]
          },
          { term: "Term 2", strands: [{ name: "Numbers", sub_strands: [{ name: "Multiplication", slos: ["Multiply up to 3-digit by 2-digit numbers", "Apply multiplication in real-life situations"] }] }] },
          { term: "Term 3", strands: [{ name: "Geometry", sub_strands: [{ name: "3D Shapes", slos: ["Identify properties of 3D shapes", "Draw nets of simple 3D shapes"] }] }] }
        ]
      },
      {
        name: "English",
        terms: [
          { term: "Term 1", strands: [{ name: "Reading", sub_strands: [{ name: "Comprehension", slos: ["Analyze texts for meaning", "Make inferences from passages"] }] }] },
          { term: "Term 2", strands: [{ name: "Writing", sub_strands: [{ name: "Composition", slos: ["Write structured compositions", "Use transitional words effectively"] }] }] },
          { term: "Term 3", strands: [{ name: "Grammar", sub_strands: [{ name: "Sentence Structure", slos: ["Construct compound sentences", "Use conjunctions correctly"] }] }] }
        ]
      },
      {
        name: "Science and Technology",
        terms: [
          { term: "Term 1", strands: [{ name: "Living Things", sub_strands: [{ name: "Plants", slos: ["Classify plants by characteristics", "Describe parts of a plant and their functions"] }] }] },
          { term: "Term 2", strands: [{ name: "Matter", sub_strands: [{ name: "States of Matter", slos: ["Identify states of matter", "Describe changes between states of matter"] }] }] },
          { term: "Term 3", strands: [{ name: "Energy", sub_strands: [{ name: "Heat Energy", slos: ["Identify sources of heat", "Describe effects of heat on matter"] }] }] }
        ]
      },
      {
        name: "Social Studies",
        terms: [
          { term: "Term 1", strands: [{ name: "Our County", sub_strands: [{ name: "Physical Features", slos: ["Identify physical features of the county", "Describe the climate of the county"] }] }] },
          { term: "Term 2", strands: [{ name: "People and Population", sub_strands: [{ name: "Population", slos: ["Describe population distribution", "Explain factors affecting population"] }] }] },
          { term: "Term 3", strands: [{ name: "Governance", sub_strands: [{ name: "Leadership", slos: ["Identify leaders in the county", "Describe roles of county leaders"] }] }] }
        ]
      }
    ]
  },
  {
    grade: "Grade 5",
    subjects: [
      {
        name: "Mathematics",
        terms: [
          { term: "Term 1", strands: [{ name: "Numbers", sub_strands: [{ name: "Decimals", slos: ["Read and write decimal numbers", "Convert fractions to decimals and vice versa"] }] }] },
          { term: "Term 2", strands: [{ name: "Measurement", sub_strands: [{ name: "Area", slos: ["Calculate area of regular shapes", "Solve problems involving area"] }] }] },
          { term: "Term 3", strands: [{ name: "Data Handling", sub_strands: [{ name: "Bar Graphs", slos: ["Draw bar graphs from given data", "Interpret information from bar graphs"] }] }] }
        ]
      },
      {
        name: "English",
        terms: [
          { term: "Term 1", strands: [{ name: "Reading", sub_strands: [{ name: "Critical Reading", slos: ["Distinguish fact from opinion", "Identify author's purpose"] }] }] },
          { term: "Term 2", strands: [{ name: "Writing", sub_strands: [{ name: "Narrative Writing", slos: ["Write narratives with a clear plot", "Develop characters in stories"] }] }] },
          { term: "Term 3", strands: [{ name: "Grammar", sub_strands: [{ name: "Punctuation", slos: ["Use commas, semicolons correctly", "Apply quotation marks in dialogue"] }] }] }
        ]
      },
      {
        name: "Science and Technology",
        terms: [
          { term: "Term 1", strands: [{ name: "Human Body", sub_strands: [{ name: "Digestive System", slos: ["Identify parts of the digestive system", "Describe the process of digestion"] }] }] },
          { term: "Term 2", strands: [{ name: "Forces", sub_strands: [{ name: "Magnetic Force", slos: ["Identify magnetic and non-magnetic materials", "Describe properties of magnets"] }] }] },
          { term: "Term 3", strands: [{ name: "Environment", sub_strands: [{ name: "Conservation", slos: ["Explain importance of environmental conservation", "Describe methods of conserving water"] }] }] }
        ]
      }
    ]
  },
  {
    grade: "Grade 6",
    subjects: [
      {
        name: "Mathematics",
        terms: [
          { term: "Term 1", strands: [{ name: "Numbers", sub_strands: [{ name: "Ratio and Proportion", slos: ["Identify ratios in real-life situations", "Solve problems involving direct proportion"] }] }] },
          { term: "Term 2", strands: [{ name: "Measurement", sub_strands: [{ name: "Volume", slos: ["Calculate volume of cuboids", "Solve real-life problems involving volume"] }] }] },
          { term: "Term 3", strands: [{ name: "Algebra", sub_strands: [{ name: "Simple Equations", slos: ["Solve simple linear equations", "Form equations from word problems"] }] }] }
        ]
      },
      {
        name: "English",
        terms: [
          { term: "Term 1", strands: [{ name: "Reading", sub_strands: [{ name: "Analytical Reading", slos: ["Analyze literary devices in texts", "Summarize passages accurately"] }] }] },
          { term: "Term 2", strands: [{ name: "Writing", sub_strands: [{ name: "Formal Writing", slos: ["Write formal letters correctly", "Use appropriate register in writing"] }] }] },
          { term: "Term 3", strands: [{ name: "Speaking", sub_strands: [{ name: "Public Speaking", slos: ["Present ideas clearly to an audience", "Use appropriate gestures and tone"] }] }] }
        ]
      }
    ]
  },
  {
    grade: "Grade 7",
    subjects: [
      {
        name: "Mathematics",
        terms: [
          {
            term: "Term 1",
            strands: [
              {
                name: "Numbers",
                sub_strands: [
                  { name: "Fractions", slos: ["Solve problems involving fractions", "Convert fractions to decimals"] },
                  { name: "Integers", slos: ["Perform operations on integers", "Apply integers in real-life contexts"] }
                ]
              },
              { name: "Algebra", sub_strands: [{ name: "Algebraic Expressions", slos: ["Simplify algebraic expressions", "Evaluate expressions by substitution"] }] }
            ]
          },
          { term: "Term 2", strands: [{ name: "Geometry", sub_strands: [{ name: "Angles", slos: ["Measure and classify angles", "Calculate unknown angles in geometric shapes"] }] }, { name: "Algebra", sub_strands: [{ name: "Linear Equations", slos: ["Solve linear equations in one variable", "Form and solve equations from word problems"] }] }] },
          { term: "Term 3", strands: [{ name: "Statistics", sub_strands: [{ name: "Data Collection", slos: ["Collect and organize data", "Represent data using frequency tables"] }] }] }
        ]
      },
      {
        name: "English",
        terms: [
          {
            term: "Term 1",
            strands: [
              {
                name: "Reading",
                sub_strands: [
                  { name: "Comprehension", slos: ["Identify main ideas in a passage", "Answer comprehension questions correctly"] },
                  { name: "Vocabulary", slos: ["Use context clues to determine word meaning", "Build vocabulary through reading"] }
                ]
              }
            ]
          },
          { term: "Term 2", strands: [{ name: "Writing", sub_strands: [{ name: "Essay Writing", slos: ["Write well-structured essays", "Develop arguments with supporting evidence"] }] }, { name: "Grammar", sub_strands: [{ name: "Complex Sentences", slos: ["Construct complex sentences correctly", "Use subordinating conjunctions"] }] }] },
          { term: "Term 3", strands: [{ name: "Literature", sub_strands: [{ name: "Poetry", slos: ["Analyze poetic devices and techniques", "Interpret meaning in poems"] }] }] }
        ]
      },
      {
        name: "Kiswahili",
        terms: [
          { term: "Term 1", strands: [{ name: "Kusoma", sub_strands: [{ name: "Ufahamu wa Kina", slos: ["Kuchambua maandishi ya aina mbalimbali", "Kutoa maoni kuhusu habari zilizosomwa"] }] }] },
          { term: "Term 2", strands: [{ name: "Kuandika", sub_strands: [{ name: "Utungaji", slos: ["Kuandika insha za aina mbalimbali", "Kutumia lugha ya mkato na tamathali za usemi"] }] }] },
          { term: "Term 3", strands: [{ name: "Sarufi", sub_strands: [{ name: "Muundo wa Sentensi", slos: ["Kutunga sentensi changamano", "Kutumia viambishi kwa usahihi"] }] }] }
        ]
      },
      {
        name: "Integrated Science",
        terms: [
          { term: "Term 1", strands: [{ name: "Scientific Investigation", sub_strands: [{ name: "The Scientific Method", slos: ["Apply steps of scientific investigation", "Design simple experiments"] }] }] },
          { term: "Term 2", strands: [{ name: "Matter", sub_strands: [{ name: "Mixtures and Solutions", slos: ["Differentiate between mixtures and compounds", "Separate mixtures using appropriate methods"] }] }] },
          { term: "Term 3", strands: [{ name: "Energy", sub_strands: [{ name: "Electrical Energy", slos: ["Describe components of a simple circuit", "Explain conductors and insulators"] }] }] }
        ]
      },
      {
        name: "Social Studies",
        terms: [
          { term: "Term 1", strands: [{ name: "Geography", sub_strands: [{ name: "Map Reading", slos: ["Interpret map symbols and keys", "Calculate distances using map scale"] }] }] },
          { term: "Term 2", strands: [{ name: "History", sub_strands: [{ name: "Early Communities", slos: ["Describe early communities in Kenya", "Explain migration patterns of Bantu communities"] }] }] },
          { term: "Term 3", strands: [{ name: "Citizenship", sub_strands: [{ name: "Democracy", slos: ["Explain principles of democracy", "Describe the electoral process in Kenya"] }] }] }
        ]
      }
    ]
  },
  {
    grade: "Grade 8",
    subjects: [
      {
        name: "Mathematics",
        terms: [
          { term: "Term 1", strands: [{ name: "Numbers", sub_strands: [{ name: "Indices and Logarithms", slos: ["Apply laws of indices", "Simplify expressions using indices"] }] }, { name: "Algebra", sub_strands: [{ name: "Quadratic Expressions", slos: ["Factorize quadratic expressions", "Expand algebraic expressions"] }] }] },
          { term: "Term 2", strands: [{ name: "Geometry", sub_strands: [{ name: "Circles", slos: ["Calculate circumference and area of circles", "Solve problems involving arcs and sectors"] }] }] },
          { term: "Term 3", strands: [{ name: "Statistics", sub_strands: [{ name: "Measures of Central Tendency", slos: ["Calculate mean, median, and mode", "Interpret statistical data"] }] }] }
        ]
      },
      {
        name: "English",
        terms: [
          { term: "Term 1", strands: [{ name: "Reading", sub_strands: [{ name: "Critical Analysis", slos: ["Evaluate arguments in written texts", "Identify bias and perspective in texts"] }] }] },
          { term: "Term 2", strands: [{ name: "Writing", sub_strands: [{ name: "Research Writing", slos: ["Write research reports with citations", "Organize research findings logically"] }] }] },
          { term: "Term 3", strands: [{ name: "Literature", sub_strands: [{ name: "Prose", slos: ["Analyze character development in novels", "Discuss themes in literary works"] }] }] }
        ]
      },
      {
        name: "Integrated Science",
        terms: [
          { term: "Term 1", strands: [{ name: "Biology", sub_strands: [{ name: "Cell Biology", slos: ["Describe cell structure and function", "Differentiate between plant and animal cells"] }] }] },
          { term: "Term 2", strands: [{ name: "Chemistry", sub_strands: [{ name: "Chemical Reactions", slos: ["Identify types of chemical reactions", "Balance simple chemical equations"] }] }] },
          { term: "Term 3", strands: [{ name: "Physics", sub_strands: [{ name: "Motion", slos: ["Describe types of motion", "Calculate speed, distance, and time"] }] }] }
        ]
      }
    ]
  },
  {
    grade: "Grade 9",
    subjects: [
      {
        name: "Mathematics",
        terms: [
          { term: "Term 1", strands: [{ name: "Algebra", sub_strands: [{ name: "Simultaneous Equations", slos: ["Solve simultaneous equations by substitution", "Solve simultaneous equations by elimination"] }] }, { name: "Trigonometry", sub_strands: [{ name: "Trigonometric Ratios", slos: ["Define sine, cosine, and tangent ratios", "Apply trigonometric ratios to solve problems"] }] }] },
          { term: "Term 2", strands: [{ name: "Geometry", sub_strands: [{ name: "Transformations", slos: ["Perform translations, reflections, and rotations", "Describe transformation properties"] }] }] },
          { term: "Term 3", strands: [{ name: "Statistics", sub_strands: [{ name: "Probability", slos: ["Calculate probability of simple events", "Apply probability in real-life situations"] }] }] }
        ]
      },
      {
        name: "English",
        terms: [
          { term: "Term 1", strands: [{ name: "Reading", sub_strands: [{ name: "Advanced Comprehension", slos: ["Synthesize information from multiple texts", "Evaluate credibility of sources"] }] }] },
          { term: "Term 2", strands: [{ name: "Writing", sub_strands: [{ name: "Argumentative Writing", slos: ["Write persuasive essays with clear thesis", "Counter opposing arguments effectively"] }] }] },
          { term: "Term 3", strands: [{ name: "Literature", sub_strands: [{ name: "Drama", slos: ["Analyze dramatic techniques and conventions", "Discuss themes and conflicts in plays"] }] }] }
        ]
      },
      {
        name: "Integrated Science",
        terms: [
          { term: "Term 1", strands: [{ name: "Biology", sub_strands: [{ name: "Reproduction", slos: ["Describe human reproductive system", "Explain the process of fertilization and development"] }] }] },
          { term: "Term 2", strands: [{ name: "Chemistry", sub_strands: [{ name: "Periodic Table", slos: ["Describe organization of the periodic table", "Predict properties of elements based on position"] }] }] },
          { term: "Term 3", strands: [{ name: "Physics", sub_strands: [{ name: "Waves", slos: ["Describe properties of waves", "Differentiate between transverse and longitudinal waves"] }] }] }
        ]
      }
    ]
  }
];

// Helper functions
export function getGrades(): string[] {
  return cbcCurriculum.map(g => g.grade);
}

export function getSubjects(grade: string): string[] {
  const g = cbcCurriculum.find(g => g.grade === grade);
  return g ? g.subjects.map(s => s.name) : [];
}

export function getTerms(grade: string, subject: string): string[] {
  const g = cbcCurriculum.find(g => g.grade === grade);
  const s = g?.subjects.find(s => s.name === subject);
  return s ? s.terms.map(t => t.term) : [];
}

export function getStrands(grade: string, subject: string, term: string): string[] {
  const g = cbcCurriculum.find(g => g.grade === grade);
  const s = g?.subjects.find(s => s.name === subject);
  const t = s?.terms.find(t => t.term === term);
  return t ? t.strands.map(st => st.name) : [];
}

export function getSubStrands(grade: string, subject: string, term: string, strand: string): string[] {
  const g = cbcCurriculum.find(g => g.grade === grade);
  const s = g?.subjects.find(s => s.name === subject);
  const t = s?.terms.find(t => t.term === term);
  const st = t?.strands.find(st => st.name === strand);
  return st ? st.sub_strands.map(ss => ss.name) : [];
}

export function getSLOs(grade: string, subject: string, term: string, strand: string, subStrand: string): string[] {
  const g = cbcCurriculum.find(g => g.grade === grade);
  const s = g?.subjects.find(s => s.name === subject);
  const t = s?.terms.find(t => t.term === term);
  const st = t?.strands.find(st => st.name === strand);
  const ss = st?.sub_strands.find(ss => ss.name === subStrand);
  return ss ? ss.slos : [];
}

export function getAllStrandsForTerm(grade: string, subject: string, term: string): StrandEntry[] {
  const g = cbcCurriculum.find(g => g.grade === grade);
  const s = g?.subjects.find(s => s.name === subject);
  const t = s?.terms.find(t => t.term === term);
  return t?.strands || [];
}
