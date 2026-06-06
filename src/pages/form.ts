import { submitData, isApiConfigured } from '../api';
import { sanitize } from '../utils/helpers';

/**
 * Render and initialize the Data Entry Form Page
 * 
 * @param container The DOM element where the page should be rendered
 * @param showToast Callback to trigger global toast notifications
 * @param openSettings Callback to open the API settings modal
 */
export function renderFormPage(
  container: HTMLElement, 
  showToast: (title: string, msg: string, type: 'success' | 'error' | 'warning') => void,
  openSettings: () => void
): void {
  // 1. Render the HTML Structure
  container.innerHTML = `
    <div class="card card-glass" style="max-width: 680px; margin: 0 auto;">
      <div class="loading-overlay" id="form-loading-overlay">
        <div class="btn-loading-spinner" style="width: 48px; height: 48px; border-width: 4px; border-top-color: var(--color-brand)"></div>
      </div>
      
      <h2 class="card-title">Collect New Data</h2>
      <p style="color: var(--text-muted); margin-bottom: 24px; font-size: 0.9rem;">Submit entries directly to your connected Google Sheet.</p>
      
      <form id="data-entry-form" novalidate>
        <div class="form-group">
          <label for="field-a">Field A (Category / Label)<span class="required-asterisk">*</span></label>
          <input 
            type="text" 
            id="field-a" 
            name="fieldA" 
            class="form-input" 
            required 
            maxlength="250" 
            placeholder="e.g. Sales, Marketing, Project Alpha"
            aria-describedby="error-field-a hint-field-a"
          >
          <span class="form-error-msg" id="error-field-a" aria-live="polite">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style="margin-right: 4px;">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
            </svg>
            <span>Field A is required and cannot be empty.</span>
          </span>
          <span class="form-hint" id="hint-field-a">Enter the main label or category name (max 250 characters).</span>
        </div>

        <div class="form-group">
          <label for="field-b">Field B (Numeric Value)<span class="required-asterisk">*</span></label>
          <input 
            type="number" 
            id="field-b" 
            name="fieldB" 
            class="form-input" 
            required 
            step="any" 
            placeholder="e.g. 150.50, 42"
            aria-describedby="error-field-b hint-field-b"
          >
          <span class="form-error-msg" id="error-field-b" aria-live="polite">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style="margin-right: 4px;">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
            </svg>
            <span>Field B is required and must be a valid number.</span>
          </span>
          <span class="form-hint" id="hint-field-b">Enter any positive or negative numeric value.</span>
        </div>

        <div class="form-group">
          <label for="field-c">Field C (Notes / Description)</label>
          <input 
            type="text" 
            id="field-c" 
            name="fieldC" 
            class="form-input" 
            maxlength="500" 
            placeholder="e.g. Quarterly review notes (optional)"
            aria-describedby="error-field-c hint-field-c"
          >
          <span class="form-error-msg" id="error-field-c" aria-live="polite">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style="margin-right: 4px;">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
            </svg>
            <span>Field C cannot exceed 500 characters.</span>
          </span>
          <span class="form-hint" id="hint-field-c">Add any additional notes (max 500 characters, optional).</span>
        </div>

        <div class="form-actions">
          <button type="button" id="btn-clear" class="btn btn-secondary">Reset Form</button>
          <button type="submit" id="btn-submit" class="btn btn-primary">Submit Entry</button>
        </div>
      </form>
    </div>
  `;

  // 2. DOM Elements
  const form = document.getElementById('data-entry-form') as HTMLFormElement;
  const inputA = document.getElementById('field-a') as HTMLInputElement;
  const inputB = document.getElementById('field-b') as HTMLInputElement;
  const inputC = document.getElementById('field-c') as HTMLInputElement;
  
  const errorA = document.getElementById('error-field-a') as HTMLElement;
  const errorB = document.getElementById('error-field-b') as HTMLElement;
  const errorC = document.getElementById('error-field-c') as HTMLElement;
  
  const loadingOverlay = document.getElementById('form-loading-overlay') as HTMLElement;
  const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
  const btnSubmit = document.getElementById('btn-submit') as HTMLButtonElement;

  // 3. Validation Logic per Field
  const validateField = (input: HTMLInputElement, errorEl: HTMLElement, customMessage?: string) => {
    const isValid = input.checkValidity();
    
    if (!isValid) {
      input.classList.add('interacted');
      errorEl.style.display = 'flex';
      input.setAttribute('aria-invalid', 'true');
      
      const span = errorEl.querySelector('span');
      if (span) {
        if (input.validity.valueMissing) {
          span.textContent = customMessage || `${input.labels?.[0]?.textContent?.replace('*', '').trim() || 'Field'} is required.`;
        } else if (input.validity.typeMismatch || input.validity.badInput) {
          span.textContent = 'Please enter a valid numeric value.';
        } else if (input.validity.tooLong) {
          span.textContent = `Maximum character limit exceeded.`;
        } else {
          span.textContent = input.validationMessage;
        }
      }
    } else {
      input.classList.remove('interacted');
      errorEl.style.display = 'none';
      input.removeAttribute('aria-invalid');
    }
    return isValid;
  };

  // 4. Attach Validation Timing Listeners (Blur and Input)
  // Validate on exit (blur)
  inputA.addEventListener('blur', () => validateField(inputA, errorA, 'Field A is required and cannot be empty.'));
  inputB.addEventListener('blur', () => validateField(inputB, errorB, 'Field B is required and must be a valid number.'));
  inputC.addEventListener('blur', () => validateField(inputC, errorC));

  // Clear errors immediately on input (active typing)
  const clearErrorOnInput = (input: HTMLInputElement, errorEl: HTMLElement) => {
    if (input.checkValidity()) {
      input.classList.remove('interacted');
      errorEl.style.display = 'none';
      input.removeAttribute('aria-invalid');
    }
  };
  inputA.addEventListener('input', () => clearErrorOnInput(inputA, errorA));
  inputB.addEventListener('input', () => clearErrorOnInput(inputB, errorB));
  inputC.addEventListener('input', () => clearErrorOnInput(inputC, errorC));

  // Helper to clear form states completely
  const resetForm = () => {
    form.reset();
    [inputA, inputB, inputC].forEach(input => {
      input.classList.remove('interacted');
      input.removeAttribute('aria-invalid');
    });
    [errorA, errorB, errorC].forEach(err => {
      err.style.display = 'none';
    });
  };

  // Clear Button Click Handler
  btnClear.addEventListener('click', resetForm);

  // 5. Submit Event Handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Trigger validation for all fields
    const isValA = validateField(inputA, errorA, 'Field A is required and cannot be empty.');
    const isValB = validateField(inputB, errorB, 'Field B is required and must be a valid number.');
    const isValC = validateField(inputC, errorC);

    if (!isValA || !isValB || !isValC) {
      // Focus the first invalid element
      if (!isValA) inputA.focus();
      else if (!isValB) inputB.focus();
      else if (!isValC) inputC.focus();
      
      showToast('Validation Error', 'Please check the highlighted fields and try again.', 'error');
      return;
    }

    // Check API URL configuration
    if (!isApiConfigured()) {
      showToast(
        'Setup Required', 
        'Google Sheets API URL is not configured. Please paste your deployed Web App URL in settings.', 
        'warning'
      );
      openSettings();
      return;
    }

    // Prepare payload
    const payload = {
      fieldA: sanitize(inputA.value),
      fieldB: Number(inputB.value),
      fieldC: sanitize(inputC.value)
    };

    // Toggle loading states
    loadingOverlay.classList.add('active');
    btnSubmit.disabled = true;
    btnClear.disabled = true;

    try {
      // API call
      const response = await submitData(payload);

      if (response.status === 'success') {
        showToast('Success', 'Your entry has been saved to Google Sheets successfully.', 'success');
        resetForm();
      } else {
        showToast('Error saving data', response.message || 'An unknown error occurred.', 'error');
      }
    } catch (err) {
      showToast(
        'Submission Failed', 
        'Could not connect to Google Apps Script. Please verify your connection and URL.', 
        'error'
      );
    } finally {
      // Restore states
      loadingOverlay.classList.remove('active');
      btnSubmit.disabled = false;
      btnClear.disabled = false;
    }
  });
}
