// evals-baseline 1.0.0 (specification 1.0)
// Generated file. Do not edit. Rebuild with: node build/build.mjs

const printedRanges = [
  0x20, 0x7e, 0xa1, 0xac, 0xae, 0x34e, 0x350, 0x377, 0x37a, 0x37f, 0x384, 0x38a,
  0x38c, 0x38c, 0x38e, 0x3a1, 0x3a3, 0x52f, 0x531, 0x556, 0x559, 0x58a, 0x58d, 0x58f,
  0x591, 0x5c7, 0x5d0, 0x5ea, 0x5ef, 0x5f4, 0x606, 0x61b, 0x61d, 0x6dc, 0x6de, 0x70d,
  0x710, 0x74a, 0x74d, 0x7b1, 0x7c0, 0x7fa, 0x7fd, 0x82d, 0x830, 0x83e, 0x840, 0x85b,
  0x85e, 0x85e, 0x860, 0x86a, 0x870, 0x88e, 0x898, 0x8e1, 0x8e3, 0x983, 0x985, 0x98c,
  0x98f, 0x990, 0x993, 0x9a8, 0x9aa, 0x9b0, 0x9b2, 0x9b2, 0x9b6, 0x9b9, 0x9bc, 0x9c4,
  0x9c7, 0x9c8, 0x9cb, 0x9ce, 0x9d7, 0x9d7, 0x9dc, 0x9dd, 0x9df, 0x9e3, 0x9e6, 0x9fe,
  0xa01, 0xa03, 0xa05, 0xa0a, 0xa0f, 0xa10, 0xa13, 0xa28, 0xa2a, 0xa30, 0xa32, 0xa33,
  0xa35, 0xa36, 0xa38, 0xa39, 0xa3c, 0xa3c, 0xa3e, 0xa42, 0xa47, 0xa48, 0xa4b, 0xa4d,
  0xa51, 0xa51, 0xa59, 0xa5c, 0xa5e, 0xa5e, 0xa66, 0xa76, 0xa81, 0xa83, 0xa85, 0xa8d,
  0xa8f, 0xa91, 0xa93, 0xaa8, 0xaaa, 0xab0, 0xab2, 0xab3, 0xab5, 0xab9, 0xabc, 0xac5,
  0xac7, 0xac9, 0xacb, 0xacd, 0xad0, 0xad0, 0xae0, 0xae3, 0xae6, 0xaf1, 0xaf9, 0xaff,
  0xb01, 0xb03, 0xb05, 0xb0c, 0xb0f, 0xb10, 0xb13, 0xb28, 0xb2a, 0xb30, 0xb32, 0xb33,
  0xb35, 0xb39, 0xb3c, 0xb44, 0xb47, 0xb48, 0xb4b, 0xb4d, 0xb55, 0xb57, 0xb5c, 0xb5d,
  0xb5f, 0xb63, 0xb66, 0xb77, 0xb82, 0xb83, 0xb85, 0xb8a, 0xb8e, 0xb90, 0xb92, 0xb95,
  0xb99, 0xb9a, 0xb9c, 0xb9c, 0xb9e, 0xb9f, 0xba3, 0xba4, 0xba8, 0xbaa, 0xbae, 0xbb9,
  0xbbe, 0xbc2, 0xbc6, 0xbc8, 0xbca, 0xbcd, 0xbd0, 0xbd0, 0xbd7, 0xbd7, 0xbe6, 0xbfa,
  0xc00, 0xc0c, 0xc0e, 0xc10, 0xc12, 0xc28, 0xc2a, 0xc39, 0xc3c, 0xc44, 0xc46, 0xc48,
  0xc4a, 0xc4d, 0xc55, 0xc56, 0xc58, 0xc5a, 0xc5d, 0xc5d, 0xc60, 0xc63, 0xc66, 0xc6f,
  0xc77, 0xc8c, 0xc8e, 0xc90, 0xc92, 0xca8, 0xcaa, 0xcb3, 0xcb5, 0xcb9, 0xcbc, 0xcc4,
  0xcc6, 0xcc8, 0xcca, 0xccd, 0xcd5, 0xcd6, 0xcdd, 0xcde, 0xce0, 0xce3, 0xce6, 0xcef,
  0xcf1, 0xcf3, 0xd00, 0xd0c, 0xd0e, 0xd10, 0xd12, 0xd44, 0xd46, 0xd48, 0xd4a, 0xd4f,
  0xd54, 0xd63, 0xd66, 0xd7f, 0xd81, 0xd83, 0xd85, 0xd96, 0xd9a, 0xdb1, 0xdb3, 0xdbb,
  0xdbd, 0xdbd, 0xdc0, 0xdc6, 0xdca, 0xdca, 0xdcf, 0xdd4, 0xdd6, 0xdd6, 0xdd8, 0xddf,
  0xde6, 0xdef, 0xdf2, 0xdf4, 0xe01, 0xe3a, 0xe3f, 0xe5b, 0xe81, 0xe82, 0xe84, 0xe84,
  0xe86, 0xe8a, 0xe8c, 0xea3, 0xea5, 0xea5, 0xea7, 0xebd, 0xec0, 0xec4, 0xec6, 0xec6,
  0xec8, 0xece, 0xed0, 0xed9, 0xedc, 0xedf, 0xf00, 0xf47, 0xf49, 0xf6c, 0xf71, 0xf97,
  0xf99, 0xfbc, 0xfbe, 0xfcc, 0xfce, 0xfda, 0x1000, 0x10c5, 0x10c7, 0x10c7, 0x10cd, 0x10cd,
  0x10d0, 0x115e, 0x1161, 0x1248, 0x124a, 0x124d, 0x1250, 0x1256, 0x1258, 0x1258, 0x125a, 0x125d,
  0x1260, 0x1288, 0x128a, 0x128d, 0x1290, 0x12b0, 0x12b2, 0x12b5, 0x12b8, 0x12be, 0x12c0, 0x12c0,
  0x12c2, 0x12c5, 0x12c8, 0x12d6, 0x12d8, 0x1310, 0x1312, 0x1315, 0x1318, 0x135a, 0x135d, 0x137c,
  0x1380, 0x1399, 0x13a0, 0x13f5, 0x13f8, 0x13fd, 0x1400, 0x167f, 0x1681, 0x169c, 0x16a0, 0x16f8,
  0x1700, 0x1715, 0x171f, 0x1736, 0x1740, 0x1753, 0x1760, 0x176c, 0x176e, 0x1770, 0x1772, 0x1773,
  0x1780, 0x17b3, 0x17b6, 0x17dd, 0x17e0, 0x17e9, 0x17f0, 0x17f9, 0x1800, 0x180a, 0x1810, 0x1819,
  0x1820, 0x1878, 0x1880, 0x18aa, 0x18b0, 0x18f5, 0x1900, 0x191e, 0x1920, 0x192b, 0x1930, 0x193b,
  0x1940, 0x1940, 0x1944, 0x196d, 0x1970, 0x1974, 0x1980, 0x19ab, 0x19b0, 0x19c9, 0x19d0, 0x19da,
  0x19de, 0x1a1b, 0x1a1e, 0x1a5e, 0x1a60, 0x1a7c, 0x1a7f, 0x1a89, 0x1a90, 0x1a99, 0x1aa0, 0x1aad,
  0x1ab0, 0x1ace, 0x1b00, 0x1b4c, 0x1b50, 0x1b7e, 0x1b80, 0x1bf3, 0x1bfc, 0x1c37, 0x1c3b, 0x1c49,
  0x1c4d, 0x1c88, 0x1c90, 0x1cba, 0x1cbd, 0x1cc7, 0x1cd0, 0x1cfa, 0x1d00, 0x1f15, 0x1f18, 0x1f1d,
  0x1f20, 0x1f45, 0x1f48, 0x1f4d, 0x1f50, 0x1f57, 0x1f59, 0x1f59, 0x1f5b, 0x1f5b, 0x1f5d, 0x1f5d,
  0x1f5f, 0x1f7d, 0x1f80, 0x1fb4, 0x1fb6, 0x1fc4, 0x1fc6, 0x1fd3, 0x1fd6, 0x1fdb, 0x1fdd, 0x1fef,
  0x1ff2, 0x1ff4, 0x1ff6, 0x1ffe, 0x2010, 0x2027, 0x2030, 0x205e, 0x2070, 0x2071, 0x2074, 0x208e,
  0x2090, 0x209c, 0x20a0, 0x20c0, 0x20d0, 0x20f0, 0x2100, 0x218b, 0x2190, 0x2426, 0x2440, 0x244a,
  0x2460, 0x27ff, 0x2801, 0x2b73, 0x2b76, 0x2b95, 0x2b97, 0x2cf3, 0x2cf9, 0x2d25, 0x2d27, 0x2d27,
  0x2d2d, 0x2d2d, 0x2d30, 0x2d67, 0x2d6f, 0x2d70, 0x2d7f, 0x2d96, 0x2da0, 0x2da6, 0x2da8, 0x2dae,
  0x2db0, 0x2db6, 0x2db8, 0x2dbe, 0x2dc0, 0x2dc6, 0x2dc8, 0x2dce, 0x2dd0, 0x2dd6, 0x2dd8, 0x2dde,
  0x2de0, 0x2e5d, 0x2e80, 0x2e99, 0x2e9b, 0x2ef3, 0x2f00, 0x2fd5, 0x2ff0, 0x2fff, 0x3001, 0x303f,
  0x3041, 0x3096, 0x3099, 0x30ff, 0x3105, 0x312f, 0x3131, 0x3163, 0x3165, 0x318e, 0x3190, 0x31e3,
  0x31ef, 0x321e, 0x3220, 0xa48c, 0xa490, 0xa4c6, 0xa4d0, 0xa62b, 0xa640, 0xa6f7, 0xa700, 0xa7ca,
  0xa7d0, 0xa7d1, 0xa7d3, 0xa7d3, 0xa7d5, 0xa7d9, 0xa7f2, 0xa82c, 0xa830, 0xa839, 0xa840, 0xa877,
  0xa880, 0xa8c5, 0xa8ce, 0xa8d9, 0xa8e0, 0xa953, 0xa95f, 0xa97c, 0xa980, 0xa9cd, 0xa9cf, 0xa9d9,
  0xa9de, 0xa9fe, 0xaa00, 0xaa36, 0xaa40, 0xaa4d, 0xaa50, 0xaa59, 0xaa5c, 0xaac2, 0xaadb, 0xaaf6,
  0xab01, 0xab06, 0xab09, 0xab0e, 0xab11, 0xab16, 0xab20, 0xab26, 0xab28, 0xab2e, 0xab30, 0xab6b,
  0xab70, 0xabed, 0xabf0, 0xabf9, 0xac00, 0xd7a3, 0xd7b0, 0xd7c6, 0xd7cb, 0xd7fb, 0xf900, 0xfa6d,
  0xfa70, 0xfad9, 0xfb00, 0xfb06, 0xfb13, 0xfb17, 0xfb1d, 0xfb36, 0xfb38, 0xfb3c, 0xfb3e, 0xfb3e,
  0xfb40, 0xfb41, 0xfb43, 0xfb44, 0xfb46, 0xfbc2, 0xfbd3, 0xfd8f, 0xfd92, 0xfdc7, 0xfdcf, 0xfdcf,
  0xfdf0, 0xfdff, 0xfe10, 0xfe19, 0xfe20, 0xfe52, 0xfe54, 0xfe66, 0xfe68, 0xfe6b, 0xfe70, 0xfe74,
  0xfe76, 0xfefc, 0xff01, 0xff9f, 0xffa1, 0xffbe, 0xffc2, 0xffc7, 0xffca, 0xffcf, 0xffd2, 0xffd7,
  0xffda, 0xffdc, 0xffe0, 0xffe6, 0xffe8, 0xffee, 0xfffd, 0xfffd, 0x10000, 0x1000b, 0x1000d, 0x10026,
  0x10028, 0x1003a, 0x1003c, 0x1003d, 0x1003f, 0x1004d, 0x10050, 0x1005d, 0x10080, 0x100fa, 0x10100, 0x10102,
  0x10107, 0x10133, 0x10137, 0x1018e, 0x10190, 0x1019c, 0x101a0, 0x101a0, 0x101d0, 0x101fd, 0x10280, 0x1029c,
  0x102a0, 0x102d0, 0x102e0, 0x102fb, 0x10300, 0x10323, 0x1032d, 0x1034a, 0x10350, 0x1037a, 0x10380, 0x1039d,
  0x1039f, 0x103c3, 0x103c8, 0x103d5, 0x10400, 0x1049d, 0x104a0, 0x104a9, 0x104b0, 0x104d3, 0x104d8, 0x104fb,
  0x10500, 0x10527, 0x10530, 0x10563, 0x1056f, 0x1057a, 0x1057c, 0x1058a, 0x1058c, 0x10592, 0x10594, 0x10595,
  0x10597, 0x105a1, 0x105a3, 0x105b1, 0x105b3, 0x105b9, 0x105bb, 0x105bc, 0x10600, 0x10736, 0x10740, 0x10755,
  0x10760, 0x10767, 0x10780, 0x10785, 0x10787, 0x107b0, 0x107b2, 0x107ba, 0x10800, 0x10805, 0x10808, 0x10808,
  0x1080a, 0x10835, 0x10837, 0x10838, 0x1083c, 0x1083c, 0x1083f, 0x10855, 0x10857, 0x1089e, 0x108a7, 0x108af,
  0x108e0, 0x108f2, 0x108f4, 0x108f5, 0x108fb, 0x1091b, 0x1091f, 0x10939, 0x1093f, 0x1093f, 0x10980, 0x109b7,
  0x109bc, 0x109cf, 0x109d2, 0x10a03, 0x10a05, 0x10a06, 0x10a0c, 0x10a13, 0x10a15, 0x10a17, 0x10a19, 0x10a35,
  0x10a38, 0x10a3a, 0x10a3f, 0x10a48, 0x10a50, 0x10a58, 0x10a60, 0x10a9f, 0x10ac0, 0x10ae6, 0x10aeb, 0x10af6,
  0x10b00, 0x10b35, 0x10b39, 0x10b55, 0x10b58, 0x10b72, 0x10b78, 0x10b91, 0x10b99, 0x10b9c, 0x10ba9, 0x10baf,
  0x10c00, 0x10c48, 0x10c80, 0x10cb2, 0x10cc0, 0x10cf2, 0x10cfa, 0x10d27, 0x10d30, 0x10d39, 0x10e60, 0x10e7e,
  0x10e80, 0x10ea9, 0x10eab, 0x10ead, 0x10eb0, 0x10eb1, 0x10efd, 0x10f27, 0x10f30, 0x10f59, 0x10f70, 0x10f89,
  0x10fb0, 0x10fcb, 0x10fe0, 0x10ff6, 0x11000, 0x1104d, 0x11052, 0x11075, 0x1107f, 0x110bc, 0x110be, 0x110c2,
  0x110d0, 0x110e8, 0x110f0, 0x110f9, 0x11100, 0x11134, 0x11136, 0x11147, 0x11150, 0x11176, 0x11180, 0x111df,
  0x111e1, 0x111f4, 0x11200, 0x11211, 0x11213, 0x11241, 0x11280, 0x11286, 0x11288, 0x11288, 0x1128a, 0x1128d,
  0x1128f, 0x1129d, 0x1129f, 0x112a9, 0x112b0, 0x112ea, 0x112f0, 0x112f9, 0x11300, 0x11303, 0x11305, 0x1130c,
  0x1130f, 0x11310, 0x11313, 0x11328, 0x1132a, 0x11330, 0x11332, 0x11333, 0x11335, 0x11339, 0x1133b, 0x11344,
  0x11347, 0x11348, 0x1134b, 0x1134d, 0x11350, 0x11350, 0x11357, 0x11357, 0x1135d, 0x11363, 0x11366, 0x1136c,
  0x11370, 0x11374, 0x11400, 0x1145b, 0x1145d, 0x11461, 0x11480, 0x114c7, 0x114d0, 0x114d9, 0x11580, 0x115b5,
  0x115b8, 0x115dd, 0x11600, 0x11644, 0x11650, 0x11659, 0x11660, 0x1166c, 0x11680, 0x116b9, 0x116c0, 0x116c9,
  0x11700, 0x1171a, 0x1171d, 0x1172b, 0x11730, 0x11746, 0x11800, 0x1183b, 0x118a0, 0x118f2, 0x118ff, 0x11906,
  0x11909, 0x11909, 0x1190c, 0x11913, 0x11915, 0x11916, 0x11918, 0x11935, 0x11937, 0x11938, 0x1193b, 0x11946,
  0x11950, 0x11959, 0x119a0, 0x119a7, 0x119aa, 0x119d7, 0x119da, 0x119e4, 0x11a00, 0x11a47, 0x11a50, 0x11aa2,
  0x11ab0, 0x11af8, 0x11b00, 0x11b09, 0x11c00, 0x11c08, 0x11c0a, 0x11c36, 0x11c38, 0x11c45, 0x11c50, 0x11c6c,
  0x11c70, 0x11c8f, 0x11c92, 0x11ca7, 0x11ca9, 0x11cb6, 0x11d00, 0x11d06, 0x11d08, 0x11d09, 0x11d0b, 0x11d36,
  0x11d3a, 0x11d3a, 0x11d3c, 0x11d3d, 0x11d3f, 0x11d44, 0x11d46, 0x11d47, 0x11d50, 0x11d59, 0x11d60, 0x11d65,
  0x11d67, 0x11d68, 0x11d6a, 0x11d8e, 0x11d90, 0x11d91, 0x11d93, 0x11d96, 0x11d98, 0x11d98, 0x11da0, 0x11da9,
  0x11ee0, 0x11ef8, 0x11f00, 0x11f10, 0x11f12, 0x11f3a, 0x11f3e, 0x11f59, 0x11fb0, 0x11fb0, 0x11fc0, 0x11ff1,
  0x11fff, 0x12399, 0x12400, 0x1246e, 0x12470, 0x12474, 0x12480, 0x12543, 0x12f90, 0x12ff2, 0x13000, 0x1342f,
  0x13440, 0x13440, 0x13443, 0x13455, 0x14400, 0x14646, 0x16800, 0x16a38, 0x16a40, 0x16a5e, 0x16a60, 0x16a69,
  0x16a6e, 0x16abe, 0x16ac0, 0x16ac9, 0x16ad0, 0x16aed, 0x16af0, 0x16af5, 0x16b00, 0x16b45, 0x16b50, 0x16b59,
  0x16b5b, 0x16b61, 0x16b63, 0x16b77, 0x16b7d, 0x16b8f, 0x16e40, 0x16e9a, 0x16f00, 0x16f4a, 0x16f4f, 0x16f87,
  0x16f8f, 0x16f9f, 0x16fe0, 0x16fe3, 0x16ff0, 0x16ff1, 0x17000, 0x187f7, 0x18800, 0x18cd5, 0x18d00, 0x18d08,
  0x1aff0, 0x1aff3, 0x1aff5, 0x1affb, 0x1affd, 0x1affe, 0x1b000, 0x1b122, 0x1b132, 0x1b132, 0x1b150, 0x1b152,
  0x1b155, 0x1b155, 0x1b164, 0x1b167, 0x1b170, 0x1b2fb, 0x1bc00, 0x1bc6a, 0x1bc70, 0x1bc7c, 0x1bc80, 0x1bc88,
  0x1bc90, 0x1bc99, 0x1bc9c, 0x1bc9f, 0x1cf00, 0x1cf2d, 0x1cf30, 0x1cf46, 0x1cf50, 0x1cfc3, 0x1d000, 0x1d0f5,
  0x1d100, 0x1d126, 0x1d129, 0x1d172, 0x1d17b, 0x1d1ea, 0x1d200, 0x1d245, 0x1d2c0, 0x1d2d3, 0x1d2e0, 0x1d2f3,
  0x1d300, 0x1d356, 0x1d360, 0x1d378, 0x1d400, 0x1d454, 0x1d456, 0x1d49c, 0x1d49e, 0x1d49f, 0x1d4a2, 0x1d4a2,
  0x1d4a5, 0x1d4a6, 0x1d4a9, 0x1d4ac, 0x1d4ae, 0x1d4b9, 0x1d4bb, 0x1d4bb, 0x1d4bd, 0x1d4c3, 0x1d4c5, 0x1d505,
  0x1d507, 0x1d50a, 0x1d50d, 0x1d514, 0x1d516, 0x1d51c, 0x1d51e, 0x1d539, 0x1d53b, 0x1d53e, 0x1d540, 0x1d544,
  0x1d546, 0x1d546, 0x1d54a, 0x1d550, 0x1d552, 0x1d6a5, 0x1d6a8, 0x1d7cb, 0x1d7ce, 0x1da8b, 0x1da9b, 0x1da9f,
  0x1daa1, 0x1daaf, 0x1df00, 0x1df1e, 0x1df25, 0x1df2a, 0x1e000, 0x1e006, 0x1e008, 0x1e018, 0x1e01b, 0x1e021,
  0x1e023, 0x1e024, 0x1e026, 0x1e02a, 0x1e030, 0x1e06d, 0x1e08f, 0x1e08f, 0x1e100, 0x1e12c, 0x1e130, 0x1e13d,
  0x1e140, 0x1e149, 0x1e14e, 0x1e14f, 0x1e290, 0x1e2ae, 0x1e2c0, 0x1e2f9, 0x1e2ff, 0x1e2ff, 0x1e4d0, 0x1e4f9,
  0x1e7e0, 0x1e7e6, 0x1e7e8, 0x1e7eb, 0x1e7ed, 0x1e7ee, 0x1e7f0, 0x1e7fe, 0x1e800, 0x1e8c4, 0x1e8c7, 0x1e8d6,
  0x1e900, 0x1e94b, 0x1e950, 0x1e959, 0x1e95e, 0x1e95f, 0x1ec71, 0x1ecb4, 0x1ed01, 0x1ed3d, 0x1ee00, 0x1ee03,
  0x1ee05, 0x1ee1f, 0x1ee21, 0x1ee22, 0x1ee24, 0x1ee24, 0x1ee27, 0x1ee27, 0x1ee29, 0x1ee32, 0x1ee34, 0x1ee37,
  0x1ee39, 0x1ee39, 0x1ee3b, 0x1ee3b, 0x1ee42, 0x1ee42, 0x1ee47, 0x1ee47, 0x1ee49, 0x1ee49, 0x1ee4b, 0x1ee4b,
  0x1ee4d, 0x1ee4f, 0x1ee51, 0x1ee52, 0x1ee54, 0x1ee54, 0x1ee57, 0x1ee57, 0x1ee59, 0x1ee59, 0x1ee5b, 0x1ee5b,
  0x1ee5d, 0x1ee5d, 0x1ee5f, 0x1ee5f, 0x1ee61, 0x1ee62, 0x1ee64, 0x1ee64, 0x1ee67, 0x1ee6a, 0x1ee6c, 0x1ee72,
  0x1ee74, 0x1ee77, 0x1ee79, 0x1ee7c, 0x1ee7e, 0x1ee7e, 0x1ee80, 0x1ee89, 0x1ee8b, 0x1ee9b, 0x1eea1, 0x1eea3,
  0x1eea5, 0x1eea9, 0x1eeab, 0x1eebb, 0x1eef0, 0x1eef1, 0x1f000, 0x1f02b, 0x1f030, 0x1f093, 0x1f0a0, 0x1f0ae,
  0x1f0b1, 0x1f0bf, 0x1f0c1, 0x1f0cf, 0x1f0d1, 0x1f0f5, 0x1f100, 0x1f1ad, 0x1f1e6, 0x1f202, 0x1f210, 0x1f23b,
  0x1f240, 0x1f248, 0x1f250, 0x1f251, 0x1f260, 0x1f265, 0x1f300, 0x1f6d7, 0x1f6dc, 0x1f6ec, 0x1f6f0, 0x1f6fc,
  0x1f700, 0x1f776, 0x1f77b, 0x1f7d9, 0x1f7e0, 0x1f7eb, 0x1f7f0, 0x1f7f0, 0x1f800, 0x1f80b, 0x1f810, 0x1f847,
  0x1f850, 0x1f859, 0x1f860, 0x1f887, 0x1f890, 0x1f8ad, 0x1f8b0, 0x1f8b1, 0x1f900, 0x1fa53, 0x1fa60, 0x1fa6d,
  0x1fa70, 0x1fa7c, 0x1fa80, 0x1fa88, 0x1fa90, 0x1fabd, 0x1fabf, 0x1fac5, 0x1face, 0x1fadb, 0x1fae0, 0x1fae8,
  0x1faf0, 0x1faf8, 0x1fb00, 0x1fb92, 0x1fb94, 0x1fbca, 0x1fbf0, 0x1fbf9, 0x20000, 0x2a6df, 0x2a700, 0x2b739,
  0x2b740, 0x2b81d, 0x2b820, 0x2cea1, 0x2ceb0, 0x2ebe0, 0x2ebf0, 0x2ee5d, 0x2f800, 0x2fa1d, 0x30000, 0x3134a,
  0x31350, 0x323af,
];

