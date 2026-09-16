import { hasSession } from "@/lib/auth/session";
import { GradientMesh } from "@/components/gradient-mesh";
import { HomeHero } from "@/components/home-hero";

export default async function Home() {
  const isSignedIn = await hasSession();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <GradientMesh />
      <main className="flex max-w-xl flex-col items-center gap-6 text-center">
        <HomeHero isSignedIn={isSignedIn} />
      </main>
    </div>
  );
}
