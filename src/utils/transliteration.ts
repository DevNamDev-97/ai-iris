/**
 * Transliteration utility for converting Devanagari (Hindi) script into
 * English/Latin alphabets (Romanized Hindi / Hinglish).
 * 
 * Ensures that all user transcriptions and speech logs appear in the same
 * English alphabets as the AI assistant, never in Hindi Devanagari characters.
 */

// Common loanwords / tech terms in Devanagari mapping to clean English representation
const COMMON_WORD_MAP: Record<string, string> = {
  'व्हाट्सएप': 'WhatsApp',
  'व्हाट्सऐप': 'WhatsApp',
  'वाट्सएप': 'WhatsApp',
  'यूट्यूब': 'YouTube',
  'गूगल': 'Google',
  'इंस्टाग्राम': 'Instagram',
  'स्पॉटिफ़ाई': 'Spotify',
  'स्पॉटिफाई': 'Spotify',
  'कैलकुलेटर': 'Calculator',
  'पायथन': 'Python',
  'जावास्क्रिप्ट': 'JavaScript',
  'कोड': 'Code',
  'गेम': 'Game',
  'स्नेक': 'Snake',
  'फोटो': 'Photo',
  'फ़ोटो': 'Photo',
  'वीडियो': 'Video',
  'मैसेज': 'Message',
  'कॉल': 'Call',
  'फ़ोन': 'Phone',
  'फोन': 'Phone',
  'स्क्रीनशॉट': 'Screenshot',
  'कैमरा': 'Camera',
  'फाइल': 'File',
  'फ़ाइल': 'File',
  'डॉक्यूमेंट': 'Document',
  'लिंक': 'Link',
  'ब्राउज़र': 'Browser',
  'म्यूजिक': 'Music',
  'गाना': 'Gaana',
  'नमस्ते': 'Namaste',
  'नमस्कार': 'Namaskar',
  'हाँ': 'Haan',
  'हां': 'Haan',
  'नहीं': 'Nahi',
  'नही': 'Nahi',
  'क्या': 'Kya',
  'कैसे': 'Kaise',
  'कैसा': 'Kaisa',
  'कैसी': 'Kaisi',
  'कौन': 'Kaun',
  'कहाँ': 'Kahan',
  'कहा': 'Kaha',
  'क्यों': 'Kyun',
  'क्यो': 'Kyo',
  'अच्छा': 'Achha',
  'ठीक': 'Theek',
  'बहुत': 'Bahut',
  'सुनो': 'Suno',
  'दिखाओ': 'Dikhao',
  'दिखा': 'Dikha',
  'खोल': 'Khol',
  'खोलो': 'Kholo',
  'बनाओ': 'Banao',
  'बना': 'Bana',
  'करो': 'Karo',
  'कर': 'Kar',
  'भेज': 'Bhej',
  'भेजो': 'Bhejo',
  'चलाओ': 'Chalao',
  'रुक': 'Ruk',
  'रुको': 'Ruko',
  'मदद': 'Madad',
  'बात': 'Baat',
  'दोस्त': 'Dost',
  'यार': 'Yaar',
  'भाई': 'Bhai',
  'दीदी': 'Didi',
  'मम्मी': 'Mummy',
  'पापा': 'Papa',
  'आज': 'Aaj',
  'कल': 'Kal',
  'मौसम': 'Mausam',
  'टाइम': 'Time',
  'समय': 'Samay',
};

const VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  'अं': 'an', 'अः': 'ah', 'ऑ': 'o',
};

const MATRAS: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
  'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ं': 'n', 'ँ': 'n', 'ः': 'h', 'ॉ': 'o',
};

const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
  'ष': 'sh', 'स': 's', 'ह': 'h',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'r',
  'ढ़': 'rh', 'फ़': 'f', 'य़': 'y',
};

/**
 * Checks if a string contains any Devanagari characters
 */
export function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Transliterates a single Hindi word from Devanagari to English Latin alphabets
 */
function transliterateWord(word: string): string {
  // Strip punctuation for lookup
  const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, '');
  if (COMMON_WORD_MAP[cleanWord]) {
    return word.replace(cleanWord, COMMON_WORD_MAP[cleanWord]);
  }

  let result = '';
  const len = word.length;
  let i = 0;

  while (i < len) {
    const char = word[i];
    const nextChar = i + 1 < len ? word[i + 1] : '';
    const nextNextChar = i + 2 < len ? word[i + 2] : '';

    // Handle nukta combinations (e.g., क़, ख़, ज़, फ़)
    let fullChar = char;
    if (nextChar === '़') {
      fullChar = char + nextChar;
      i++;
    }

    if (VOWELS[fullChar]) {
      result += VOWELS[fullChar];
    } else if (CONSONANTS[fullChar]) {
      const consonantSound = CONSONANTS[fullChar];
      // Check what follows the consonant
      const peek = i + 1 < len ? word[i + 1] : '';

      if (peek === '्') {
        // Virama: half consonant (no implicit 'a')
        result += consonantSound;
        i++; // skip virama
      } else if (MATRAS[peek]) {
        // Followed by matra
        result += consonantSound + MATRAS[peek];
        i++; // skip matra
      } else if (peek && CONSONANTS[peek]) {
        // Followed by another consonant (inherent 'a')
        result += consonantSound + 'a';
      } else if (i === len - 1) {
        // Word ending consonant: in standard Hindi, schwa is usually deleted at end
        result += consonantSound;
      } else {
        result += consonantSound + (/[a-zA-Z0-9]/.test(peek) ? '' : 'a');
      }
    } else if (MATRAS[char]) {
      result += MATRAS[char];
    } else if (char === '्') {
      // isolated virama, skip
    } else {
      result += char;
    }

    i++;
  }

  // Cleanup redundant double letters
  result = result
    .replace(/aaa/g, 'aa')
    .replace(/eee/g, 'ee')
    .replace(/ooo/g, 'oo')
    .replace(/nnn/g, 'n');

  return result;
}

/**
 * Strips internal audio/transcription meta tags like <no speech>, {pause}, [pause], <pause>
 */
export function stripAudioMetaTags(text: string): string {
  if (!text) return '';
  return text
    .replace(/<no\s*speech.*?>/gi, '')
    .replace(/<pause.*?>/gi, '')
    .replace(/\{pause.*?\}/gi, '')
    .replace(/\[pause.*?\]/gi, '')
    .replace(/<.*?>/g, '')
    .replace(/\{.*?\}/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Transliterates full sentence/text from Devanagari to English alphabets (Hinglish/Roman script).
 * If text is already in Latin/English, returns it as is.
 */
export function toEnglishAlphabets(text: string): string {
  if (!text) return '';
  
  const cleanMeta = stripAudioMetaTags(text);
  if (!cleanMeta) return '';

  let formatted = cleanMeta;
  if (hasDevanagari(cleanMeta)) {
    // Split by whitespace and token boundaries
    const tokens = cleanMeta.split(/(\s+|[.,!?;:'"()[\]{}])/);
    formatted = tokens
      .map((token) => {
        if (hasDevanagari(token)) {
          return transliterateWord(token);
        }
        return token;
      })
      .join('');
  }

  return formatCaptionAssistantName(formatted);
}

/**
 * Formats any occurrences of the assistant name in captions and UI text as "I.R.I.S."
 */
export function formatCaptionAssistantName(text: string): string {
  if (!text) return text;
  return text.replace(/\b(Iris|IRIS|I\s*R\s*I\s*S)\b/gi, 'I.R.I.S.');
}
