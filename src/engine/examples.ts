/*
 * Carnatic Music Notation Typesetter — bundled examples
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Most of these come from the v1.5 Beta manual. Add your own by appending
 * { id, title, text } objects; they appear in the Examples menu and the
 * tests check that each one parses without warnings.
 */
export interface Example {
  id: string;
  title: string;
  text: string;
}

const NEW_SONG = `# Lines starting with # are comments.
# Press Assist for help with directives, or Help for the full manual.
Title: "Song name"
Tala: Adi
SmartLyricMode
Heading: "Song name - Raga - Tala - Composer",bold,center,14
Heading: ""
Heading: "pallavi:",bold,left,12
S: s , r , g , p , | d , s' , | d p g r ||
L: sa ri ga pa da sa da pa ga ri
`;

const QUICKSTART = `# The "Quick Start" example from the v1.5 manual
Title: "brOva bhAramA"
Tala: Adi
DefaultSpeed: 1
Heading: "brOva bhAramA - bahudAri - Adi - tyAgarAja",bold,italic,14,center
Heading: ""
Heading: "pallavi:",bold,left,12
S: "1)" ; , ( p   d n , ) pa m | ga , g | m      pa , ||
L:      _ _   brO _ va _   bhA ra   mA _ ra ghu rA ,
S: "2)" m~ , , ( p    d n s' n p     ; ) m | ga , g | m    pa , ||
L:      mA . .    brO _ vA . . bhA _     ra   mA _ ra ghu rA ,
`;

const SMART = `# The same lines in Smart Lyric Mode: no _ needed for pauses
Title: "brOva bhAramA (smart lyrics)"
Layout: Krithi
Tala: Adi
SmartLyricMode
Heading: "brOva bhAramA - bahudAri - Adi - tyAgarAja",bold,italic,14,center
Heading: ""
Heading: "pallavi:",bold,left,12
S: "1)" ; , ( p d n , ) pa m | ga , g | m pa , ||
L:            brO . va    bhA ra mA   ra ghu rA
S: "2)" m~ , , ( p d n s' n p ; ) m | ga , g | m pa , ||
L:      mA . .   brO . vA . . bhA ra  mA   ra ghu rA
`;

const GITAM = `# Gitam layout: first speed, a space after every akshara
Title: "SrI gaNanAtha"
Layout: gitam
Tala: rupaka
Heading: "SrI gaNanAtha - malahari - rUpaka - purandaradAsa",bold,center,14
Heading: ""
S: m   p d s' s' r' r' s' d p m      p
L: sRi . ga Na nA ta sin du ra . var na
S: r   m p d m p d p m g r s
L: ka ru Na sA ga ra ka ri va da na .
`;

const VARNAM = `# Varnam layout: second speed, aligned at every akshara
Title: "ninnukOri"
Layout: varnam
Tala: Adi
Heading: "ninnukOri - mOhanam - Adi (varnam)",bold,center,14
Heading: ""
S: g , g    , r                      , , , s s r r g g r r s r g r s     r s d\` s r g p g r s r
L: ni _ nnu _ kO                     . . . ri . . . . . . . yu . . . nnA . . . nu . . . ra . . .
`;

const SPEEDS = `# DefaultSpeed, ( ) for faster speeds, and Gati changes
Title: "Speeds and gati"
Heading: "Speeds",bold,center,14
Heading: "DefaultSpeed: 0 (first speed)",italic
DefaultSpeed: 0
Layout: varnam
Tala: Adi
S: s r ( s r ( g m p d ) ) r g ( r g ( m p d n ) )
Heading: "DefaultSpeed: 1 (second speed)",italic
DefaultSpeed: 1
Layout: varnam
Tala: Adi
S: sa ri s r ( g m p d ) ri ga r g ( m p d n )
Heading: "DefaultSpeed: 2 (third speed)",italic
DefaultSpeed: 2
Layout: varnam
Tala: Adi
S: sa ; ri ; sa ri g m p d ri ; ga ; ri ga m p d n
Heading: ""
Heading: "Gati changes",bold,center,14
Layout: Varnam
Tala: Adi
DefaultSpeed: 2
S: s r g m    p d   n s' s' n d p | m g r s |
Gati: Tisra
S: s r g r g m g m p m p d ||
Gati: Khanda
S: s r s r g r g r g m
Gati: Misra
S: s r g s r g m
Gati: Sankirna
S: s r s r g s r g m |
Gati: catusra
S: s r g m    p d   n s' | s' n d p m g r s ||
`;

const TALAS = `# A few of the talas, from the Tala Directive section of the manual
Title: "Talas"
Heading: "Adi",bold
Tala: Adi
DefaultSpeed: 1
S: s r g m p d n s' s' n d p m g r s
Heading: "Misra Capu",bold
Tala: MisraCapu
DefaultSpeed: 1
S: s , n d m d n d , m g m d m
Heading: "Khanda Capu",bold
Tala: KhandaCapu
DefaultSpeed: 1
S: s g s g m g m g m p
Heading: "Rupaka Capu",bold
Tala: RupakaCapu
DefaultSpeed: 1
S: s r g r g m g m p m p d p d n d n s'
Heading: "Adi, tisra gati",bold
Tala: Tisra_Adi
DefaultSpeed: 1
S: s r g m p d n s' s' n d m
S: p g r s s' n d p m g r s
Heading: "Rupaka, first speed",bold
Tala: Rupaka
DefaultSpeed: 0
S: m p d s' s' r' | r' s' d p
S: r m p d m p | d p m g
Heading: "Khanda Jati Ata",bold
Tala: Khanda_Ata
DefaultSpeed: 1
S: s r g m p d n s' n d p m g r s r g m p d n s' s' n d p m g
`;