const classEscapeOf = (codePoint) => `\\u{${codePoint.toString(16)}}`;

function classOfRanges(ranges) {
  let source = '';
  for (let index = 0; index < ranges.length; index += 2) {
    source += `${classEscapeOf(ranges[index])}-${classEscapeOf(ranges[index + 1])}`;
  }
  return source;
}

const unprintable = new RegExp(`[^${classOfRanges(printedRanges)}]|(?<=##)\\[`, 'gu');

const delimiterEscapes = { '"': '\\u0022', '\\': '\\\\' };

function escapeOf(character) {
  const codePoint = character.codePointAt(0);
  return codePoint > 0xffff ? `\\u{${codePoint.toString(16)}}` : `\\u${codePoint.toString(16).padStart(4, '0')}`;
}

function printable(text) {
  return text.replace(unprintable, escapeOf);
}

const spanOf = (text) => `"${printable(text.replace(/["\\]/g, (character) => delimiterEscapes[character]))}"`;

function datum(value) {
  if (typeof value === 'string') {
    return spanOf(value);
  }
  const spelled = JSON.stringify(value);
  return value !== null && typeof value === 'object' ? spanOf(spelled) : spelled;
}

const jsonEscapeOf = (character) =>
  character
    .split('')
    .map((unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`)
    .join('');

function jsonSafe(text) {
  return text.replace(/[^\n]/gu, (character) => (printable(character) === character ? character : jsonEscapeOf(character)));
}

class Unreadable extends Error {
  constructor(message, problem) {
    super(message);
    this.name = 'Unreadable';
    this.problem = problem;
  }
}

const refusalSentence = (name, problem) => `${datum(name)}: ${problem}`;

const refuse = (name, problem) => new Unreadable(refusalSentence(name, problem), problem);

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findRepeatedKey(text) {
  const keysOfOpenContainers = [];
  let stringStart = -1;
  let lastString = '';
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (stringStart >= 0) {
      if (character === '\\') {
        index += 1;
      } else if (character === '"') {
        lastString = text.slice(stringStart, index + 1);
        stringStart = -1;
      }
    } else if (character === '"') {
      stringStart = index;
    } else if (character === '{') {
      keysOfOpenContainers.push(new Set());
    } else if (character === '[') {
      keysOfOpenContainers.push(null);
    } else if (character === '}' || character === ']') {
      keysOfOpenContainers.pop();
    } else if (character === ':') {
      const key = JSON.parse(lastString);
      const keysOfObject = keysOfOpenContainers.at(-1);
      if (keysOfObject.has(key)) {
        return key;
      }
      keysOfObject.add(key);
    }
  }
  return undefined;
}

function parseJson(text, name) {
  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw refuse(name, 'not JSON');
    }
    throw error;
  }
  const repeatedKey = findRepeatedKey(text);
  if (repeatedKey !== undefined) {
    throw refuse(name, `the key ${datum(repeatedKey)} appears twice in one object`);
  }
  return document;
}

function compareText(left, right) {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

const byKey = (left, right) => compareText(left.key, right.key);

import { createHash } from 'node:crypto';

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const members = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${members.join(',')}}`;
  }
  return JSON.stringify(value);
}

