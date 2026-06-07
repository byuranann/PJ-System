import { submitData } from '../api';
import { sanitize } from '../utils/helpers';

// Language key for translations
const LANGUAGE_KEY = 'google_sheets_dashboard_language';

// Translation Dictionary (duplicated locally since we removed the export from main.ts)
const translations = {
  en: {
    toastSuccessTitle: 'Success',
    toastErrorTitle: 'Error',
    toastWarningTitle: 'Warning',
    validationError: 'Validation Error',
    validationErrorMsg: 'Please check the highlighted fields and try again.',
    fieldAError: 'Product Type is required and cannot be empty.',
    fieldBError: 'Weight is required and must be a valid number.',
    fieldCError: 'Name cannot exceed 500 characters.',
    submissionFailed: 'Submission Failed',
    submissionFailedMsg: 'Could not connect to Google Apps Script. Please verify your connection and URL.'
  },
  th: {
    toastSuccessTitle: 'สำเร็จ',
    toastErrorTitle: 'ข้อผิดพลาด',
    toastWarningTitle: 'คำเตือน',
    validationError: 'ข้อผิดพลาดในการตรวจสอบ',
    validationErrorMsg: 'กรุณาตรวจสอบฟิลด์ที่ไฮไลต์และลองอีกครั้ง.',
    fieldAError: 'ชนิดสินค้าเป็นสิ่งจำเป็นและไม่สามารถเว้นว่างได้.',
    fieldBError: 'น้ำหนักเป็นสิ่งจำเป็นและต้องเป็นตัวเลขที่ถูกต้อง.',
    fieldCError: 'ชื่อไม่สามารถเกิน 500 ตัวอักษรได้.',
    submissionFailed: 'การส่งล้มเหลว',
    submissionFailedMsg: 'ไม่สามารถเชื่อมต่อกับ Google Apps Script ได้ กรุณาตรวจสอบการเชื่อมต่อและ URL ของคุณ.'
  }
};

/**
 * Render and initialize the Data Entry Form Page
 *
 * @param container The DOM element where the page should be rendered
 * @param showToast Callback to trigger global toast notifications
 */
export function renderFormPage(
  container: HTMLElement,
  showToast: (title: string, msg: string, type: 'success' | 'error' | 'warning') => void
): void {
  const lang = translations[(localStorage.getItem(LANGUAGE_KEY) as keyof typeof translations) || 'en'];

  // 1. Render the HTML Structure
  container.innerHTML = `
    <div class="card card-glass" style="max-width: 680px; margin: 0 auto;">
      <div class="loading-overlay" id="form-loading-overlay">
        <div class="btn-loading-spinner" style="width: 48px; height: 48px; border-width: 4px; border-top-color: var(--color-brand)"></div>
      </div>

      <h2 class="card-title" data-translate="formTitle">Collect New Data</h2>
      <p style="color: var(--text-muted); margin-bottom: 24px; font-size: 0.9rem;" data-translate="formDescription">Submit entries directly to your connected Google Sheet.</p>

      <form id="data-entry-form" novalidate>
        <div class="form-group">
          <label for="field-a" data-translate="fieldALabel">Field A (Category / Label)<span class="required-asterisk">*</span></label>
          <input
            type="text"
            id="field-a"
            name="fieldA"
            class="form-input"
            required
            maxlength="250"
            placeholder=""
            data-translate-placeholder="fieldAPlaceholder"
            aria-describedby="error-field-a hint-field-a"
          >
          <span class="form-error-msg" id="error-field-a" aria-live="polite">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style="margin-right: 4px;">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
            </svg>
            <span>${lang.fieldAError}</span>
          </span>
          <span class="form-hint" id="hint-field-a" data-translate="fieldAHint">Enter the main label or category name (max 250 characters).</span>
        </div>

        <div class="form-group">
          <label for="field-b" data-translate="fieldBLabel">Field B (Numeric Value)<span class="required-asterisk">*</span></label>
          <input
            type="number"
            id="field-b"
            name="fieldB"
            class="form-input"
            required
            step="any"
            placeholder=""
            data-translate-placeholder="fieldBPlaceholder"
            aria-describedby="error-field-b hint-field-b"
          >
          <span class="form-error-msg" id="error-field-b" aria-live="polite">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style="margin-right: 4px;">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
            </svg>
            <span>${lang.fieldBError}</span>
          </span>
          <span class="form-hint" id="hint-field-b" data-translate="fieldBHint">Enter any positive or negative numeric value.</span>
        </div>

        <div class="form-group">
          <label for="field-c" data-translate="fieldCLabel">Field C (Notes / Description)</label>
          <input
            type="text"
            id="field-c"
            name="fieldC"
            class="form-input"
            maxlength="500"
            placeholder=""
            data-translate-placeholder="fieldCPlaceholder"
            aria-describedby="error-field-c hint-field-c"
          >
          <span class="form-error-msg" id="error-field-c" aria-live="polite">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style="margin-right: 4px;">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
            </svg>
            <span>${lang.fieldCError}</span>
          </span>
          <span class="form-hint" id="hint-field-c" data-translate="fieldCHint">Add any additional notes (max 500 characters, optional).</span>
        </div>

        <div class="form-actions">
          <button type="button" id="btn-clear" class="btn btn-secondary" data-translate-value="btnClear">Reset Form</button>
          <button type="submit" id="btn-submit" class="btn btn-primary" data-translate-value="btnSubmit">Submit Entry</button>
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
  const validateField = (input: HTMLInputElement, errorEl: HTMLElement, errorKey: string) => {
    const isValid = input.checkValidity();
    const currentLang = translations[(localStorage.getItem(LANGUAGE_KEY) as keyof typeof translations) || 'en'];

    if (!isValid) {
      input.classList.add('interacted');
      errorEl.style.display = 'flex';
      input.setAttribute('aria-invalid', 'true');

      const span = errorEl.querySelector('span');
      if (span) {
        if (input.validity.valueMissing) {
          span.textContent = currentLang[errorKey as keyof typeof currentLang] || `${input.labels?.[0]?.textContent?.replace('*', '').trim() || 'Field'} is required.`;
        } else if (input.validity.typeMismatch || input.validity.badInput) {
          span.textContent = currentLang.fieldBError;
        } else if (input.validity.tooLong) {
          span.textContent = currentLang.fieldCError;
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
  inputA.addEventListener('blur', () => validateField(inputA, errorA, 'fieldAError'));
  inputB.addEventListener('blur', () => validateField(inputB, errorB, 'fieldBError'));
  inputC.addEventListener('blur', () => validateField(inputC, errorC, 'fieldCError'));

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

    const currentLang = translations[(localStorage.getItem(LANGUAGE_KEY) as keyof typeof translations) || 'en'];

    // Trigger validation for all fields
    const isValA = validateField(inputA, errorA, 'fieldAError');
    const isValB = validateField(inputB, errorB, 'fieldBError');
    const isValC = validateField(inputC, errorC, 'fieldCError');

    if (!isValA || !isValB || !isValC) {
      // Focus the first invalid element
      if (!isValA) inputA.focus();
      else if (!isValB) inputB.focus();
      else if (!isValC) inputC.focus();

      showToast(currentLang.validationError, currentLang.validationErrorMsg, 'error');
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
        showToast(currentLang.toastSuccessTitle, 'Your entry has been saved to Google Sheets successfully.', 'success');
        resetForm();
      } else {
        showToast(currentLang.toastErrorTitle, response.message || 'An unknown error occurred.', 'error');
      }
    } catch (err) {
      showToast(
        currentLang.toastErrorTitle,
        currentLang.submissionFailedMsg,
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
