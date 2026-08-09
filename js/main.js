// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Mobile nav toggle
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");
toggle.addEventListener("click", () => nav.classList.toggle("open"));
nav.addEventListener("click", (e) => {
  if (e.target.closest("a")) nav.classList.remove("open");
});

// Lightbox: click any Past Work / Studio Sale image to enlarge
const lightbox = document.getElementById("lightbox");
if (lightbox) {
  const lbImg = document.getElementById("lightbox-img");
  const closeBtn = document.getElementById("lightbox-close");
  const prevBtn = document.getElementById("lightbox-prev");
  const nextBtn = document.getElementById("lightbox-next");
  let group = [];
  let idx = 0;

  const show = () => {
    const img = group[idx];
    if (!img) return;
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt || "Artwork by Nate Stegemiller";
  };
  const syncArrows = () => {
    const multi = group.length > 1;
    prevBtn.style.display = multi ? "" : "none";
    nextBtn.style.display = multi ? "" : "none";
  };
  const openAt = (list, i) => {
    group = list;
    idx = i;
    show();
    syncArrows();
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lb-open");
  };
  const close = () => {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lb-open");
    lbImg.src = "";
  };
  const step = (d) => {
    if (group.length < 2) return;
    idx = (idx + d + group.length) % group.length;
    show();
  };

  const galleryImgs = [...document.querySelectorAll(".gallery figure img")];
  const saleImgs = [...document.querySelectorAll(".sale-item .artframe img")];
  galleryImgs.forEach((img, i) => img.addEventListener("click", () => openAt(galleryImgs, i)));
  saleImgs.forEach((img, i) => img.addEventListener("click", () => openAt(saleImgs, i)));

  prevBtn.addEventListener("click", (e) => { e.stopPropagation(); step(-1); });
  nextBtn.addEventListener("click", (e) => { e.stopPropagation(); step(1); });

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target === closeBtn) close();
  });
  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });
}

// Gallery carousel: arrows + "See all work" expand toggle
const gallery = document.getElementById("gallery");
if (gallery) {
  const wrap = document.getElementById("gallery-carousel");
  const prev = document.getElementById("gallery-prev");
  const next = document.getElementById("gallery-next");
  const toggle = document.getElementById("gallery-toggle");

  const step = () => Math.max(240, gallery.clientWidth * 0.8);
  if (prev) prev.addEventListener("click", () => gallery.scrollBy({ left: -step(), behavior: "smooth" }));
  if (next) next.addEventListener("click", () => gallery.scrollBy({ left: step(), behavior: "smooth" }));

  if (toggle) {
    toggle.addEventListener("click", () => {
      const expanded = gallery.classList.toggle("show-all");
      wrap.classList.toggle("expanded", expanded);
      toggle.textContent = expanded ? "Show less" : "See all work";
      if (!expanded) document.getElementById("work").scrollIntoView({ behavior: "smooth" });
    });
  }
}

// Inquiry form (FormSubmit) — submits in-page, no email app
const FORM_ENDPOINT = "https://formsubmit.co/ajax/natesteg.art@gmail.com";

function makeRef() {
  // Unique, human-readable reference, e.g. NS-LXK4-9F2A
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.floor(Math.random() * 0xffff).toString(36).toUpperCase().padStart(3, "0");
  return `NS-${t.slice(-4)}-${r}`;
}

// Studio Sale "Inquire to buy" → pre-tag the form with that piece's unique ID
document.querySelectorAll(".js-buy").forEach((btn) => {
  btn.addEventListener("click", () => {
    const piece = btn.getAttribute("data-piece") || "";
    const topic = document.getElementById("f-subject");
    const regarding = document.getElementById("f-regarding");
    if (topic) topic.value = "Studio Sale";
    if (regarding) regarding.value = piece;
    document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => document.getElementById("f-name").focus(), 500);
  });
});

const form = document.getElementById("inquiry-form");
if (form) {
  const note = document.getElementById("form-note");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("input", (e) => e.target.classList.remove("field-error"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const topic = form.topic.value;
    const regarding = form.regarding.value.trim();
    const message = form.message.value.trim();

    let invalid = null;
    if (!name) invalid = form.name;
    else if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) invalid = form.email;
    else if (!message) invalid = form.message;
    if (invalid) {
      invalid.focus();
      invalid.classList.add("field-error");
      return;
    }

    const ref = makeRef();
    const payload = {
      name,
      email,
      topic,
      regarding: regarding || "—",
      reference: ref,
      message,
      _subject: `${topic} inquiry — ${ref}${regarding ? " · " + regarding : ""}`,
      _template: "table",
      _captcha: "false",
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.success === "true" || data.success === true)) {
        form.reset();
        note.innerHTML = `Thank you — your inquiry is in. Your reference is <strong>${ref}</strong>; I'll be in touch soon.`;
        note.classList.add("form-note-sent");
        submitBtn.style.display = "none";
      } else if ((data.message || "").toLowerCase().includes("activat")) {
        // One-time FormSubmit activation pending (owner setup only)
        submitBtn.disabled = false;
        submitBtn.textContent = "Send inquiry";
        note.textContent =
          "Form setup is being activated — please try again in a moment.";
        note.classList.add("form-note-error");
      } else {
        throw new Error("send failed");
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send inquiry";
      note.innerHTML =
        `Something went wrong sending that. Please email me directly at ` +
        `<a href="mailto:natesteg.art@gmail.com">natesteg.art@gmail.com</a> (reference ${ref}).`;
      note.classList.add("form-note-error");
    }
  });
}
