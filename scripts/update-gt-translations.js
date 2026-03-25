import fs from "node:fs/promises";
import path from "node:path";
import translate from "google-translate-api-x";

const TRANSLATIONS_DIR = path.resolve("public/_gt");
const CACHE_FILE = path.resolve(".gt-translate-cache.json");
const SOURCE_LOCALE = "en";
const BATCH_SIZE = 50;
const MAX_BATCH_CHARACTERS = 4500;
const DELAY_MS = Number(process.env.GT_TRANSLATE_DELAY_MS ?? 1200);
const RETRY_DELAY_MS = Number(process.env.GT_TRANSLATE_RETRY_DELAY_MS ?? 5000);
const MAX_ATTEMPTS = Number(process.env.GT_TRANSLATE_MAX_ATTEMPTS ?? 3);

async function main() {
  const sourcePath = path.join(TRANSLATIONS_DIR, `${SOURCE_LOCALE}.json`);
  const sourceTranslations = await readJson(sourcePath);
  const cache = await readJson(CACHE_FILE, {});
  const files = await fs.readdir(TRANSLATIONS_DIR);
  const localeFiles = files
    .filter((file) => file.endsWith(".json") && file !== `${SOURCE_LOCALE}.json`)
    .sort();

  for (const localeFile of localeFiles) {
    const locale = localeFile.replace(/\.json$/, "");
    await updateLocaleFile({
      cache,
      locale,
      localePath: path.join(TRANSLATIONS_DIR, localeFile),
      sourceTranslations,
    });
  }

  await writeJson(CACHE_FILE, cache);
}

async function updateLocaleFile({ cache, locale, localePath, sourceTranslations }) {
  const localeTranslations = await readJson(localePath);
  const localeCache = cache[locale] ?? {};
  const pendingEntries = new Map();

  for (const [key, sourceText] of Object.entries(sourceTranslations)) {
    if (!isTranslatable(sourceText)) {
      localeTranslations[key] = sourceText;
      continue;
    }

    const cachedTranslation = localeCache[sourceText];
    if (typeof cachedTranslation === "string" && cachedTranslation.length > 0) {
      localeTranslations[key] = cachedTranslation;
      continue;
    }

    const entry = pendingEntries.get(sourceText);
    if (entry) {
      entry.keys.push(key);
      continue;
    }

    pendingEntries.set(sourceText, {
      keys: [key],
      sourceText,
    });
  }

  const pendingList = Array.from(pendingEntries.values());
  if (pendingList.length === 0) {
    console.log(`[${locale}] no new strings to translate`);
    await writeJson(localePath, localeTranslations);
    return;
  }

  console.log(`[${locale}] translating ${pendingList.length} new strings`);

  const batches = buildBatches(pendingList);
  let translatedCount = 0;

  for (const batch of batches) {
    const translatedTexts = await translateBatch(locale, batch);

    batch.forEach((entry, index) => {
      const translatedText = preserveOuterWhitespace(
        entry.sourceText,
        translatedTexts[index],
      );

      localeCache[entry.sourceText] = translatedText;

      for (const key of entry.keys) {
        localeTranslations[key] = translatedText;
      }
    });

    translatedCount += batch.length;
    cache[locale] = localeCache;

    await writeJson(localePath, localeTranslations);
    await writeJson(CACHE_FILE, cache);

    console.log(
      `[${locale}] translated ${translatedCount}/${pendingList.length} strings`,
    );

    await sleep(DELAY_MS);
  }
}

function buildBatches(entries) {
  const batches = [];
  let currentBatch = [];
  let currentCharacters = 0;

  for (const entry of entries) {
    const entryCharacters = entry.sourceText.length;
    const exceedsBatchSize = currentBatch.length >= BATCH_SIZE;
    const exceedsCharacterLimit =
      currentBatch.length > 0 &&
      currentCharacters + entryCharacters > MAX_BATCH_CHARACTERS;

    if (exceedsBatchSize || exceedsCharacterLimit) {
      batches.push(currentBatch);
      currentBatch = [];
      currentCharacters = 0;
    }

    currentBatch.push(entry);
    currentCharacters += entryCharacters;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

async function translateBatch(locale, batch) {
  const texts = batch.map((entry) => entry.sourceText);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const results = await translate(texts, {
        client: "gtx",
        forceBatch: true,
        from: SOURCE_LOCALE,
        to: locale,
      });

      if (!Array.isArray(results)) {
        throw new Error(`Expected array response for locale "${locale}"`);
      }

      if (results.length !== texts.length) {
        throw new Error(
          `Expected ${texts.length} translations for locale "${locale}", received ${results.length}`,
        );
      }

      return results.map((result, index) => {
        const translatedText = result?.text?.trim();
        if (!translatedText) {
          throw new Error(
            `Missing translation for locale "${locale}" at batch index ${index}`,
          );
        }

        return translatedText;
      });
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }

      console.warn(
        `[${locale}] batch failed on attempt ${attempt}/${MAX_ATTEMPTS}, retrying...`,
      );
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw new Error(`Failed to translate batch for locale "${locale}"`);
}

function preserveOuterWhitespace(sourceText, translatedText) {
  const leadingWhitespace = sourceText.match(/^\s*/u)?.[0] ?? "";
  const trailingWhitespace = sourceText.match(/\s*$/u)?.[0] ?? "";
  return `${leadingWhitespace}${translatedText.trim()}${trailingWhitespace}`;
}

function isTranslatable(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    /\p{L}/u.test(value)
  );
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === "ENOENT" && fallback !== null) {
      return fallback;
    }

    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
