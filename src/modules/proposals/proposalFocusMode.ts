import { matchPath } from "react-router";

export const isProposalPreviewPath = (pathname: string) =>
  Boolean(matchPath("/proposals/:id/preview", pathname));

export const isProposalBuilderPath = (pathname: string) =>
  Boolean(
    matchPath({ path: "/proposals/create", end: true }, pathname) ||
      matchPath("/proposals/:id/edit", pathname),
  );

/** Proposal builder + draft/review workspace. */
export const isProposalFocusModePath = (pathname: string) =>
  isProposalPreviewPath(pathname) || isProposalBuilderPath(pathname);
