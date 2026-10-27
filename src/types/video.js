module.exports = { id: "video", label: "Video", icon: "video", match: (p, f) => p.mediaKinds.has("video") || !!(f && f.byKind("video").length) };
