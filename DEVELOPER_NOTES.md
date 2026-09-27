# Notes for Shu'la Lab (English, French version below)

> **Since 27 September 2026 there is no separate studio package.** Everything is published in the
> public GitHub repository of the patch, free of charge and without any condition: take whatever you
> find useful and integrate it as you see fit. The "package" described below is still produced by
> `node release.js` (`release/studio/`), with the translations laid out in your own structures.

This package is a complete French localisation pass for **Homicide Desk** (Steam app 4935210,
Steam build 25152927, September 2026). It was made by a French-speaking player who
wanted a French version with exactly the same clues, tone and immersion as the English original.
Everything in this package is offered for integration, free of charge and without any condition.

The texts were written **from the English original**, not by editing the existing French. Every
French string of the seven cases was read against its English source. The player patch that
applies the same texts to an installed copy is published separately: you do not need it.

## 1. What is in the box

This package holds only the translated data, laid out in your own structures: no script, nothing
to install.

| File | Content | Game structure it maps to |
|---|---|---|
| `cases/case-00X.fr.json` | The complete French object of each of the **seven** cases, 2 493 strings (2 195 of them rewritten). Cases 005 and 006 are new | The `fr` entry of each case in your translation map, same shape as your current objects |
| `ui/fr.json` | The complete French UI dictionary, 1 687 keys, ready to replace yours | The French UI dictionary |
| `ui/fr_additions.json` | The 74 keys that had **no** French value, already merged in `ui/fr.json` | Same object, for review |
| `ui/fr_overrides.json` | The 71 corrected entries, already merged in `ui/fr.json` | Same object, for review |
| `prompts/systemPrompts.fr.json` | The 32 character sheets, `{ "case-001": { "<character id>": "<French>" } }`, 73 068 characters | `suspectData.<id>.systemPrompt` and `witnesses[].systemPrompt`, see point 40 |
| `strings/strings.fr.json` | Every string that lives in code rather than in the dictionary or a case object, as « text currently in build 25152927 » → « French », one section per surface | Literals of the bundle |

Sections of `strings/strings.fr.json`:

| Section | Content |
|---|---|
| `languageDirective` | The French language directive for suspects (`wI.fr`), point 10 |
| `promptEnglishLines` | 3 English lines the interrogation prompt adds outside the dictionary: `[The detective places evidence…]` and two language reminders |
| `ruleBlocksAndLiterals` | 10 hard-coded strings: 4 Atlas blurbs, an internal label table, and the 6 rule blocks of the system prompt (`i2`, `s2`, `uu`, `n2`, `r2`, `o2`) |
| `promptFragments` | 16 fragments the code assembles into the system prompt: block headers, the three moods, the H. Whitmore SMS contact (case 000), the prosecutor's clerk. They are template segments, the `${…}` interpolations must stay where they are |
| `inlineMultilingual` | 4 inline `{en,ar,zh,fr,…}` texts: charge names, wrongful-arrest counter |
| `scriptedTextFixes` | 13 replacements applied to your French texts wherever they appear, dictionary included: document names in the tutorial, gender agreement of the player, title of case 000, and the ROT-13 word list of point 7 |
| `weather` | 7 office weather descriptions, keyed by English text (point 5) |
| `radioIncidents` | The 7 daily radio incidents, keyed by English brief (point 4) |
| `cadTerminal` | CAD terminal: codes, locations, tips, 17 Atlas POI labels, 3 unit statuses (76 entries) |
| `precinctChatter` | 64 precinct feed lines per case, in array order (`precinctChatter[i].text.fr`) |
| `paperHeaders` | French table for the 3D paper headers, stamps, watermarks and footers (`ka` table, point 3) |
| `caseDates` | The 7 case dates (point 12) |

**`prompts/` and the code sections of `strings/` are the ones worth your attention.** They exist
only because those strings have no dictionary key, or, for the character sheets, because the merge
never reads them from the localised file: our patch had to replace them by their literal value.
Giving them a key, or merging `systemPrompt`, would remove the need for that mechanism entirely,
for every language, not just French.

Counts: 2 195 case strings rewritten out of 2 493, 74 dictionary additions, 71 corrections, and
outside the case files 64 precinct lines, 7 weather descriptions, 7 radio incidents (35 strings),
76 CAD entries, 4 inline texts, 10 literals, 16 prompt fragments, 13 scripted text fixes and
32 character sheets.

Typography follows the game's own French: straight apostrophes in case texts, the studio's
typographic apostrophe in dictionary overrides (each key keeps the style of its neighbours on
screen), French quotation marks. **No em dashes anywhere**, matching your 06/09 build change.
Document lines are wrapped at 68 characters because the 3D paper viewer cuts around 70.

## 2. Things in the build you may want to fix (independent of the translation)

Found while doing the work. All of them are patched locally by the player patch, the fix is described so
you can do it properly at the source.

1. **Case-closed mail, charge line** (function `uc`): the charge is resolved with
   `uo()?charge.ar:zc()?charge.zh:charge.en`, so every language except Arabic and Chinese gets the
   English charge even when `charge.fr` exists. Suggested: `charge[lang] ?? charge.en`.
   The same mail hard-codes English formatting (`LABEL: value`, `30m`, `100%`, `+$50`).
2. **Office date** (`bs()`): weekday and month names are English arrays. `toLocaleDateString` with
   the interface locale gives « SAM. 7 MARS 2020 ».
3. **3D paper headers, stamps, watermarks, footers** (`ka` table): English, Arabic and Chinese only.
   A French table is provided in `strings/strings.fr.json`, section `paperHeaders`. Note that « AFFAIRE EN COURS » does
   not fit the stamp box, « EN COURS » does. The « EVIDENCE » stamp should read « PREUVE ».
4. **Daily radio incidents** (`ap` array): English and Arabic only. French in `strings/strings.fr.json`, section `radioIncidents`.
5. **Weather descriptions**: English only.
6. **CAD terminal, Atlas POI labels, unit status** (`ip`, `Od`, `sp`, `op`, `gi`, `GU`): no French.
   The POI keyword matching (`matches` arrays) is unaffected, the French texts keep the English
   place names.
7. **Lab ROT-13 mini-game**: the ten 4-letter words (CLUE, LOCK, SAFE, DOOR, SEAL, WIRE…) are only
   readable in English, so a French player cannot check the result by eye. Words valid in both
   languages work for everyone: CODE, CASE, TEST, ZONE, NOTE, DATE, PLAN, TAXI, CLUB, FILM.
8. **Case 004 safe code 0412**: the code is Mara's birthday, 12 April, in US month-day order. The
   player learns the date from Tomas in the interview (generated in the interface language). A
   French player would type 1204. The French texts add « (mois-jour) » in the planner and « Elle
   écrivait ses dates à l'américaine » in the safe hint. Other locales have the same problem.
9. **Local AI backend**: GPU detection only checks `nvidia-smi`. On a machine with an Intel or AMD
   integrated GPU, Ollama runs on CPU and the 4B model is selected, which produces weak French
   (wrong gender agreement, anglicisms). Setting `OLLAMA_IGPU_ENABLE=1` in the Ollama environment
   enables the Vulkan path on integrated GPUs (not tested on dual-GPU laptops). Most of the weak
   French, though, came from the prompt itself, which was 75 % English (point 40). With the fully
   French prompt of this package, measured on 23 September with your own Ollama runtime, Qwen3 4B
   answers entirely in French and no character exceeds the 4 096-token window (worst case Adrian
   Cove, 89 % with Qwen3 4B, 86 % with Gemma 3 4B). Your tier logic is therefore left untouched:
   the patch never forces a model.
10. **French language directive for suspects** (`wI.fr`): a longer directive (gender agreement of
    the character, formal « vous », no anglicisms) noticeably improves the generated French. The
    text is in `strings/strings.fr.json`, section `languageDirective`.
11. **`settings.language.note`** (English): says « Case documents stay in English », which is no
    longer true for the localised builds.
12. **Case date** (`date:"17 March 2024"` on each case): the field lives outside the translation
    object and is printed as is on the case opening screen, the Archives card, the case list and
    RPD-NET. French: « 17 mars 2024 » (the seven dates are in `strings/strings.fr.json`, section `caseDates`).
13. **Case id printed raw** (`activeCase.id.toUpperCase()` → « CASE-001 ») on the opening screen,
    the warrant and RPD-NET, while the Archives card already uses `cbr.caseNo` (« AFFAIRE N°001 »).
    The three spots should go through the same dictionary key.
14. **« VICTIM: name »** on the opening screen: the colon is concatenated in code (`+": "`), French
    typography needs a space before it.
15. **Cases 005 and 006 ship with no localisation at all.** `Quiet Hours` and `Nobody's Flat` have
    no entry in the case translation map, in any of the ten languages, so every player outside
    English reads them in English. Their two new mechanics, the audio bench and the RPD-NET
    records, are already supported by the merge function, so the data side is ready.
16. **The em-dash sweep of 06/09/2026 was applied without a proof pass.** In the case 001 badge log,
    an empty cell holding nothing but a long dash between two pipes became `|, |`, which now
    reads as a comma in the SORTIE column.
17. **Fixed-width label columns in CSS**: `.bag-k` (evidence bag, 44px) breaks « AFFAIRE » and
    « CHAÎNE » over two lines, `.fp-match-label` (fingerprint bench, 60px) is too narrow for the
    French match label. `min-width` plus `white-space:nowrap`, or a wider column, fixes every locale.
18. **Call duration in phone records** is formatted in code as `0m 38s`. French shows « 0:38 ».
19. **The paper tables in several exhibits are wider than the document body.** Case 004 exhibit E5
    reaches 104 characters and case 003 exhibit E6 reaches 95, against a body wrapped at 68. The
    3D renderer word-wraps them, so a table row breaks in the middle and the columns stop lining
    up. Case 004 E5 is also misaligned in the source: the FROM cell of the 21:52 row is one
    character short of the others.
20. **The French dictionary mixes both apostrophe characters**, 253 typographic against 134
    straight, sometimes on the same screen: `warrant.title` uses the typographic one while
    `warrant.readyBody` uses the straight one. Our patch reproduces each key's original choice
    rather than picking one, so the mix is yours to settle.
21. **`acc.pOpportunityQ`, `acc.pMotiveQ` and the released-suspect strings assume a male suspect**
    in French (`relâché`, `se trouvait-il`). Several suspects are women, so the text disagrees with
    the portrait on screen. The patch rewrites them without gender.
