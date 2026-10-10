/**
 * C4S STUDIO — Official Interactive Engine
 * Next-Gen Web Experience & Audio Synthesis
 */

document.addEventListener('DOMContentLoaded', () => {
  initParticleCanvas();
  initHeaderScroll();
  initMobileDrawer();
  init3DCardTilt();
  initStatsCounter();
  initPortfolioFilters();
  initCostEstimator();
  initFaqAccordion();
  initAudioSynthesizer();
});

/* ==========================================================================
   1. AMBIENT PARTICLE CANVAS BACKGROUND
   ========================================================================== */
function initParticleCanvas() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  const particleCount = Math.min(Math.floor(window.innerWidth / 18), 70);

  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.7;
      this.vy = (Math.random() - 0.5) * 0.7;
      this.radius = Math.random() * 2 + 1;
      this.alpha = Math.random() * 0.5 + 0.2;
      this.color = Math.random() > 0.4 ? '#8b5cf6' : '#06b6d4';
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.alpha;
      ctx.fill();
    }
  }

  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  // Connect particles with faint glowing lines
  function animate() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();

      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 110) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = '#8b5cf6';
          ctx.globalAlpha = (1 - dist / 110) * 0.15;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    ctx.globalAlpha = 1.0;
    requestAnimationFrame(animate);
  }

  animate();
}

/* ==========================================================================
   2. HEADER & NAVIGATION SCROLL EFFECTS
   ========================================================================== */
function initHeaderScroll() {
  const header = document.getElementById('header');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id], header[id]');

  window.addEventListener('scroll', () => {
    // Header shadow & blur on scroll
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Scroll Spy for Nav links
    let currentId = '';
    const scrollPos = window.scrollY + 120;

    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = section.getAttribute('id');
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.add('active');
      }
    });
  });
}

/* ==========================================================================
   3. MOBILE DRAWER MENU
   ========================================================================== */
function initMobileDrawer() {
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const drawerClose = document.getElementById('drawerClose');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  if (!mobileToggle || !mobileDrawer) return;

  const toggleMenu = () => {
    const isOpen = mobileDrawer.classList.toggle('open');
    mobileToggle.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
    playSfx('click');
  };

  mobileToggle.addEventListener('click', toggleMenu);
  if (drawerClose) drawerClose.addEventListener('click', toggleMenu);

  mobileNavLinks.forEach((link) => {
    link.addEventListener('click', () => {
      mobileDrawer.classList.remove('open');
      mobileToggle.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

/* ==========================================================================
   4. HERO 3D CARD TILT INTERACTION
   ========================================================================== */
function init3DCardTilt() {
  const cardWrapper = document.querySelector('.cube-card-wrapper');
  const card = document.querySelector('.studio-card-3d');
  if (!cardWrapper || !card) return;

  cardWrapper.addEventListener('mousemove', (e) => {
    const rect = cardWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 12;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  });

  cardWrapper.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  });
}

/* ==========================================================================
   5. STATS COUNT-UP ANIMATION
   ========================================================================== */
function initStatsCounter() {
  const statNumbers = document.querySelectorAll('.stat-number');
  if (!statNumbers.length) return;

  let started = false;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !started) {
          started = true;
          statNumbers.forEach((stat) => {
            const target = parseInt(stat.getAttribute('data-count'), 10) || 0;
            let current = 0;
            const duration = 1800; // ms
            const stepTime = 25;
            const increment = target / (duration / stepTime);

            const timer = setInterval(() => {
              current += increment;
              if (current >= target) {
                stat.textContent = target;
                clearInterval(timer);
              } else {
                stat.textContent = Math.floor(current);
              }
            }, stepTime);
          });
        }
      });
    },
    { threshold: 0.5 }
  );

  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) observer.observe(heroStats);
}

/* ==========================================================================
   6. PORTFOLIO FILTERS & MODAL DATA
   ========================================================================== */