const ORNAMENTS = `# Gamakas, stayi dots, phrase ends and "same as before"
Title: "Gamakas and phrasing"
Tala: Adi
DefaultSpeed: 1
Heading: "Gamaka signs",bold
S: m~ , ma~~ , r g^ m s m/ g r s ma// g r n d\\ p m n da\\\\ p
Heading: "Text above a swara, and stayi dots",bold
S: s' n(w) n d p m g r s n\` d\` p\` s ; , s'' ;
Heading: "Phrase ends shown as handles, with spacing",bold
PhraseEnds: Handle,10
Tala: Adi
S: ( s' n' d p- n d p m ) pa ( s' n' d p- n d p m ) pa ; ;
Heading: "= repeats an akshara of the previous line",bold
PhraseEnds: Hide
Tala: Adi
S: p ; ( s' n d n ) p d n | s' , , , | , , , , ||
S: =   =   =      =           | =    =   | ( d n s' ,- d n s' , ) ||
`;

const MANUAL = `# Manual mode with inline tala markers (jagadAnandakAraka, caraNam 5)
Title: "jagadAnandakAraka"
Layout:Krithi
PhraseEnds: Hide,0.45in
Tala: Adi,Manual,InlineTalaMarkers
DefaultSpeed: 2
Heading: "jagadAnandakAraka - nATa - tyAgarAja - caraNam #5",bold,center,13
S: sa     pa   ma ri- s pa m r s- p m ga- m p n        p ga- m pa m ri- p   m ri-
L: sR.Sh Tis dit yan da kA ra kA . mi ta kA mi ta pha la dA sa mA na gA tra Sa ci
LineBreak
S: n p m ri- s' n p m ri- r' sa'- p sa'- m pa- r g m pa- s' , n p m
L: pa ti nu tA pti ma ta ha ra nu rA     ga rA ga rA ji ta ka tA sA _ ra hi ta
`;

const LANGUAGES = `# Lyrics are typed in the Unified Transliteration Scheme
# and shown in the script chosen with Language:
Title: "Languages"
Tala: Adi
Heading: "English",bold
Language: English
S: ; , ( p d n , ) pa m | ga , g | m pa , ||
L: _ _ brO _ va _ bhA ra mA _ ra ghu rA ,
Heading: "Diacritics",bold
Language: Diacritics
S: ; , ( p d n , ) pa m | ga , g | m pa , ||
L: _ _ brO _ va _ bhA ra mA _ ra ghu rA ,
Heading: "Sanskrit",bold,english
Language: Sanskrit
S: ; , ( p d n , ) pa m | ga , g | m pa , ||
L: _ _ brO _ va _ bhA ra mA _ ra ghu rA ,
Heading: "Telugu",bold,english
Language: Telugu
S: ; , ( p d n , ) pa m | ga , g | m pa , ||
L: _ _ brO _ va _ bhA ra mA _ ra ghu rA ,
Heading: "Kannada",bold,english
Language: Kannada
S: ; , ( p d n , ) pa m | ga , g | m pa , ||
L: _ _ brO _ va _ bhA ra mA _ ra ghu rA ,
Heading: "Malayalam",bold,english
Language: Malayalam
S: ; , ( p d n , ) pa m | ga , g | m pa , ||
L: _ _ brO _ va _ bhA ra mA _ ra ghu rA ,
Heading: "Tamil",bold,english
Language: Tamil
S: ; , ( p d n , ) pa m | ga , g | m pa , ||
L: _ _ brO _ va _ bhA ra mA _ ra ghu rA ,
Heading: "brOva bhAramA",tamil,center,14,bold
`;

const EXERCISES = `# Beginner exercises in gitam layout (one swara per akshara)
Title: "Sarali Varisai and Alankarams"
Layout: gitam
Heading: "Sarali Varisai - mAyAmALavagauLa - Adi",bold,center,14
Tala: Adi
Heading: "1",bold
S: s r g m p d n s'
S: s' n d p m g r s
Heading: "2",bold
S: s r s r s r g m
S: s r g m p d n s'
S: s' n s' n s' n d p
S: s' n d p m g r s
Heading: "3",bold
S: s r g s r g s r
S: s r g m p d n s'
S: s' n d s' n d s' n
S: s' n d p m g r s
Heading: ""
Heading: "Alankarams",bold,center,14
Heading: "Dhruva talam",bold
Tala: Catusra_Dhruva
S: s r g m g r s r g r s r g m
S: r g m p m g r g m g r g m p
Heading: "Matya talam",bold
Tala: Catusra_Matya
S: s r g r s r s r g m
S: r g m g r g r g m p
Heading: "Rupaka talam",bold
Tala: Catusra_Rupaka
S: s r s r g m
S: r g r g m p
Heading: "Triputa talam",bold
Tala: Tisra_Triputa
S: s r g s r g m
S: r g m r g m p
`;

export const examples: Example[] = [
  { id: 'quickstart', title: 'Quick start (brOva bhAramA)', text: QUICKSTART },
  { id: 'smart', title: 'Smart lyric mode', text: SMART },
  { id: 'gitam', title: 'Gitam layout (SrI gaNanAtha)', text: GITAM },
  { id: 'varnam', title: 'Varnam layout (ninnukOri)', text: VARNAM },
  { id: 'speeds', title: 'Speeds and gati', text: SPEEDS },
  { id: 'talas', title: 'Talas', text: TALAS },
  { id: 'ornaments', title: 'Gamakas and phrasing', text: ORNAMENTS },
  { id: 'manual', title: 'Manual mode, inline tala markers', text: MANUAL },
  { id: 'languages', title: 'Languages', text: LANGUAGES },
  { id: 'exercises', title: 'Sarali Varisai and Alankarams', text: EXERCISES },
];
export const newSongTemplate = NEW_SONG;