function caseDigest(identities) {
  const texts = identities.map(canonicalJson).sort();
  return createHash('sha256').update(texts.join('\u0001')).digest('hex').slice(0, 12);
}

const microUnitsPerUnit = 1000000;

const largestQuantisable = 4000000000;

function quantise(value) {
  const micro = Math.round(value * microUnitsPerUnit);
  return micro === 0 ? 0 : micro;
}

function isQuantisable(value) {
  return typeof value === 'number' && Math.abs(value) <= largestQuantisable;
}

function formatQuantised(micro) {
  const sign = micro < 0 ? '-' : '';
  const digits = String(Math.abs(micro)).padStart(7, '0');
  const whole = digits.slice(0, -6);
  const fraction = digits.slice(-6).replace(/0+$/, '');
  return fraction === '' ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

function count(number, noun) {
  return `${number} ${noun}${number === 1 ? '' : 's'}`;
}

function roundToMillionths(value) {
  return quantise(value) / microUnitsPerUnit;
}

function listKeys(keys) {
  const listed = keys.slice(0, 10).map(datum).join(', ');
  return keys.length > 10 ? `${listed}, and ${keys.length - 10} more` : listed;
}

const REVERSED_IN_DEEPEVAL_4_2_0 = new Set(['Bias', 'Hallucination', 'Misuse', 'Toxicity']);

const DEEPEVAL_UNKNOWN_DIRECTION =
  "DeepEval 4.2.0 reversed this metric's score, and no verdict in this file shows which way it runs; run it again on DeepEval 4.2.0 or later with strict mode off and the default threshold";

function isVerdict(sample) {
  return (
    isPlainObject(sample) &&
    typeof sample.name === 'string' &&
    typeof sample.score === 'number' &&
    typeof sample.threshold === 'number' &&
    typeof sample.success === 'boolean'
  );
}

function showsHigherIsBetter(sample) {
  if (sample.score !== sample.threshold) {
    return sample.success === sample.score > sample.threshold;
  }
  return sample.strictMode === true && sample.threshold === 1 && sample.success === true;
}

function metricsShownHigherIsBetter(testCases) {
  const shown = new Set();
  for (const testCase of testCases) {
    for (const sample of testCase.metricsData ?? []) {
      if (isVerdict(sample) && showsHigherIsBetter(sample)) {
        shown.add(sample.name);
      }
    }
  }
  return shown;
}

function deepevalDirectionRefusal(metricName, shownHigherIsBetter) {
  return REVERSED_IN_DEEPEVAL_4_2_0.has(metricName) && !shownHigherIsBetter.has(metricName) ? DEEPEVAL_UNKNOWN_DIRECTION : undefined;
}

const BASE_ASSERTION_TYPES = [
  'agent-rubric', 'answer-relevance', 'bleu', 'classifier', 'contains', 'contains-all', 'contains-any', 'contains-html',
  'contains-json', 'contains-sql', 'contains-xml', 'context-faithfulness', 'context-recall', 'context-relevance',
  'conversation-relevance', 'cost', 'equals', 'factuality', 'finish-reason', 'g-eval', 'gleu', 'guardrails', 'icontains',
  'icontains-all', 'icontains-any', 'is-html', 'is-json', 'is-refusal', 'is-sql', 'is-valid-function-call',
  'is-valid-openai-function-call', 'is-valid-openai-tools-call', 'is-xml', 'javascript', 'latency', 'levenshtein',
  'llm-rubric', 'meteor', 'model-graded-closedqa', 'model-graded-factuality', 'moderation', 'perplexity', 'perplexity-score',
  'pi', 'python', 'regex', 'rouge-l', 'rouge-n', 'rouge-s', 'ruby', 'search-rubric', 'similar', 'similar:cosine',
  'similar:dot', 'similar:euclidean', 'skill-used', 'starts-with', 'tool-call-f1', 'trace-error-spans', 'trace-span-count',
  'trace-span-duration', 'trajectory:goal-success', 'trajectory:step-count', 'trajectory:tool-args-match',
  'trajectory:tool-sequence', 'trajectory:tool-used', 'webhook', 'word-count',
];
const HIGHER_IS_BETTER_TYPES = new Set(BASE_ASSERTION_TYPES);
const RAW_COST = 'cost with no threshold';
const LOWER_IS_BETTER_LABELS = new Set([RAW_COST, 'not-javascript', 'not-python', 'not-ruby', 'not-tool-call-f1']);
const NOT_PREFIX = 'not-';
const COST_HINT = '. To compare cost, give the cost assertion a threshold so that it scores pass or fail';
const NO_ASSERTION =
  'the file lists no assertion for any metric, so which way its scores run cannot be established; this implementation reads higher-is-better metrics only';

const withoutNot = (type) => (type.startsWith(NOT_PREFIX) ? type.slice(NOT_PREFIX.length) : type);
const listed = (labels) => labels.map(datum).join(', ');

function assertionLabel({ type, threshold }) {
  return withoutNot(type) === 'cost' && typeof threshold !== 'number' ? RAW_COST : type;
}

function directionOfLabel(label) {
  if (LOWER_IS_BETTER_LABELS.has(label)) {
    return 'lower';
  }
  return HIGHER_IS_BETTER_TYPES.has(withoutNot(label)) ? 'higher' : 'unknown';
}

function labelsOf(assertion) {
  const labels = [];
  const pending = [assertion];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current.type === 'assert-set' && Array.isArray(current.assert)) {
      for (const child of current.assert) {
        if (isPlainObject(child)) {
          pending.push(child);
        }
      }
    } else if (typeof current.type === 'string') {
      labels.push(assertionLabel(current));
    }
  }
  return labels;
}

