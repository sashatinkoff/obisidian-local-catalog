module.exports = { id: "canvas", label: "Canvas", icon: "share", match: (p, f) => p.mediaKinds.has("canvas") || !!(f && f.byKind("canvas").length) };
