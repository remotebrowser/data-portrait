document.addEventListener('DOMContentLoaded', function () {
  const form = document.querySelector('div.card');

  if (form) {
    form.addEventListener('submit', function (e) {
      const overlay = document.createElement('div');
      overlay.className = 'form-overlay';

      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      spinner.style.borderTopColor = '#333';

      overlay.appendChild(spinner);
      form.appendChild(overlay);
    });
  }

  const eyeIcon =
    '<svg class="icon-eye" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>';
  const eyeOffIcon =
    '<svg class="icon-eye-off" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>';

  document.querySelectorAll('input[type="password"]').forEach(function (input) {
    if (
      input.parentElement &&
      input.parentElement.classList.contains('password-wrapper')
    ) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'password-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-toggle';
    toggle.setAttribute('aria-label', 'Show password');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.innerHTML = eyeIcon + eyeOffIcon;

    toggle.addEventListener('click', function () {
      const willShow = input.type === 'password';
      input.type = willShow ? 'text' : 'password';
      toggle.classList.toggle('is-visible', willShow);
      toggle.setAttribute('aria-pressed', String(willShow));
      toggle.setAttribute(
        'aria-label',
        willShow ? 'Hide password' : 'Show password'
      );
    });

    wrapper.appendChild(toggle);
  });
});