22. **Case 001, `ev-omar-cleared`: the arithmetic is wrong.** Badge-out is 20:47 and the earliest
    time-of-death estimate is 21:00, which is thirteen minutes, not "seven minutes before". The French
    says thirteen.
23. **Case 002: the victim cannot be found at 02:47.** Dead air starts at 02:47 and the report
    itself says it ran forty minutes before the morning engineer noticed. Discovery is 03:27, which is
    what the French report says (« vers 03h30 » in the prose summaries).
24. **Case 002: the murder window (02:30-02:50) excludes two clues that are said to be inside it.**
    Grange is live on air at 02:44:12, Wexler badges out at 02:58 and the dashcam runs at 03:05,
    which the text calls "inside the murder window". A window of 02:45-03:15 fits every clue, and the
    French uses it everywhere.
25. **Case 002: the grant shortfall is $8,100 in the ledger but "roughly $9,000" everywhere else.**
    The French keeps $8,100 everywhere.
26. **Case 003: the meeting note says Thursday 21:40**, but Ashworth checks in on Saturday 18th and
    dies on Sunday 19th at 21:41, which is the meeting time. The note should read Sunday. The French
    reads Sunday, and shifts the three routine entries before it so that the week still holds
    (Thursday to Sunday instead of Monday to Thursday). The mileage figure is unchanged, its unit is
    the kilometre.
27. **Case 003: the room is "re-keyed" at a motel with brass fobs, a paper register and a broken
    system.** The French says the room was switched to a late check-out at the front desk instead.
28. **Case 004: thirty-day rolling retention cannot have erased the most recent night.** The line
    now states the loss without claiming the retention policy caused it.
29. **Case 004: 2 January to 1 February is thirty days, not thirty-one.** The French says thirty.
30. **Case 004: the school pickup log is dated a Saturday night.** The French says "the sign-out
    register signed by the father" and drops the school, which a Saturday makes implausible.
31. **Case 005: channel CH-08 is deleted on the 15th, 16th and 17th** although the same file says
    the unit has been offline since the 12th. Those cells now read "fault, no file".
32. **Case 005: the corridor radio keys up at 22:13** inside a partial that only covers
    22:09:45-22:10:49.
33. **Case 005: on Saturday night Dunne says she has already paid**, but the $400 transfer is on
    Sunday at 10:05, after the deletion.
34. **Case 006: Cass Aldiss is born 30/07/2000 and is called thirteen** when she files the missing
    person report in September 2014, which would make her fourteen. The French moves the birth
    date to 30/10/2000, the one value that appears once against eight mentions of her age.
35. **Case 006: a delivery-jacket caller leaves at 00:10** yet the text places him "inside the
    window", which opens at 00:30.
36. **Case 004: one call, two devices.** The 21:52 call reaches Nadia from City Hall extension 4471
    and the recovered burner logs an outgoing call at 21:52 of the same duration. Nothing explains
    the overlap. Left as is: we did not want to invent a spoofing mechanism.
37. **Case 004: the Tomas thread is never closed.** The imaging report puts him gloved in the flat
    a month before the murder, with an unknown woman in the kitchen, and the endings call him
    grieving and not guilty. One line would close it.
38. **A clue id is lost in every translated language.** In case 001, `pressArchive.articles[1].hotspot`
    carries `clue:{id,label,detail}` in English, but every localised file ships that `clue` with
    `label` and `detail` only. Your merge replaces the whole `clue` object, so `clue-press-ghost`
    loses its id and the clue cannot register. Our build restores the id. Worth checking the other
    nine languages, and any other `hotspot.clue` in future cases.
39. **`city-atlas.png` is missing from the build.** The City Atlas app requests
    `/icons/city-atlas.png` and the archive has no such file, so the console logs a 404 every time
    the desktop is drawn. Present in your own build, unrelated to the translation.
40. **The system prompt stays English in all ten languages, and that is why the model answers in
    English.** The language directive (`wI.fr`, 702 characters) is sent twice, but it is drowned:
    the six rule blocks written in code (`i2`, `s2`, `uu`, `n2`, `r2`, `o2`, 3 550 characters), the
    headers the code assembles (`PEOPLE YOU KNOW`, `EVIDENCE THE DETECTIVE HAS IN HAND`, the three
    moods) and above all the 32 `systemPrompt` character sheets (73 068 characters) all go out in
    English. A 4B model follows the dominant language of its context, not the instruction: it
    answers in English, or mixes both in one sentence. **The important part**: `suspectData` is
    never read from the localised file, your merge only takes `openingStatements` and `questions`.
    Translating the `systemPrompt` fields in `case-XXX.fr.json` therefore has no effect, and that
    holds for all ten languages. Our patch replaces them in the bundle (French in
    `prompts/systemPrompts.fr.json`), along with the rule blocks and the assembled fragments
    (`strings/strings.fr.json`, sections `ruleBlocksAndLiterals` and `promptFragments`). The prompt
    is then entirely French, which our tooling measures on the installed archive. The same
    applies to the H. Whitmore HR text contact (case 000) and to the prosecutor's clerk who judges
    the pre-charge declaration, whose `feedback` field is shown to the player.
41. **Email timestamps are in no localised file.** `emails[].timestamp` (43 of them) and
    `evidence[].phoneRecords[].time` (4 in case 003) have no entry in the translated overlays: a
    French player reads « 2 FEB 2020 · 06:14 » in their inbox, next to a French subject and body,
    and next to other dates you did translate elsewhere (`mediaClips[].label`, `spreadsheetRows`,
    the `phoneRecords[].time` of cases 001 and 002). All nine other languages have the same gap.
42. **No localised file carries a `date` key**, for any of the seven cases, in any of the ten
    languages, so the case date stays English on a French dossier.
43. **Case 001: the UV smear contradicts itself.** The exhibit and the clue place it "at shoulder
    height (~168–178cm)" and derive the culprit's height from it, but your own UV hotspot says
    `grip height`. Both cannot be true: the shoulder of a 173cm person is at 142cm. A player who
    does the arithmetic clears Sophie Ward and accuses Omar Farooq, the exact opposite of the
    solution. We kept the grip reading, the only one the numbers allow.
44. **Case 001, three timings that do not fit together**: the fourth-floor detectors stay live until
    21:33 although Grace Adeyemi's round explains them, the cleaning wax dates the smear to a pass
    that had not happened yet, and Sophie Ward's sheet has her reaching Marcus at 21:25, the very
    minute Grace hears her going down the stairs.
45. **Case 002: Dana Wexler describes her own swipe log backwards.** Her sheet has her re-badging
    "on your way back out", but the 02:40 supervisor override is recorded as an entry (IN) and her
    02:58 exit carries no anomaly.
