import * as React from "react";
import { Button } from "@/components/ui/button.tsx";
import { useGetStartedLink } from "@/hooks/useNavReferenceLink.ts";

interface GetStartedProps {
  size?: "sm" | "md" | "lg" | "xl";
}

export const GetStarted: React.FC<GetStartedProps> = ({ size = "lg" }) => {
  const { link: getStartedLink } = useGetStartedLink();

  return (
    <a href={getStartedLink}>
      <Button size={size} variant="primary">
        Get Started
      </Button>
    </a>
  );
};
