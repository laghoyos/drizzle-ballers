// ── PROGRAM CARD HOVER HIGHLIGHT ──
document.querySelectorAll('.program-card').forEach(card => {
  card.style.cursor = 'pointer';
  const btn = card.querySelector('a, button');

  card.addEventListener('mouseenter', () => {
    document.querySelectorAll('.program-card').forEach(c => {
      c.classList.remove('featured');
      c.querySelector('.program-tag').classList.add('gray');
      const b = c.querySelector('a, button');
      b.className = 'btn-secondary';
      b.style.cssText = 'display:inline-block;font-size:0.85rem;padding:0.7rem 1.5rem;';
      const p = c.querySelector('.program-price');
      if (p) p.style.color = 'var(--silver)';
    });
    card.classList.add('featured');
    card.querySelector('.program-tag').classList.remove('gray');
    btn.className = 'btn-primary';
    btn.style.cssText = 'display:inline-block;font-size:0.85rem;padding:0.7rem 1.5rem;';
    const activePrice = card.querySelector('.program-price');
    if (activePrice) activePrice.style.color = 'var(--green)';
  });
});

// ── BOOKING FLOW ──
// Payment is now collected by Calendly itself (Stripe connected under Calendly's
// own Integrations settings), so each price tier needs its own Calendly event type.
// Prices below MUST match what's configured on each event type in Calendly.
const CALENDLY_EVENTS = {
  'u5': 'https://calendly.com/drizzleballers/age-group-u5',
  '6-7': 'https://calendly.com/drizzleballers/age-group-6-7',
  '8-9': 'https://calendly.com/drizzleballers/age-group-8-9'
};
const AGE_GROUP_LABELS = { 'u5': 'Under 5', '6-7': '6–7', '8-9': '8–9' };
const PRICE = 35;

// Calendly's widget.js loads async — wait for it before calling its API.
function withCalendly(cb) {
  if (window.Calendly) return cb();
  setTimeout(() => withCalendly(cb), 150);
}

let ageGroupSelected = localStorage.getItem('drizzle_age_group') || 'u5';

function setAgeGroupAndShowCalendly(group) {
  ageGroupSelected = group;
  localStorage.setItem('drizzle_age_group', group);
  ['u5', '6-7', '8-9'].forEach(g => {
    document.getElementById('btn-' + g).classList.toggle('active', g === group);
  });

  document.getElementById('group-confirmed').style.display = 'none';

  // Show Calendly step (keep age group selector visible above)
  document.getElementById("booking-step-2").style.display = "block";

  // Update age group label
  document.getElementById('level-display').textContent = AGE_GROUP_LABELS[group];

  renderGroupWidget();
}

function renderGroupWidget() {
  const container = document.getElementById('calendly-group-widget');
  container.innerHTML = '';
  container.style.display = 'block';
  document.getElementById('group-confirmed').style.display = 'none';
  withCalendly(() => Calendly.initInlineWidget({
    url: CALENDLY_EVENTS[ageGroupSelected],
    parentElement: container
  }));
}

// Single global handler — routes to whichever booking flow is active.
// Calendly only fires this once the whole flow (including any payment step) completes.
window.addEventListener('message', function(e) {
  if (e.origin !== 'https://calendly.com' || e.data.event !== 'calendly.event_scheduled') return;
  if (document.getElementById('booking-step-2').style.display !== 'none' &&
      document.getElementById('group-confirmed').style.display === 'none') {
    showGroupConfirmed();
  }
});

function showGroupConfirmed() {
  document.getElementById('calendly-group-widget').style.display = 'none';
  document.getElementById('confirm-total').textContent = '$' + PRICE;
  document.getElementById('group-confirmed').style.display = 'block';

  // Optional email notification only — Calendly + Stripe are the actual record of the booking/payment.
  const bookingData = new FormData();
  bookingData.append('age_group', AGE_GROUP_LABELS[ageGroupSelected]);
  bookingData.append('total', '$' + PRICE);
  bookingData.append('status', 'booked_and_paid');
  fetch(`https://formspree.io/f/${FORMSPREE_BOOKING}`, {
    method: 'POST',
    body: bookingData,
    headers: { 'Accept': 'application/json' }
  }).catch(err => console.error('Booking notification error:', err));
}

function backToLevel() {
  document.getElementById("booking-step-2").style.display = "none";
  document.getElementById('group-confirmed').style.display = 'none';
}

function showGroupBooking() {
  document.getElementById('group-book-btn-container').style.display = 'none';
  document.getElementById('booking-step-1').style.display = 'block';
}

function resetGroupBooking() {
  document.getElementById('group-book-btn-container').style.display = 'block';
  document.getElementById('booking-step-1').style.display = 'none';
  document.getElementById('booking-step-2').style.display = 'none';
  document.getElementById('group-confirmed').style.display = 'none';
}


// init — highlight the saved age group's button
['u5', '6-7', '8-9'].forEach(g => {
  document.getElementById('btn-' + g).classList.toggle('active', g === ageGroupSelected);
});


