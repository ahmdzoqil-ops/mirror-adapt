/** أدوات نصية عربية: تطبيع للبحث الذكي + مسافة تحرير لأقرب النتائج */

const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

export function normalizeArabic(input: string): string {
  return (input || "")
    .toString()
    .replace(TASHKEEL, "")
    .replace(/[أإآٱa]/g, (m) => (m === "a" ? "a" : "ا"))
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
}

/**
 * درجة تطابق: 1 = مطابق تمامًا، 0 = بعيد.
 * يتجاهل التشكيل واختلاف (أ إ آ ا) و(ة/ه) و(ى/ي)،
 * ويقبل البحث بأي جزء من الاسم أو بأي كلمة منه.
 */
export function matchScore(query: string, target: string): number {
  const q = normalizeArabic(query);
  const t = normalizeArabic(target);
  if (!q) return 1;
  if (!t) return 0;

  if (t === q) return 1;
  if (t.startsWith(q)) return 0.98;

  const words = t.split(" ").filter(Boolean);
  if (words.some((w) => w === q)) return 0.96;
  if (words.some((w) => w.startsWith(q))) return 0.92;
  if (t.includes(q)) return 0.88;
  if (words.some((w) => w.includes(q))) return 0.85;

  // كل كلمات البحث موجودة في الاسم (بأي ترتيب)
  const qWords = q.split(" ").filter(Boolean);
  if (qWords.length > 1 && qWords.every((qw) => words.some((w) => w.includes(qw)))) return 0.8;

  // أقرب تطابق تقريبي (أخطاء إملائية)
  const best = Math.max(
    1 - levenshtein(q, t) / Math.max(q.length, t.length),
    ...words.map((w) => 1 - levenshtein(q, w) / Math.max(q.length, w.length)),
  );
  return Math.max(0, Math.min(best, 0.78));
}
