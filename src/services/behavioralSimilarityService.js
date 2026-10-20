const STOP_WORDS = new Set(["the","and","for","that","this","with","you","your","are","was","have","from","will","not","please","hello","thanks","can","could","would","what","when","where","how","our","they","them","then","there","here","about","into","just","like","want","need"]);

function fingerprint(messages) {
    const terms = new Set();
    const phrases = new Set();
    for (const message of (Array.isArray(messages) ? messages : []).slice(0, 100)) {
        if (typeof message !== "string") continue;
        const tokens = message.toLowerCase().normalize("NFKC").match(/[a-z0-9]{3,}/g) || [];
        const clean = tokens.filter((token) => !STOP_WORDS.has(token)).slice(0, 300);
        clean.forEach((token) => terms.add(token));
        for (let i = 0; i < clean.length - 1; i += 1) phrases.add(clean[i] + " " + clean[i + 1]);
    }
    return { terms: [...terms].sort(), phrases: [...phrases].sort() };
}

function compareFingerprints(left, right) {
    const a = new Set(left?.terms || []);
    const b = new Set(right?.terms || []);
    if (!a.size || !b.size) return { score: 0, sharedTerms: [], sharedCount: 0, unionCount: a.size + b.size };
    const sharedTerms = [...a].filter((term) => b.has(term)).sort();
    const unionCount = new Set([...a, ...b]).size;
    return {
        score: Number((sharedTerms.length / unionCount).toFixed(4)),
        sharedTerms: sharedTerms.slice(0, 20),
        sharedCount: sharedTerms.length,
        unionCount
    };
}

module.exports = { fingerprint, compareFingerprints };
