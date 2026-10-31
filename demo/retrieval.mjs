const stopWords = new Set("a an and are as at be been being by can could describe do does for from had has have how if in into is it its listed may of on or our provide report reported reports say says should simulated some standard summarize than that the their these they this those to used using was were what when where which who why will with would you your according available corpus ocean pavilion project question rfi seattle aquarium".split(" "));

function terms(text) {
  return (text.normalize("NFKD").toLowerCase().replace(/(\d),(?=\d)/g, "$1").match(/[a-z0-9]+/g) || [])
    .map(term => term.length > 4 && term.endsWith("ies") ? term.slice(0, -3) + "y" : term.length > 3 && term.endsWith("s") && !term.endsWith("ss") ? term.slice(0, -1) : term)
    .filter(term => term.length > 1 && !stopWords.has(term));
}

export function retrievePassages(question, documents, limit = 4) {
  const started = performance.now();
  const aliases = { capacity: ["gallon", "volume"], strength: ["psi", "mpa"], rebar: ["reinforcement", "reinforcing"], reinforcement: ["reinforcing", "rebar"] };
  const originalTerms = [...new Set(terms(question))];
  const queryTerms = [...new Set(originalTerms.flatMap(term => [term, ...(aliases[term] || [])]))];
  const indexed = documents.map(document => ({
    document,
    fields: [
      { tokens: terms(document.text), weight: 1 },
      { tokens: terms(document.topic), weight: 1.5 },
      { tokens: terms(document.publisher), weight: 1 },
      { tokens: terms(document.title), weight: 0.35 },
      { tokens: terms(document.limits), weight: 0.25 },
    ],
  }));
  const frequency = new Map(queryTerms.map(term => [term, indexed.filter(item => item.fields.some(field => field.tokens.includes(term))).length]));
  const ranked = indexed.map(({ document, fields }) => {
    let score = 0;
    const matchedTerms = [];
    for (const term of queryTerms) {
      let overlap = 0;
      for (const field of fields) {
        const count = field.tokens.filter(token => token === term).length;
        if (count) overlap += field.weight * (1 + Math.log(count));
      }
      if (overlap) {
        score += overlap * (1 + Math.log((documents.length + 1) / (frequency.get(term) + 1)));
        matchedTerms.push(term);
      }
    }
    return { ...document, score: Math.round(score * 1000) / 1000, matchedTerms };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return {
    method: "Weighted keyword overlap",
    version: "1.0",
    limit,
    queryTerms,
    candidateCount: ranked.length,
    candidates: ranked.map((item, index) => ({ id: item.id, rank: index + 1, score: item.score, selected: index < limit })),
    passages: ranked.slice(0, limit).map((item, index) => ({ ...item, rank: index + 1 })),
    durationMs: Math.round((performance.now() - started) * 100) / 100,
  };
}
