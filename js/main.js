// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Mobile nav toggle
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");
toggle.addEventListener("click", () => nav.classList.toggle("open"));
nav.addEventListener("click", (e) => {
  if (e.target.closest("a")) nav.classList.remove("open");
});

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
