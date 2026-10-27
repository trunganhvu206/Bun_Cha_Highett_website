// "Ask us" AI assistant widget. Talks to /api/chat on the booking server (chat.js).
// Uses esc() and telHref from script.js.

(function () {
  const launcher = document.getElementById("chat-launcher");
  const panel = document.getElementById("chat-panel");
  const log = document.getElementById("chat-log");
  const chatForm = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const suggest = document.getElementById("chat-suggest");
  const history = []; // { role: "user" | "assistant", content }
  let busy = false;

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", open);
    launcher.classList.toggle("is-open", open);
    if (open) input.focus();
    else launcher.focus();
  }

  launcher.addEventListener("click", () => setOpen(panel.hidden));
  document.getElementById("chat-close").addEventListener("click", () => setOpen(false));
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  // Plain text with line breaks; phone numbers and emails become tappable links.
  function format(text) {
    return esc(text)
      .replace(/\b([\w.+-]+@[\w-]+\.[\w.]+)\b/g, '<a href="mailto:$1">$1</a>')
      .replace(/\b(0\d(?:[ ]?\d){8})\b/g, (m) => `<a href="tel:${m.replace(/\s/g, "")}">${m}</a>`)
      .replace(/\n/g, "<br>");
  }

  function addMessage(role, html) {
    const div = document.createElement("div");
    div.className = `chat-msg ${role === "user" ? "chat-user" : "chat-bot"}`;
    div.innerHTML = html;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  async function ask(question) {
    if (busy || !question.trim()) return;
    busy = true;
    suggest.hidden = true;
    addMessage("user", esc(question));
    history.push({ role: "user", content: question });
    const typing = addMessage("assistant", `<span class="chat-typing" aria-label="Assistant is typing"><i></i><i></i><i></i></span>`);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-19) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "unavailable");
      typing.innerHTML = format(data.reply);
      history.push({ role: "assistant", content: data.reply });
    } catch (err) {
      history.pop(); // keep user/assistant turns alternating
      typing.innerHTML = `${esc(err.message === "unavailable" || err.message === "Failed to fetch"
        ? "Sorry, I'm not available right now."
        : err.message)} You can call us on <a href="${telHref}">${esc(RESTAURANT.phone)}</a>.`;
    } finally {
      busy = false;
      log.scrollTop = log.scrollHeight;
    }
  }

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value;
    input.value = "";
    ask(q);
  });

  suggest.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn) ask(btn.textContent);
  });
})();
