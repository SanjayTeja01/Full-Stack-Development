import { Suspense } from "react";
import { AuthAction } from "./auth-action";
import { Spinner } from "@/components/ui/feedback";

export default function AuthActionPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AuthAction />
    </Suspense>
  );
}
