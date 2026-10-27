module.exports = { id: "image", label: "Photo", icon: "image", match: (p, f) => p.mediaKinds.has("image") || !!(f && f.byKind("image").length) };
