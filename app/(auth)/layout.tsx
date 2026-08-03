import Link from "next/link";
import { GradientMesh } from "@/components/gradient-mesh";
import { Card } from "@/components/ui";
import { AuthCardMotion } from "@/components/auth/auth-card-motion";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <GradientMesh />
      <Link
        href="/"
        className="mb-8 bg-gradient-to-r from-brand-from via-brand-via to-brand-to bg-clip-text text-2xl font-bold tracking-tight text-transparent"
      >
        fracture
      </Link>
      <div className="w-full max-w-sm">
        <AuthCardMotion>
          <Card>{children}</Card>
        </AuthCardMotion>
      </div>
    </div>
  );
}
