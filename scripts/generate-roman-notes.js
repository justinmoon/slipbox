#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import path from "path";
import crypto from "crypto";

// Use SLIPBOX_DATA_DIR from environment
const dataDir = process.env.SLIPBOX_DATA_DIR || "/tmp/slipbox-data";
const dbPath = path.join(dataDir, "slipbox.db");

// Roman Empire themed notes content
const romanNotes = [
  {
    title: "The Founding of Rome",
    content:
      "According to legend, Rome was founded in 753 BCE by Romulus and Remus, twin brothers raised by a she-wolf. Archaeological evidence suggests the area was inhabited much earlier, with settlements dating back to at least 1000 BCE. The strategic location on seven hills along the Tiber River made it an ideal site for a city that would eventually rule the Mediterranean world.",
  },
  {
    title: "Julius Caesar's Assassination",
    content:
      "On the Ides of March (March 15), 44 BCE, Julius Caesar was assassinated by a group of senators led by Brutus and Cassius. The conspirators believed they were saving the Republic from tyranny, but Caesar's death actually hastened its end. The power vacuum led to civil wars and ultimately the establishment of the Empire under Augustus.",
  },
  {
    title: "Augustus and the Pax Romana",
    content:
      "Augustus, originally named Octavian, became Rome's first emperor in 27 BCE. His reign marked the beginning of the Pax Romana, a period of relative peace and stability that lasted approximately 200 years. During this time, Roman culture, law, and infrastructure spread throughout the empire, creating a shared identity across diverse populations.",
  },
  {
    title: "The Roman Legion",
    content:
      "The backbone of Roman military power was the legion, typically consisting of 4,000-6,000 heavy infantry. Legionaries were professional soldiers who served for 25 years, receiving land grants upon retirement. Their discipline, training, and innovative tactics made them nearly invincible for centuries. The famous 'testudo' (tortoise) formation provided excellent protection against arrows.",
  },
  {
    title: "Roman Engineering Marvels",
    content:
      "Roman engineers created lasting monuments to their civilization. The aqueduct system brought fresh water to cities from distant sources, some still functioning today. The road network, totaling over 250,000 miles, connected the empire with the phrase 'all roads lead to Rome' becoming literal truth. The Pantheon's concrete dome remains the world's largest unreinforced concrete dome.",
  },
  {
    title: "Gladiatorial Games",
    content:
      "The gladiatorial games served both as entertainment and political tool. Emperors used them to gain popularity and demonstrate power. The Colosseum, completed in 80 CE, could hold 50,000 spectators. Contrary to popular belief, gladiatorial fights were not always to the death - trained gladiators were expensive investments, and many survived multiple bouts.",
  },
  {
    title: "The Fall of the Western Empire",
    content:
      "The Western Roman Empire fell in 476 CE when Germanic chieftain Odoacer deposed the last emperor, Romulus Augustulus. However, the collapse was gradual, caused by multiple factors: economic troubles, military pressure from barbarian tribes, administrative corruption, and the rise of Christianity changing traditional Roman values. The Eastern Empire continued as Byzantium for another thousand years.",
  },
  {
    title: "Roman Law and Governance",
    content:
      "Roman law forms the foundation of many modern legal systems. The Twelve Tables (450 BCE) were the first written laws, ensuring legal transparency. Later, the Corpus Juris Civilis compiled under Justinian became the basis for civil law tradition. Concepts like 'innocent until proven guilty' and legal representation originated in Roman courts.",
  },
  {
    title: "Daily Life in Ancient Rome",
    content:
      "Most Romans lived in insulae, multi-story apartment buildings often poorly constructed and prone to fires. The wealthy lived in domus, single-family homes with central courtyards. Public baths were social centers where business was conducted. The Roman diet consisted mainly of grain, olive oil, and wine, with garum (fermented fish sauce) as a popular condiment.",
  },
  {
    title: "Marcus Aurelius - The Philosopher Emperor",
    content:
      "Marcus Aurelius (161-180 CE) was the last of the Five Good Emperors. His 'Meditations,' written during military campaigns, remains influential in Stoic philosophy. Despite being a peaceful philosopher, he spent most of his reign defending the empire's borders. His death marked the end of the Pax Romana, as his son Commodus proved an incompetent and cruel successor.",
  },
  {
    title: "The Roman Economy",
    content:
      "Rome's economy was sophisticated for its time, with banking, credit, and even an early form of corporation (societas). Trade networks extended from Britain to China via the Silk Road. The denarius served as common currency throughout the empire. However, later debasement of currency contributed to economic crisis and inflation in the 3rd century.",
  },
  {
    title: "Roman Religion and Mythology",
    content:
      "Roman religion was initially polytheistic, adopting many Greek gods with Latin names. The imperial cult deified emperors, serving as a unifying political force. Mystery cults like Mithraism competed with traditional religion. Christianity's rise fundamentally transformed the empire - from persecution under Nero to state religion under Constantine.",
  },
  {
    title: "Pompeii - A City Frozen in Time",
    content:
      "The eruption of Mount Vesuvius in 79 CE preserved Pompeii under volcanic ash, providing an unprecedented glimpse into Roman life. Excavations reveal everything from political graffiti to fast-food counters (thermopolia). The plaster casts of victims, created by pouring plaster into voids left by decomposed bodies, provide haunting testimony to the disaster's sudden violence.",
  },
  {
    title: "Roman Military Conquest Strategy",
    content:
      "Rome's expansion followed a pattern: conquer, consolidate, Romanize. After military victory, Romans built infrastructure, established colonies of veterans, and gradually extended citizenship rights. Local elites were co-opted into Roman administration. This strategy created stakeholders in Roman success, making rebellions less likely and creating a sustainable empire.",
  },
  {
    title: "The Praetorian Guard",
    content:
      "Created by Augustus as an elite unit to protect the emperor, the Praetorian Guard became kingmakers and king-slayers. They assassinated numerous emperors and auctioned the position to the highest bidder in 193 CE. Their political influence often destabilized the empire until Constantine disbanded them in 312 CE after they backed his rival Maxentius.",
  },
  {
    title: "Roman Architecture and Concrete",
    content:
      "Roman concrete (opus caementicium) revolutionized architecture. Unlike modern concrete, it actually grew stronger over time due to volcanic ash creating mineral growth when exposed to seawater. This enabled structures like the Pantheon's dome and massive harbor installations. The invention of the arch and vault allowed Romans to build on an unprecedented scale.",
  },
  {
    title: "Bread and Circuses",
    content:
      "'Panem et circenses' - bread and circuses - described the strategy of appeasing Rome's masses with free grain distributions and entertainment. By the 2nd century, 200,000 Romans received free grain. This policy prevented unrest but created dependency and enormous state expense. Some historians argue this contributed to the empire's eventual economic collapse.",
  },
  {
    title: "Hannibal and the Punic Wars",
    content:
      "Hannibal Barca's crossing of the Alps with war elephants in 218 BCE remains one of history's boldest military maneuvers. During the Second Punic War, he won stunning victories at Cannae and Lake Trasimene, bringing Rome to the brink of defeat. However, Scipio Africanus ultimately defeated him at Zama in 202 BCE, securing Roman dominance over the Mediterranean.",
  },
  {
    title: "Roman Citizenship",
    content:
      "Roman citizenship was initially exclusive but gradually extended throughout the empire. Citizens had legal rights including trial, property ownership, and marriage recognition. The Constitutio Antoniniana in 212 CE granted citizenship to all free inhabitants, completing a process that transformed 'Roman' from ethnic to legal identity.",
  },
  {
    title: "Constantine and Christianity",
    content:
      "Constantine's conversion to Christianity after the Battle of Milvian Bridge (312 CE) transformed both empire and religion. The Edict of Milan legalized Christianity, ending persecution. He convened the Council of Nicaea to address doctrinal disputes. His new capital, Constantinople, became 'New Rome,' shifting the empire's center eastward.",
  },
  {
    title: "Roman Women and Society",
    content:
      "Roman women had more rights than their Greek counterparts but remained legally subordinate to men. Wealthy women could own property, run businesses, and influence politics behind the scenes. Famous women like Livia (Augustus's wife) and Agrippina (Nero's mother) wielded significant power. Lower-class women worked in various trades, from midwifery to tavern-keeping.",
  },
  {
    title: "The Crisis of the Third Century",
    content:
      "From 235-284 CE, the empire nearly collapsed. Fifty emperors ruled in fifty years, most dying violently. Plague, economic crisis, and barbarian invasions created chaos. The empire split into three parts temporarily. Diocletian's reforms (284 CE) stabilized the situation through administrative division (the Tetrarchy) and economic controls.",
  },
  {
    title: "Roman Medicine and Public Health",
    content:
      "Romans made significant medical advances, particularly in military surgery and public health. They built extensive sewer systems (like the Cloaca Maxima), public latrines, and hospitals. Military medics developed surgical tools remarkably similar to modern instruments. Galen's anatomical work remained authoritative for over a millennium, though his reliance on animal dissection led to some errors.",
  },
  {
    title: "Spartacus and the Slave Revolts",
    content:
      "Spartacus led the largest slave rebellion (73-71 BCE) in Roman history. Starting with 70 gladiators, his army grew to 120,000. For two years, they defeated Roman armies and threatened Rome itself. Crassus finally crushed the rebellion, crucifying 6,000 survivors along the Appian Way. The revolt highlighted Rome's dependence on slave labor and the system's inherent instability.",
  },
  {
    title: "Latin's Lasting Legacy",
    content:
      "Latin evolved into Romance languages (Italian, Spanish, French, Portuguese, Romanian) spoken by 800 million people today. It remained the language of scholarship, law, and the Catholic Church for centuries. Scientific nomenclature still uses Latin. Common phrases like 'et cetera,' 'vice versa,' and 'quid pro quo' demonstrate Latin's continued presence in modern English.",
  },
];

function generateNoteId() {
  return crypto.randomBytes(16).toString("hex");
}

function countWords(text) {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

function countChars(text) {
  return text.length;
}

try {
  // Open database
  const db = new Database(dbPath);

  // Prepare statements
  const insertNote = db.prepare(`
    INSERT INTO notes (id, content, created_at, updated_at, word_count, char_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertSearch = db.prepare(`
    INSERT INTO note_search_index (id, content)
    VALUES (?, ?)
  `);

  const now = Date.now();

  // Insert all 25 notes
  for (let i = 0; i < 25 && i < romanNotes.length; i++) {
    const note = romanNotes[i];
    const noteId = generateNoteId();
    const content = `# ${note.title}\n\n${note.content}`;
    const wordCount = countWords(content);
    const charCount = countChars(content);

    // Stagger creation times slightly
    const createdAt = now - (25 - i) * 60000; // Each note 1 minute apart

    insertNote.run(noteId, content, createdAt, createdAt, wordCount, charCount);
    insertSearch.run(noteId, content);
  }

  db.close();
  console.log("   Successfully generated 25 Roman Empire themed notes");
} catch (err) {
  console.error("Error generating notes:", err.message);
  process.exit(1);
}
