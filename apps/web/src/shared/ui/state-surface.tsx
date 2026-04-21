import * as React from "react"

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/src/shared/ui/state-message"
import {
  Surface,
  SurfaceBody,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
} from "@/src/shared/ui/surface"

type StateSurfaceBaseProps = {
  className?: string
  density?: React.ComponentProps<typeof Surface>["density"]
  tone?: React.ComponentProps<typeof Surface>["tone"]
  title: React.ReactNode
  description?: React.ReactNode
}

type LoadingSurfaceProps = StateSurfaceBaseProps & {
  variant: "loading"
  label?: string
  rows?: number
  showLoadingHeader?: boolean
}

type ErrorSurfaceProps = StateSurfaceBaseProps & {
  variant: "error"
  stateTitle?: React.ReactNode
  stateDescription?: React.ReactNode
  action?: React.ReactNode
}

type EmptySurfaceProps = StateSurfaceBaseProps & {
  variant: "empty"
  stateTitle: React.ReactNode
  stateDescription?: React.ReactNode
  action?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
}

type StateSurfaceProps =
  | LoadingSurfaceProps
  | ErrorSurfaceProps
  | EmptySurfaceProps

/**
 * Shared async-state shell for widgets and pages that only vary copy between
 * loading, error, and empty states.
 */
function StateSurface({
  className,
  density = "comfortable",
  tone = "elevated",
  title,
  description,
  ...props
}: StateSurfaceProps) {
  return (
    <Surface className={className} density={density} tone={tone}>
      <SurfaceHeader>
        <SurfaceHeading>
          <SurfaceTitle>{title}</SurfaceTitle>
          {description ? (
            <SurfaceDescription>{description}</SurfaceDescription>
          ) : null}
        </SurfaceHeading>
      </SurfaceHeader>
      <SurfaceBody>
        {props.variant === "loading" ? (
          <LoadingState
            label={props.label}
            rows={props.rows}
            showHeader={props.showLoadingHeader ?? false}
          />
        ) : null}
        {props.variant === "error" ? (
          <ErrorState
            action={props.action}
            description={props.stateDescription}
            title={props.stateTitle}
          />
        ) : null}
        {props.variant === "empty" ? (
          <EmptyState
            action={props.action}
            description={props.stateDescription}
            icon={props.icon}
            title={props.stateTitle}
          />
        ) : null}
      </SurfaceBody>
    </Surface>
  )
}

export { StateSurface }