46. **Case 005: Petra Dunne's job title differs** between her character sheet (`senior transcript
    clerk`) and the role shown to the player.
47. **Case 004: Renee Okafor's sheet cites an exhibit E6 that does not exist.** The exhibit list
    skips E6 and E15, and her crack point points at E6 for the scene photographs.
48. **Case 004: the victim is called an independent journalist** although the dossier gives her nine
    years on staff at the same paper, a press card and an editor who commissions her stories.
49. **Case 005: the radio call that corroborates Ostrom falls outside the recording.** His sheet and
    the audio bench note timestamp the corridor radio keying at 22:13, but the only recovered
    fragment of that Saturday covers 22:09:45 to 22:10:49. The player cannot check the
    corroboration, and the same sheet says "around ten past ten" two paragraphs later.
50. **Case 006: Ivo Sarris is born 17/03/1989 and called 31** at the 2 March 2020 interviews, where
    he is still 30. Same shape as Cass Aldiss in point 34.
51. **Case 005: a Monday file is deleted on the Sunday before it exists.** In the recorder archive
    index, the `Mon 17 Feb` row carries `DELETED 16 Feb 09:14 · KIRWAN-S` on two channels. The file
    is deleted the day before the day it records. Left as is in French, it cannot be repaired
    without inventing a date.
52. **Case 006: Cove learns the name in January and in February.** His character sheet says he saw
    Halloran's name for flat 11-C on the occupant list in February 2020, but Krantz's statement (E22)
    and the clue `clue-cove-asked-name` have him ringing the agency **in January**, before the new
    list was even typed, to ask whether 11-C was still Halloran. That call is the decisive clue of
    the case, and it puts his knowledge a month earlier than his own sheet admits. Left as is.
53. **The interrogation prompt does not fit in the context window you ship.** The engine runs with
    `num_ctx 4096` (Modelfile). Measured with each model's real tokenizer: once every exhibit of
    case 006 is collected, Adrian Cove's system prompt weighs 3 405 tokens in English (83 % of the
    window, room for 4 to 6 exchanges) and 4 169 in French even after trimming (French costs about
    20 % more tokens for the same content). On overflow, `homicide-qwen4b` returns HTTP 400
    (`exceeds the available context size`) and the game **silently falls back to your hosted
    backend** (`/api/ask`), and `homicide-gemma*` keeps the first and last tokens and drops the
    middle, character sheet included (Cove then introduces himself as another character). Note
    that `/v1/chat/completions`, the route interrogations use, **ignores a per-request `num_ctx`**
    (measured), only `/api/chat` honours it. The player patch uses `/api/chat` with `num_ctx 6144`
    for French only (5 120 when the model does not fit entirely in VRAM) and trims the oldest
    exchanges before sending: 0 errors over 234 test exchanges, history kept, 5 times faster than
    the truncated 4 096 case. Qwen 3 4B costs 3,57 GB at 6 144 against 3,18 GB at 4 096.
54. **Both language directives keep an English tail.** `hI()` builds « (LANGUAGE: … reply in » +
    the language name + « only. Never use any English word or letter… », and `fI()` (the DA clerk)
    « Write your entire answer in » + the name + « and in no other language… ». For every language
    but English the model receives a mixed-language directive, twice per prompt, at the most read
    positions. A full string per language removes it.
55. **Suspects know every collected exhibit before it is presented.** The prompt lists all
    `collectedEvidenceIds`, presented or not. A small model uses them: Tommy Vale (case 000) quoted
    the closing ledger (« Tuesday and Thursday ») before the detective showed it, 3 times out of 3,
    and no wording of the instruction stopped it. The player patch lists, in French only, the
    exhibits already put on the table in front of this suspect (their name is in the history).
56. **For French, Gemma 3 4B plays suspects far better than Qwen 3 4B.** Read side by side by a
    native French speaker over the same questions, Gemma 4B gives livelier, more plausible suspects
    and reacts to presented exhibits the way the character sheets intend, where Qwen 4B answers in
    flat and sometimes nonsensical French. The player patch offers to download `gemma3:4b` from the
    Ollama registry (about 3,3 GB) and creates `homicide-gemma4b` with the template and parameters
    of your own `homicide-gemma12b`. It is chosen for French sessions only, cards that hold the 12B
    keep it. Worth considering as the French floor model if the download size is acceptable.
57. **The player's current question is sent twice.** `xe()` pushes the question into the history,
    then `Ie()` takes `getHistory().slice(-10)` and `ask()` appends `{role: "user", content}` once
    more. The model sees the same question (with the exhibit's `presentationMessage` when there is
    one) as two consecutive user turns. Not changed by the player patch, reported for your review.
58. **`slice(-10)` makes every exchange pay for the whole prompt again.** Once the history is
    full, the oldest message drops out at each turn, so the text after the system prompt changes
    from its first line and Ollama cannot reuse its cached prefix: the model re-reads the whole
    prompt before the first word. On an integrated GPU this prefill is most of the delay. In
    French only, the player patch keeps the whole history (and trims it by blocks of 30 % when
    the window is full), keeps the system prompt identical from one turn to the next, and warms
    the cache when the interrogation opens and when an exhibit is pinned. Measured on the same
    machine (Intel integrated GPU, Gemma 3 4B, case 000, Tommy Vale, long scenario): 12,6 s mean
    per reply before, 7,9 s after, worst reply 24,8 s before, 10,7 s after (English original with
    your code: 7,6 s).
59. **Most generated text is thrown away.** `ge()` keeps 4 sentences and 460 characters at most,
    but the model may write up to `max_tokens 400` before `ge()` runs. The player patch streams
    `/api/chat` and stops generation as soon as the text `ge()` would show can no longer change
    (sentence count reached, gestures closed). Checked on 1 457 recorded replies: 0 displayed text
    differs from the full generation.
60. **Stress keywords and reaction icons are English only.** The list that adds 8 points per keyword (« prove »,
    « saw you », « evidence », « lied »…) is matched against what the player types. In any other
    language, typed questions add no stress, only presented exhibits and recognised scripted
    questions do. The reaction icon has the same limit: `te` matches English gesture words
    (« shrug », « sigh », « nod »…), so French gestures always get `react-neutral` (67 % of
    French replies in our recordings). Since 1.2.1 the player patch adds, in French only, one
    pattern per English keyword (same 8 points, « lied » becomes « menti », « will » becomes
    « testament ») and one French pattern per icon, tried next to yours in the same order
    (`mecaniques_fr.json`). Measured: on 48 questions in English/French pairs a player earns 174
    stress points in English, 110 in French before, 166 after (the gap is « will » matching the
    auxiliary verb in English). Neutral icons in French: 67 % before, 1 % after.
61. **« Never confess » fights the last crack point.** `i2` (« ABSOLUTE RULE: NEVER CONFESS »,
    placed first, and repeated at the end) overrides the final stages of `CRACK POINTS`, which ask
    the suspect to stop denying. In the other direction, a small model reading the hidden truth in
    the character sheet quotes it too early: Tommy Vale (case 000) told the detective he sold the
    watch at Westgate Pawn & Loan with no exhibit on the table. The player patch marks, in 15
    French character sheets, the facts that belong to an exhibit (`[[SI:E4]] … [[/SI]]`, with
    `+` for « all of » and `|` for « any of »): they are removed from the sheet and sent in the
    last user message only once that exhibit has been shown to this suspect.
    In the French sheets of this package the markers are removed, the text is complete, with one
    deliberate difference: for four guilty characters (Sophie Ward, Dana Wexler, Grant Holloway,
    Victor Calloway) the sheet says they are guilty but no
    longer describes how they killed. Those details were never to be said, and a small model
    quoted them anyway.

62. **The field certificate is stamped as evidence.** `JR()` opens the desktop certificate in the
    3D paper viewer with `variant:"standard"`, so it gets the exhibit stamp « E V I D E N C E » and
    the footer « OFFICIAL DOCUMENT · FOR INVESTIGATIVE USE ONLY », like a piece of a case. It is a
    personnel document. The player patch gives it, in French only, a variant of its own
    (`hdfr-certificat`, drawn like `standard`): stamp « H A B I L I T É » (certified) and footer
    « ÉTAT DE SERVICE · DOCUMENT PERSONNEL » (service record · personal document).
63. **The paper header is only recognised in English, Arabic and Chinese.** `Va()` treats the first
    two lines as the department and document header only when the first line contains
    « RAVENPORT POLICE » (or its Arabic or Chinese form). In the seven other languages the
    certificate and the reports that start with the department name (case 000 E1, case 001 E1)
    print those two lines as body text, and the header band falls back to the generic
    « MAJOR CRIMES UNIT » / « CASE DOCUMENT ». The player patch adds « POLICE DE RAVENPORT » for
    French.

## 3. Places where the French deliberately differs from the English text

Only where the English text contradicts what the player sees or hears. Worth a look on your side.

- **Case 000, Longines watch**: text says « brown leather strap », the 3D model
  (`Wristwatch_evidence.glb` texture) shows a black leather strap. French says « cuir noir ».
- **Case 001, photo E5 (server room B)**: text says « a fallen mop handle » and « Grace's cleaning
  cart in the doorway ». The image shows an aluminium pole near the door and a **tech cart with a
  monitor and keyboard** next to an office chair. French keeps the mop handle and the clue (Grace's
  round had not reached the room yet) but describes the cart as a technician's cart. It also says
  explicitly that the pole is not the missing rack rail (the scene report says the rail was never
  recovered), because players took it for the murder weapon.
- **Case 001, press photo of article 2**: caption says « the Vanta Systems building », the image is
  the empty server room. French captions the sealed server room.
- **Case 003, image E5 (boardwalk camera)**: text says « reversed in, front plate facing the
  building », the image shows the pickup nose-in with only the rear plate visible. French describes
  the image, the clue (partial plate later resolved by dispatch) is unchanged.
- **Case 001, Marcus' voicemail**: shown as 0:41, the audio lasts 0:29 and he hesitates. All 13
  English recordings were transcribed from the audio and the French transcripts follow the spoken
  delivery (hesitations included), not the written English.
- **Case titles**: 000 « La clé du prêteur », 001 « Heures supplémentaires », 002 « Silence radio »,
  003 « Complet », 004 « Un peu d'air », 005 « Heures calmes », 006 « Chez personne ».
- **Case 001, the UV smear**: the English says « at shoulder height » in three places while giving
  168–178cm, and your own hotspot says `grip height`. The French says « à hauteur d'homme », which
  is compatible with both the figures and the hotspot. No measurement was touched. See point 43.
- **Case 005, the radio call at 22:13**: the French says 22:10, the only value that falls inside the
  recovered audio fragment, so that the player can actually check the corroboration. See point 49.
- **Case 006, Ivo Sarris's date of birth**: moved one month, as for Cass Aldiss, so that his stated
  age holds. See point 50.
- **Case 006, Cass Aldiss's date of birth**: 30/10/2000 instead of 30/07/2000, so that her stated
  age holds. See point 34.
- **Case 003, Dominic's notepad (E3)**: the four routine entries are re-dated so that the meeting
  falls on the Sunday, and « mileage 214 » is written « km 214 ». See point 26.
- **Cases 001, 002 and 004, figures made consistent**: thirteen minutes (point 22), discovery at
  03:27 and murder window 02:45-03:15 (points 23 and 24), $8,100 everywhere (point 25), thirty days
  (point 29).
- **Case 001, moved to 2020**: the only case of the series set in 2024, it fell four years after the
  desk clock (2020) and the six other cases, and the exhibits against Sophie Ward (2023, 2021)
  looked like they came from the future. The French moves the whole case back by exactly 209 weeks,
  which keeps every weekday: Sunday 17 March 2024 becomes Sunday 15 March 2020, the events run from
  12 to 17 March 2020, the fraud from January 2019 to February 2020, the SIM is activated on
  7 January 2019, the PO box closed in 2017, the reference becomes MC/2020/0315. Case date,
  13 email timestamps, exhibits, articles and the four character sheets follow. Marcus's notebook
  (E9) spells the year out (« janv. 2019 »): « janv. 23 » read as « 23 January ».
- **Case 001, four time markers**: the lawyers write on Monday at 17:45 and set their deadline
  « before tomorrow, Tuesday, 09:00 » (the English says Monday, already past). Morrison's 08:10 email
  says the board « meets this morning » (it meets at 09:00). The UV page from the strongbox is
  « written in the dark, Thursday »: the box has been locked since Thursday, the English says
  Sunday. The anonymous tip puts the Friday rollback « two days before » the Sunday calls. The
  precinct chatter says « all of last month » (the English says « all of March » during a week in
  March). The « good » ending mentions Sophie Ward's full signature on every sheet, as exhibit E10
  does (the English says « initials », which E10 contradicts).
- **Case 002, two times**: the 02:40 manual override is « five minutes before the murder window
  opens, and she only badges out at 02:58 », to follow the 02:45-03:15 window of point 24. The woman
  at the loading door is seen « just before two » (the English says « five past two », the camera
  shows 01:58).
- **Case 003, emails and records**: the body is found at 11:04 and three emails were timestamped
  before it (09:40, 10:20, 11:00, one of them saying it learned of the death « this morning »). They
  move to 11:35, 12:05 and 11:50. The call-record presentation says « a quarter of an hour before »
  (21:15 against 21:30, the English says twenty-five minutes), and the description says he had been
  staying there « for two days ».
- **Case 004, four points**: the safe-deposit box is « rented since September 2019 » and Nadia
  « goes back » to it the following week (the English says it was opened twice). Farrah hears the
  argument around 22:00, « far from the late hour one imagined for a suicide » (the English says
  « well after » the coroner's window, which starts at 22:00). The 0412 code is explained in the
  French player's date order: « safe code = month + day » and « the month first, then the day ».
- **Case 005, three points**: the recorder archive index keeps two deleted nights (16 and 17), the
  15th only survives as a partial, as the label, the email and Kirwan's sheet say. Exhibit E8 no
  longer says « no event within ten minutes » of 23:45 (its own table shows three, at 23:40 and
  23:50) but « nothing at 23:45 that looks like a round going through », as does the question put to
  Ostrom. The E8 presentation says « twelve seconds after the blow » (the English says nineteen, the
  clue of the same exhibit and the timestamps give twelve).
- **Case 006, seven points**: the lobby photo no longer says Cove « did not fob out » (his sheet and
  the badge log say 01:14). « The night of the 27th » becomes « the 27th » or « the night of the 26th
  to the 27th » (in French, « la nuit du 27 » runs from the 27th to the 28th). The two sales are
  « eight years apart » (May 2010, November 2018). Morrison's email and the Krantz lawyers' email
  report the 3 March interviews and move from 2 to 3 March. Joan dates the garage invoice « two days
  after » the accident (8 and 10 October 2011, the English says a week). RPD-NET gives Mayfair from
  2012, as the building-control application (E16) does, not 2013. The 2013 photo is dated 14/06/2013
  (the English writes 06/14/2013, the only US-format date of the case), Ruben is « just forty » on it
  (he is 40, the English says « mid-thirties »), and the 22:11 message says he called « the only two
  numbers » he had (the English says « the only number », the log shows two).

Every other figure, time, date and amount is identical to the English.

## 4. What was verified, and how

- Bundle after patch: `node --check` passes on the eleven scripts of the archive, the game starts,
  the model preloads. Case 000 was played to the end by a French tester who knew nothing of the
  project. The six other cases were opened and spot-played, not completed end to end by us: their
  coverage rests on the checks below.
- Structure: each rewritten case object has exactly the same keys and array lengths as the
  original French object (our injection tool refuses otherwise).
- Mechanics: lock codes, Atlas keyword matching, warrant word-overlap check (tokeniser
  `[\p{L}\p{N}]+` after NFKC, so accents and apostrophes are safe), handwriting markers
  `[[Q:…]]/[[X:…]]`, clickable press phrase, numbers and times compared with the English
  (our audit script). Every intentional difference with the English is listed in section 2 (« the French
  says… ») or in section 3.
- No Latin-script English left in the French surfaces: dictionary (0 EN keys without FR),
  inline `{en:…}` objects (0 without `fr`), radio, CAD, POI, weather, chatter.
- System prompt sent to the model: 100 % French words (rule blocks, the 32 character sheets, the
  headers assembled by the code and the language directive), measured on the installed archive.
  Not a single English instruction block is left, the SMS contact and the prosecutor's clerk
  included.
- Nothing else touched: the English, German, Spanish, Portuguese and Turkish dictionaries and the
  nine other language objects of the cases are byte-identical to the original build. No personal
  data in the package.

Not verified by us: the Arabic and Chinese versions were not touched and not reviewed.

## 5. What the player patch changes in the code

The player patch is published separately and is not needed to integrate this package. It never
edits the game's text in place by hand: it replaces the `fr` object of each case with the one in
`cases/`, applies the tables of `ui/`, `prompts/` and `strings/` and re-packs the asar. It also
makes a handful of **code edits conditional on the interface language** (`lang === "fr"`, the
nine other languages keep the original expression): the case date and the case id on the opening
screen, the space before the colon after VICTIM, call durations, the case-closed mail, unit
statuses, the `[The detective places evidence…]` line and the two language directives of the
interrogation prompt. **Two edits apply to every language**, with no visible effect outside
French: the ROT-13 word list of point 7 and the CSS label columns of point 17. Two edits are
**player-side conveniences, not localisation**: `desktop/dist/localAI.js` reads an optional
`%APPDATA%\detective-os\localai-override.json` (`model`, `igpu`) and adds `OLLAMA_IGPU_ENABLE=1`
to the embedded Ollama environment when that file says `"igpu": true` (point 9), never when it says
`false`. Without it, since 1.3.0 and in French sessions only, the patch tries the integrated GPU
at startup when the model loaded on the CPU (`size_vram` 0), keeps it only if a fixed measurement
is faster than on the CPU, falls back to the CPU on any failure or crash, and remembers the result
per game and patch version in `hdfr-contexte.json`. The patch never creates the override file. Since 24/09/2026 `localAI.js` also carries the **French interrogation
engine** of points 53 to 56: `/api/chat` with `num_ctx 6144` and the overflow guard when the
renderer flags `hdfrLang: "fr"`, the presented-exhibit filter, and `homicide-gemma4b` for French
sessions when the player chose to install it (`%APPDATA%\detective-os\hdfr-contexte.json` tells
the main process the last session was French). Every other language takes your original code path.
Since 1.2.0 (25/09/2026), still in French only, it also streams the reply and stops early
(point 59), keeps the system prompt stable, keeps the full history and warms the cache (point 58),
and sends the `[[SI]]` facts in the last user message once their exhibit is shown (point 61).
Since 1.2.1 it also gives French stress keywords and French reaction gestures (point 60).
Integrate the data files, and treat the engine edits as measured suggestions.

---

# Notes pour Shu'la Lab (version française)

> **Depuis le 27 septembre 2026, il n'y a plus de paquet séparé pour le studio.** Tout est publié dans
> le dépôt GitHub public du patch, gratuitement et sans condition : reprenez ce qui vous est utile et
> intégrez-le à votre guise. Le « paquet » décrit ci-dessous est toujours produit par
> `node release.js` (`release/studio/`), avec les traductions rangées dans vos propres structures.

Ce paquet est une passe complète de localisation française de **Homicide Desk** (app Steam 4935210,
build Steam 25152927, septembre 2026). Il a été fait par un joueur francophone
qui voulait une version française avec exactement les mêmes indices, le même ton et la même
immersion que la version anglaise. Tout le contenu de ce paquet est offert pour intégration, gratuitement et sans condition.

Les textes ont été écrits **depuis la version originale anglaise**, pas en retouchant le français
existant. Chaque chaîne française des sept affaires a été relue face à sa source anglaise. Le patch
joueur, qui applique les mêmes textes sur une installation, est publié à part : vous n'en avez pas
besoin.

## 1. Contenu

Ce paquet ne contient que les données traduites, rangées dans vos propres structures : aucun
script, rien à installer.

| Fichier | Contenu | Structure du jeu concernée |
|---|---|---|
| `cases/case-00X.fr.json` | L'objet français complet de chacune des **sept** affaires, 2 493 chaînes (dont 2 195 réécrites). Les affaires 005 et 006 sont nouvelles | L'entrée `fr` de chaque affaire dans votre carte des traductions, même forme que vos objets actuels |
| `ui/fr.json` | Le dictionnaire français complet de l'interface, 1 687 clés, prêt à remplacer le vôtre | Le dictionnaire français |
| `ui/fr_additions.json` | Les 74 clés **sans** valeur française, déjà fusionnées dans `ui/fr.json` | Le même objet, pour relecture |
| `ui/fr_overrides.json` | Les 71 entrées corrigées, déjà fusionnées dans `ui/fr.json` | Le même objet, pour relecture |
| `prompts/systemPrompts.fr.json` | Les 32 personnalités, `{ "case-001": { "<identifiant du personnage>": "<français>" } }`, 73 068 caractères | `suspectData.<id>.systemPrompt` et `witnesses[].systemPrompt`, voir point 40 |
| `strings/strings.fr.json` | Toutes les chaînes qui vivent dans le code plutôt que dans le dictionnaire ou un objet d'affaire, en « texte actuel du build 25152927 » vers « français », une section par surface | Littéraux du bundle |

Sections de `strings/strings.fr.json` :

| Section | Contenu |
|---|---|
| `languageDirective` | La consigne de langue française des suspects (`wI.fr`), point 10 |
| `promptEnglishLines` | 3 lignes anglaises que le prompt d'interrogatoire ajoute hors dictionnaire : `[The detective places evidence…]` et deux rappels de langue |
| `ruleBlocksAndLiterals` | 10 chaînes écrites en dur : 4 fiches de l'Atlas, une table interne, et les 6 blocs de règles du prompt système (`i2`, `s2`, `uu`, `n2`, `r2`, `o2`) |
| `promptFragments` | 16 fragments que le code assemble dans le prompt système : en-têtes de blocs, les trois humeurs, le contact SMS H. Whitmore (affaire 000), le greffier du procureur. Ce sont des segments de gabarits, les interpolations `${…}` doivent rester à leur place |
| `inlineMultilingual` | 4 textes `{en,ar,zh,fr,…}` écrits en ligne : chefs d'inculpation, compteur d'arrestations injustifiées |
| `scriptedTextFixes` | 13 remplacements appliqués à vos textes français partout où ils apparaissent, dictionnaire compris : noms de documents du tutoriel, accord de genre du joueur, titre de l'affaire 000, et la liste de mots ROT-13 du point 7 |
| `weather` | 7 descriptions météo, indexées par le texte anglais (point 5) |
| `radioIncidents` | Les 7 incidents radio du jour, indexés par l'appel anglais (point 4) |
| `cadTerminal` | Terminal de régulation : codes, lieux, conseils, 17 points d'intérêt de l'Atlas, 3 statuts d'unité (76 entrées) |
| `precinctChatter` | 64 messages du fil du poste par affaire, dans l'ordre du tableau (`precinctChatter[i].text.fr`) |
| `paperHeaders` | Table française des en-têtes, tampons, filigranes et pieds de page du papier 3D (table `ka`, point 3) |
| `caseDates` | Les 7 dates d'affaire (point 12) |

**Ce sont `prompts/` et les sections de code de `strings/` qui méritent votre attention.** Elles
n'existent que parce que ces chaînes n'ont aucune clé de dictionnaire ou, pour les personnalités,
parce que la fusion ne les lit jamais depuis le fichier localisé : notre patch a dû les remplacer
par leur valeur littérale. Leur donner une clé, ou fusionner `systemPrompt`, supprimerait le besoin
de ce mécanisme, pour toutes les langues.

Volumes : 2 195 chaînes d'affaires réécrites sur 2 493, 74 ajouts au dictionnaire, 71 corrections,
et hors fichiers d'affaires 64 messages du fil, 7 descriptions météo, 7 incidents radio
(35 chaînes), 76 entrées du terminal, 4 textes en ligne, 10 littéraux, 16 fragments de prompt,
13 remplacements de textes scriptés et 32 personnalités.

La typographie suit celle du jeu : apostrophe droite dans les textes d'affaires, apostrophe
typographique du studio dans les remplacements de dictionnaire (chaque clé garde le style de ses
voisines à l'écran), guillemets français. **Aucun tiret cadratin**, conformément à votre propre
changement du 06/09. Les lignes de documents sont coupées à 68 caractères, le lecteur papier 3D
coupant vers 70.

## 2. Points du build à corriger, indépendamment de la traduction

Trouvés en cours de route. Tous sont corrigés localement par le patch joueur, la correction est décrite
pour que vous puissiez la faire proprement à la source.

1. **Courriel « affaire classée », chef d'accusation** (fonction `uc`) : la charge est résolue par
   `uo()?charge.ar:zc()?charge.zh:charge.en`, donc toute langue autre que l'arabe et le chinois
   reçoit la charge anglaise même quand `charge.fr` existe. Suggestion : `charge[lang] ?? charge.en`.
   Le même courriel compose son récapitulatif à l'anglaise (`LIBELLÉ: valeur`, `30m`, `100%`, `+$50`).
2. **Date du bureau** (`bs()`) : jours et mois sont des tableaux anglais. `toLocaleDateString` avec
   la locale de l'interface donne « SAM. 7 MARS 2020 ».
3. **Papier 3D, en-têtes, tampons, filigranes, pieds de page** (table `ka`) : anglais, arabe et
   chinois seulement. Une table française est fournie dans `strings/strings.fr.json`, section `paperHeaders`.
   « AFFAIRE EN COURS » dépasse du cadre du tampon, « EN COURS » tient. Le tampon « EVIDENCE »
   doit se lire « PREUVE ».
4. **Appels radio du jour** (tableau `ap`) : anglais et arabe seulement. Français dans `strings/strings.fr.json`, section `radioIncidents`.
5. **Descriptions météo** : anglais seulement.
6. **Terminal de régulation, lieux de l'Atlas, statut des unités** (`ip`, `Od`, `sp`, `op`, `gi`,
   `GU`) : pas de français. Le repérage par mot-clé des lieux (`matches`) n'est pas touché, les
   textes français gardent les noms de lieux anglais.
7. **Mini-jeu ROT-13 du labo** : les dix mots de 4 lettres (CLUE, LOCK, SAFE, DOOR, SEAL, WIRE…)
   ne sont lisibles qu'en anglais, un francophone ne peut pas vérifier son résultat à l'œil. Des
   mots valides dans les deux langues conviennent à tous : CODE, CASE, TEST, ZONE, NOTE, DATE,
   PLAN, TAXI, CLUB, FILM.
8. **Affaire 004, code du coffre 0412** : c'est l'anniversaire de Mara, le 12 avril, en ordre
   américain mois-jour. Le joueur apprend la date par Tomas en interrogatoire (généré dans la langue
   de l'interface). Un francophone taperait 1204. Les textes français ajoutent « (mois-jour) » dans
   l'agenda et « Elle écrivait ses dates à l'américaine » dans l'indice du coffre. Les autres
   langues ont le même problème.
9. **Moteur d'IA locale** : la détection de carte graphique ne teste que `nvidia-smi`. Avec une puce
   Intel ou AMD intégrée, Ollama tourne sur processeur et le modèle 4B est choisi, ce qui donne un
   français faible (accords faux, anglicismes). `OLLAMA_IGPU_ENABLE=1` dans l'environnement d'Ollama
   active la voie Vulkan sur les puces intégrées (non testé sur les portables à deux cartes
   graphiques). L'essentiel du français faible venait toutefois du prompt lui-même, anglais à 75 %
   (point 40). Avec le prompt entièrement français de ce paquet, mesuré le 23 septembre avec votre
   propre moteur Ollama, Qwen3 4B répond entièrement en français et aucun personnage ne dépasse la
   fenêtre de 4 096 jetons (pire cas Adrian Cove, 89 % avec Qwen3 4B, 86 % avec Gemma 3 4B). Votre
   choix de modèle par palier reste donc intact : le patch n'impose jamais de modèle.
10. **Consigne de langue française des suspects** (`wI.fr`) : une consigne plus longue (accord au
    genre du personnage, vouvoiement, pas d'anglicismes) améliore nettement le français généré. Le
    texte est dans `strings/strings.fr.json`, section `languageDirective`.
11. **`settings.language.note`** (anglais) : dit que les documents restent en anglais, ce qui n'est
    plus vrai pour les builds localisés.
12. **Date de l'affaire** (`date:"17 March 2024"` sur chaque affaire) : le champ est hors de l'objet
    de traduction et s'affiche tel quel sur l'écran d'ouverture, la carte des Archives, la liste des
    affaires et RPD-NET. Français : « 17 mars 2024 » (les sept dates sont dans
    `strings/strings.fr.json`, section `caseDates`).
13. **Identifiant d'affaire affiché brut** (`activeCase.id.toUpperCase()` → « CASE-001 ») sur l'écran
    d'ouverture, le mandat et RPD-NET, alors que la carte des Archives passe déjà par `cbr.caseNo`
    (« AFFAIRE N°001 »). Les trois endroits devraient utiliser la même clé du dictionnaire.
14. **« VICTIM: nom »** sur l'écran d'ouverture : les deux-points sont concaténés dans le code
    (`+": "`), la typographie française veut une espace avant.
15. **Les affaires 005 et 006 sont livrées sans aucune localisation.** `Quiet Hours` et
    `Nobody's Flat` n'ont d'entrée dans la carte des traductions dans aucune des dix langues, si bien
    que tout joueur non anglophone les lit en anglais. Leurs deux mécanismes nouveaux, la table
    d'écoute et les fiches RPD-NET, sont déjà prévus par la fonction de fusion : côté données,
    tout est prêt.