function collectAssertionLabels(results) {
  const labelsByMetric = new Map();
  for (const result of results) {
    const components = isPlainObject(result) && isPlainObject(result.gradingResult) ? result.gradingResult.componentResults : undefined;
    for (const component of Array.isArray(components) ? components : []) {
      const assertion = isPlainObject(component) ? component.assertion : undefined;
      if (!isPlainObject(assertion) || typeof assertion.metric !== 'string') {
        continue;
      }
      const labels = labelsByMetric.get(assertion.metric) ?? new Set();
      labelsOf(assertion).forEach((label) => labels.add(label));
      labelsByMetric.set(assertion.metric, labels);
    }
  }
  return labelsByMetric;
}

function promptfooDirectionRefusal(labelSet = new Set(), noAssertionsListed = false) {
  const labels = [...labelSet].sort(compareText);
  if (labels.length === 0) {
    return noAssertionsListed ? NO_ASSERTION : undefined;
  }
  const directions = labels.map(directionOfLabel);
  const unknown = labels[directions.indexOf('unknown')];
  const lower = labels.filter((label, index) => directions[index] === 'lower');
  if (directions.includes('unknown')) {
    return `promptfoo assertion type ${datum(unknown)} feeds it, and this implementation has not checked which way that score runs; update evals-baseline, or use an assertion type it knows`;
  }
  if (lower.length === 0) {
    return undefined;
  }
  if (lower.length < labels.length) {
    return `promptfoo feeds it from assertions that disagree on which way a score runs (${listed(labels)}); give each kind its own metric name`;
  }
  return `promptfoo scores it as lower-is-better (${listed(lower)}); this implementation reads higher-is-better metrics only${lower.includes(RAW_COST) ? COST_HINT : ''}`;
}

const wrongField = (name, path, expected) => refuse(name, `${path} is missing or is not ${expected}`);

function objectAt(value, name, path) {
  if (!isPlainObject(value)) {
    throw wrongField(name, path, 'an object');
  }
  return value;
}

function arrayAt(value, name, path) {
  if (!Array.isArray(value)) {
    throw wrongField(name, path, 'an array');
  }
  return value;
}

function stringAt(value, name, path) {
  if (typeof value !== 'string') {
    throw wrongField(name, path, 'a string');
  }
  return value;
}

function numberAt(value, name, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw wrongField(name, path, 'a number');
  }
  return value;
}

function countAt(value, name, path) {
  if (!Number.isInteger(value) || value < 0) {
    throw wrongField(name, path, 'a non-negative integer');
  }
  return value;
}

function describeJsonKind(value) {
  if (Array.isArray(value)) {
    return 'an array';
  }
  if (value === null) {
    return 'null';
  }
  return { string: 'a string', number: 'a number', boolean: 'a boolean' }[typeof value];
}

function describeTopLevel(document) {
  if (!isPlainObject(document)) {
    return `the JSON value is ${describeJsonKind(document)}`;
  }
  const keys = Object.keys(document).sort(compareText);
  return `top-level keys: ${keys.length === 0 ? 'none' : listKeys(keys)}`;
}

function detectTool(document, name) {
  const isPromptfoo = isPlainObject(document) && isPlainObject(document.results) && typeof document.results.version === 'number';
  const isDeepeval = isPlainObject(document) && Array.isArray(document.testCases) && Array.isArray(document.metricsScores);
  if (isPromptfoo && isDeepeval) {
    throw refuse(name, `matches both a promptfoo results file and a DeepEval test run; ${describeTopLevel(document)}`);
  }
  if (isPromptfoo) {
    return 'promptfoo';
  }
  if (isDeepeval) {
    return 'deepeval';
  }
  if (isPlainObject(document) && isPlainObject(document.testRunData)) {
    throw refuse(
      name,
      'this is DeepEval .latest_test_run.json, which wraps the run in testRunData; read .latest_run_full.json or a test_run_*.json file',
    );
  }
  throw refuse(name, `neither a promptfoo results file nor a DeepEval test run; ${describeTopLevel(document)}`);
}

function assertUniqueKeys(metrics, name) {
  const seen = new Set();
  for (const { key } of metrics) {
    if (seen.has(key)) {
      throw refuse(name, `the metric key ${datum(key)} is produced twice`);
    }
    seen.add(key);
  }
}

function readPromptfoo(document, name) {
  const { results } = document;
  if (results.version !== 3) {
    throw refuse(name, `promptfoo results version ${results.version} is not read; this implementation reads version 3`);
  }
  const prompts = arrayAt(results.prompts, name, 'results.prompts');
  const tests = arrayAt(results.results, name, 'results.results');
  const assertionLabels = collectAssertionLabels(tests);
  const noAssertionsListed = tests.length > 0 && assertionLabels.size === 0;
  const labels = new Set();
  const metrics = [];
  const refused = [];
  const errors = [];

  prompts.forEach((prompt, index) => {
    const promptPath = `results.prompts[${index}]`;
    objectAt(prompt, name, promptPath);
    const label = stringAt(prompt.provider, name, `${promptPath}.provider`);
    if (labels.has(label)) {
      throw refuse(name, `two prompts share the provider label ${datum(label)}; this implementation reads one prompt per provider`);
    }
    labels.add(label);
    const statistics = objectAt(prompt.metrics, name, `${promptPath}.metrics`);
    const erroredTests = numberAt(statistics.testErrorCount, name, `${promptPath}.metrics.testErrorCount`);
    const sums = objectAt(statistics.namedScores, name, `${promptPath}.metrics.namedScores`);
    const counts = objectAt(statistics.namedScoresCount, name, `${promptPath}.metrics.namedScoresCount`);
    const weights =
      statistics.namedScoreWeights === undefined ? {} : objectAt(statistics.namedScoreWeights, name, `${promptPath}.metrics.namedScoreWeights`);

    for (const metricName of Object.keys(counts)) {
      const key = `${label} :: ${metricName}`;
      const samples = countAt(counts[metricName], name, `${promptPath}.metrics.namedScoresCount[${datum(metricName)}]`);
      if (samples === 0) {
        continue;
      }
      const sum = numberAt(sums[metricName], name, `${promptPath}.metrics.namedScores[${datum(metricName)}]`);
      const weighted = Object.hasOwn(weights, metricName);
      const weight = weights[metricName];
      if (weighted && !(Number.isFinite(weight) && weight > 0)) {
        refused.push({ key, reason: `promptfoo's weight total for it is ${datum(weight)}, which is not a positive number` });
        continue;
      }
      const unknownDirection = promptfooDirectionRefusal(assertionLabels.get(metricName), noAssertionsListed);
      if (unknownDirection !== undefined) {
        refused.push({ key, reason: unknownDirection });
        continue;
      }
      const value = roundToMillionths(sum / (weighted ? weight : samples));
      if (!isQuantisable(value)) {
        throw refuse(name, `the value of ${datum(key)} is out of range`);
      }
      metrics.push({ key, value, samples });
    }
    if (erroredTests > 0) {
      errors.push({ key: label, text: `${datum(label)}: ${erroredTests} errored test(s) in this run (promptfoo testErrorCount)` });
    }
  });

  const variablesByTest = new Map();
  tests.forEach((result, index) => {
    const resultPath = `results.results[${index}]`;
    objectAt(result, name, resultPath);
    const testIndex = numberAt(result.testIdx, name, `${resultPath}.testIdx`);
    const testCase = objectAt(result.testCase, name, `${resultPath}.testCase`);
    if (!variablesByTest.has(testIndex)) {
      variablesByTest.set(testIndex, testCase.vars === undefined ? {} : objectAt(testCase.vars, name, `${resultPath}.testCase.vars`));
    }
  });

  const rawVersion = isPlainObject(document.metadata) ? document.metadata.promptfooVersion : undefined;
  assertUniqueKeys([...metrics, ...refused], name);
  return {
    name,
    tool: 'promptfoo',
    toolVersion: rawVersion === undefined || rawVersion === null ? null : stringAt(rawVersion, name, 'metadata.promptfooVersion'),
    shape: 'promptfoo-results-3',
    cases: { count: variablesByTest.size, digest: caseDigest([...variablesByTest.values()]) },
    metrics: metrics.sort(byKey),
    refused: refused.sort(byKey),
    errors: errors.sort(byKey).map((error) => error.text),
  };
}

