/**
 * トップの検索窓（作業パッケージ「トップ導線修正」A節）。
 *
 * 一致は部分一致・大文字小文字無視・全角半角スペース除去・ひらがな⇄カタカナの
 * 相互一致で行う。NFKC正規化で全角英数字・半角カタカナも通常の表記へ吸収したうえで、
 * カタカナをひらがなへ揃えて比較する（クエリ・対象の両方に同じ変換を通すため
 * 「ラーメン」と「らーめん」のどちらで入力しても一致する）。
 *
 * 読み仮名データ（かな→漢字の読み）は持たないが、全アイテムが nameRomaji
 * （ヘボン式ローマ字）を持つため、クエリがかな（ひらがな・カタカナ）のときは
 * kanaToRomaji でヘボン式ローマ字の候補に変換し、nameRomaji 等とも突き合わせる
 * （「はかた」→"hakata" が "Hakata Ramen" に一致）。
 *
 * サーバー境界を持たない純関数のみ（DB/フックに依存しない）。BrowseShell から
 * クライアント側の絞り込みとして呼ばれる。
 */

const KATAKANA_START = 0x30a1; // ァ
const KATAKANA_END = 0x30f6; // ヶ
const HIRAGANA_START = 0x3041; // ぁ
const KANA_OFFSET = KATAKANA_START - HIRAGANA_START;

/** カタカナ1文字をひらがなへ変換する（対象範囲外はそのまま返す）。 */
function katakanaToHiragana(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    out += code >= KATAKANA_START && code <= KATAKANA_END
      ? String.fromCodePoint(code - KANA_OFFSET)
      : ch;
  }
  return out;
}

/**
 * 検索クエリ・対象文字列を比較可能な形へ正規化する。
 * NFKC（全角英数字・半角カナ等を統一）→ 空白除去（半角/全角）→ 小文字化 → カタカナ→ひらがな。
 */
export function normalizeSearchText(input: string): string {
  return katakanaToHiragana(
    input.normalize("NFKC").replace(/[\s　]+/g, "").toLowerCase(),
  );
}

/** ひらがな（拗音・撥音を含む）1〜2文字 → ヘボン式ローマ字の基本対応表。 */
const MORA_TABLE: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  きゃ: "kya", きゅ: "kyu", きょ: "kyo",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  しゃ: "sha", しゅ: "shu", しょ: "sho", しぇ: "she",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  じゃ: "ja", じゅ: "ju", じょ: "jo", じぇ: "je",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho", ちぇ: "che",
  つぁ: "tsa", つぃ: "tsi", つぇ: "tse", つぉ: "tso",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  てぃ: "ti", でぃ: "di", とぅ: "tu", どぅ: "du",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
  ふぁ: "fa", ふぃ: "fi", ふぇ: "fe", ふぉ: "fo",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  びゃ: "bya", びゅ: "byu", びょ: "byo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  みゃ: "mya", みゅ: "myu", みょ: "myo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo",
  わ: "wa", ゐ: "i", ゑ: "e", を: "o",
  うぁ: "wa", うぃ: "wi", うぇ: "we", うぉ: "wo",
  ゔ: "vu", ゔぁ: "va", ゔぃ: "vi", ゔぇ: "ve", ゔぉ: "vo",
};

/** 子音で始まる（＝促音「っ」で重複できる）かどうか。 */
const CONSONANT_START = /^[bcdfghjklmnpqrstvwyz]/;

/** hira[i] から始まる最長一致（2文字→1文字の順）のモーラを引く。 */
function lookupMora(hira: string, i: number): { romaji: string; length: number } | null {
  // 2文字分が実在するときだけ2文字キーを試す（文字列末尾で1文字しか残っていない場合に
  // その1文字がたまたま別の1文字キーと一致し、誤って length:2 を返すのを防ぐ）。
  if (i + 2 <= hira.length) {
    const two = hira.slice(i, i + 2);
    if (Object.hasOwn(MORA_TABLE, two)) return { romaji: MORA_TABLE[two], length: 2 };
  }
  const one = hira[i];
  if (Object.hasOwn(MORA_TABLE, one)) return { romaji: MORA_TABLE[one], length: 1 };
  return null;
}

const KANA_PATTERN = /[぀-ヿ]/;