16. **La suppression des tirets cadratins du 06/09/2026 n'a pas été relue.** Dans le relevé des
    badges de l'affaire 001, une cellule vide qui ne contenait qu'un tiret long entre deux barres est devenue `|, |`,
    ce qui affiche
    maintenant une virgule dans la colonne SORTIE.
17. **Colonnes de libellés à largeur fixe dans le CSS** : `.bag-k` (sachet de scellés, 44 px) coupe
    « AFFAIRE » et « CHAÎNE » sur deux lignes, `.fp-match-label` (table d'empreintes, 60 px) est trop
    étroite pour le libellé français. `min-width` avec `white-space:nowrap`, ou une colonne plus
    large, règle toutes les langues.
18. **Durée des appels dans les relevés téléphoniques** composée dans le code en `0m 38s`. Le
    français affiche « 0:38 ».
19. **Les tableaux de plusieurs pièces sont plus larges que le corps du document.** La pièce E5 de
    l'affaire 004 atteint 104 caractères et la pièce E6 de l'affaire 003 en atteint 95, pour un
    corps replié à 68. Le rendu 3D les replie au mot près : une ligne de tableau se coupe en son
    milieu et les colonnes cessent d'être alignées. La pièce E5 de l'affaire 004 est en outre
    désalignée à la source, la cellule DE de la ligne 21:52 ayant un caractère de moins que les
    autres.
20. **Le dictionnaire français mélange les deux apostrophes**, 253 typographiques contre 134
    droites, parfois sur le même écran : `warrant.title` prend la typographique quand
    `warrant.readyBody` prend la droite. Le patch reprend le choix d'origine clé par clé plutôt
    que d'en imposer un, la question vous revient.
21. **`acc.pOpportunityQ`, `acc.pMotiveQ` et les messages de remise en liberté supposent un suspect
    masculin** en français (« relâché », « se trouvait-il »). Plusieurs suspectes sont des femmes,
    le texte contredit alors le portrait affiché. Le patch les réécrit sans marque de genre.
22. **Affaire 001, `ev-omar-cleared` : le calcul est faux.** Sortie badge à 20:47, heure de décès la
    plus précoce 21:00, soit treize minutes et non « sept minutes avant ». Le français dit treize.
23. **Affaire 002 : la victime ne peut pas être découverte à 02:47.** Le silence commence à 02:47 et
    le rapport dit lui-même qu'il a duré quarante minutes avant que l'ingénieur s'en aperçoive. La
    découverte est à 03:27, c'est ce que dit le rapport français (« vers 03h30 » dans les résumés).
24. **Affaire 002 : le créneau du décès (02:30-02:50) exclut deux indices censés y tomber.** Grange
    est en direct à 02:44:12, Wexler badge à 02:58 et la dashcam tourne à 03:05, que le texte dit
    « en plein créneau ». Un créneau de 02:45 à 03:15 fait tenir tous les indices ensemble, le
    français l'emploie partout.
25. **Affaire 002 : l'écart de subvention vaut 8 100 $ au registre et « environ 9 000 » ailleurs.**
    Le français garde 8 100 $ partout.
26. **Affaire 003 : la note de rendez-vous dit jeudi 21h40**, alors qu'Ashworth arrive le samedi 18
    et meurt le dimanche 19 à 21h41, qui est l'heure du rendez-vous. La note doit dire dimanche. Le
    français dit dimanche, et décale les trois entrées de routine qui précèdent pour que la semaine
    tienne (jeudi à dimanche au lieu de lundi à jeudi). Le chiffre du kilométrage est inchangé, son
    unité est le kilomètre.
27. **Affaire 003 : la chambre est « réencodée » dans un motel à clés en laiton**, registre papier et
    système en panne. Le français dit que la chambre a été repassée en départ tardif à la réception.
28. **Affaire 004 : une purge glissante de trente jours ne peut pas avoir effacé la nuit la plus
    récente.** La phrase constate la perte sans plus l'imputer à la durée de conservation.
29. **Affaire 004 : du 2 janvier au 1er février il y a trente jours, pas trente et un.** Le français
    dit trente.
30. **Affaire 004 : le registre de sortie de l'école est daté d'un samedi soir.** Le français parle
    du « registre de sortie signé par le père » et ne nomme plus l'école.
31. **Affaire 005 : le canal CH-08 est supprimé les 15, 16 et 17** alors que le même document dit
    l'appareil hors service depuis le 12. Ces cellules disent maintenant « panne, aucun fichier ».
32. **Affaire 005 : la radio du couloir passe en émission à 22:13** dans un extrait partiel qui ne
    couvre que 22:09:45 à 22:10:49.
33. **Affaire 005 : le samedi soir, Dunne dit avoir déjà payé**, alors que le virement de 400 $ est
    du dimanche 10:05, après la suppression.
34. **Affaire 006 : Cass Aldiss est née le 30/07/2000 et on la dit de treize ans** au moment du
    signalement de septembre 2014, ce qui lui en ferait quatorze. Le français déplace la date de
    naissance au 30/10/2000, la seule valeur citée une fois contre huit mentions de son âge.
35. **Affaire 006 : l'homme au blouson de coursier repart à 00h10** alors que le texte le place
    « en plein créneau », qui s'ouvre à 00h30.
36. **Affaire 004 : un appel, deux appareils.** L'appel de 21h52 arrive chez Nadia depuis le poste
    4471 de la mairie, et le jetable récupéré porte un appel sortant à 21h52 de même durée. Rien
    n'explique le recouvrement. Laissé tel quel, nous n'avons pas voulu inventer une usurpation.
37. **Affaire 004 : la piste Tomas n'est jamais refermée.** Le rapport d'imagerie le montre ganté
    dans l'appartement un mois avant les faits, avec une femme inconnue dans la cuisine, et les
    fins le disent en deuil et non coupable. Une ligne suffirait à clore.
38. **Un identifiant d'indice est perdu dans toutes les langues traduites.** Dans l'affaire 001,
    `pressArchive.articles[1].hotspot` porte `clue:{id,label,detail}` en anglais, mais chaque
    fichier localisé livre ce `clue` avec `label` et `detail` seulement. Votre fusion remplace
    l'objet `clue` entier : `clue-press-ghost` perd son id et l'indice ne peut plus s'enregistrer.
    Notre build rétablit l'id. À vérifier sur les neuf autres langues, et sur tout futur
    `hotspot.clue`.
39. **`city-atlas.png` est absent du build.** L'application Atlas demande
    `/icons/city-atlas.png`, que l'archive ne contient pas : la console enregistre une 404 à chaque
    affichage du bureau. Présent dans votre propre build, sans rapport avec la traduction.
40. **Le prompt système reste anglais dans les dix langues, et c'est ce qui fait répondre le modèle
    en anglais.** La consigne de langue (`wI.fr`, 702 caractères) est envoyée deux fois, mais elle
    est noyée : les six blocs de règles écrits dans le code (`i2`, `s2`, `uu`, `n2`, `r2`, `o2`,
    3 550 caractères), les en-têtes assemblés par le code (`PEOPLE YOU KNOW`, `EVIDENCE THE
    DETECTIVE HAS IN HAND`, les trois humeurs) et surtout les 32 personnalités `systemPrompt`
    (73 068 caractères) partent en anglais. Un modèle de 4 milliards de paramètres suit la langue
    dominante du contexte, pas la consigne : il répond en anglais, ou mélange les deux dans une même
    phrase. **Le point important** : `suspectData` n'est jamais lu depuis le fichier localisé, votre
    fusion ne reprend que `openingStatements` et `questions`. Traduire les `systemPrompt` dans
    `case-XXX.fr.json` n'a donc aucun effet, et c'est vrai des dix langues. Notre patch les remplace
    dans le bundle (français dans `prompts/systemPrompts.fr.json`), avec les blocs de règles et les
    fragments assemblés par le code (`strings/strings.fr.json`, sections `ruleBlocksAndLiterals` et
    `promptFragments`). Le prompt reçu est alors intégralement français, ce que mesurent nos outils
    sur l'archive installée. Sont concernés aussi le contact SMS
    H. Whitmore du service du personnel (affaire 000) et le greffier du procureur qui juge la
    déclaration avant accusation, dont le champ `feedback` est affiché au joueur.
41. **Les horodatages des courriels ne sont dans aucun fichier localisé.** `emails[].timestamp`
    (43 occurrences) et `evidence[].phoneRecords[].time` (4 dans l'affaire 003) n'ont pas d'entrée
    dans les surcouches traduites : le joueur français lit « 2 FEB 2020 · 06:14 » dans sa messagerie,
    à côté d'un objet et d'un corps de message français, et à côté d'autres dates que le studio a
    bien traduites ailleurs (`mediaClips[].label`, `spreadsheetRows`, `phoneRecords[].time` des
    affaires 001 et 002). Notre build les rétablit au format déjà employé par le jeu, « 2 FÉVR. 2020
    · 06:14 ». Les neuf autres langues ont le même trou.
42. **Aucun fichier localisé ne porte de clé `date`**, pour aucune des sept affaires et dans aucune
    des dix langues. La date en tête de dossier reste donc en anglais partout ailleurs qu'en anglais
    (« 17 March 2024 » sur un dossier français). Notre build la remplace par un accesseur qui rend
    la forme française quand l'interface est en français. Une clé dans les fichiers de langue
    suffirait à régler le cas pour les dix.
43. **Affaire 001 : la trace relevée sous ultraviolets se contredit d'un texte à l'autre.** La fiche
    et l'indice la situent « at shoulder height (~168–178cm) » et en tirent la taille du coupable,
    mais votre propre point chaud de la photographie parle de `grip height`. Les deux ne peuvent pas
    être vrais : l'épaule d'une personne d'1,73 m est à 1,42 m du sol. Un joueur qui calcule à
    partir de « épaule » innocente Sophie Ward et accuse Omar Farooq, c'est-à-dire l'inverse de la
    solution. Nous avons retenu la hauteur de préhension, seule compatible avec les chiffres, et
    écrit « à hauteur d'homme » aux trois endroits, sans toucher aux mesures.
44. **Affaire 001, trois minutages qui ne tiennent pas ensemble.** Les détecteurs du quatrième étage
    restent actifs jusqu'à 21h33 alors que la tournée de Grace Adeyemi peut les expliquer, la cire
    de nettoyage date la trace d'un passage qui n'avait pas encore eu lieu, et la personnalité de
    Sophie Ward la fait arriver devant Marcus à 21h25 au moment précis où Grace l'entend déjà
    descendre l'escalier. Laissés tels quels, ils demandent un arbitrage d'auteur.
45. **Affaire 002 : Dana Wexler raconte son propre relevé à l'envers.** Sa personnalité lui fait
    dire qu'elle a rebadgé « on your way back out », alors que la dérogation au code superviseur de
    02:40 est enregistrée en ENTRÉE et que sa sortie de 02:58 ne porte aucune anomalie. Le
    personnage explique donc la pièce à charge dans le mauvais sens. Corrigé côté français.
46. **Affaire 005 : le titre de poste de Petra Dunne diffère entre sa personnalité et le dossier**
    (`senior transcript clerk` contre le rôle affiché au joueur). Nous alignons la personnalité sur
    le dossier, puisque c'est le dossier que le joueur lit.
47. **Affaire 004 : la personnalité de Renee Okafor cite une pièce E6 qui n'existe pas.** La liste
    des pièces de cette affaire saute E6 et E15, et le palier de craquage de Renee renvoie à E6 pour
    les photographies de la scène. Le trou est dans la version originale, nous ne l'avons pas
    comblé : renuméroter aurait cassé les renvois justes. À trancher de votre côté.
48. **Affaire 004 : la victime est décrite comme journaliste indépendante** alors que le dossier
    lui donne neuf ans de salariat au même journal, sa carte de presse et un rédacteur en chef qui
    lui commande des sujets. Laissé tel quel, le mot est dans la source.
49. **Affaire 005 : l'appel radio qui corrobore Ostrom tombe hors de l'enregistrement.** Sa
    personnalité et la note du banc audio datent de 22:13 le passage en émission du poste radio dans
    le couloir, mais le seul fragment récupéré du samedi couvre 22:09:45 à 22:10:49. Le joueur ne
    peut donc pas vérifier la corroboration, alors que c'est tout l'intérêt de la scène, et le même
    texte dit deux paragraphes plus bas « around ten past ten ». Nous avons retenu 22:10, la seule
    valeur qui tombe dans le fragment, aux quatre endroits concernés.
50. **Affaire 006 : Ivo Sarris est né le 17/03/1989 et on le dit de 31 ans** au moment des auditions
    du 2 mars 2020, où il en a encore 30. Même traitement que pour Cass Aldiss au point 34 : nous
    déplaçons la date de naissance, citée une fois, plutôt que l'âge, cité trois fois.
51. **Affaire 005 : un fichier du lundi est supprimé le dimanche d'avant.** Dans l'index des
    archives de l'enregistreur, la ligne du lundi 17 février porte « SUPPRIMÉ 16 févr. 09:14 » sur
    deux canaux. Le fichier est effacé la veille du jour qu'il enregistre. Laissé tel quel, il n'y a
    pas moyen de le réparer sans inventer une date.
52. **Affaire 006 : Cove apprend le nom en janvier et en février.** Sa personnalité dit qu'il a vu
    « P. Halloran, 11-C » sur la liste des occupants en février 2020, mais la déposition de Krantz
    (E22) et l'indice `clue-cove-asked-name` le font appeler l'agence **en janvier**, avant même que
    la nouvelle liste soit tapée, pour demander si le 11-C était toujours Halloran. Cet appel est
    l'indice décisif de l'affaire, et il place ce que Cove sait un mois avant ce que sa propre fiche
    reconnaît. Laissé tel quel.
53. **Le prompt d'interrogatoire ne tient pas dans la fenêtre de contexte que vous livrez.** Le
    moteur tourne avec `num_ctx 4096` (Modelfile). Mesuré avec le tokenizer réel de chaque modèle :
    une fois toutes les pièces de l'affaire 006 ramassées, le prompt système d'Adrian Cove pèse
    3 405 jetons en anglais (83 % de la fenêtre, place pour 4 à 6 échanges) et 4 169 en français
    même resserré (le français coûte environ 20 % de jetons de plus à contenu égal). Au débordement,
    `homicide-qwen4b` renvoie HTTP 400 (`exceeds the available context size`) et le jeu **se replie
    en silence sur votre serveur en ligne** (`/api/ask`), et `homicide-gemma*` garde les premiers et
    les derniers jetons et jette le milieu, fiche du personnage comprise (Cove se présente alors
    sous le nom d'un autre personnage). À noter : `/v1/chat/completions`, la route des
    interrogatoires, **ignore un `num_ctx` passé par requête** (mesuré), seule `/api/chat` le
    respecte. Le patch joueur passe par `/api/chat` en `num_ctx 6144`, en français seulement (5 120
    quand le modèle ne tient pas entier en mémoire graphique), et retire les plus vieux échanges
    avant l'envoi : 0 erreur sur 234 échanges de test, historique conservé, 5 fois plus rapide que
    le cas tronqué à 4 096. Qwen 3 4B coûte 3,57 Go en 6 144 contre 3,18 Go en 4 096.
54. **Les deux consignes de langue gardent une queue anglaise.** `hI()` construit « (LANGUAGE: …
    reply in » + le nom de la langue + « only. Never use any English word or letter… », et `fI()`
    (le greffier du procureur) « Write your entire answer in » + le nom + « and in no other
    language… ». Pour toute autre langue que l'anglais, le modèle reçoit une consigne bilingue,
    deux fois par prompt, aux positions les plus lues. Une chaîne complète par langue la supprime.
55. **Les suspects connaissent toutes les pièces ramassées avant qu'on les leur présente.** Le
    prompt liste tous les `collectedEvidenceIds`, présentés ou non. Un petit modèle s'en sert :
    Tommy Vale (affaire 000) citait le cahier de fermeture (« mardi et jeudi ») avant que
    l'inspecteur le montre, 3 fois sur 3, et aucune formulation de la consigne ne l'en a empêché.
    Le patch joueur ne liste, en français seulement, que les pièces déjà posées sur la table devant
    ce suspect (leur nom figure dans l'historique).
56. **En français, Gemma 3 4B joue les suspects bien mieux que Qwen 3 4B.** Lus côte à côte par un
    francophone sur les mêmes questions, Gemma 4B donne des suspects plus vivants et plus crédibles,
    et réagit aux pièces présentées comme le prévoient les fiches, là où Qwen 4B répond dans un
    français plat et parfois absurde. Le patch joueur propose de télécharger `gemma3:4b` depuis le
    registre Ollama (environ 3,3 Go) et crée `homicide-gemma4b` avec le gabarit et les réglages de
    votre propre `homicide-gemma12b`. Il n'est choisi que pour les sessions françaises, les cartes
    qui tiennent le 12B le gardent. À envisager comme modèle plancher du français si la taille du
    téléchargement est acceptable.

57. **La question courante du joueur part deux fois.** `xe()` pousse la question dans
    l'historique, puis `Ie()` prend `getHistory().slice(-10)` et `ask()` ajoute encore
    `{role: "user", content}`. Le modèle voit la même question (avec le `presentationMessage` de la
    pièce s'il y en a une) en deux messages utilisateur consécutifs. Non modifié par le patch
    joueur, signalé pour examen.
58. **`slice(-10)` fait repayer tout le prompt à chaque échange.** Une fois l'historique plein, le
    plus vieux message sort à chaque tour : le texte qui suit le prompt système change dès sa
    première ligne et Ollama ne peut plus réutiliser son préfixe en cache, le modèle relit tout le
    prompt avant le premier mot. Sur une puce graphique intégrée, cette relecture fait l'essentiel
    du délai. En français seulement, le patch joueur garde tout l'historique (et le réduit par blocs
    de 30 % quand la fenêtre est pleine), garde le prompt système identique d'un tour à l'autre et
    chauffe le cache à l'ouverture de l'audition et à l'épinglage d'une pièce. Mesuré sur la même
    machine (puce Intel intégrée, Gemma 3 4B, affaire 000, Tommy Vale, scénario long) : 12,6 s par
    réplique en moyenne avant, 7,9 s après, pire réplique 24,8 s avant, 10,7 s après (version
    anglaise avec votre code : 7,6 s).
59. **L'essentiel du texte généré est jeté.** `ge()` garde 4 phrases et 460 caractères au plus,
    mais le modèle peut écrire jusqu'à `max_tokens 400` avant que `ge()` passe. Le patch joueur lit
    `/api/chat` en flux et arrête la génération dès que le texte affiché par `ge()` ne peut plus
    changer (nombre de phrases atteint, gestes refermés). Vérifié sur 1 457 répliques enregistrées :
    aucun texte affiché ne diffère de la génération complète.
60. **Les mots-clés de stress et les icônes de réaction sont en anglais seulement.** La liste qui ajoute 8 points par mot
    (« prove », « saw you », « evidence », « lied »…) est cherchée dans ce que tape le joueur. Dans
    toute autre langue, les questions tapées n'ajoutent aucun stress, seules les pièces présentées
    et les questions scriptées reconnues le font. L'icône de réaction a la même limite : `te`
    cherche des mots anglais de geste (« shrug », « sigh », « nod »…), les gestes français
    reçoivent donc toujours `react-neutral` (67 % des répliques françaises de nos
    enregistrements). Depuis la 1.2.1, le patch joueur ajoute, en français seulement, un motif
    par mot-clé anglais (mêmes 8 points, « lied » devient « menti », « will » devient
    « testament ») et un motif français par icône, essayé à côté du vôtre dans le même ordre
    (`mecaniques_fr.json`). Mesuré : sur 48 questions en paires anglais/français, un joueur
    gagne 174 points de stress en anglais, 110 en français avant, 166 après (l'écart vient de
    « will », qui prend aussi le verbe auxiliaire en anglais). Icônes neutres en français :
    67 % avant, 1 % après.
61. **« Ne jamais avouer » combat le dernier palier d'aveu.** `i2` (« ABSOLUTE RULE: NEVER
    CONFESS », placé en tête et rappelé en fin) l'emporte sur les derniers paliers de
    `CRACK POINTS`, qui demandent au suspect de cesser de nier. Dans l'autre sens, un petit modèle
    qui lit la vérité cachée dans la fiche la cite trop tôt : Tommy Vale (affaire 000) a dit à
    l'inspecteur avoir vendu la montre chez Westgate Pawn & Loan sans aucune pièce sur la table. Le
    patch joueur balise, dans 15 fiches françaises, les faits qui dépendent d'une pièce
    (`[[SI:E4]] … [[/SI]]`, `+` pour « toutes », `|` pour « l'une ») : ils sont retirés de la fiche
    et envoyés dans le dernier message utilisateur seulement quand cette pièce a été montrée à ce
    suspect.
    Dans les fiches françaises de ce paquet, les balises sont retirées et le texte est complet, avec
    une différence voulue : pour quatre coupables (Sophie Ward, Dana Wexler, Grant Holloway, Victor
    Calloway), la fiche dit qu'ils sont coupables mais ne
    décrit plus comment ils ont tué. Ces détails ne devaient jamais être dits, et un petit modèle
    les citait quand même.

62. **Le certificat d'habilitation est tamponné comme une pièce à conviction.** `JR()` ouvre le
    certificat du bureau dans le papier 3D avec `variant:"standard"` : il reçoit le tampon
    « E V I D E N C E » (« P R E U V E » en français) et le pied de page « OFFICIAL DOCUMENT · FOR
    INVESTIGATIVE USE ONLY », comme une pièce d'affaire. C'est un document du personnel. Le patch
    joueur lui donne, en français seulement, une variante propre (`hdfr-certificat`, dessinée
    comme `standard`) : tampon « H A B I L I T É » et pied de page « ÉTAT DE SERVICE · DOCUMENT
    PERSONNEL ».
63. **L'en-tête du papier n'est reconnu qu'en anglais, en arabe et en chinois.** `Va()` ne traite
    les deux premières lignes comme en-tête (service et intitulé du document) que si la première
    contient « RAVENPORT POLICE » (ou sa forme arabe ou chinoise). Dans les sept autres langues, le
    certificat et les rapports qui commencent par le nom du service (affaire 000 E1, affaire 001
    E1) impriment ces deux lignes dans le corps du texte, et le bandeau retombe sur les libellés
    génériques « BRIGADE CRIMINELLE » / « DOCUMENT D'ENQUÊTE ». Le patch joueur ajoute
    « POLICE DE RAVENPORT » pour le français.

## 3. Endroits où le français s'écarte volontairement du texte anglais

Seulement là où le texte anglais contredit ce que le joueur voit ou entend. À regarder de votre côté.

- **Affaire 000, montre Longines** : le texte dit « bracelet en cuir brun », le modèle 3D (texture de
  `Wristwatch_evidence.glb`) montre un bracelet en cuir noir. Le français dit « cuir noir ».
- **Affaire 001, photo E5 (salle des serveurs B)** : le texte dit « un manche de serpillière tombé »
  et « le chariot de ménage de Grace dans l'embrasure ». L'image montre une tige en aluminium près de
  la porte et un **chariot technique avec écran et clavier** à côté d'un siège de bureau. Le français
  garde le manche et l'indice (la tournée de Grace n'était pas encore passée) mais décrit le chariot
  comme un chariot de technicien. Il précise aussi que la tige n'est pas le rail de baie disparu (le
  rapport de scène dit que le rail n'a jamais été retrouvé), parce que des joueurs l'ont pris pour
  l'arme du crime.
- **Affaire 001, photo de presse de l'article 2** : la légende dit « l'immeuble de Vanta Systems »,
  l'image est la salle des serveurs vide. Le français légende la salle des serveurs sous scellés.
- **Affaire 003, image E5 (caméra de la promenade)** : le texte dit « garé en marche arrière, plaque
  avant face au bâtiment », l'image montre le pick-up garé le nez vers le motel, seule la plaque
  arrière visible. Le français décrit l'image, l'indice (plaque partielle résolue ensuite par le
  central) ne change pas.
- **Affaire 001, message vocal de Marcus** : affiché 0:41, la bande dure 0:29 et il hésite. Les 13
  enregistrements anglais ont été transcrits depuis l'audio et les transcriptions françaises suivent
  la diction parlée (hésitations comprises), pas l'anglais écrit.
- **Titres des affaires** : 000 « La clé du prêteur », 001 « Heures supplémentaires », 002 « Silence
  radio », 003 « Complet », 004 « Un peu d'air », 005 « Heures calmes », 006 « Chez personne ».
- **Affaire 001, la trace UV** : l'anglais dit « à hauteur d'épaule » à trois endroits tout en donnant
  168–178 cm, et votre propre point chaud dit `grip height`. Le français dit « à hauteur d'homme »,
  compatible avec les chiffres et le point chaud. Aucune mesure touchée. Voir point 43.
- **Affaire 005, l'appel radio de 22:13** : le français dit 22:10, seule valeur qui tombe dans le
  fragment audio récupéré, pour que le joueur puisse vérifier la corroboration. Voir point 49.
- **Affaire 006, date de naissance d'Ivo Sarris** : décalée d'un mois, comme pour Cass Aldiss, pour
  que l'âge annoncé tienne. Voir point 50.
- **Affaire 006, date de naissance de Cass Aldiss** : 30/10/2000 au lieu de 30/07/2000, pour que
  l'âge annoncé tienne. Voir point 34.
- **Affaire 003, carnet de Dominic (E3)** : les quatre entrées de routine sont redatées pour que le
  rendez-vous tombe le dimanche, et « mileage 214 » s'écrit « km 214 ». Voir point 26.
- **Affaires 001, 002 et 004, chiffres mis en cohérence** : treize minutes (point 22), découverte à
  03:27 et créneau 02:45-03:15 (points 23 et 24), 8 100 $ partout (point 25), trente jours
  (point 29).
- **Affaire 001, reculée en 2020** : seule de la série en 2024, elle tombait quatre ans après
  l'horloge du bureau (2020) et les six autres affaires, et les pièces à charge contre Sophie Ward
  (2023, 2021) semblaient venir du futur. Le français recule toute l'affaire de 209 semaines
  exactement, ce qui garde chaque jour de semaine : le dimanche 17 mars 2024 devient le dimanche
  15 mars 2020, les faits vont du 12 au 17 mars 2020, la fraude de janvier 2019 à février 2020, la
  SIM est activée le 7 janvier 2019, la boîte postale fermée en 2017, la référence devient
  MC/2020/0315. Date du dossier, 13 horodatages de courriels, pièces, articles et les quatre fiches
  suivent. Le carnet de Marcus (E9) écrit l'année en entier (« janv. 2019 ») : « janv. 23 » se lisait
  « 23 janvier ».
- **Affaire 001, quatre repères de temps** : les avocats écrivent le lundi à 17:45 et fixent leur
  échéance « avant demain, mardi, 09h00 » (l'anglais dit « lundi », déjà passé). Le courriel de
  Morrison de 08:10 dit que le conseil « se réunit ce matin » (il se réunit à 09:00). La page UV du
  coffre est « écrite dans le noir, jeudi » : le coffre est fermé depuis jeudi, l'anglais dit
  dimanche. La dénonciation situe l'annulation du vendredi « deux jours avant » les appels du
  dimanche. Le bavardage parle de « tout le mois dernier » (l'anglais dit « tout le mois de mars »
  alors que la semaine est en mars). La fin « good » parle de la signature complète de Sophie Ward
  sur chaque feuille, comme la pièce E10 (l'anglais dit « initials », que E10 dément).
- **Affaire 002, deux heures** : la dérogation manuelle de 02:40 est dite « cinq minutes avant le
  début du créneau du meurtre, et elle ne ressort qu'à 02h58 », pour suivre le créneau 02:45-03:15
  du point 24. La femme de la porte de chargement est vue « juste avant deux heures » (l'anglais dit
  « deux heures cinq », la caméra montre 01:58).
- **Affaire 003, courriels et relevés** : le corps est découvert à 11:04, trois courriels étaient
  horodatés avant (09:40, 10:20, 11:00, dont un qui dit avoir appris le décès « ce matin »). Ils
  passent à 11:35, 12:05 et 11:50. La présentation des relevés dit « un quart d'heure avant » (21:15
  contre 21:30, l'anglais dit vingt-cinq minutes), la description dit qu'il logeait là « depuis deux
  jours ».
- **Affaire 004, quatre points** : le coffre est « loué depuis septembre 2019 » et Nadia y
  « retourne » la semaine suivante (l'anglais dit qu'il est ouvert deux fois). Farrah entend la
  dispute vers 22h00, « bien loin de l'heure tardive qu'on imaginait pour un suicide » (l'anglais
  dit « bien après » la fenêtre du légiste, qui commence à 22:00). Le code 0412 est expliqué au
  format du joueur français : « Code coffre = mois + jour » et « le mois d'abord, le jour ensuite ».
- **Affaire 005, trois points** : l'index des archives garde deux nuits supprimées (16 et 17), la
  nuit du 15 ne survit qu'en partiel, comme le disent l'étiquette, le courriel et la fiche de Kirwan.
  La pièce E8 ne dit plus « aucun événement dans les dix minutes » autour de 23:45 (son tableau en
  montre trois, à 23:40 et 23:50) mais « rien à 23:45 qui ressemble au passage d'une ronde », comme
  la question posée à Ostrom. La présentation de E8 dit « douze secondes après le coup » (l'anglais
  dit dix-neuf, l'indice de la même pièce et les horodatages donnent douze).
- **Affaire 006, sept points** : la photo du hall ne dit plus que Cove « n'a pas badgé pour sortir »
  (sa fiche et le relevé des badges disent 01:14). « La nuit du 27 » devient « le 27 » ou « la nuit
  du 26 au 27 » (en français, la nuit du 27 va du 27 au 28). Les deux ventes sont « à huit ans
  d'écart » (mai 2010, novembre 2018). Le courriel de Morrison et celui des avocats de Krantz
  rapportent les auditions du 3 mars et passent du 2 au 3 mars. Joan situe la facture du garage
  « deux jours après » l'accident (8 et 10 octobre 2011, l'anglais dit une semaine). RPD-NET donne
  Mayfair depuis 2012 comme la demande d'agrément (E16), pas 2013. La photo de 2013 est datée
  14/06/2013 (l'anglais écrit 06/14/2013, seul format américain de l'affaire), Ruben y a « la
  quarantaine tout juste » (il a 40 ans, l'anglais dit « mid-thirties »), et le message de 22:11 dit
  qu'il a appelé « les deux seuls numéros » qu'il avait (l'anglais dit « le seul », le relevé en
  montre deux).

Tout autre chiffre, heure, date et montant est identique à l'anglais.

## 4. Ce qui a été vérifié, et comment

- Bundle patché : `node --check` passe sur les onze scripts de l'archive, le jeu démarre, le modèle
  se précharge. L'affaire 000 a été jouée jusqu'au bout par un testeur francophone qui ne savait
  rien du projet. Les six autres ont été ouvertes et jouées par sondage, pas terminées de bout en
  bout par nous : leur couverture repose sur les contrôles ci-dessous.
- Structure : chaque objet d'affaire réécrit a exactement les mêmes clés et longueurs de tableaux
  que l'objet français d'origine (notre outil d'injection refuse sinon).
- Mécanique : codes des verrous, mots-clés de l'Atlas, recoupement de mots du mandat (découpage
  `[\p{L}\p{N}]+` après NFKC, accents et apostrophes sans effet), marqueurs d'écriture
  `[[Q:…]]/[[X:…]]`, phrase cliquable de l'article, nombres et heures comparés à l'anglais
  (notre script d'audit). Chaque écart voulu avec l'anglais est listé en section 2 (« le français dit… ») ou
  en section 3.
- Plus d'anglais en alphabet latin sur les surfaces françaises : dictionnaire (0 clé EN sans FR),
  objets `{en:…}` en ligne (0 sans `fr`), radio, terminal, lieux, météo, fil du commissariat.
- Prompt système envoyé au modèle : 100 % de mots français, blocs de règles, personnalités des
  32 personnages, en-têtes assemblés par le code et consigne de langue comprises
  (mesuré par nos outils sur le bundle réellement installé). Plus aucun bloc de
  consigne anglais dans l'archive, le contact SMS et le greffier du procureur compris.
- Rien d'autre touché : les dictionnaires anglais, allemand, espagnol, portugais et turc et les neuf
  autres objets de langue des affaires sont identiques octet pour octet au build d'origine. Aucune
  donnée personnelle dans le paquet.

Non vérifié par nous : les versions arabe et chinoise n'ont été ni touchées ni relues.

## 5. Ce que le patch joueur change dans le code

Le patch joueur est publié à part et n'est pas nécessaire pour intégrer ce paquet. Il ne retouche
jamais le texte du jeu à la main : il remplace l'objet `fr` de chaque affaire par celui de `cases/`,
applique les tables de `ui/`, `prompts/` et `strings/` et réempaquette l'asar. Il fait aussi une
poignée de **modifications de code conditionnées à la langue de l'interface** (`lang === "fr"`, les
neuf autres langues gardent l'expression d'origine) : la date et l'identifiant de l'affaire sur
l'écran d'ouverture, l'espace avant les deux-points après VICTIM, la durée des appels, le courriel
d'affaire classée, les statuts d'unité, la ligne `[The detective places evidence…]` et les deux
consignes de langue du prompt d'interrogatoire. **Deux modifications valent pour toutes les
langues**, sans effet visible hors du français : la liste de mots ROT-13 du point 7 et les colonnes
CSS du point 17. Deux modifications sont **un confort de joueur, pas de la localisation** :
`desktop/dist/localAI.js` lit un fichier facultatif `%APPDATA%\detective-os\localai-override.json`
(`model`, `igpu`) : `"igpu": true` ajoute `OLLAMA_IGPU_ENABLE=1` à l'environnement de l'Ollama
embarqué, `false` l'interdit (point 9). Sans réglage, depuis la 1.3.0 et en français seulement, le
patch essaie la puce intégrée au démarrage quand le modèle s'est chargé sur le processeur
(`size_vram` 0), ne la garde que si une mesure fixe y est plus rapide, revient au processeur au
moindre échec ou plantage, et mémorise le résultat par version du jeu et du patch dans
`hdfr-contexte.json`. Le patch ne crée jamais le fichier de réglage. Depuis le
24/09/2026, `localAI.js` porte aussi le **moteur d'interrogatoire français** des points 53 à 56 :
`/api/chat` en `num_ctx 6144` et le filet anti-débordement quand le rendu signale
`hdfrLang: "fr"`, le filtre des pièces présentées, et `homicide-gemma4b` pour les sessions
françaises quand le joueur a choisi de l'installer (`%APPDATA%\detective-os\hdfr-contexte.json`
dit au processus principal que la dernière session était en français). Toute autre langue suit
votre code d'origine. Depuis la 1.2.0 (25/09/2026), toujours en français seulement, il lit aussi la
réponse en flux et l'arrête tôt (point 59), garde le prompt système stable, tout l'historique et
chauffe le cache (point 58), et envoie les faits `[[SI]]` dans le dernier message utilisateur une
fois leur pièce montrée (point 61). Depuis la 1.2.1, il donne aussi au stress des mots-clés
français et aux icônes de réaction des gestes français (point 60). Intégrez les fichiers de données, et prenez les modifications du moteur
comme des suggestions mesurées.