function findContradictions(testCases) {
  const contradictions = new Map();
  for (const testCase of testCases) {
    for (const sample of testCase.metricsData ?? []) {
      if (!isVerdict(sample) || sample.success === sample.score >= sample.threshold) {
        continue;
      }
      const known = contradictions.get(sample.name);
      if (known === undefined) {
        contradictions.set(sample.name, { count: 1, first: sample });
      } else {
        known.count += 1;
      }
    }
  }
  return contradictions;
}

function readDeepeval(document, name) {
  if (document.conversationalTestCases !== undefined) {
    const conversational = arrayAt(document.conversationalTestCases, name, 'conversationalTestCases');
    if (conversational.length > 0) {
      throw refuse(name, 'conversationalTestCases is not empty; this implementation does not read multi-turn runs');
    }
  }
  const identities = document.testCases.map((testCase, index) => {
    const testPath = `testCases[${index}]`;
    objectAt(testCase, name, testPath);
    const input = stringAt(testCase.input, name, `${testPath}.input`);
    const expectedOutput = testCase.expectedOutput ?? null;
    if (expectedOutput !== null) {
      stringAt(expectedOutput, name, `${testPath}.expectedOutput`);
    }
    if (testCase.metricsData !== undefined && !Array.isArray(testCase.metricsData)) {
      throw refuse(name, `${testPath}.metricsData is not an array`);
    }
    return { input, expectedOutput };
  });

  const contradictions = findContradictions(document.testCases);
  const shownHigherIsBetter = metricsShownHigherIsBetter(document.testCases);
  const seen = new Set();
  const metrics = [];
  const refused = [];
  const errors = [];
  document.metricsScores.forEach((entry, index) => {
    const scorePath = `metricsScores[${index}]`;
    objectAt(entry, name, scorePath);
    const key = stringAt(entry.metric, name, `${scorePath}.metric`);
    if (seen.has(key)) {
      throw refuse(name, `metricsScores names the metric ${datum(key)} twice`);
    }
    seen.add(key);
    const scores = arrayAt(entry.scores, name, `${scorePath}.scores`).map((score, position) =>
      numberAt(score, name, `${scorePath}.scores[${position}]`),
    );
    const erroredSamples = countAt(entry.errors, name, `${scorePath}.errors`);
    if (erroredSamples > 0) {
      errors.push({
        key,
        text: `${datum(key)}: ${erroredSamples} sample(s) DeepEval counted as errors, because the metric raised an error or returned no verdict (success is null)`,
      });
    }
    if (scores.length === 0) {
      return;
    }
    const contradiction = contradictions.get(key);
    if (contradiction !== undefined) {
      const { success, score, threshold } = contradiction.first;
      refused.push({
        key,
        reason: `DeepEval's own verdicts contradict higher-is-better in ${contradiction.count} sample(s) (success=${success}, score=${score}, threshold=${threshold}); this implementation reads higher-is-better metrics only`,
      });
      return;
    }
    const unknownDirection = deepevalDirectionRefusal(key, shownHigherIsBetter);
    if (unknownDirection !== undefined) {
      refused.push({ key, reason: unknownDirection });
      return;
    }
    const value = roundToMillionths(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    if (!isQuantisable(value)) {
      throw refuse(name, `the value of ${datum(key)} is out of range`);
    }
    metrics.push({ key, value, samples: scores.length });
  });

  return {
    name,
    tool: 'deepeval',
    toolVersion: null,
    shape: 'deepeval-test-run',
    cases: { count: identities.length, digest: caseDigest(identities) },
    metrics: metrics.sort(byKey),
    refused: refused.sort(byKey),
    errors: errors.sort(byKey).map((error) => error.text),
  };
}

function readRun(text, nameForMessages) {
  const document = parseJson(text, nameForMessages);
  return detectTool(document, nameForMessages) === 'promptfoo'
    ? readPromptfoo(document, nameForMessages)
    : readDeepeval(document, nameForMessages);
}

const specificationVersion = '1.0';

const [implementedMajor, implementedMinor] = specificationVersion.split('.').map(Number);

const specificationPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const recordedAtPattern = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;
const digestPattern = /^[0-9a-f]{12}$/;
const shapeByTool = { promptfoo: 'promptfoo-results-3', deepeval: 'deepeval-test-run' };

const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

function lastDayOfMonth(year, month) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isRealInstant(text) {
  const match = recordedAtPattern.exec(text);
  return match !== null && Number(match[3]) <= lastDayOfMonth(Number(match[1]), Number(match[2]));
}

function checkKeys(object, allowed, where, name) {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      throw refuse(name, `unknown key ${datum(key)} in ${where}`);
    }
  }
  for (const key of allowed) {
    if (!Object.hasOwn(object, key)) {
      throw refuse(name, `missing key ${datum(key)} in ${where}`);
    }
  }
}

function checkSpecification(document, name) {
  if (!Object.hasOwn(document, 'spec')) {
    throw refuse(name, 'missing key "spec" in the baseline');
  }
  const { spec } = document;
  const match = typeof spec === 'string' ? specificationPattern.exec(spec) : null;
  if (match === null) {
    throw refuse(name, `spec must be MAJOR.MINOR with no third number and no leading zeros, such as "${specificationVersion}", got ${datum(spec)}`);
  }
  if (Number(match[1]) !== implementedMajor) {
    throw refuse(name, `specification ${spec} is not read by this implementation, which reads ${implementedMajor}.x up to ${specificationVersion}`);
  }
  if (Number(match[2]) > implementedMinor) {
    throw refuse(name, `specification ${spec} is newer than ${specificationVersion}, the newest this implementation reads`);
  }
}

function readSource(source, name) {
  checkKeys(source, ['tool', 'toolVersion', 'shape'], 'source', name);
  if (!Object.hasOwn(shapeByTool, source.tool)) {
    throw refuse(name, 'source.tool must be "promptfoo" or "deepeval"');
  }
  if (source.toolVersion !== null && typeof source.toolVersion !== 'string') {
    throw refuse(name, 'source.toolVersion must be a string or null');
  }
  if (source.shape !== shapeByTool[source.tool]) {
    throw refuse(name, `source.shape must be "${shapeByTool[source.tool]}" when source.tool is "${source.tool}"`);
  }
  return { tool: source.tool, toolVersion: source.toolVersion, shape: source.shape };
}

function readCases(cases, name) {
  checkKeys(cases, ['count', 'digest'], 'cases', name);
  if (!Number.isInteger(cases.count) || cases.count < 1) {
    throw refuse(name, 'cases.count must be a positive integer');
  }
  if (typeof cases.digest !== 'string' || !digestPattern.test(cases.digest)) {
    throw refuse(name, 'cases.digest must be 12 lowercase hexadecimal characters');
  }
  return { count: cases.count, digest: cases.digest };
}

function readMetric(key, entry, name) {
  const where = `metrics[${datum(key)}]`;
  if (!isPlainObject(entry)) {
    throw refuse(name, `${where} must be an object`);
  }
  checkKeys(entry, ['value', 'samples', 'tolerance'], where, name);
  if (!isQuantisable(entry.value)) {
    throw refuse(name, `${where}.value must be a number between -${largestQuantisable} and ${largestQuantisable}`);
  }
  if (!Number.isInteger(entry.samples) || entry.samples < 1) {
    throw refuse(name, `${where}.samples must be a positive integer`);
  }
  if (!isQuantisable(entry.tolerance) || entry.tolerance < 0) {
    throw refuse(name, `${where}.tolerance must be a number between 0 and ${largestQuantisable}`);
  }
  return { key, value: entry.value, samples: entry.samples, tolerance: entry.tolerance };
}

