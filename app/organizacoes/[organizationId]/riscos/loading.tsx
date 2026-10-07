import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-4 sm:p-7 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
