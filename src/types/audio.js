module.exports = { id: "audio", label: "Voice", icon: "mic", match: (p, f) => p.mediaKinds.has("audio") || !!(f && f.byKind("audio").length) };