function readBaseline(text, nameForMessages) {
  const name = nameForMessages;
  const document = parseJson(text, name);
  if (!isPlainObject(document)) {
    throw refuse(name, 'not a JSON object');
  }
  checkSpecification(document, name);
  checkKeys(document, ['spec', 'source', 'recordedAt', 'cases', 'metrics'], 'the baseline', name);
  if (!isPlainObject(document.source)) {
    throw refuse(name, 'source must be an object');
  }
  const source = readSource(document.source, name);
  if (typeof document.recordedAt !== 'string' || !isRealInstant(document.recordedAt)) {
    throw refuse(name, 'recordedAt must be an ISO 8601 UTC time to the millisecond, such as 2026-09-02T09:00:00.000Z');
  }
  if (!isPlainObject(document.cases)) {
    throw refuse(name, 'cases must be an object');
  }
  const cases = readCases(document.cases, name);
  if (!isPlainObject(document.metrics)) {
    throw refuse(name, 'metrics must be an object');
  }
  const entries = Object.entries(document.metrics);
  if (entries.length === 0) {
    throw refuse(name, 'metrics names no metric, so the baseline guards nothing');
  }
  const metrics = entries.map(([key, entry]) => readMetric(key, entry, name)).sort(byKey);
  return { spec: document.spec, source, recordedAt: document.recordedAt, cases, metrics };
}

const byMetricKey = (run) => new Map(run.metrics.map((metric) => [metric.key, metric]));

const baselineSide = (expected) => ({ value: quantise(expected.value), samples: expected.samples });

function findingsForMetric(expected, actual, reason) {
  if (actual === undefined) {
    return [
      reason === undefined
        ? { id: 'missing-metric', key: expected.key, baseline: baselineSide(expected) }
        : { id: 'unreadable-metric', key: expected.key, reason },
    ];
  }
  const findings = [];
  const drop = quantise(expected.value) - quantise(actual.value);
  if (drop > quantise(expected.tolerance)) {
    findings.push({
      id: 'below-baseline',
      key: expected.key,
      baseline: { ...baselineSide(expected), tolerance: quantise(expected.tolerance) },
      run: { value: quantise(actual.value), samples: actual.samples },
      drop,
    });
  }
  if (actual.samples < expected.samples) {
    findings.push({ id: 'sample-count', key: expected.key, baseline: { samples: expected.samples }, run: { samples: actual.samples } });
  }
  return findings;
}

function compareFindings(baseline, run) {
  const findings = [];
  if (baseline.cases.digest !== run.cases.digest) {
    findings.push({
      id: 'cases-changed',
      baseline: { count: baseline.cases.count, digest: baseline.cases.digest },
      run: { count: run.cases.count, digest: run.cases.digest },
    });
  }
  const actualByKey = byMetricKey(run);
  const reasonByKey = new Map(run.refused.map((refusal) => [refusal.key, refusal.reason]));
  for (const expected of [...baseline.metrics].sort(byKey)) {
    findings.push(...findingsForMetric(expected, actualByKey.get(expected.key), reasonByKey.get(expected.key)));
  }
  return findings;
}

function riseNotes(baseline, run) {
  const actualByKey = byMetricKey(run);
  return [...baseline.metrics]
    .sort(byKey)
    .filter((expected) => actualByKey.has(expected.key) && actualByKey.get(expected.key).samples > expected.samples)
    .map((expected) => ({
      kind: 'more-samples',
      key: expected.key,
      baseline: { samples: expected.samples },
      run: { samples: actualByKey.get(expected.key).samples },
    }));
}

function compareNotes(baseline, run) {
  const notes = [];
  const baselineKeys = new Set(baseline.metrics.map((metric) => metric.key));
  const onlyInRun = run.metrics.map((metric) => metric.key).filter((key) => !baselineKeys.has(key)).sort(compareText);
  if (onlyInRun.length > 0) {
    notes.push({ kind: 'metrics-only-in-run', keys: onlyInRun });
  }
  notes.push(...riseNotes(baseline, run));
  notes.push(...run.errors.map((text) => ({ kind: 'run-error', text })));
  for (const { key, reason } of [...run.refused].sort(byKey)) {
    if (!baselineKeys.has(key)) {
      notes.push({ kind: 'refused-metric', key, reason });
    }
  }
  const { tool, toolVersion } = baseline.source;
  if (toolVersion !== null && run.toolVersion !== null && toolVersion !== run.toolVersion) {
    notes.push({ kind: 'tool-version-changed', tool, baseline: { toolVersion }, run: { toolVersion: run.toolVersion } });
  }
  return notes;
}

function compare(baseline, run) {
  if (baseline.source.tool !== run.tool) {
    return {
      findings: [
        {
          id: 'bad-run',
          file: run.name,
          cause: 'other-tool',
          baseline: { tool: baseline.source.tool, shape: baseline.source.shape },
          run: { tool: run.tool, shape: run.shape },
        },
      ],
      notes: [],
    };
  }
  return { findings: compareFindings(baseline, run), notes: compareNotes(baseline, run) };
}

const valueOverSamples = ({ value, samples }) => `${formatQuantised(value)} over ${count(samples, 'sample')}`;

const samplesHeld = (baseline, run) => `the baseline holds ${count(baseline.samples, 'sample')} and this run holds ${run.samples}`;

const smallestMeasuredNoiseFloor = quantise(0.0084);

const unsetToleranceSentence = ({ baseline, run, drop }) =>
  [
    `${valueOverSamples(run)} is below the baseline ${valueOverSamples(baseline)} by ${formatQuantised(drop)}.`,
    'The tolerance is 0, so every fall is reported, and a fall this small is one that two runs of unchanged code can show.',
    'The tolerance is probably unset; the model is probably not worse.',
    'Rerun the suite with nothing changed, see how far each metric moves, and set this tolerance in the baseline to match',
    '(see the README section on setting tolerances from your own noise).',
    'If 0 is on purpose, treat this as a real fall.',
  ].join(' ');

const failureWord = (failure) => (failure === 'ENOENT' ? 'not found' : failure);

const describeCannotRead = (file, failure) => `cannot read ${datum(file)}: ${failureWord(failure)}`;

const unreadableFileSentences = {
  'cannot-read': ({ file, failure }) => describeCannotRead(file, failure),
  refused: ({ file, problem }) => refusalSentence(file, problem),
  'other-tool': ({ file, baseline, run }) =>
    `${datum(file)}: the baseline was recorded from ${baseline.tool} (${baseline.shape}) and this file is ${run.tool} (${run.shape})`,
};

const unreadableFileSentence = (finding) => unreadableFileSentences[finding.cause](finding);

const findingSentences = {
  'missing-metric': ({ baseline }) => `the baseline names it (${valueOverSamples(baseline)}) and this run has no such metric`,
  'unreadable-metric': ({ reason }) => reason,
  'below-baseline': ({ baseline, run, drop }) =>
    `${valueOverSamples(run)} is below the baseline ${valueOverSamples(baseline)} by ${formatQuantised(drop)}, more than the tolerance ${formatQuantised(baseline.tolerance)}`,
  'below-baseline-inside-noise': unsetToleranceSentence,
  'sample-count': ({ baseline, run }) => samplesHeld(baseline, run),
  'cases-changed': ({ baseline, run }) =>
    `the baseline was recorded from ${count(baseline.count, 'case')} (digest ${baseline.digest}); this run holds ${count(run.count, 'case')} (digest ${run.digest}); re-record if the change is intended`,
  'no-baseline': ({ file }) => `no baseline at ${datum(file)}; nothing was compared; record one with: evals-baseline record <run-file>`,
  'bad-baseline': unreadableFileSentence,
  'bad-run': unreadableFileSentence,
  'internal-error': ({ message }) => datum(message),
};

const noteSentences = {
  'metrics-only-in-run': ({ keys }) => `${keys.length} metric(s) only in this run, not compared (rule 3): ${listKeys(keys)}`,
  'more-samples': ({ key, baseline, run }) => `${datum(key)}: ${samplesHeld(baseline, run)}; more samples than the baseline are never a finding`,
  'run-error': ({ text }) => text,
  'refused-metric': ({ key, reason }) => `${datum(key)} cannot be read: ${reason}`,
  'tool-version-changed': ({ tool, baseline, run }) =>
    `the baseline was recorded by ${tool} ${datum(baseline.toolVersion)}; this run was written by ${datum(run.toolVersion)}`,
};

const findingHead = ({ id, key }) => (key === undefined ? id : `${id} ${datum(key)}`);

const isFallInsideNoise = ({ id, baseline, drop }) => id === 'below-baseline' && baseline.tolerance === 0 && drop < smallestMeasuredNoiseFloor;

const sentenceKey = (finding) => (isFallInsideNoise(finding) ? 'below-baseline-inside-noise' : finding.id);

const describeFinding = (finding) => `${findingHead(finding)}: ${findingSentences[sentenceKey(finding)](finding)}`;

const describeNote = (note) => noteSentences[note.kind](note);

function carriedTolerances(run, previous) {
  const carried = new Map();
  if (previous !== null && previous !== undefined && previous.source.tool === run.tool) {
    for (const metric of previous.metrics) {
      carried.set(metric.key, metric.tolerance);
    }
  }
  return carried;
}

const unsetReason = (metrics) =>
  `no tolerance was given for ${count(metrics, 'metric')}, and a tolerance of 0 reports a fall of any size; pass --tolerance <n> to set one, or --tolerance 0 to accept 0`;

const conflictReason = (tolerance, metrics) =>
  `--tolerance ${formatQuantised(quantise(tolerance))} would change the tolerance of ${count(metrics, 'metric')} that the baseline already holds, and record keeps those; edit them in the baseline, or leave --tolerance out`;

function toleranceRefusal(run, tolerance, previous) {
  const carried = carriedTolerances(run, previous);
  if (tolerance === undefined) {
    const unset = run.metrics.filter(({ key }) => !carried.has(key));
    return unset.length === 0 ? null : { reason: unsetReason(unset.length), held: [] };
  }
  const held = run.metrics
    .filter(({ key }) => carried.has(key) && quantise(carried.get(key)) !== quantise(tolerance))
    .map(({ key }) => ({ key, tolerance: carried.get(key) }))
    .sort(byKey);
  return held.length === 0 ? null : { reason: conflictReason(tolerance, held.length), held };
}

function record(run, now, tolerance, previous) {
  const carried = carriedTolerances(run, previous);
  return {
    spec: specificationVersion,
    source: { tool: run.tool, toolVersion: run.toolVersion, shape: run.shape },
    recordedAt: now.toISOString(),
    cases: { count: run.cases.count, digest: run.cases.digest },
    metrics: run.metrics
      .map(({ key, value, samples }) => ({ key, value, samples, tolerance: carried.has(key) ? carried.get(key) : tolerance }))
      .sort(byKey),
  };
}

