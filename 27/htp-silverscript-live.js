(function() {
  function compileFromForm() {
    const outcome1 = document.querySelector('[name="outcome1"], #outcome-1, [data-outcome="0"]')?.value || 'Yes';
    const outcome2 = document.querySelector('[name="outcome2"], #outcome-2, [data-outcome="1"]')?.value || 'No';
    const allOutcomes = Array.from(document.querySelectorAll('[data-outcome-input]'))
                            .map(el => el.value).filter(Boolean);
    const outcomes = allOutcomes.length >= 2 ? allOutcomes : [outcome1, outcome2];
    const escrow = document.querySelector('[name="escrow"], #escrow-amount')?.value || '10';
    const deadline = document.querySelector('[name="deadline"], #event-deadline')?.value || '1440';
    const oracle = document.querySelector('[name="oracle"], #oracle-address')?.value || 'kaspatest:oracle';

    const script = `// HTP Event Contract — SilverScript
// Auto-compiled from form fields

OUTCOMES: [${outcomes.map(o => `"${o}"`).join(', ')}]
ESCROW: ${escrow} KAS
DEADLINE: ${deadline} minutes
ORACLE: ${oracle}

OP_PUSHDATA "${outcomes[0]}" 
OP_PUSHDATA "${outcomes[1]}"
${outcomes.length > 2 ? outcomes.slice(2).map(o => `OP_PUSHDATA "${o}"`).join('\n') : ''}
OP_INPUTSPK          // verify caller owns input
OP_CHECKSIG          // oracle signature check
OP_IF
  OP_TXOUTPUTSPK     // route to winning address
  OP_EQUALVERIFY
  OP_RETURN 1        // settle
OP_ELSE
  // deadline fallback: return escrow
  OP_RETURN 0
OP_ENDIF`;

    const output = document.querySelector('#silverscript-output, .compiler-output, [data-compiler]');
    if (output) {
      output.value = script;
      output.textContent = script;
      output.classList.add('compiled');
    }
  }

  function watchForm() {
    const form = document.querySelector('#event-creator-form, .event-creation-form, [data-form="event"]');
    if (!form) { setTimeout(watchForm, 1500); return; }
    form.addEventListener('input', compileFromForm);
    form.addEventListener('change', compileFromForm);
    compileFromForm(); // compile immediately on load
    console.log('[HTP SilverScript] Live compiler wired to form');
  }

  document.addEventListener('DOMContentLoaded', watchForm);
  setTimeout(watchForm, 2000);
})();
