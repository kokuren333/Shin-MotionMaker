# M8 コミットハッシュの対応表（author・committer の noreply 書き換え）

2026-11-14、オーナーの明示決定（23:38）により、公開前にローカル履歴の全コミットの author・committer を `kokuren333 <50736503+kokuren333@users.noreply.github.com>` に書き換えた（`git filter-branch --env-filter … -- --all`、113 コミット・13 ref）。木（ファイル内容）・著者日時・メッセージ・親子関係は変えていないので、各コミットの中身は同じで、ハッシュだけが変わった。

M0〜M7 の文書・証拠（`VERIFICATION.md`、`docs/work/*/`、証拠の JSON）に書かれた Shin-MotionMaker 自身のコミットハッシュは、すべて書き換え前の値である。記録は当時の証拠としてそのまま残し、公開 repo で辿るときはこの表で新しいハッシュに読み替える。原典 BiimMotion のハッシュ（`262c798`、`955fa5c` など）は別 repo なので影響を受けない。

対応づけは、書き換え前後のコミットを「木・著者日時・件名・（対応づけ済みの）親」で突き合わせ、113 件すべてが一意に対応することを確かめて作った。

| 旧（短縮） | 新（短縮） | 旧 | 新 | 件名 |
| --- | --- | --- | --- | --- |
| `2e2d3c4` | `e53dd3a` | `2e2d3c4b1947b2d9c49edfcad09e22d0f373d0e1` | `e53dd3af5fb3586379750417d824d8aff6cb08d8` | M0: preserve canonical requirements |
| `f505f59` | `cf8a2f8` | `f505f5995bfdf0920057779516816ee306e45d22` | `cf8a2f81c8024377c36ea6c83d558e1724c1440d` | M0: initialize development harness and shallow CI skeleton |
| `75ab1a6` | `ff0c3eb` | `75ab1a6d0cec17cff5547dc4474f407b66699e00` | `ff0c3ebbcb5275d483847b72c0765d83c5d6933f` | M0: capture ten upstream golden cases and baseline test inventory |
| `35b3c20` | `643bfb5` | `35b3c2069f19c90982337b536ed968cc00bb97ce` | `643bfb50b15e761d19328a99e17b39596cad2d57` | M0: define shared interfaces and document capture evidence |
| `6d92687` | `7e90afd` | `6d9268774370eeda30f0b2312ff4762c6410ad35` | `7e90afde0c3c33fb2ea13a012d37449e9c675c3a` | M0R: review CONTRACT.md |
| `6629a76` | `681320f` | `6629a761bec56a2e784e00e891422324c4caf200` | `681320ffb2a9951476da5c471db390262dac33a2` | M5: copy reused CyberSprite icon sources and palette unmodified |
| `8638331` | `1e8b8fa` | `8638331e02b09af28bfc1a7b24cc7f7b2e79b42e` | `1e8b8fabc3d80d55b00a0044edb68b3d08c4811b` | M5: draw thirteen original icons with the CyberSprite CLI |
| `877f11e` | `427b899` | `877f11e21a68b321599af26535fdebca37d995b1` | `427b899d954c8ba99e780faad17af3a63ebe4db5` | M5: export icon PNGs with provenance manifest, TS-09 test and notice |
| `885e039` | `d6c0aff` | `885e03908c824dfe234641ca17c376a52131a99e` | `d6c0aff629c96ef1dcb98bd287e060608542d50b` | M5: report icon work with validate evidence and contact sheets |
| `2579d78` | `33a0090` | `2579d78bc02534fdec1994814f7a2225d6946bd8` | `33a0090d00ae275a776cdfb78688ea3549d33f36` | M0b: capture diverse attachment MIME baseline |
| `dea0886` | `fe82814` | `dea0886b0a581c8109623911af9ebf8929998c92` | `fe82814b5390636123f709e22449e0032ddbec4f` | M0b: preserve synthetic PDF fixture bytes |
| `6bb8c5b` | `17c0eac` | `6bb8c5bc3d1e6b8e1740ad3dc468cd455656d978` | `17c0eacb0197b8e67386e4197d559e7aee66d43a` | M0b: revise shared contracts after M0R review |
| `9e96420` | `942c9a4` | `9e9642099c94a0d99661b9778546da5cebbeebac` | `942c9a444a6868d465ec6c95c0f45050036a4dc5` | M5R: review icons |
| `aa215fd` | `6b6f100` | `aa215fd6ee6894d5ec6cf777a1d1b2009bdede89` | `6b6f1009336dc3c351a9e7c218fa88def8ad8ad3` | M5: redraw style icons at equal weight and gate as a boom barrier |
| `89af302` | `65322cb` | `89af302a9ad97ec94763211e164f93c55f257179` | `65322cbb5af0bfb3e1f24a6745769897a344f8aa` | M5: assert original icon author is recorded instead of a fixed name |
| `5ddb974` | `92690bd` | `5ddb97410adc148a13362fe647387b532b7847a4` | `92690bd5be95782cd56cad7a812ad24e36744908` | M5: add style-order and before/after sheets and report the M5-fix |
| `fd03fff` | `6967bd0` | `fd03fffb0ca266e5f7e4829e5cac8cf706a0dae4` | `6967bd02e906468f1f7e45987dbdebb2cf053fe9` | M5R2: re-review icons |
| `651342f` | `5808227` | `651342f46de3ebfb634724d257bf4592e71013c0` | `5808227d70095c97b04f55724654625938d0538f` | M5R2: drop a mistaken off-center note from the re-review |
| `8c984d4` | `778210a` | `8c984d4d3ef45eaa2599e1ee2f720ea816add391` | `778210a8a51a0d0bdb295f935581ac6515853610` | Merge M5: icons (reuse + 13 originals drawn with CyberSprite) |
| `9d9f9d2` | `1df9ebf` | `9d9f9d2bab20badc7739c41de69846259103d594` | `1df9ebfbcd5b46057720d38ee8c28651ad6b0fa8` | M1: port the generation core and preserve upstream job baselines |
| `d2ec222` | `974315d` | `d2ec222c7e3c96953ca38e9d7e6fc30b99e5c0e6` | `974315d65adb8af090fc55fe0cb06b21b279cd47` | M1: record porting evidence and review handoff |
| `43b6d85` | `8eee778` | `43b6d8517670b0a0449cf5855019d6edee53ab55` | `8eee7786e800adf86f64d1e7b8131c1fff6997d9` | M1R: review core port |
| `3919845` | `47fb5a2` | `3919845eeb7bf5bfd655e233f23e3edac7a82038` | `47fb5a20e01acfbf133a21ba1dcbe123e6a2b113` | M1: preserve validation output and restore upstream test assertions |
| `0628273` | `fc6a339` | `06282735ca26831045a0943a8fceb7fc61fd0a7a` | `fc6a33972fd235cbf63411c7fbd369ec5b8f8f2d` | M1: document cross-review fixes and verification evidence |
| `288b0ab` | `0fae153` | `288b0ab6de585f0c291fd7fa228f47df054a56ac` | `0fae15368cb12aeefdd691c7c278cc418b8d17c5` | Merge M1: core port, job-template, upstream tests, baseline checks |
| `686d78e` | `82f4d35` | `686d78e51fd81b4dd4db13251441bf5c8c780676` | `82f4d35cab35dd6be0c51d38fa092ce2d8a93e94` | M2a: implement host operations and detached run lifecycle |
| `c7da8bb` | `0e008bb` | `c7da8bbbb99d214aaa64caf87156b2802ee63ce7` | `0e008bbbc674b89a857d62ed11353c2c09189ffd` | M2a: expose BOM-aware text input for CLI adapters |
| `21787f8` | `1840813` | `21787f8e5d3398081d4975ffdae6bd848d77fe6a` | `1840813b0e70de7b33ac48bd0321976e5251229d` | M2a: record Windows verification and review handoff |
| `a089d5f` | `ee3037d` | `a089d5fd52f4b7e21e4635a6a882de526fbe084b` | `ee3037dac93daa773dfc75ce22d379a7bb8e0869` | M4: set up the gui workspace with copied CyberSprite tokens and a Pages build |
| `c262177` | `f1673e2` | `c2621776987e14f5c326c2c343f087b43a1bc866` | `f1673e2a68172b3feb80990547602c7f4f9c6743` | M4: port the upstream GUI onto core with request.json, inspection and CLI/MCP sections |
| `49f5b94` | `ac3a1ca` | `49f5b94827f768e74274896246fba02cddca665c` | `ac3a1cac2507226fd9b5d4065614dad4619b8238` | M4: test tokens, contrast, request I/O and every GU-02 item in a headless browser |
| `e32b689` | `264598d` | `e32b689b1d3b5ee664a72cd56aa0a452317d8e7c` | `264598d8e61827639bd0da4302fd900eec67f18e` | M2aR: review host |
| `28c7191` | `86455c2` | `28c71915807917421038b976e86c3f3df15fbcb2` | `86455c28d62c053c7dfd56622d223afedeeb2c37` | M4: use the on-text role on filled TOC and tab items and check rendered contrast in both themes |
| `6471c8c` | `09250ec` | `6471c8cf3428d28b31c1c139669af603772e1c6e` | `09250ecb0cc261b118ed64482c1884d413ea6b44` | M4: write DESIGN.md, record screenshots and verification, fill the theme NOTICE and report |
| `494769a` | `accf148` | `494769abb4d194a41b77b27cc22facc151a8a8b5` | `accf148fe04a5842ce9605f1bf887ce4a758c109` | M4: record the final ci-local run |
| `3077c70` | `73e2bf8` | `3077c7014669b59760d8462a9cd2e8072e216335` | `73e2bf845eb924d2955396fa7bc5ceb962073d96` | M4R: review GUI |
| `2792f36` | `2027eea` | `2792f369240ab64eac41f7d9649a9e56397ae2d7` | `2027eeae6ba9c0524eb6d223b1cc1d924b132f59` | M2a: harden path checks and process ownership after review |
| `1c1eac1` | `bf4e060` | `1c1eac1e3b5489931dc9e116a427b8726fad4e77` | `bf4e0600b5467e24e2fa92a8cda35dfe89722950` | M2a: discard identities captured after child exit |
| `5af47bf` | `7ee320b` | `5af47bf586d8fa9331d798d3339a28dfcb9a9d38` | `7ee320b2822c3d4b857102a683b073fb1b44cede` | M2a: record review fixes and Windows verification evidence |
| `b48092a` | `cee5df6` | `b48092abcab33747f8f3c1bb08ddd483eb1e42ca` | `cee5df6b84788c4b720e6929f99789daff1b5cfd` | M2a: clarify direct CI exit-code verification |
| `81fcd9f` | `b102fb1` | `81fcd9f3c35172e30c24bbafdef36bd7436ede27` | `b102fb1d8512b20523f5a9c81eb91ce6233928b4` | M4: reject unknown fixed-choice values on request import using core checks |
| `19cffbb` | `b70daa6` | `19cffbbed7b7ba0a72ebe56d0a5fc333f04d7b74` | `b70daa6363f832d65953389e3f5cf4bb3fc46418` | M4: show QC waivers, review_mode and gate rows for run.json through the same view |
| `d403e58` | `3404a28` | `d403e582ec64400512d246c84e15971769e41cf6` | `3404a28d907ae9797b8f967c8e4984414da28ed5` | M4: quote CLI examples per shell for PowerShell and POSIX |
| `49a11e6` | `aad39a1` | `49a11e6854d3789346f79bf41c16ca07e82eac8d` | `aad39a16ba4379da9e1c36c3de846368f22f81c6` | M4: keep input on failed import and avoid smooth scroll under reduced motion |
| `e07672d` | `59654fe` | `e07672de4a9507d6fcda24f923386c6970788f25` | `59654fe301ae05522f95e81c633b57883da13d60` | M4: add e2e for the M4R fixes, style and full-screen keys, keyboard states and progress |
| `c269ef4` | `bcb10ec` | `c269ef4222453aca2ff7f740b1c3b1faf45e9b85` | `bcb10eca0f0ce312575821efc48967b641789bdd` | M4: add a screenshot of the invalid-choice import error |
| `0787aea` | `e9f3f3f` | `0787aea47a0a6fe1a3d01ca59951bd4451d7a977` | `e9f3f3fec6db3bc96fce382329352ca88c0e5edc` | Merge M2a: host, run ledger, operation table, schemas |
| `9f08db5` | `c12f4eb` | `9f08db52726416520362473c5b85cdbe1e1f3a80` | `c12f4eb365452e27c0f67b8e3151392056dc2221` | M4: add screenshots of the per-shell CLI examples and a QC run record |
| `2c27553` | `5a6bab7` | `2c27553497ea5299875d78461e87278be64af1dd` | `5a6bab7d0aece2fefc7485cafbd873d79260c5dc` | M4: retake screenshots after the M4R fixes and update VERIFICATION and DESIGN |
| `4ed3968` | `ec98d8f` | `4ed39689146317ebf453f52bf6060d852599920f` | `ec98d8fc47e312e38aed514e27cc95e736cfae54` | M4: report the M4-fix, correct the AR-06 evidence scope and ask about core choice sets |
| `f943fbf` | `79f3f11` | `f943fbfd54c1f9e8abff242a32ebdd13ea0e8f36` | `79f3f11175ca599329cd7e70aaffc213890c5e08` | M4: record the ci-local run after the M4-fix |
| `00065e3` | `3528f14` | `00065e3a852a92d131d0340aa7f5aee42825af78` | `3528f14afd48af9a6e9b8a16f90f3a2ef6e0a889` | Merge M4: GUI (theme, upstream features on core, request.json, inspection, CLI/MCP section) |
| `809cab5` | `c4b127e` | `809cab5b87ec036ce568d06bb9b0bd4463767d50` | `c4b127eca3f65e05a5f2b7adcae7bca746cd130d` | M3: add stdio MCP adapter and protocol tests |
| `149257e` | `0609edb` | `149257ead7f560a22c818461255ce57688acdb84` | `0609edb216351b21811c20d78ca20911f872501e` | M3: fix npm workspace setup paths on Windows |
| `408f68e` | `e44eb85` | `408f68e3c10f7a1264ea9fc03d3ff894fd6612a2` | `e44eb85170ef8733e2de782afcb6d911541138ee` | M3: document MCP usage safety and execution evidence |
| `cfe8593` | `d08f6e6` | `cfe8593eaf8689eaee7f66d5180816a524f3e7a4` | `d08f6e6bb4fa42fc830f1084b88182e452f7afd2` | M2b: add table-driven CLI and verify script exit mappings |
| `1c095a2` | `8088c8e` | `1c095a2ae7247f52f0f993ea4889b804cfe71ddf` | `8088c8ea6dfcaffcfe473077a8caf47a32c50ef5` | M3: record shallow checkout verification results |
| `3fa5773` | `5d7d088` | `3fa5773a75d6cbad392e347417cc9c68db2c1eee` | `5d7d088089139244c21e0a98ab80ef8d38d62d35` | M2b: preserve detach start success for immediate script failures |
| `590bf2b` | `8320472` | `590bf2b7e17d716817b47161c920e7454413ceef` | `83204721a63e39a60c8d246709740ae66a983cb0` | M2b: keep canonical command names in usage error envelopes |
| `de4809c` | `ed4edae` | `de4809cd18ce1249ba4294bb71d9c6af98aefee6` | `ed4edae87f73b721ea5612ec6c7eac2c37c60842` | M2b: synchronize detached lifecycle tests without timing assumptions |
| `647de6f` | `dc6682d` | `647de6ffbc9583c208e37ce0b6f9f17c9e15b554` | `dc6682d632f2525fc3ab1c4c29c319397367c924` | M2b: record final shallow-checkout verification evidence |
| `91c939f` | `a0e7d1f` | `91c939f33339d9576a6fc444c90b9242ecfa4dbf` | `a0e7d1fb894e3b18df3fa0d7414fa95b4614073f` | Merge M2b: CLI (table-driven commands, envelope, exit codes, docs/CLI.md) |
| `9cb0afe` | `3ebbf76` | `9cb0afeed4ea918c4e0163d1f269fde3fe0c8b2a` | `3ebbf762640a11b1c99f5d09391d9338823d604c` | M3R: review MCP |
| `7196448` | `a593db7` | `7196448fdd74d84c2cf94d10e20db7a1bfb3d946` | `a593db76b999669fc47236f8a0f9dba7bd7d028c` | M3: merge main CLI and GUI integration |
| `e776002` | `502d0d8` | `e7760029fedce8881d2eae99da3e234d3e4169fc` | `502d0d8b2b7cc8d40902182d9c41710cd619f435` | M3: fix MCP image delivery and connect the built CLI |
| `7baaac7` | `63c9b1d` | `7baaac705f736c5f64715e24f1050781c4a3e9b6` | `63c9b1d5b47822753aa0a8d34f374ab794671a04` | M3: document approved MCP image contract and CLI registration |
| `ff7ebca` | `944a9ce` | `ff7ebca51d0053e2f5db359e7c3548aab8b79106` | `944a9ce025a3119669ab5b414ebda486dcfbf965` | M3: align existing tests with MCP startup and image limits |
| `07a730b` | `955d595` | `07a730bc82afddb590fdbd9206049fe939241def` | `955d59594d6c031948ae2e8c73fb083e79fda7cb` | M3: record fix verification and review handoff |
| `f40fb77` | `f82d35d` | `f40fb773c2a1eb566964201fb21a03b9522eb47e` | `f82d35daa56768cdc79c00fb419745bb1b0aba63` | Merge M3: MCP stdio server, tools, safety, CLI wiring |
| `c72f3dc` | `1a57ed6` | `c72f3dc6b59c667471e9d891b791f233dd279d7b` | `1a57ed6a518c2e2db9106dcdb569c71905705c00` | M7: share existing form choices across request validation and schemas |
| `6bc44bf` | `3cc5b8d` | `6bc44bf642ff8660e4fd37eddc89374a7092ebe9` | `3cc5b8d8a6ee53062428862b07b9ff1ca4f82e1f` | M7: verify browser CLI and MCP generation and read parity |
| `f98dc05` | `db24f71` | `f98dc051fff88ca4c7eefba4db60e9819913e349` | `db24f715bfc115a2363810764cc970e9e2a92e72` | M7: add real runtime orchestration and Pages verification tools |
| `3232feb` | `40c2c89` | `3232feb55b4588bcc0492f09e8bd3ff77caf93d4` | `40c2c89c5405bf28c29194628701b55c14809b54` | M7: keep invalid object diagnostics separate from enum checks |
| `506a5a8` | `444bfc4` | `506a5a893cbb4da0aabfbfa82ecc1d75f6c00d3f` | `444bfc41fdfbc97f9815fe6ed308bd75e0a74474` | M7: synchronize detached MCP restart verification with a release file |
| `7cb015a` | `0283314` | `7cb015a74590c162ca63bf26c405a27a5079aea3` | `0283314f2647ad216ef2eea95c772550c1bdbb0d` | M6: complete the root development harness AGENTS.md |
| `02a101e` | `95c6576` | `02a101e77c790739bad6cb99c967f917bcea33e7` | `95c65764e89c4181d0c47fbd1bd3ef7f910dbb15` | M6: add the user README for GUI, CLI and MCP |
| `89f17df` | `5cf9c37` | `89f17df0b2bed2cf13e365d2d54bb96e8aa3c83d` | `5cf9c37c47000c204198134748db83b9cac40007` | M6: polish the CLI, MCP, design and workflow documents |
| `39fde49` | `88e7d52` | `39fde49a92ddefc249ccee1584718b8e257ac223` | `88e7d52285b691cbe899305f0093823f1977c80c` | M6: refine the job README CLI/MCP section and bump the template to 0.5.2 |
| `c055d99` | `c0e92e5` | `c055d99d819752d67022a1b1033d20f47ac7ded4` | `c0e92e5262dc0cd3eb40f2858f6e6ffbb7bdd60f` | M7: record Windows Tier B Tier C legacy and Pages evidence |
| `af0b5eb` | `4979f31` | `af0b5eb1ba1c600878abca10cf45d5b0ac48a44b` | `4979f31af2aaeac03373eb6a65398249433711e3` | M6: record command evidence and the M6 report |
| `7741d95` | `a29e473` | `7741d9594e30305339b8736ee6e2c49591c89384` | `a29e4739e544dda1885b635ac09f155e6953dd3a` | Merge M6: README, AGENTS.md, polished CLI/MCP/DESIGN/WORKFLOW docs, job README R3 section |
| `47de25f` | `abdae03` | `47de25f6908b4401ebc1258dd6d584390b96aee0` | `abdae0301b3e6d7a84686c5f5081228d6ba3724e` | M7: finalize clean-clone integration verification records |
| `6789f2a` | `aaa874f` | `6789f2a2abb4a6ef4b98d5c23eb14b3a511f805f` | `aaa874f787540f03ee1e2f461bc4786f0ad83197` | M7: merge M6 documentation updates from main |
| `94e1ab6` | `44a1fbc` | `94e1ab6093a4433e9b7581a6a47d4b26866f4766` | `44a1fbc0acdc803f1c0e4d0f4aba995ca54e7772` | M7: verify CLI lifecycle and audit all dependency licenses |
| `1437320` | `4be5798` | `143732025ef64fef1f572658dca60695bcb80d7b` | `4be57985f2d0a2ba83af76cc54fcbf0bc52c4dbd` | M7: account for libc in optional dependency license coverage |
| `5b43fa9` | `c011fe0` | `5b43fa9d6c05720b5c44fe2da47036d7843ae2ca` | `c011fe0c12b04788cc963eddb78dedf8a465ae2d` | M7: document integration checks after the M6 merge |
| `bc99306` | `be730b4` | `bc99306326622d9ff52cdb134b47bf22a0c2a423` | `be730b4e3fd8fc913204e6a715689d57de28db5e` | M7: retain addendum command and license verification evidence |
| `34a203e` | `73518c9` | `34a203e69f31dada11dc496e3d78fcda122dc0cb` | `73518c94cb9186e48ad83bd88e3eee4b731dd8c0` | M7: record addendum clean-clone and Pages verification results |
| `e5b7c53` | `e1d43e9` | `e5b7c53819b3c600404a449ebb9e24bcdbf67d38` | `e1d43e9710615af99a59a036f96d615d408a03e5` | Merge M7: integration (formChoices, 3-entry parity, Tier B/C on Windows, JT-12, verify-pages, license audit) |
| `14c6f16` | `72c457a` | `14c6f16ae063917319dfdedc0e754261625f37cc` | `72c457ae10b9f27f53430e6f6b3273eb989c7208` | G4: integration review |
| `0df32f3` | `fd37866` | `0df32f34d52f5bceb7acd6bdd5c3f547dfac20be` | `fd37866d2aaae6a136b726dd250235c443f78ef7` | L2: publish orders, acceptance records, plan and question status under docs/work (G4-M2) |
| `780951a` | `89836e8` | `780951a7ce228c0e3c607fe8e0cc7f97ef09e8d1` | `89836e8f390e3273b8c60227e35a1797c739c280` | M7-fix: preserve launch errors and original input compatibility |
| `859dbcb` | `86cf20b` | `859dbcbd1f2a32803979b84bda88be409108c1cd` | `86cf20b4c7b6c4a816dbf2360af5f3e996795e15` | M7-fix: pin baseline differences and verify evidence revisions |
| `278f133` | `bd32cda` | `278f133af3f63138260c9a16bcbdef4d0ab2e596` | `bd32cdac779c9591cacc342c53fb274df8c35b28` | M7-fix: align contract and document review fixes |
| `c9fb606` | `41fc60e` | `c9fb60697ebb0f8ebaf7ecbb813d5d4fbd54d6d8` | `41fc60e9c8668c280d07af7400f0246efc44d5b9` | M7-fix: merge main before final verification |
| `94ed115` | `ad2e6c9` | `94ed115ff66bea5f49277e113d68582949aea131` | `ad2e6c9446ee336e7a76f985fe432b859f8d5c6b` | M7-gui: explain request.json import errors for screen users (R-10) |
| `8d2369b` | `b9d8f71` | `8d2369bdbf52714238b489dae9886162177fd20b` | `b9d8f71bba7e655f7e589b557738c65c7ee4fcef` | M7-fix: record GUI fixture mismatch and revision guard evidence |
| `f8bf74a` | `460610e` | `f8bf74a22316c4c5bba5ac44652939d571909829` | `460610e7f5ea4e00ae973c12215ca496450be7e0` | M7-gui: retake GUI screenshots at the R-10 commit and record them (G4-M1) |
| `7c4f7c0` | `97904c0` | `7c4f7c0d93ae58b7b4d6b2c462f0a5cd9c77cf74` | `97904c0eb20dc12e74960cf1897a4d5a11d9900a` | M7-fix: allow completion margin in MCP progress verification |
| `c0d10ca` | `85a1c6e` | `c0d10ca798b2689a50e91f3556dc73c09cfa3391` | `85a1c6eb75b0f2458bb0385757d56b03e51e67d4` | M7-fix: record integration timing failure and recheck |
| `4ff67bd` | `2822173` | `4ff67bdf446bbeefe8f84aea830a6ab1a540c34b` | `2822173896c18ab82c7e5d8c5595708f8cf23cf7` | M7-gui: report R-10 decisions, screenshot differences and test evidence |
| `b23dc19` | `68bdd3e` | `b23dc191f24e6a96cfd87a167aecc9c6071f2ee6` | `68bdd3e6ebbc38bceb2bb0d79336fcd02c437e01` | M7-fix: record final runtime evidence and outstanding GUI fixtures |
| `e10f571` | `99950e2` | `e10f571c77045a884496413341abbcd56b86ba9a` | `99950e2470831e4cd5244b4ab0345bf0821e78ea` | Merge M7-gui: GUI import error wording (R-10) and retaken screenshots (G4-M1) |
| `f6b4153` | `b8056a8` | `f6b4153ed3a6baad37584c8afed47430f3933973` | `b8056a86daa1119d26124d4e356bae0ddabb5be2` | Merge M7-fix: G4 recommended fixes and final runtime evidence |
| `4cafdbe` | `030309d` | `4cafdbe79cd2232361c8891f1485066d02d5b6ca` | `030309dc6348737f780bc1fede5489e2909388e1` | M7-final: align GUI import fixtures with active character checks |
| `c3cfc12` | `24be482` | `c3cfc1297fde70449e71515b1c83fd8cf4a41805` | `24be482463b1e4a2f237a0c080cf54cc88c9441c` | M7-final: record integrated verification and L2 answer |
| `ec800cb` | `1dc3e0e` | `ec800cb45dd50114b2641e0b6abe6af1405851d5` | `1dc3e0e75e8231c6ec810d55474fc755097d2679` | Merge M7-final: GUI test alignment and integrated verification |
| `7d92314` | `3b456fa` | `7d92314f24e7bff710d8b36731bef03ce865df52` | `3b456fa1e9d305568f481a8519c199b91cf86264` | G4R2: re-review integration |
| `41ee245` | `87335db` | `41ee24582f0b330783ed5b0a6d8d400e90ab469d` | `87335dbcbb90823af12e226bacdc581c0de0d4ca` | M7-detector: detect static command prefixes in templates and concatenations |
| `76527e6` | `0f5aeda` | `76527e684a314ac258e02b18bf2df97cc9f4c324` | `0f5aeda617441166bdb96cae20b27717b3c05ea9` | M7-detector: record regression and depth-one CI verification |
| `17d8112` | `98b4115` | `17d8112037e607c54b48d5ac8808b0f17154eabd` | `98b4115f6449f66ac3df56deaa9a6af6e1f9d617` | Merge M7-detector: detect git launches in template literals and concatenations (G4R2-R1) |
| `c5edd07` | `4e92b30` | `c5edd07ff420c100a471e31ef2b863a787dec321` | `4e92b3058aea6bce5336388c84f800bf26f5da5b` | L2: record M7 acceptance, post-G4 orders and status (G4R2-M1) |
| `d34de11` | `20f93e9` | `d34de1194f01117e996c20079612958d9d0e8f6a` | `20f93e9d3697d3da2967c4d7cd95412a17ef6c39` | L2: final ledger entries |
