import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-4 sm:p-7 lg:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-9 w-56" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full" />
        ))}
      </div>
    </div>
  );
}
