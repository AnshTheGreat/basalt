export function showVaultWizard(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'vault-wizard-overlay';
    overlay.innerHTML = `
      <div class="vault-wizard">
        <h1>Welcome to Basalt</h1>
        <p>Pick a folder to use as your vault, or create a new one.</p>
        <div class="wizard-actions">
          <button data-action="choose">Open existing vault</button>
          <button data-action="create">Create new vault</button>
        </div>
        <p class="wizard-hint">All notes and attachments live inside this folder.</p>
      </div>
    `;
    document.body.appendChild(overlay);

    const finish = () => { overlay.remove(); resolve(); };
    overlay.querySelector('[data-action="choose"]')!.addEventListener('click', async () => {
      const p = await window.vaultAPI.chooseVault();
      if (p) finish();
    });
    overlay.querySelector('[data-action="create"]')!.addEventListener('click', async () => {
      const p = await window.vaultAPI.createVault();
      if (p) finish();
    });
  });
}
