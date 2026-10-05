/**
 * C4S STUDIO — Firebase Integration Module
 * Handles: Google Auth, Firestore Gallery, Real-time updates
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCAR-h67q3M8-7cRB5mOcY9KqJYeShWonU",
  authDomain: "mr-gaming-c4s-website.firebaseapp.com",
  projectId: "mr-gaming-c4s-website",
  storageBucket: "mr-gaming-c4s-website.firebasestorage.app",
  messagingSenderId: "310015601996",
  appId: "1:310015601996:web:3533dc2ea5fa60d7fc33e9",
  measurementId: "G-QPMRKCRMQY"
};

const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth      = getAuth(app);
const db        = getFirestore(app);

window.C4S_Firebase = { auth, db, GoogleAuthProvider, signInWithPopup, signOut };

// Gallery State
let allGalleryItems      = [];
let currentLightboxIndex = 0;
let currentFilter        = 'all';

// Auth State Listener
onAuthStateChanged(auth, (user) => {
  renderAuthWidgets(user);
  loadGallery();
});

// Google SVG helper
function googleSVG() {
  return `<svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>`;
}

// Render Auth Widgets
function renderAuthWidgets(user) {
  const headerContainer = document.getElementById('headerAuthContainer');
  const mobileContainer = document.getElementById('mobileAuthContainer');
  if (!headerContainer) return;

  if (user) {
    const avatar = user.photoURL
      ? `<img src="${user.photoURL}" alt="${user.displayName}" class="auth-avatar">`
      : `<div class="auth-avatar-placeholder"><i class="fa-solid fa-user"></i></div>`;

    headerContainer.innerHTML = `
      <div class="auth-user-widget" id="authUserWidget">
        ${avatar}
        <span class="auth-user-name">${(user.displayName || 'User').split(' ')[0]}</span>
        <div class="auth-dropdown" id="authDropdown">
          <div class="auth-dropdown-header">
            <strong>${user.displayName || ''}</strong>
            <small>${user.email}</small>
          </div>
          ${isAdmin(user) ? `<a href="admin.html" class="auth-dropdown-item admin-link"><i class="fa-solid fa-shield-halved"></i> Admin Panel</a>` : ''}
          <button class="auth-dropdown-item signout-btn" onclick="window.C4S_signOut()">
            <i class="fa-solid fa-right-from-bracket"></i> Sign Out
          </button>
        </div>
      </div>`;

    if (mobileContainer) {
      mobileContainer.innerHTML = `
        <div class="mobile-user-info">
          ${avatar}
          <div class="mobile-user-text">
            <strong>${user.displayName || ''}</strong>
            <small>${user.email}</small>
          </div>
        </div>
        ${isAdmin(user) ? `<a href="admin.html" class="btn btn-sm btn-primary mobile-admin-btn"><i class="fa-solid fa-shield-halved"></i> Admin Panel</a>` : ''}
        <button class="btn btn-sm btn-secondary mobile-signout-btn" onclick="window.C4S_signOut()">
          <i class="fa-solid fa-right-from-bracket"></i> Sign Out
        </button>`;
    }

    // Dropdown toggle
    setTimeout(() => {
      const widget = document.getElementById('authUserWidget');
      if (widget) {
        widget.addEventListener('click', (e) => {
          e.stopPropagation();
          document.getElementById('authDropdown')?.classList.toggle('open');
        });
        document.addEventListener('click', () => {
          document.getElementById('authDropdown')?.classList.remove('open');
        });
      }
    }, 0);

  } else {
    headerContainer.innerHTML = `
      <button class="btn-google-login" id="googleLoginBtn" onclick="window.C4S_signIn()">
        ${googleSVG()} Sign in
      </button>`;

    if (mobileContainer) {
      mobileContainer.innerHTML = `
        <button class="btn btn-google-login btn-block mobile-google-btn" onclick="window.C4S_signIn()">
          ${googleSVG()} Sign in with Google
        </button>`;
    }
  }
}

// Admin check
function isAdmin(user) {
  const adminEmails = ['chulitharv123@gmail.com'];
  return user && adminEmails.includes(user.email);
}

window.C4S_signIn = async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error('Sign in error:', err);
    if (window.showToast) window.showToast('Sign in failed. Please try again.');
  }
};

window.C4S_signOut = async () => {
  try {
    await signOut(auth);
    if (window.showToast) window.showToast('Signed out successfully.');
  } catch (err) {
    console.error('Sign out error:', err);
  }
};

// Load Gallery
function loadGallery() {
  const galleryGrid    = document.getElementById('galleryGrid');
  const galleryLoading = document.getElementById('galleryLoading');
  if (!galleryGrid) return;

  const q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'));

  onSnapshot(q, (snapshot) => {
    allGalleryItems = [];
    snapshot.forEach((doc) => {
      allGalleryItems.push({ id: doc.id, ...doc.data() });
    });
    if (galleryLoading) galleryLoading.style.display = 'none';
    renderGallery(currentFilter);
  }, (err) => {
    console.error('Gallery error:', err);
    if (galleryLoading) galleryLoading.innerHTML = `
      <div style="text-align:center;color:var(--text-muted);padding:3rem 0;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:2.5rem;color:#f59e0b;display:block;margin-bottom:1rem;"></i>
        <p>Could not load gallery. Check Firestore rules or connection.</p>
      </div>`;
  });
}

// Helper to parse YouTube Video IDs
function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

// Render Gallery
function renderGallery(filter) {
  const galleryGrid  = document.getElementById('galleryGrid');
  const galleryEmpty = document.getElementById('galleryEmpty');
  if (!galleryGrid) return;

  currentFilter = filter;

  const filtered = filter === 'all'
    ? allGalleryItems
    : allGalleryItems.filter(i => i.type === filter || i.category === filter);

  if (filtered.length === 0) {
    galleryGrid.innerHTML = '';
    if (galleryEmpty) galleryEmpty.style.display = 'flex';
    return;
  }
  if (galleryEmpty) galleryEmpty.style.display = 'none';

  galleryGrid.innerHTML = filtered.map((item, idx) => {
    const isVideo = item.type === 'video';
    const ytId    = isVideo ? getYouTubeId(item.url) : null;
    const ytThumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '';
    const thumb   = item.thumbnail || ytThumb || item.url || '';
    const tags    = (item.tags || []).map(t => `<span class="gallery-tag">${t}</span>`).join('');
    const fallback = 'https://placehold.co/400x300/1a0533/8b5cf6?text=' + (isVideo ? 'Video' : 'Photo');

    return `
      <div class="gallery-card animate-gallery-in" onclick="window.openGalleryLightbox(${idx})">
        <div class="gallery-thumb-wrap">
          ${isVideo
            ? `<img src="${thumb || fallback}" alt="${item.title || ''}" loading="lazy"
                    onerror="this.src='${fallback}'" class="gallery-thumb-img">
               <div class="gallery-play-btn"><i class="fa-solid fa-play"></i></div>`
            : `<img src="${item.url}" alt="${item.title || ''}" loading="lazy"
                    onerror="this.src='${fallback}'" class="gallery-thumb-img">`
          }
          <div class="gallery-card-overlay">
            <i class="fa-solid fa-expand gallery-expand-icon"></i>
            <span class="gallery-type-badge ${isVideo ? 'badge-video' : 'badge-photo'}">
              <i class="fa-solid ${isVideo ? 'fa-film' : 'fa-image'}"></i>
              ${isVideo ? 'Video' : 'Photo'}
            </span>
          </div>
        </div>
        <div class="gallery-card-info">
          <h4>${item.title || 'Untitled'}</h4>
          ${item.description ? `<p>${item.description}</p>` : ''}
          <div class="gallery-tags-row">${tags}</div>
        </div>
      </div>`;
  }).join('');
}

window.openGalleryLightbox = (idx) => {
  const filtered = currentFilter === 'all'
    ? allGalleryItems
    : allGalleryItems.filter(i => i.type === currentFilter || i.category === currentFilter);

  if (!filtered[idx]) return;
  currentLightboxIndex = idx;

  const lightbox = document.getElementById('galleryLightbox');
  if (lightbox) {
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderLightboxItem(filtered, idx);
  }
};

function renderLightboxItem(items, idx) {
  const item  = items[idx];
  const media = document.getElementById('lightboxMedia');
  const info  = document.getElementById('lightboxInfo');
  const prev  = document.getElementById('lightboxPrev');
  const next  = document.getElementById('lightboxNext');
  if (!media || !item) return;

  if (item.type === 'video') {
    const ytId = getYouTubeId(item.url);
    if (ytId) {
      media.innerHTML = `<iframe class="lightbox-video" style="aspect-ratio:16/9;width:100%;min-height:360px;max-height:70vh;border:0;border-radius:var(--radius-lg);" src="https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else {
      media.innerHTML = `<video controls autoplay class="lightbox-video"><source src="${item.url}" type="video/mp4">Your browser does not support video.</video>`;
    }
  } else {
    media.innerHTML = `<img src="${item.url}" alt="${item.title || ''}" class="lightbox-image">`;
  }

  if (info) {
    const tags = (item.tags || []).map(t => `<span class="gallery-tag">${t}</span>`).join('');
    info.innerHTML = `
      <h3>${item.title || 'Untitled'}</h3>
      ${item.description ? `<p>${item.description}</p>` : ''}
      <div class="gallery-tags-row">${tags}</div>
      <small style="color:var(--text-muted)">${idx + 1} / ${items.length}</small>`;
  }

  if (prev) prev.style.display = idx === 0 ? 'none' : 'flex';
  if (next) next.style.display = idx === items.length - 1 ? 'none' : 'flex';
}

function navigateLightbox(dir) {
  const filtered = currentFilter === 'all'
    ? allGalleryItems
    : allGalleryItems.filter(i => i.type === currentFilter || i.category === currentFilter);

  const newIdx = currentLightboxIndex + dir;
  if (newIdx < 0 || newIdx >= filtered.length) return;
  currentLightboxIndex = newIdx;
  renderLightboxItem(filtered, newIdx);
}

function closeLightbox() {
  const lightbox = document.getElementById('galleryLightbox');
  if (lightbox) lightbox.classList.remove('open');
  document.body.style.overflow = '';
  const media = document.getElementById('lightboxMedia');
  if (media) media.innerHTML = '';
}

window.closeLightbox = closeLightbox;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('lightboxClose')?.addEventListener('click', closeLightbox);
  document.getElementById('lightboxBackdrop')?.addEventListener('click', closeLightbox);
  document.getElementById('lightboxPrev')?.addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('lightboxNext')?.addEventListener('click', () => navigateLightbox(1));

  const tabs = document.querySelectorAll('.gallery-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderGallery(tab.getAttribute('data-gfilter'));
    });
  });
});

document.addEventListener('keydown', (e) => {
  const lightbox = document.getElementById('galleryLightbox');
  if (!lightbox?.classList.contains('open')) return;
  if (e.key === 'ArrowLeft')  navigateLightbox(-1);
  if (e.key === 'ArrowRight') navigateLightbox(1);
  if (e.key === 'Escape')     closeLightbox();
});
