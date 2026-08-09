/** يحوّل مخرج البناء index.mobile.html إلى index.html المتوقّع من Capacitor */
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "dist-mobile");
const src = join(dir, "index.mobile.html");
const dest = join(dir, "index.html");
if (existsSync(src)) renameSync(src, dest);
if (!existsSync(dest)) {
  console.error("dist-mobile/index.html غير موجود — فشل بناء نسخة الجوال");
  process.exit(1);
}
console.log("✔ dist-mobile/index.html جاهز");
