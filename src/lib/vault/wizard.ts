/**
 * First-run vault setup. Delegates straight to the OS folder picker,
 * which already supports creating a new folder inline (via the
 * `createDirectory` flag in the main process handler).
 */
export async function showVaultWizard(): Promise<boolean> {
  const p = await window.vaultAPI.chooseVault();
  return !!p;
}