/** クエリにひらがな・カタカナ（長音記号「ー」を含む）が含まれるか。 */
function containsKana(input: string): boolean {
  return KANA_PATTERN.test(input);
}

const MAX_ROMAJI_CANDIDATES = 32;

/**
 * かな（ひらがな・カタカナ）をヘボン式ローマ字の候補に変換する（純関数）。
 *
 * 読み仮名データが無いため漢字は変換できない（かな→かな相互変換
 * normalizeSearchText とは別の目的で、かな→ローマ字専用）。以下は一意に決まらず
 * 実用上どちらの書き方もあるため、両方の候補を返す:
 * - 長音記号「ー」: 前の母音を延ばす（例: らーめん→raamen）か、無視する（→ramen）
 * - お段＋「う」（長音相当。例: しょう）: 「う」を無視する（しょ→sho）か、
 *   そのまま書く（しょう→shou）
 *
 * 決定的に処理するもの:
 * - 促音「っ」: 次の音の先頭子音を重ねる（がっこう→gakko/gakkou の "kk"）。
 *   次が無い・母音始まりのときは読み飛ばす
 * - 撥音「ん」: つねに "n"
 *
 * かな以外の文字（英数字・記号等）はそのまま素通しする。結果は重複を除いた配列。
 */
export function kanaToRomaji(input: string): string[] {
  const hira = katakanaToHiragana(input.normalize("NFKC"));
  const results: string[] = [];
  const seen = new Set<string>();

  const emit = (value: string) => {
    if (seen.size >= MAX_ROMAJI_CANDIDATES) return;
    if (seen.has(value)) return;
    seen.add(value);
    results.push(value);
  };

  function recurse(i: number, acc: string) {
    if (seen.size >= MAX_ROMAJI_CANDIDATES) return;
    if (i >= hira.length) {
      emit(acc);
      return;
    }
    const ch = hira[i];

    // 促音「っ」: 次のモーラの先頭子音を重ねる。次が無い/母音始まりなら読み飛ばす。
    if (ch === "っ") {
      const next = lookupMora(hira, i + 1);
      if (next && CONSONANT_START.test(next.romaji)) {
        recurse(i + 1 + next.length, acc + next.romaji[0] + next.romaji);
      } else {
        recurse(i + 1, acc);
      }
      return;
    }

    // 撥音「ん」
    if (ch === "ん") {
      recurse(i + 1, acc + "n");
      return;
    }

    // 長音記号「ー」: 前の母音を延ばす／無視するの2通りに分岐する。
    if (ch === "ー") {
      const lastChar = acc.slice(-1);
      if (/[aiueo]/.test(lastChar)) {
        recurse(i + 1, acc + lastChar);
      }
      recurse(i + 1, acc);
      return;
    }

    const mora = lookupMora(hira, i);
    if (!mora) {
      // かな以外の文字はそのまま1文字通す
      recurse(i + 1, acc + ch);
      return;
    }

    // お段＋「う」＝長音相当（しょう→sho/shou）。この「う」だけ分岐する。
    if (mora.romaji === "u" && mora.length === 1 && acc.endsWith("o")) {
      recurse(i + 1, acc);
      recurse(i + 1, acc + "u");
      return;
    }

    recurse(i + mora.length, acc + mora.romaji);
  }

  recurse(0, "");
  return results;
}

/**
 * クエリが対象文字列のいずれかに部分一致するか。
 * クエリが空（正規化後に空文字になる場合を含む）なら常に true（絞り込み無し）。
 * クエリがかなを含む場合は、ヘボン式ローマ字の候補（kanaToRomaji）とも突き合わせる
 * （読み仮名データが無い漢字表記には一致しないが、nameRomaji には一致する）。
 */
export function matchesSearchQuery(
  query: string,
  ...targets: (string | null | undefined)[]
): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const romajiCandidates = containsKana(query)
    ? kanaToRomaji(query).map((r) => normalizeSearchText(r))
    : [];
  return targets.some((target) => {
    if (target == null) return false;
    const normalizedTarget = normalizeSearchText(target);
    if (normalizedTarget.includes(q)) return true;
    return romajiCandidates.some((r) => r.length > 0 && normalizedTarget.includes(r));
  });
}
