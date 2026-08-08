import type { AppData, StudySet, Term } from "./types";

export const uid = () =>
  (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now());

function mkTerms(pairs: [string, string][]): Term[] {
  return pairs.map(([term, definition]) => ({ id: uid(), term, definition }));
}

const now = Date.now();

function set(
  partial: Omit<StudySet, "id" | "createdAt" | "updatedAt" | "authorId" | "folderIds" | "visibility">
): StudySet {
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    authorId: "u_me",
    folderIds: [],
    visibility: "public",
    ...partial,
  };
}

export function buildSeed(): AppData {
  const spanish = set({
    title: "Spanish 101 — Common Verbs",
    description: "The 30 most common Spanish verbs for beginners.",
    authorName: "quizlet_official",
    subject: "Languages",
    termLang: "es",
    defLang: "en",
    terms: mkTerms([
      ["ser", "to be (permanent)"],
      ["estar", "to be (temporary)"],
      ["tener", "to have"],
      ["hacer", "to do / to make"],
      ["ir", "to go"],
      ["poder", "to be able to / can"],
      ["decir", "to say / to tell"],
      ["ver", "to see"],
      ["dar", "to give"],
      ["saber", "to know (facts)"],
      ["querer", "to want / to love"],
      ["llegar", "to arrive"],
      ["pasar", "to pass / to happen"],
      ["deber", "must / to owe"],
      ["poner", "to put / to place"],
      ["parecer", "to seem"],
      ["quedar", "to stay / to remain"],
      ["creer", "to believe"],
      ["hablar", "to speak"],
      ["llevar", "to carry / to wear"],
      ["dejar", "to leave / to let"],
      ["seguir", "to follow / to continue"],
      ["encontrar", "to find"],
      ["llamar", "to call"],
      ["venir", "to come"],
      ["pensar", "to think"],
      ["salir", "to leave / to go out"],
      ["volver", "to return"],
      ["conocer", "to know (people)"],
      ["vivir", "to live"],
    ]),
  });

  const bio = set({
    title: "Biology — Cell Organelles",
    description: "Parts of the eukaryotic cell and their functions.",
    authorName: "mr_dawson_bio",
    subject: "Science",
    termLang: "en",
    defLang: "en",
    terms: mkTerms([
      ["Nucleus", "Contains DNA and controls cell activities"],
      ["Mitochondria", "Powerhouse of the cell; produces ATP"],
      ["Ribosome", "Site of protein synthesis"],
      ["Endoplasmic Reticulum", "Transports materials through the cell"],
      ["Golgi Apparatus", "Modifies, sorts, and packages proteins"],
      ["Lysosome", "Contains digestive enzymes; breaks down waste"],
      ["Chloroplast", "Site of photosynthesis in plant cells"],
      ["Cell Membrane", "Controls what enters and leaves the cell"],
      ["Cell Wall", "Rigid outer layer in plant cells"],
      ["Cytoplasm", "Jelly-like fluid where organelles are suspended"],
      ["Vacuole", "Stores water, nutrients, and waste"],
      ["Nucleolus", "Produces ribosomes inside the nucleus"],
    ]),
  });

  const history = set({
    title: "US History — Founding Documents",
    description: "Key American founding documents and dates.",
    authorName: "apush_ace",
    subject: "History",
    termLang: "en",
    defLang: "en",
    terms: mkTerms([
      ["Declaration of Independence", "1776 — declared the colonies free from Britain"],
      ["Articles of Confederation", "1781 — first US constitution; weak central govt"],
      ["Constitution", "1787 — established the framework of US government"],
      ["Bill of Rights", "1791 — first 10 amendments protecting liberties"],
      ["Federalist Papers", "1788 — essays supporting ratification"],
      ["Emancipation Proclamation", "1863 — freed slaves in Confederate states"],
      ["13th Amendment", "1865 — abolished slavery"],
      ["Louisiana Purchase", "1803 — doubled the size of the US"],
    ]),
  });

  const cs = set({
    title: "Computer Science — Big-O Notation",
    description: "Time complexity classes from fastest to slowest.",
    authorName: "leet_lucy",
    subject: "Computer Science",
    termLang: "en",
    defLang: "en",
    terms: mkTerms([
      ["O(1)", "Constant time — independent of input size"],
      ["O(log n)", "Logarithmic — binary search"],
      ["O(n)", "Linear — single loop over input"],
      ["O(n log n)", "Linearithmic — merge sort, quicksort avg"],
      ["O(n²)", "Quadratic — nested loops, bubble sort"],
      ["O(2ⁿ)", "Exponential — naive recursive Fibonacci"],
      ["O(n!)", "Factorial — brute-force traveling salesman"],
    ]),
  });

  const sets = [spanish, bio, history, cs];

  return {
    user: {
      id: "u_me",
      username: "you",
      name: "You",
      avatarColor: "#4255ff",
      isPlus: false,
      streak: 3,
    },
    sets,
    folders: [
      { id: "f_lang", name: "Languages", setIds: [spanish.id], createdAt: now },
      { id: "f_stem", name: "STEM", setIds: [bio.id, cs.id], createdAt: now },
    ],
    classes: [
      {
        id: "c_1",
        name: "Period 3 — Biology",
        school: "Lincoln High",
        setIds: [bio.id],
        memberCount: 28,
        createdAt: now,
      },
    ],
    stats: {},
    recentSetIds: [spanish.id, bio.id],
    settings: { dark: false, soundOn: true, autoplayFlashcards: false },
  };
}
