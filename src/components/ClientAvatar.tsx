import { cn } from "@/lib/utils";

/** لون ثابت مشتق من اسم العميل — أفاتار أنيق وموحّد في كل التطبيق */
const PALETTE = [
  "bg-primary/12 text-primary",
  "bg-success/12 text-success",
  "bg-destructive/12 text-destructive",
  "bg-accent text-accent-foreground",
  "bg-secondary text-secondary-foreground",
];

function hueOf(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

const SIZES = {
  sm: "size-9 text-sm",
  md: "size-11 text-base",
  lg: "size-14 text-xl",
} as const;

export function ClientAvatar({
  name,
  photo,
  size = "md",
  className,
}: {
  name: string;
  photo?: string | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const base = cn(
    "shrink-0 rounded-full overflow-hidden ring-1 ring-border/60",
    SIZES[size],
    className,
  );
  if (photo) {
    return <img src={photo} alt={name} className={cn(base, "object-cover")} loading="lazy" />;
  }
  return (
    <div className={cn(base, "flex items-center justify-center font-bold", hueOf(name))}>
      {name.trim().charAt(0) || "؟"}
    </div>
  );
}