const LINKS = {
  freePassByAge: {
    'Under 5': 'https://calendly.com/drizzleballers/free-pass-age-group-u5',
    '6–7 years old': 'https://calendly.com/drizzleballers/free-pass-age-group-6-7',
    '8–9 years old': 'https://calendly.com/drizzleballers/free-pass-age-group-8-9'
  }
};

// ── TAB SWITCHING ──
function switchTab(tab, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.book-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).style.display = 'block';
  btn.classList.add('active');
}

// ── FREE SESSION CLAIM ──
function normalizePhone(raw) {
  return raw.replace(/\D/g, '');
}

function claimFreeSession(e) {
  e.preventDefault();
  const form  = e.target;
  const name  = document.getElementById('fs-name').value.trim();
  const phone = normalizePhone(document.getElementById('fs-phone').value);
  const msg   = document.getElementById('free-msg');
  const submitBtn = form.querySelector('button[type="submit"]');

  if (phone.length < 7) {
    msg.className = 'error';
    msg.textContent = '⚠️ Please enter a valid phone number.';
    return;
  }

  // Local duplicate check — fast UX guard (Formspree is the real record)
  const existing = JSON.parse(localStorage.getItem('db_free_sessions') || '[]');
  const duplicate = existing.find(r => normalizePhone(r.phone) === phone);
  if (duplicate) {
    msg.className = 'error';
    msg.textContent = `⚠️ This number already claimed a free class on ${duplicate.date}. One per family!`;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Claiming…';

  fetch(`https://formspree.io/f/${FORMSPREE_FREE_SESSION}`, {
    method: 'POST',
    body: new FormData(form),
    headers: { 'Accept': 'application/json' }
  })
    .then(r => {
      if (!r.ok) return r.json().then(d => { throw new Error(d.errors?.map(x => x.message).join(', ') || 'Error'); });

      // Persist locally only after a successful server record
      const record = {
        name,
        phone: document.getElementById('fs-phone').value.trim(),
        date: new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
      };
      existing.push(record);
      localStorage.setItem('db_free_sessions', JSON.stringify(existing));

      const freePassUrl = LINKS.freePassByAge[document.getElementById('fs-age').value] || 'https://calendly.com/drizzleballers';
      msg.className = 'success';
      msg.innerHTML = `✅ You're on the list, <strong>${name}</strong>! We'll text you at ${document.getElementById('fs-phone').value.trim()} to confirm your spot. Pick your time below to lock it in:`;
      submitBtn.textContent = '🎉 Claimed!';

      const widget = document.getElementById('free-pass-widget');
      widget.innerHTML = '';
      widget.style.display = 'block';
      withCalendly(() => Calendly.initInlineWidget({
        url: freePassUrl,
        parentElement: widget
      }));
    })
    .catch(err => {
      msg.className = 'error';
      msg.textContent = '⚠️ Something went wrong — please text us directly at (206) 730-9007.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Claim My Free Class ⚽';
      console.error('Free session error:', err);
    });
}


function toggleMenu() {
  const menu = document.getElementById('mobile-menu');
  const btn  = document.querySelector('.nav-hamburger');
  menu.classList.toggle('open');
  btn.classList.toggle('open');
  document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
}

const rain = document.getElementById('rain');
for (let i = 0; i < 40; i++) {
  const drop = document.createElement('div');
  drop.classList.add('drop');
  drop.style.left = Math.random() * 100 + '%';
  drop.style.height = (40 + Math.random() * 60) + 'px';
  drop.style.animationDuration = (1.5 + Math.random() * 2.5) + 's';
  drop.style.animationDelay = (Math.random() * 3) + 's';
  rain.appendChild(drop);
}

// ── FORMSPREE IDs — replace with your own from formspree.io/forms ──
const FORMSPREE_CONTACT     = 'xwvjvgqo';
const FORMSPREE_FREE_SESSION = 'mykakrpa';
const FORMSPREE_BOOKING     = 'meeweyzy';

// Form submit
function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn  = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  fetch(`https://formspree.io/f/${FORMSPREE_CONTACT}`, {
    method: 'POST',
    body: new FormData(form),
    headers: { 'Accept': 'application/json' }
  })
    .then(r => {
      if (r.ok) {
        btn.textContent = '✅ Message Sent!';
        btn.style.background = '#2a5a00';
        form.reset();
        setTimeout(() => {
          btn.textContent = 'Send Message ⚽';
          btn.style.background = '';
          btn.disabled = false;
        }, 3000);
      } else {
        return r.json().then(d => { throw new Error(d.errors?.map(x => x.message).join(', ') || 'Error'); });
      }
    })
    .catch(err => {
      btn.textContent = '⚠️ Failed — try emailing us';
      btn.style.background = '#7f1d1d';
      btn.disabled = false;
      console.error('Contact form error:', err);
    });
}

// Scroll animations
const observer = new IntersectionObserver((entries) => {
  entries.forEach(el => {
    if (el.isIntersecting) {
      el.target.style.opacity = '1';
      el.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.program-card, .pricing-card, .schedule-day, .stat-chip').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});
