import { Suspense } from "react";
import type { Metadata } from "next";
import { OnboardingForm } from "./onboarding-form";
import { Spinner } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Complete your profile" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <OnboardingForm />
    </Suspense>
  );
}
