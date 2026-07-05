document.getElementById("year").textContent = new Date().getFullYear();

const projects = [
  { title: "Northline Rebrand", category: "design", tag: "Brand Identity", desc: "Full identity system for a boutique coffee roaster: logo, packaging, and social templates." },
  { title: "Summer Launch Reel", category: "video", tag: "Social Reel", desc: "15-second product launch edit with motion titles and synced sound design." },
  { title: "Coastline Wedding Film", category: "film", tag: "Wedding Film", desc: "Multi-camera wedding highlight film, shot and color graded for a cinematic feel." },
  { title: "Menu & Print Set", category: "design", tag: "Print Design", desc: "Restaurant menu and table collateral, printed in two languages." },
  { title: "Founder Interview Series", category: "film", tag: "Interview", desc: "Three-part interview series shot on location with natural light setups." },
  { title: "Product Ad Cutdown", category: "video", tag: "Ad Edit", desc: "60s hero ad cut down into three social-ready lengths with color grading." },
  { title: "Event Highlight Reel", category: "film", tag: "Event", desc: "Same-day highlight edit delivered for a live conference recap." },
  { title: "App Icon & Store Kit", category: "design", tag: "UI Design", desc: "App icon set and App Store screenshot kit for a mobile launch." },
  { title: "Music Video Edit", category: "video", tag: "Music Video", desc: "Full edit and grade for an independent artist's single release." }
];

const grid = document.getElementById("workGrid");

function renderProjects(filter) {
  grid.innerHTML = "";
  projects.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "work-card";
    card.dataset.category = p.category;
    if (filter !== "all" && p.category !== filter) card.classList.add("hidden");
    card.innerHTML = `
      <div class="work-thumb">${p.tag}</div>
      <div class="work-overlay">
        <span class="work-tag">${p.category}</span>
        <div class="work-title">${p.title}</div>
        <div class="work-desc">${p.desc}</div>
      </div>
    `;
    card.addEventListener("click", () => openLightbox(p));
    grid.appendChild(card);
  });
}

renderProjects("all");

document.getElementById("filters").addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderProjects(btn.dataset.filter);
});

const lightbox = document.getElementById("lightbox");
const lightboxMedia = document.getElementById("lightboxMedia");
const lightboxTitle = document.getElementById("lightboxTitle");
const lightboxDesc = document.getElementById("lightboxDesc");

function openLightbox(p) {
  lightboxMedia.textContent = p.tag + " — media placeholder";
  lightboxTitle.textContent = p.title;
  lightboxDesc.textContent = p.desc;
  lightbox.classList.add("open");
}

document.getElementById("lightboxClose").addEventListener("click", () => {
  lightbox.classList.remove("open");
});

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.classList.remove("open");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") lightbox.classList.remove("open");
});

const navToggle = document.getElementById("navToggle");
const nav = document.getElementById("nav");

navToggle.addEventListener("click", () => {
  nav.classList.toggle("mobile-open");
});

document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => nav.classList.remove("mobile-open"));
});

document.getElementById("contactForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const type = document.getElementById("type").value;
  const message = document.getElementById("message").value;
  const subject = encodeURIComponent(`Project inquiry: ${type}`);
  const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nProject type: ${type}\n\n${message}`);
  window.location.href = `mailto:hello@example.com?subject=${subject}&body=${body}`;
});
