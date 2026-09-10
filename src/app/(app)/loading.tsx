import { Skeleton } from "@/components/ui/skeleton";

// App Router loading boundary, shown while a route segment behind the
// shell is fetching. Kept generic since it covers every screen here.
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
