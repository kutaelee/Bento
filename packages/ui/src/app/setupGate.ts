export type SetupGateDecision = {
  allow: boolean;
  redirectTo?: string;
};

export const getSetupGateDecision = (setupRequired: boolean): SetupGateDecision => {
  if (setupRequired) {
    return { allow: true };
  }

  return { allow: false, redirectTo: "/login" };
};
