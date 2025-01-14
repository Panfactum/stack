import { faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress";

function MarkdownGuideNavButton(props: {
  href: string | undefined;
  tooltip: string;
  text: string;
  icon: "left" | "right";
}) {
  const { href, tooltip, text, icon } = props;

  if (href === undefined) {
    return <div className="w-36" />;
  }

  return (
    <Button asChild variant={`primary`}>
      <a href={href} className={`flex items-center gap-x-xs `}>
        {icon === "right" ? null : (
          <FontAwesomeIcon icon={faArrowLeft} size="lg" />
        )}
        {text}
        {icon === "left" ? null : (
          <FontAwesomeIcon icon={faArrowRight} size="lg" />
        )}
      </a>
    </Button>
  );
}

interface MarkdownGuideNavProps {
  backHref?: string | undefined;
  backText?: string | undefined;
  backTooltip?: string | undefined;
  forwardHref?: string | undefined;
  forwardText?: string | undefined;
  forwardTooltip?: string | undefined;
  stepNumber?: number | undefined;
  totalSteps?: number | undefined;
  progressLabel?: string | undefined;
}

export default memo(function MarkdownGuideNav(props: MarkdownGuideNavProps) {
  const {
    backHref,
    backText = "Previous",
    backTooltip = "Previous page",
    forwardHref,
    forwardText = "Next",
    forwardTooltip = "Next page",
    stepNumber,
    totalSteps = 10,
    progressLabel,
  } = props;

  return (
    <div className="w-full flex flex-col gap-2 py-4 not-prose">
      <div className=" flex justify-between items-end">
        <MarkdownGuideNavButton
          href={backHref}
          text={backText}
          tooltip={backTooltip}
          icon={"left"}
        />
        {stepNumber === undefined ? (
          <div />
        ) : (
          <div className="justify-center gap-3 hidden lg:flex">
            <div className="font-bold">{progressLabel}</div>
            <div>
              {" "}
              Step {stepNumber} /{totalSteps}
            </div>
          </div>
        )}
        <MarkdownGuideNavButton
          href={forwardHref}
          text={forwardText}
          tooltip={forwardTooltip}
          icon={"right"}
        />
      </div>
      {stepNumber === undefined ? (
        <div />
      ) : (
        <div className="flex flex-col gap-3">
          <Progress
            color="primary"
            value={Math.round((stepNumber / totalSteps) * 100)}
          />
          <div className="justify-center gap-3 flex lg:hidden text-base">
            <div className="font-bold">{progressLabel}</div>
            <div>
              {" "}
              Step {stepNumber} /{totalSteps}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