function metricText({ key, value, samples, tolerance }) {
  const body = JSON.stringify({ value, samples, tolerance }, null, 2).replaceAll('\n', '\n    ');
  return `    ${JSON.stringify(key)}: ${body}`;
}

function baselineText(baseline) {
  const head = JSON.stringify(
    {
      spec: baseline.spec,
      source: { tool: baseline.source.tool, toolVersion: baseline.source.toolVersion, shape: baseline.source.shape },
      recordedAt: baseline.recordedAt,
      cases: { count: baseline.cases.count, digest: baseline.cases.digest },
    },
    null,
    2,
  );
  const metrics = [...baseline.metrics].sort(byKey).map(metricText).join(',\n');
  return jsonSafe(`${head.slice(0, -2)},\n  "metrics": {\n${metrics}\n  }\n}\n`);
}

function isUnchanged(previous, next) {
  const stamp = { recordedAt: next.recordedAt, source: { ...previous.source, toolVersion: next.source.toolVersion } };
  return baselineText({ ...previous, ...stamp }) === baselineText(next);
}

const valueAndSamples = ({ value, samples }) => `${formatQuantised(quantise(value))} over ${count(samples, 'sample')}`;

function movement(before, after) {
  const drop = quantise(before.value) - quantise(after.value);
  if (drop !== 0) {
    return `would ${drop > 0 ? 'fall' : 'rise'} by ${formatQuantised(Math.abs(drop))}, from ${valueAndSamples(before)} to ${valueAndSamples(after)}`;
  }
  if (before.samples !== after.samples) {
    return `would keep the value ${formatQuantised(quantise(after.value))} and go from ${count(before.samples, 'sample')} to ${count(after.samples, 'sample')}`;
  }
  return null;
}

const removedMetric = (before) =>
  `would be removed; the baseline holds ${valueAndSamples(before)}, with the tolerance ${formatQuantised(quantise(before.tolerance))}`;

function metricMovement(before, after) {
  if (before === undefined) {
    return `would be added, at ${valueAndSamples(after)}`;
  }
  return after === undefined ? removedMetric(before) : movement(before, after);
}

function metricNotes(previous, next) {
  const before = new Map(previous.metrics.map((metric) => [metric.key, metric]));
  const after = new Map(next.metrics.map((metric) => [metric.key, metric]));
  return [...new Set([...before.keys(), ...after.keys()])]
    .sort(compareText)
    .map((key) => [key, metricMovement(before.get(key), after.get(key))])
    .filter(([, text]) => text !== null)
    .map(([key, text]) => `${datum(key)}: ${text}`);
}

const casesText = ({ count: total, digest }) => `${count(total, 'case')} (digest ${digest})`;

function sourceNotes(previous, next) {
  const notes = [];
  if (previous.source.tool !== next.source.tool) {
    notes.push(`the tool would change from ${previous.source.tool} to ${next.source.tool}, so no tolerance would be carried over`);
  }
  if (previous.cases.digest !== next.cases.digest) {
    notes.push(`the cases would change from ${casesText(previous.cases)} to ${casesText(next.cases)}`);
  }
  return notes;
}

const baselineSummary = ({ metrics, cases }) => `a baseline of ${count(metrics.length, 'metric')} and ${count(cases.count, 'case')}`;

function replaceRefusal(baselinePath, previous, next, replace) {
  if (previous === null || previous === undefined || replace) {
    return null;
  }
  return {
    reason: `${datum(baselinePath)} already holds ${baselineSummary(previous)}, recorded ${previous.recordedAt.slice(0, 10)}; this run would replace it with ${baselineSummary(next)}; pass --replace to replace it`,
    notes: [...sourceNotes(previous, next), ...metricNotes(previous, next)],
  };
}

function removeQuietly(files, path) {
  try {
    files.rmSync(path, { force: true });
  } catch {
    return;
  }
}

function createTemporary(files, temporary, text) {
  try {
    files.writeFileSync(temporary, text, { flag: 'wx', flush: true });
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      removeQuietly(files, temporary);
    }
    throw error;
  }
}

function writeAtomically(path, text, files, suffix) {
  const temporary = `${path}.${suffix}.tmp`;
  createTemporary(files, temporary, text);
  try {
    files.renameSync(temporary, path);
  } catch (error) {
    removeQuietly(files, temporary);
    throw error;
  }
}

const packageVersion = '1.0.0';

const bannerText = `evals-baseline ${packageVersion} (specification ${specificationVersion})`;

const exitCode = { pass: 0, regression: 1, usage: 2, notEvaluated: 3 };

const advisoryFindingId = 'cases-changed';

const regressionFindingIds = new Set(['missing-metric', 'below-baseline', 'sample-count']);

function exitCodeOfFinding({ id }) {
  if (id === advisoryFindingId) {
    return exitCode.pass;
  }
  return regressionFindingIds.has(id) ? exitCode.regression : exitCode.notEvaluated;
}

function strictExitCode(findings) {
  const codes = findings.map(exitCodeOfFinding);
  if (codes.includes(exitCode.regression)) {
    return exitCode.regression;
  }
  return codes.includes(exitCode.notEvaluated) ? exitCode.notEvaluated : exitCode.pass;
}

const toolText = (tool, version) => (version === null ? `${tool} version unknown` : `${tool} ${datum(version)}`);

function dayNumber(isoDay) {
  const [year, month, day] = isoDay.split('-').map(Number);
  const shiftedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra;
}

function describeAge(recordedDay, today) {
  const days = dayNumber(today) - dayNumber(recordedDay);
  if (days === 0) {
    return 'the same day as';
  }
  return days > 0 ? `${count(days, 'day')} before` : `${count(-days, 'day')} after`;
}

function summaryText(findingCount, strictCode, strict) {
  if (findingCount === 0) {
    return 'evals-baseline: no findings';
  }
  const counted = `evals-baseline: ${count(findingCount, 'finding')}`;
  if (strictCode === exitCode.pass) {
    return `${counted}; warning only, exit 0 (${advisoryFindingId} never fails --strict)`;
  }
  return strict ? `${counted}; exit ${strictCode} (--strict)` : `${counted}; warning only, exit 0 (pass --strict to exit ${strictCode})`;
}

function render(result, strict, today) {
  const { baselinePath, baseline, findings, notes } = result;
  const lines = [];
  if (baseline === null) {
    lines.push(`${bannerText} check ${datum(baselinePath)}`);
  } else {
    const described = `${toolText(baseline.source.tool, baseline.source.toolVersion)}, ${count(baseline.metrics.length, 'metric')}, ${count(baseline.cases.count, 'case')}`;
    const recordedDay = baseline.recordedAt.slice(0, 10);
    lines.push(`${bannerText} check ${datum(baselinePath)}: ${described}`);
    lines.push(`date: baseline recorded ${recordedDay}, ${describeAge(recordedDay, today)} this check on ${today}`);
  }
  const findingLines = findings.map((finding) => printable(describeFinding(finding)));
  const failingLines = findings.filter((finding) => exitCodeOfFinding(finding) !== exitCode.pass).map((finding) => printable(describeFinding(finding)));
  lines.push(...findingLines);
  lines.push(...notes.map((note) => `note: ${describeNote(note)}`));
  const strictCode = strictExitCode(findings);
  lines.push(summaryText(findings.length, strictCode, strict));
  return {
    lines: lines.map(printable),
    code: strict ? strictCode : exitCode.pass,
    findings: findingLines,
    failing: failingLines,
  };
}

function noMetricAdvice(tool) {
  return tool === 'promptfoo'
    ? 'no named metric in this run; add "metric: <name>" to the assertions you want guarded'
    : 'no metric with a valid sample in this run';
}

function renderShow(run, runFile) {
  const described = `${toolText(run.tool, run.toolVersion)} (${run.shape}), ${count(run.metrics.length, 'metric')}, ${count(run.cases.count, 'case')} (digest ${run.cases.digest})`;
  const lines = [`${bannerText} show ${datum(runFile)}: ${described}`];
  for (const metric of run.metrics) {
    lines.push(`metric ${datum(metric.key)}  ${formatQuantised(quantise(metric.value))}  ${count(metric.samples, 'sample')}`);
  }
  for (const { key, reason } of run.refused) {
    lines.push(`note: ${describeNote({ kind: 'refused-metric', key, reason })}`);
  }
  for (const text of run.errors) {
    lines.push(`note: ${describeNote({ kind: 'run-error', text })}`);
  }
  if (run.metrics.length === 0 && run.refused.length === 0) {
    lines.push(`note: ${noMetricAdvice(run.tool)}`);
  }
  return lines.map(printable);
}

function renderShowRefusal(reason) {
  return [printable(`${bannerText} show: refused: ${reason}`)];
}

const notRecorded = (refused) => refused.map((refusal) => `note: ${datum(refusal.key)} not recorded: ${refusal.reason}`);

const heldTolerances = (held) =>
  held.map(({ key, tolerance }) => `note: ${datum(key)}: the baseline holds the tolerance ${formatQuantised(quantise(tolerance))}`);

function renderRecordRefusal(reason, refused, held = [], notes = []) {
  return [
    `${bannerText} record: refused: ${reason}; nothing written`,
    ...notRecorded(refused),
    ...heldTolerances(held),
    ...notes.map((text) => `note: ${text}`),
  ].map(printable);
}

function renderRecordUnchanged(baselinePath, previous, refused) {
  const recorded = `recorded ${previous.recordedAt.slice(0, 10)}`;
  return [
    `${bannerText} record: unchanged: ${datum(baselinePath)} already holds these values; not rewritten (${recorded})`,
    ...notRecorded(refused),
  ].map(printable);
}

function renderRecordWritten(baselinePath, baseline, refused, replaced) {
  const described = `${count(baseline.metrics.length, 'metric')}, ${count(baseline.cases.count, 'case')}, ${toolText(baseline.source.tool, baseline.source.toolVersion)}`;
  const lines = [`${bannerText} record: wrote ${datum(baselinePath)} (${described})`, ...notRecorded(refused)];
  if (replaced.length > 0) {
    lines.push(`replaced: the previous baseline would have reported ${count(replaced.length, 'finding')} against this run:`);
    lines.push(...replaced.map((finding) => `  ${describeFinding(finding)}`));
  }
  return lines.map(printable);
}

