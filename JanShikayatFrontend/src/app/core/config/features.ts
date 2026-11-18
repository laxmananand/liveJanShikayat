/**
 * Feature switches. Set a flag back to true to bring the feature back; nothing else needs changing.
 */
export const FEATURES = {
  /** प्रशासन → उपयोगकर्ता प्रबंधन (sidebar item and /admin/users). Temporarily hidden. */
  userManagement: false,
  /**
   * Citizen online complaint form (/register and its landing-page cards). Hidden until it saves to the
   * backend: PublicService.submitComplaint is still a mock that keeps complaints in the citizen's browser only.
   */
  onlineComplaint: false
};