const portfolioData = {
  'cyber-frag': {
    title: 'Cyber Frag Velocity (Valorant / CS2)',
    category: 'Gaming Montage',
    tags: ['Valorant', 'CS2', 'Velocity Motion', 'Sound FX'],
    gradientClass: 'grad-1',
    icon: 'fa-crosshairs',
    description:
      'A hyper-synchronized, high-tempo montage showcasing clutch moments in Valorant and CS2. Engineered with custom optical flow time-remapping, velocity curves, 3D bullet impacts, cinematic camera angles, and tailored bass-heavy audio layering.',
    specs: {
      Resolution: '4K Ultra-HD (3840x2160)',
      Framerate: '60 FPS Ultra-Smooth',
      Software: 'After Effects, Premiere Pro, RSMB',
      Turnaround: '48 Hours',
    },
    highlights: [
      'Synchronized beat drops with shot impacts',
      'Custom 3D weapon inspect angles using HLAE / Replay tool',
      'Clean cinematic color grade and glowing kill highlights',
    ],
  },
  'neon-tokyo': {
    title: 'Neon Cyber Odyssey (Cinematic Reel)',
    category: 'Cinematic Video Editing',
    tags: ['Cinematic 4K', 'Color Grade', 'Cyberpunk', 'VFX'],
    gradientClass: 'grad-2',
    icon: 'fa-clapperboard',
    description:
      'An atmospheric cyberpunk visual journey produced for a flagship digital media release. Combines anamorphic lens flares, dystopian color palettes, dynamic 3D typography, and custom ambient sound design.',
    specs: {
      Resolution: '4K Cinema DCI (4096x2160)',
      Framerate: '24 FPS Cinematic',
      Software: 'DaVinci Resolve Studio, After Effects',
      Turnaround: '72 Hours',
    },
    highlights: [
      'Hollywood-standard ACES color pipeline',
      'Dynamic speed ramping and seamless mask transitions',
      'Original soundscapes and immersive Foley effects',
    ],
  },
  'c4s-core': {
    title: 'C4S Quantum Core 3D Reveal',
    category: '3D & VFX',
    tags: ['Blender 4.0', 'Unreal Engine 5', 'Holographic', 'Chrome'],
    gradientClass: 'grad-3',
    icon: 'fa-cubes-stacked',
    description:
      'A futuristic 3D intro ident made for competitive esports streams and YouTube channels. Features metallic displacement shaders, particle disintegration, neon wireframes, and energetic camera sweeps.',
    specs: {
      Resolution: '4K Master (60 FPS)',
      Engine: 'Blender Cycles & Unreal Engine 5.3',
      Format: 'Alpha Channel WebM / ProRes 4444',
      Turnaround: '48 Hours',
    },
    highlights: [
      'Transparent background support for stream stingers',
      'Procedural glass refraction and metallic reflections',
      'Custom futuristic sci-fi sound effects included',
    ],
  },
  'esports-viper': {
    title: 'Viper Strike Esports Clan Identity',
    category: 'Esports & Clan Branding',
    tags: ['Vector Mascot', 'Jersey Kit', 'Twitch Pack', 'Social Kit'],
    gradientClass: 'grad-4',
    icon: 'fa-shield-cat',
    description:
      'A ferocious brand overhaul for an international esports organization. Includes primary and secondary mascot marks, print-ready tournament jerseys, stream overlays, social media headers, and victory announcement cards.',
    specs: {
      Deliverables: 'Full Vector (AI, EPS, SVG, PNG, PDF)',
      Merch: 'Sublimation Print Ready CMYK',
      Socials: 'YouTube, Twitch, Discord, Twitter/X',
      Turnaround: '3 to 5 Days',
    },
    highlights: [
      'Distinct aggressive esports mascot aesthetics',
      'Complete typography system and brand guidelines',
      'Optimized avatars and banners for all platforms',
    ],
  },
  'gta-cinematic': {
    title: 'Night City Heist RP Trailer',
    category: 'Gaming Cinematic',
    tags: ['GTA V RP', 'Rockstar Editor', 'Voiceover', 'Drone Cinematics'],
    gradientClass: 'grad-5',
    icon: 'fa-car-burst',
    description:
      'A cinematic server trailer produced for a high-population GTA V Roleplay community. Crafted with custom camera scripting, realistic rain reflections, narrative voice acting, and high-speed pursuit choreography.',
    specs: {
      Resolution: '2K QHD 60 FPS',
      Tools: 'Rockstar Editor, ReShade, DaVinci Resolve',
      Soundtrack: 'Licensed Cinematic Cyberpunk Score',
      Turnaround: '72 Hours',
    },
    highlights: [
      'Storyline scripting and voiceover curation',
      'Custom weather and lightning particle enhancements',
      'High-impact cinematic sound design',
    ],
  },
  'stream-hud': {
    title: 'Apex Predator Stream HUD & Overlay',
    category: 'Stream Pack & Overlays',
    tags: ['OBS Ready', '60FPS Stinger', 'Webcam Frame', 'Alerts'],
    gradientClass: 'grad-6',
    icon: 'fa-tv',
    description:
      'A high-tech cyberpunk HUD stream pack tailored for Twitch and YouTube Gaming streamers. Includes Starting Soon, BRB, Stream Ending scenes, animated webcam border, recent subscriber/donation ticker, and custom sound stingers.',
    specs: {
      Format: 'WebM 60FPS (Optimized <5% CPU usage)',
      Platform: 'OBS Studio, Streamlabs, Twitch Studio',
      Audio: 'Included Stinger Sound Effects',
      Turnaround: '48 Hours',
    },
    highlights: [
      '1-Click OBS Scene Collection import',
      'Ultra-lightweight rendering with no stream lag',
      'Modular layout adaptable to any game aspect ratio',
    ],
  },
};

function initPortfolioFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const portfolioCards = document.querySelectorAll('.portfolio-card');

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      playSfx('click');

      const filter = btn.getAttribute('data-filter');

      portfolioCards.forEach((card) => {
        const category = card.getAttribute('data-category');
        if (filter === 'all' || category === filter) {
          card.style.display = 'flex';
          card.style.animation = 'fadeIn 0.35s ease forwards';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

function openModal(projectId) {
  const modal = document.getElementById('projectModal');
  const modalBody = document.getElementById('modalBody');
  const project = portfolioData[projectId];

  if (!modal || !modalBody || !project) return;
  playSfx('open');

  const tagsHtml = project.tags.map((t) => `<span class="tag">${t}</span>`).join(' ');

  const specsHtml = Object.entries(project.specs)
    .map(
      ([key, val]) => `
      <div class="spec-chip">
        <i class="fa-solid fa-microchip"></i>
        <span><strong>${key}:</strong> ${val}</span>
      </div>`
    )
    .join('');

  const highlightsHtml = project.highlights
    .map((h) => `<li><i class="fa-solid fa-check" style="color:var(--cyan);margin-right:8px;"></i>${h}</li>`)
    .join('');

  modalBody.innerHTML = `
    <div class="modal-content-grid">
      <div class="modal-preview-hero ${project.gradientClass}">
        <i class="fa-solid ${project.icon}"></i>
      </div>
      <div class="modal-details">
        <div class="portfolio-tags" style="margin-bottom: 0.8rem;">
          ${tagsHtml}
        </div>
        <h3>${project.title}</h3>
        <p>${project.description}</p>

        <h4 style="font-family:var(--font-display);font-size:1.1rem;margin-bottom:0.8rem;color:#ffffff;">Technical Specifications</h4>
        <div class="modal-spec-row">
          ${specsHtml}
        </div>

        <h4 style="font-family:var(--font-display);font-size:1.1rem;margin-bottom:0.8rem;color:#ffffff;">Key Features</h4>
        <ul style="display:flex;flex-direction:column;gap:0.6rem;margin-bottom:2rem;color:var(--text-muted);font-size:0.92rem;">
          ${highlightsHtml}
        </ul>

        <div style="display:flex;gap:1rem;flex-wrap:wrap;">
          <button class="btn btn-primary glow-effect" onclick="orderSimilarProject('${project.category}')">
            <i class="fa-solid fa-bolt"></i> Order Similar Project
          </button>
          <button class="btn btn-secondary" onclick="closeModal()">
            Close Details
          </button>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('projectModal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
  playSfx('click');
}

// Close modal on Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

function orderSimilarProject(category) {
  closeModal();
  const contactSelect = document.getElementById('contactService');
  if (contactSelect) {
    for (let i = 0; i < contactSelect.options.length; i++) {
      if (
        contactSelect.options[i].text.toLowerCase().includes(category.toLowerCase()) ||
        contactSelect.options[i].value.toLowerCase().includes(category.toLowerCase())
      ) {
        contactSelect.selectedIndex = i;
        break;
      }
    }
  }

  const messageBox = document.getElementById('message');
  if (messageBox) {
    messageBox.value = `Hi C4S Studio! I was impressed by your "${category}" showcase and would love to start a similar project.`;
  }

  const contactSection = document.getElementById('contact');
  if (contactSection) {
    contactSection.scrollIntoView({ behavior: 'smooth' });
  }

  showToast(`Selected "${category}" for your inquiry!`);
}

/* ==========================================================================
   7. INTERACTIVE PROJECT COST ESTIMATOR
   ========================================================================== */
function initCostEstimator() {
  const serviceChips = document.querySelectorAll('.calc-chip');
  const durationSlider = document.getElementById('durationSlider');
  const durationValue = document.getElementById('durationValue');
  const addonCheckboxes = document.querySelectorAll('.addon-checkbox');

  const totalEstimate = document.getElementById('totalEstimate');
  const lkrEstimate = document.getElementById('lkrEstimate');
  const summaryService = document.getElementById('summaryService');
  const summaryDuration = document.getElementById('summaryDuration');
  const summaryAddons = document.getElementById('summaryAddons');

  if (!totalEstimate) return;

  function calculate() {
    // 1. Base Service Price
    const activeChip = document.querySelector('.calc-chip.active');
    const basePrice = parseInt(activeChip?.getAttribute('data-cost') || '25', 10);
    const serviceName = activeChip?.getAttribute('data-service') || 'Gaming Montage';

    // 2. Duration / Scale Multiplier
    const duration = parseInt(durationSlider?.value || '3', 10);
    if (durationValue) durationValue.textContent = duration;

    // Small scale factor: $5 per extra minute/asset above 1
    const durationFactor = (duration - 1) * 5;

    // 3. Add-ons
    let addonsTotal = 0;
    const selectedAddonNames = [];
    addonCheckboxes.forEach((cb) => {
      if (cb.checked) {
        addonsTotal += parseInt(cb.value, 10);
        selectedAddonNames.push(cb.getAttribute('data-name'));
      }
    });

    const finalUSD = basePrice + durationFactor + addonsTotal;
    const approxLKR = (finalUSD * 305).toLocaleString(); // 1 USD ≈ 305 LKR

    totalEstimate.textContent = finalUSD;
    if (lkrEstimate) lkrEstimate.textContent = `රු ${approxLKR} LKR`;

    if (summaryService) summaryService.textContent = serviceName;
    if (summaryDuration) summaryDuration.textContent = `${duration} Minutes / Assets`;
    if (summaryAddons) {
      summaryAddons.textContent = selectedAddonNames.length > 0 ? selectedAddonNames.join(', ') : 'None';
    }
  }

  // Event Listeners
  serviceChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      serviceChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      playSfx('click');
      calculate();
    });
  });

  if (durationSlider) {
    durationSlider.addEventListener('input', calculate);
  }

  addonCheckboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      playSfx('click');
      calculate();
    });
  });

  // Initial calculation
  calculate();
}

function proceedWithEstimate() {
  const service = document.getElementById('summaryService')?.textContent || 'Gaming Montage';
  const duration = document.getElementById('summaryDuration')?.textContent || '3 Minutes';
  const addons = document.getElementById('summaryAddons')?.textContent || 'None';
  const total = document.getElementById('totalEstimate')?.textContent || '40';
  const lkr = document.getElementById('lkrEstimate')?.textContent || 'රු 12,000 LKR';

  // Fill in contact form
  const contactSelect = document.getElementById('contactService');
  if (contactSelect) {
    for (let i = 0; i < contactSelect.options.length; i++) {
      if (contactSelect.options[i].text.toLowerCase().includes(service.toLowerCase())) {
        contactSelect.selectedIndex = i;
        break;
      }
    }
  }

  const budgetSelect = document.getElementById('budget');
  if (budgetSelect) {
    const totalNum = parseInt(total, 10);
    if (totalNum <= 50) budgetSelect.value = '$25 - $50';
    else if (totalNum <= 100) budgetSelect.value = '$50 - $100';
    else if (totalNum <= 250) budgetSelect.value = '$100 - $250';
    else budgetSelect.value = '$250+';
  }

  const messageBox = document.getElementById('message');
  if (messageBox) {
    messageBox.value = `[Estimator Booking Request]\nService: ${service}\nScale/Duration: ${duration}\nAdd-ons: ${addons}\nEstimated Total: $${total} USD (Approx. ${lkr})\n\nProject vision / Footage link: `;
  }

  const contactSection = document.getElementById('contact');
  if (contactSection) {
    contactSection.scrollIntoView({ behavior: 'smooth' });
  }

  showToast('Estimate transferred to the booking form below!');
  playSfx('success');
}

/* ==========================================================================
   8. FAQ ACCORDION
   ========================================================================== */
function initFaqAccordion() {
  const accordionHeaders = document.querySelectorAll('.accordion-header');

  accordionHeaders.forEach((header) => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const isActive = item.classList.contains('active');

      // Close all other items
      document.querySelectorAll('.accordion-item').forEach((i) => {
        i.classList.remove('active');
      });

      if (!isActive) {
        item.classList.add('active');
        playSfx('click');
      }
    });
  });
}

/* ==========================================================================
   9. CONTACT FORM HANDLING
   ========================================================================== */
function handleContactSubmit(event) {
  event.preventDefault();
  const form = document.getElementById('contactForm');
  const successBox = document.getElementById('formSuccessMessage');
  const submitBtn = form.querySelector('button[type="submit"]');

  if (!form || !successBox) return;

  const originalContent = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Transmitting...</span>';

  setTimeout(() => {
    form.style.display = 'none';
    successBox.classList.add('visible');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalContent;
    playSfx('success');
    showToast('Inquiry successfully sent to C4S Studio!');
  }, 1000);
}

function resetContactForm() {
  const form = document.getElementById('contactForm');
  const successBox = document.getElementById('formSuccessMessage');
  if (form && successBox) {
    form.reset();
    form.style.display = 'block';
    successBox.classList.remove('visible');
    playSfx('click');
  }
}

/* ==========================================================================
   10. TOAST NOTIFICATION UTILITY
   ========================================================================== */
let toastTimeout;
function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  if (!toast || !toastMessage) return;

  clearTimeout(toastTimeout);
  toastMessage.textContent = message;
  toast.classList.add('show');

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

/* ==========================================================================
   11. PROCEDURAL AUDIO SYNTHESIZER (Web Audio API)
   ========================================================================== */
let audioCtx = null;
let soundEnabled = true;

function initAudioSynthesizer() {
  const audioToggle = document.getElementById('audioToggle');
  const soundIcon = document.getElementById('soundIcon');

  if (!audioToggle) return;

  audioToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (soundIcon) {
      soundIcon.className = soundEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    }
    showToast(soundEnabled ? 'Studio sound effects enabled' : 'Sound effects muted');
    if (soundEnabled) playSfx('click');
  });
}

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSfx(type) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'click') {
      // Subtle high-tech beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'open') {
      // Futuristic swell / blip
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'success') {
      // Dual-tone harmonic chime
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.09); // E5

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.09); // G5
      gain2.gain.setValueAtTime(0.04, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.25);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.35);
    }
  } catch (err) {
    // Ignore audio autoplay restrictions
  }
}

// Ensure global accessibility for inline HTML event handlers
window.openModal = openModal;
window.closeModal = closeModal;
window.orderSimilarProject = orderSimilarProject;
window.proceedWithEstimate = proceedWithEstimate;
window.handleContactSubmit = handleContactSubmit;
window.resetContactForm = resetContactForm;
window.showToast = showToast;