function renderVersion() {
  return [bannerText];
}

import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

const usageLine = 'usage: evals-baseline <check|record|show> <run-file> [--baseline <path>] [--strict] [--tolerance <n>] [--replace]';
const defaultBaselinePath = 'evals-baseline.json';
const flagsByVerb = { check: ['--baseline', '--strict'], record: ['--baseline', '--tolerance', '--replace'], show: [] };
const everyFlag = ['--baseline', '--strict', '--tolerance', '--replace'];
const decimalPattern = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

const defaultIo = {
  readFile: (path) => readFileSync(path, 'utf8'),
  writeFile: (path, text) => writeAtomically(path, text, { renameSync, rmSync, writeFileSync }, process.pid),
  now: () => new Date(),
};

function outcome({ stdout = [], stderr = [], code = 0, findings = [], failing = [] }) {
  return { stdout, stderr, code, findings, failing };
}

const internalError = (error) => ({ id: 'internal-error', message: error instanceof Error ? error.message : String(error) });

function flagProblem(verb, flag, taken) {
  if (!everyFlag.includes(flag)) {
    return `unknown flag ${datum(flag)}`;
  }
  if (!flagsByVerb[verb].includes(flag)) {
    return `${flag} is not a flag of ${verb}`;
  }
  return taken.has(flag) ? `${flag} given twice` : null;
}

function readFlagValue(flag, value) {
  if (flag === '--baseline') {
    return value === undefined || value.startsWith('-') ? { problem: '--baseline needs a path' } : { value };
  }
  if (value === undefined) {
    return { problem: '--tolerance needs a number of at least 0' };
  }
  if (!decimalPattern.test(value) || !isQuantisable(Number(value))) {
    return { problem: `--tolerance needs a number of at least 0, got ${datum(value)}` };
  }
  return { value: Number(value) };
}

function parseArguments(argv) {
  if (argv.length === 1 && argv[0] === '--version') {
    return { version: true };
  }
  const [verb, ...rest] = argv;
  if (!Object.hasOwn(flagsByVerb, String(verb))) {
    return { usage: [usageLine] };
  }
  const taken = new Map();
  const files = [];
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('-')) {
      files.push(token);
      continue;
    }
    const problem = flagProblem(verb, token, taken);
    if (problem !== null) {
      return { usage: [`evals-baseline: ${problem}`, usageLine] };
    }
    if (token === '--strict' || token === '--replace') {
      taken.set(token, true);
      continue;
    }
    const read = readFlagValue(token, rest[index + 1]);
    if (read.problem !== undefined) {
      return { usage: [`evals-baseline: ${read.problem}`, usageLine] };
    }
    taken.set(token, read.value);
    index += 1;
  }
  if (files.length !== 1) {
    return { usage: [usageLine] };
  }
  return {
    verb,
    runFile: files[0],
    baselinePath: taken.get('--baseline') ?? defaultBaselinePath,
    strict: taken.has('--strict'),
    replace: taken.has('--replace'),
    tolerance: taken.get('--tolerance'),
  };
}

function readInput(io, path) {
  try {
    return { text: io.readFile(path) };
  } catch (error) {
    if (typeof error?.code === 'string') {
      return { failure: error.code };
    }
    throw error;
  }
}

function attempt(read) {
  try {
    return { value: read() };
  } catch (error) {
    if (error instanceof Unreadable) {
      return { refusal: error.message, problem: error.problem };
    }
    throw error;
  }
}

function examine(state, runFile, baselinePath, io) {
  const baselineInput = readInput(io, baselinePath);
  if (baselineInput.failure === 'ENOENT') {
    state.findings.push({ id: 'no-baseline', file: baselinePath });
    return;
  }
  if (baselineInput.failure !== undefined) {
    state.findings.push({ id: 'bad-baseline', file: baselinePath, cause: 'cannot-read', failure: baselineInput.failure });
    return;
  }
  const baseline = attempt(() => readBaseline(baselineInput.text, baselinePath));
  if (baseline.refusal !== undefined) {
    state.findings.push({ id: 'bad-baseline', file: baselinePath, cause: 'refused', problem: baseline.problem });
    return;
  }
  state.baseline = baseline.value;
  const runInput = readInput(io, runFile);
  if (runInput.failure !== undefined) {
    state.findings.push({ id: 'bad-run', file: runFile, cause: 'cannot-read', failure: runInput.failure });
    return;
  }
  const run = attempt(() => readRun(runInput.text, runFile));
  if (run.refusal !== undefined) {
    state.findings.push({ id: 'bad-run', file: runFile, cause: 'refused', problem: run.problem });
    return;
  }
  const result = compare(baseline.value, run.value);
  state.findings.push(...result.findings);
  state.notes.push(...result.notes);
}

function runCheck({ runFile, baselinePath, strict }, io) {
  const today = io.now().toISOString().slice(0, 10);
  const state = { baseline: null, findings: [], notes: [] };
  try {
    examine(state, runFile, baselinePath, io);
  } catch (error) {
    state.findings.push(internalError(error));
  }
  const output = render({ baselinePath, baseline: state.baseline, findings: state.findings, notes: state.notes }, strict, today);
  return outcome({ stdout: output.lines, code: output.code, findings: output.findings, failing: output.failing });
}

function loadRun(runFile, io) {
  const input = readInput(io, runFile);
  if (input.failure !== undefined) {
    return { refusal: describeCannotRead(runFile, input.failure) };
  }
  return attempt(() => readRun(input.text, runFile));
}

function runShow({ runFile }, io) {
  try {
    const run = loadRun(runFile, io);
    if (run.refusal !== undefined) {
      return outcome({ stdout: renderShowRefusal(run.refusal), code: exitCode.notEvaluated });
    }
    return outcome({ stdout: renderShow(run.value, runFile) });
  } catch (error) {
    return outcome({ stdout: renderShowRefusal(describeFinding(internalError(error))), code: exitCode.notEvaluated });
  }
}

function refusalReason(run) {
  if (run.errors.length > 0) {
    return `the run has errored samples (${run.errors.join('; ')}); fix them and run the suite again`;
  }
  if (run.cases.count === 0) {
    return 'the run holds no cases, so a baseline of it would guard nothing';
  }
  if (run.metrics.length === 0) {
    return run.refused.length > 0 ? 'every metric in this run was refused by the reader' : noMetricAdvice(run.tool);
  }
  return null;
}

const unreadableBaselineAdvice =
  'the existing baseline cannot be read, so recording over it would discard its tolerances; fix it or delete it, then record again';

function loadPrevious(baselinePath, io) {
  const input = readInput(io, baselinePath);
  if (input.failure === 'ENOENT') {
    return { previous: null };
  }
  if (input.failure !== undefined) {
    return { refusal: describeCannotRead(baselinePath, input.failure) };
  }
  const baseline = attempt(() => readBaseline(input.text, baselinePath));
  if (baseline.refusal !== undefined) {
    return { refusal: `${baseline.refusal}; ${unreadableBaselineAdvice}` };
  }
  return { previous: baseline.value };
}

function findingsReplaced(previous, run) {
  if (previous !== null) {
    return compare(previous, run).findings;
  }
  return [];
}

function writeBaseline(io, baselinePath, text) {
  try {
    io.writeFile(baselinePath, text);
    return null;
  } catch (error) {
    if (typeof error?.code === 'string') {
      return `cannot write ${datum(baselinePath)}: ${error.code}`;
    }
    throw error;
  }
}

function recordRun({ runFile, baselinePath, tolerance, replace }, io) {
  const refused = (reason, refusedMetrics = [], held = [], notes = []) =>
    outcome({ stdout: renderRecordRefusal(reason, refusedMetrics, held, notes), code: exitCode.notEvaluated });
  try {
    const run = loadRun(runFile, io);
    if (run.refusal !== undefined) {
      return refused(run.refusal);
    }
    const reason = refusalReason(run.value);
    if (reason !== null) {
      return refused(reason, run.value.refused);
    }
    const existing = loadPrevious(baselinePath, io);
    if (existing.refusal !== undefined) {
      return refused(existing.refusal);
    }
    const toleranceProblem = toleranceRefusal(run.value, tolerance, existing.previous);
    if (toleranceProblem !== null) {
      return refused(toleranceProblem.reason, [], toleranceProblem.held);
    }
    const next = record(run.value, io.now(), tolerance, existing.previous);
    if (existing.previous !== null && isUnchanged(existing.previous, next)) {
      return outcome({ stdout: renderRecordUnchanged(baselinePath, existing.previous, run.value.refused) });
    }
    const replacement = replaceRefusal(baselinePath, existing.previous, next, replace);
    if (replacement !== null) {
      return refused(replacement.reason, [], [], replacement.notes);
    }
    const replaced = findingsReplaced(existing.previous, run.value);
    const writeFailure = writeBaseline(io, baselinePath, baselineText(next));
    if (writeFailure !== null) {
      return refused(writeFailure);
    }
    return outcome({ stdout: renderRecordWritten(baselinePath, next, run.value.refused, replaced) });
  } catch (error) {
    return refused(describeFinding(internalError(error)));
  }
}

const verbs = { check: runCheck, record: recordRun, show: runShow };

function cli(argv, io = defaultIo) {
  const parsed = parseArguments(argv);
  if (parsed.usage !== undefined) {
    return outcome({ stderr: parsed.usage.map(printable), code: exitCode.usage });
  }
  if (parsed.version) {
    return outcome({ stdout: renderVersion() });
  }
  return verbs[parsed.verb](parsed, io);
}

{
  function ignoreClosedReader(error) {
    if (error.code !== 'EPIPE') {
      throw error;
    }
  }

  process.stdout.on('error', ignoreClosedReader);
  process.stderr.on('error', ignoreClosedReader);

  const outcome = cli(process.argv.slice(2));
  for (const line of outcome.stdout) process.stdout.write(`${line}\n`);
  for (const line of outcome.stderr) process.stderr.write(`${line}\n`);
  process.exitCode = outcome.code;
}
