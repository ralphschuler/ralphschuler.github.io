const button = document.querySelector('#copy-prompt');
const prompt = document.querySelector('#agent-prompt');
const status = document.querySelector('#copy-status');
button.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(prompt.value);
    status.textContent = 'Copied.';
  } catch {
    prompt.focus();
    prompt.select();
    status.textContent = 'Selected. Copy the text using your keyboard.';
  }
});
